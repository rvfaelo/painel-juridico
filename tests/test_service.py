"""Testes locais: nenhuma chamada real a DataJud/DJEN nem dados de clientes."""
import http.client
import io
from contextlib import closing, redirect_stdout
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import unittest
import urllib.request
from types import SimpleNamespace
from unittest.mock import patch

from service.connectors import (
    SourceError, cnj_alias, consult_datajud, consult_djen, parse_datajud_page,
    valid_cnj, fingerprint, probe_public_sources, preview_datajud,
    json_request,
    djen_certificate_url, fetch_djen_certificate, _DjenCertificateRedirect,
)
from service.main import Handler, Server, Worker, main
from service.store import Store


def cnj(seq=1, year=2026, justice=8, court=19, origin=1):
    base = f"{seq:07d}{year:04d}{justice}{court:02d}{origin:04d}"
    check = 98 - int(base + "00") % 97
    return base[:7] + f"{check:02d}" + base[7:]


def movement(event_id, text="Conclusão ao relator", when="2026-11-03T10:00:00"):
    return {
        "id": event_id, "tramitationId": "datajud:tram1", "source": "datajud",
        "occurredAt": when, "text": text,
        "sourceUpdatedAt": "2026-11-04T10:00:00",
        "digest": fingerprint({"id": event_id, "text": text, "when": when}),
        "kind": "movement",
    }


def result(*movements, status="success"):
    return {
        "status": status, "source": "datajud", "events": list(movements),
        "tramitations": [{"id": "datajud:tram1", "tribunal": "TJRJ",
                          "grau": "1", "sistema": "PJe"}],
        "documents": [], "sourceUpdatedAt": "2026-11-04T10:00:00",
        "limitation": "Apenas dados publicos",
    }


class OriginMatrixTests(unittest.TestCase):
    def handler(self, origin, site, token):
        handler = object.__new__(Handler)
        handler.headers = {}
        if origin is not None:
            handler.headers['Origin'] = origin
        if site:
            handler.headers['Sec-Fetch-Site'] = site
        if token is not None:
            handler.headers['X-Pauta-CSRF'] = token
        handler.server = SimpleNamespace(origin='http://127.0.0.1:8766',
                                         csrf='token-right')
        return handler

    def test_allowed_origin_truth_table(self):
        origins = {'equal': 'http://127.0.0.1:8766', 'none': None,
                   'other': 'https://evil.test'}
        sites = ('', 'same-origin', 'cross-site', 'none')
        tokens = {'right': 'token-right', 'wrong': 'token-wrong', 'absent': None}
        checked = 0
        for origin_case, origin in origins.items():
            for site in sites:
                for token_case, token in tokens.items():
                    # Tabela-verdade: outro Origin ou cross-site sempre nega;
                    # Sec-Fetch-Site: none só aceita Origin ausente e CSRF certo;
                    # vazio/same-origin mantém o comportamento anterior.
                    expected = (
                        origin_case != 'other' and site != 'cross-site'
                        and (site != 'none' or (
                            origin_case == 'none' and token_case == 'right'))
                    )
                    got = Handler.allowed_origin(self.handler(origin, site, token))
                    self.assertEqual(
                        got, expected,
                        f'origin={origin_case} site={site or "(vazio)"} csrf={token_case}')
                    checked += 1
        self.assertEqual(checked, 36)


class CNJTests(unittest.TestCase):
    def test_datajud_http_200_incompleto_nao_significa_nao_encontrado(self):
        number = cnj()
        hit = {"_id": "example", "_source": {"numeroProcesso": number, "tribunal": "TJRJ",
               "grau": "G1", "movimentos": []}}
        for flags in ({"timed_out": True}, {"_shards": {"failed": 1}}):
            with self.subTest(flags=flags), self.assertRaises(SourceError) as caught:
                parse_datajud_page({**flags, "hits": {"total": 0, "hits": []}}, number)
            self.assertEqual(caught.exception.status, "unavailable")
            self.assertTrue(caught.exception.retryable)
            total, uncertain, tram, events = parse_datajud_page(
                {**flags, "hits": {"total": {"value": 1, "relation": "eq"}, "hits": [hit]}}, number)
            self.assertEqual((total, uncertain, len(tram), len(events)), (1, True, 1, 0))

    def test_datajud_retenta_uma_vez_incompleto_sem_dados(self):
        number = cnj()
        response_payload = {"hits": {"total": {"value": 1, "relation": "eq"}, "hits": [{
            "_id": "retry", "_source": {"numeroProcesso": number, "tribunal": "TJRJ",
            "grau": "G1", "movimentos": []}}]}}
        calls = []

        def requester(url, payload=None, headers=None):
            calls.append(url)
            if len(calls) == 1:
                raise SourceError("unavailable", "busca incompleta", retryable=True)
            return response_payload

        with patch("service.connectors.time.sleep") as sleep:
            result = consult_datajud(number, requester=requester)
        self.assertEqual(result["status"], "success")
        self.assertEqual(len(calls), 2)
        sleep.assert_called_once_with(1)

    def test_timeout_datajud_independente_do_djen_e_sem_retry_lento(self):
        with patch("urllib.request.OpenerDirector.open", side_effect=TimeoutError) as request:
            with self.assertRaises(SourceError) as caught:
                json_request("https://comunicaapi.pje.jus.br/api/v1/comunicacao")
            self.assertEqual(request.call_args.kwargs["timeout"], 18)
            self.assertTrue(caught.exception.retryable)
            request.reset_mock()
            with self.assertRaises(SourceError):
                json_request("https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search")
            request.assert_not_called()

    def test_datajud_429_e_504_respeitam_retry_after(self):
        import httpx
        from service.datajud_mcp import request_datajud
        url = "https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search"
        for code, retry in [(429, True), (504, True)]:
            response = httpx.Response(code, headers={"Retry-After": "30"}, request=httpx.Request("POST", url))
            error = httpx.HTTPStatusError("test", request=response.request, response=response)
            with self.subTest(code=code), patch("httpx.AsyncClient.request", side_effect=error):
                with self.assertRaises(SourceError) as caught:
                    request_datajud(url)
                self.assertEqual(caught.exception.retryable, retry)
                self.assertEqual(caught.exception.retry_after, 30)

    def test_reconhece_tjrj_trf2_tjsp_com_verificador(self):
        self.assertEqual(cnj_alias(cnj(court=19)), "tjrj")
        self.assertEqual(cnj_alias(cnj(justice=4, court=2)), "trf2")
        self.assertEqual(cnj_alias(cnj(court=26)), "tjsp")
        self.assertEqual(cnj_alias(cnj(justice=3, court=0)), "stj")
        self.assertEqual(cnj_alias(cnj(justice=1, court=0)), "")
        self.assertFalse(valid_cnj(cnj(court=19)[:7] + "00" + cnj(court=19)[9:]))

    def test_aliases_oficiais_multiplas_justicas(self):
        for justice, court, expected in [
            (8, 1, "tjac"), (8, 7, "tjdft"), (8, 27, "tjto"),
            (4, 1, "trf1"), (4, 6, "trf6"),
            (5, 0, "tst"), (5, 1, "trt1"), (5, 24, "trt24"),
            (6, 0, "tse"), (6, 7, "tre-dft"), (6, 26, "tre-sp"),
            (3, 0, "stj"), (7, 0, "stm"),
            (9, 13, "tjmmg"), (9, 21, "tjmrs"), (9, 26, "tjmsp"),
        ]:
            with self.subTest(justice=justice, court=court):
                self.assertEqual(cnj_alias(cnj(justice=justice, court=court)), expected)
        for justice, court in [(1, 0), (2, 0), (8, 28), (4, 7), (5, 25), (6, 28), (9, 19)]:
            self.assertEqual(cnj_alias(cnj(justice=justice, court=court)), "")

    def test_diagnostico_remoto_nao_consulta_carteira(self):
        calls = []
        def fake(url, **options):
            calls.append((url, options))
            return ({"hits": {"hits": []}} if "datajud" in url else
                    {"items": [], "count": 0})
        results = probe_public_sources("public-key", fake)
        self.assertEqual([x["status"] for x in results], ["reachable", "reachable"])
        self.assertEqual(calls[0][1]["payload"], {"size": 0, "query": {"match_none": {}}})
        self.assertEqual(calls[0][1]["headers"]["Authorization"], "APIKey public-key")
        self.assertNotIn("numeroProcesso", calls[1][0])
        self.assertNotIn("numeroOab", calls[1][0])
        self.assertEqual(calls[0][1]["timeout"], 120)
        self.assertEqual(calls[1][1]["timeout"], 8)

    def test_diagnostico_distingue_limite_http_429(self):
        def fake(url, **options):
            if "datajud" in url:
                raise SourceError("unavailable", "Fonte respondeu HTTP 429.", retryable=True)
            return {"items": [], "count": 0}
        results = probe_public_sources(requester=fake)
        self.assertEqual(results[0]["status"], "rate_limited")
        self.assertIn("Aguarde", results[0]["message"])
        self.assertEqual(results[1]["status"], "reachable")

    def test_previa_datajud_preserva_registros_e_metadados(self):
        number = cnj()
        calls = []
        def fake(value, key):
            calls.append((value, key))
            return {"status": "success", "tramitations": [
                {"id": "datajud:g1", "tribunal": "TJRJ", "grau": "G1", "sistema": "PJe",
                 "classe": {"codigo": 7, "nome": "Procedimento Comum Cível"},
                 "assuntos": [{"nome": "Obrigação de Fazer"}, {"codigo": 123}],
                 "orgao": {"nome": "2ª Vara Cível"},
                 "dataAjuizamento": "2025-01-02", "ultimaAtualizacaoFonte": "2026-11-05"},
                {"id": "datajud:g2", "tribunal": "TJRJ", "grau": "G2",
                 "classe": {"nome": "Apelação"}, "assuntos": [],
                 "orgao": {"nome": "2ª Câmara Cível"}}]}
        result = preview_datajud(number, "secret", fake)
        self.assertEqual(calls, [(number, "secret")])
        self.assertEqual(result["status"], "success")
        self.assertEqual(len(result["records"]), 2)
        self.assertEqual(result["records"][0]["classe"], "Procedimento Comum Cível")
        self.assertEqual(result["records"][0]["assuntos"], ["Obrigação de Fazer"])
        self.assertEqual(result["records"][0]["orgao"], "2ª Vara Cível")
        self.assertEqual(result["records"][1]["grau"], "G2")
        self.assertNotIn("secret", json.dumps(result))
        self.assertNotIn("events", result)

    def test_previa_datajud_vazia_parcial_e_cnj_invalido(self):
        number = cnj()
        none = preview_datajud(number, fetch=lambda *args: {"status": "not_found", "tramitations": []})
        self.assertEqual(none["status"], "not_found")
        self.assertIn("não comprova", none["message"])
        part = preview_datajud(number, fetch=lambda *args: {"status": "partial", "tramitations": [
            {"id": "datajud:1", "orgao": {"nome": "Vara A"}}]})
        self.assertEqual(part["status"], "partial")
        self.assertTrue(part["partial"])
        self.assertEqual(part["records"][0]["tribunal"], "")
        with self.assertRaisesRegex(ValueError, "CNJ válido"):
            preview_datajud("00000000000000000000", fetch=lambda *args: self.fail("Não consultar CNJ inválido"))

    def test_nome_de_sistema_estruturado_e_extraido_sem_dict_python(self):
        number = cnj()
        page = {"hits": {"total": {"value": 1}, "hits": [{"_id": "a", "_source": {
            "numeroProcesso": number, "tribunal": "TJRJ", "sistema": {"codigo": 1, "nome": "PJe"},
            "movimentos": []}}]}}
        received = consult_datajud(number, requester=lambda *args, **kwargs: page)
        self.assertEqual(received["tramitations"][0]["sistema"], "PJe")

    def test_datajud_tramitacoes_nao_sao_achatadas(self):
        number = cnj()
        hit = lambda id, grau, when: {
            "_id": id, "_source": {
                "numeroProcesso": number, "tribunal": "TJRJ", "grau": grau,
                "sistema": {"codigo": 1}, "classe": {"nome": "Procedimento comum"},
                "movimentos": [{"codigo": 1, "nome": "Distribuição", "dataHora": when}],
            }}
        payload = {"hits": {"total": {"value": 2, "relation": "eq"},
                            "hits": [hit("primeiro", "G1", "2026-01-02"),
                                     hit("recurso", "G2", "2026-02-03")]}}
        total, uncertain, tram, events = parse_datajud_page(payload, number)
        self.assertEqual(total, 2)
        self.assertFalse(uncertain)
        self.assertEqual(len(tram), 2)
        self.assertEqual({x["grau"] for x in tram}, {"G1", "G2"})
        self.assertEqual(len({x["tramitationId"] for x in events}), 2)

    def test_datajud_paginas_e_status_parcial(self):
        number = cnj()
        response = lambda n: {"hits": {"total": {"value": 102, "relation": "eq"},
                                        "hits": [{"_id": f"{n}-{i}", "_source": {
                                            "numeroProcesso": number, "grau": "G1", "tribunal": "TJRJ",
                                            "movimentos": []}} for i in range(100 if n == 0 else 2)]}}
        calls = []

        def requester(url, **kwargs):
            self.assertTrue(url.endswith("/api_publica_tjrj/_search"))
            calls.append(kwargs["payload"]["from"])
            return response((kwargs["payload"]["from"] // 100))

        found = consult_datajud(number, requester=requester)
        self.assertEqual(found["status"], "success")
        self.assertEqual(len(found["tramitations"]), 102)
        self.assertEqual(calls, [0, 100])

    def test_datajud_falha_na_segunda_pagina_retorna_parcial(self):
        number = cnj()
        calls = 0
        def requester(url, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise SourceError("unavailable", "429", retryable=True)
            return {"hits": {"total": 101, "hits": [
                {"_id": "id"+str(i), "_source": {"numeroProcesso": number,
                  "movimentos": []}} for i in range(100)]}}
        returned = consult_datajud(number, requester=requester)
        self.assertEqual(returned["status"], "partial")
        self.assertEqual(len(returned["tramitations"]), 100)

    def test_djen_publicacao_texto_externo_nao_vira_html(self):
        number = cnj()

        def requester(url):
            self.assertIn("numeroProcesso", url)
            return {"count": 1, "items": [{"id": "pub1", "numero_processo": number,
                "data_disponibilizacao": "2026-11-03",
                "texto": "<script>alert(1)</script><b>Despacho</b>&amp; ciência",
                "hash": "qo8LEjMv6g2sAodc5TGKzLJRmrz2A1"}]}

        result = consult_djen(number, requester=requester)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["events"][0]["text"], "Despacho & ciência")
        self.assertEqual(result["events"][0]["certificateHash"], "qo8LEjMv6g2sAodc5TGKzLJRmrz2A1")

    def test_certidao_cnj_usa_apenas_hash_e_valida_pdf_na_resposta(self):
        certificate_hash = "qo8LEjMv6g2sAodc5TGKzLJRmrz2A1"
        self.assertEqual(djen_certificate_url(certificate_hash),
                         "https://comunicaapi.pje.jus.br/api/v1/comunicacao/" + certificate_hash + "/certidao")
        for invalid in ("", "abc", "../../outro", "https://site-malicioso.test", "a" * 129):
            with self.subTest(hash=invalid), self.assertRaises(ValueError):
                djen_certificate_url(invalid)

        class Response(io.BytesIO):
            def __init__(self, data):
                super().__init__(data)
                self.headers = {"Content-Type": "application/pdf"}

        class Opener:
            def __init__(self, data):
                self.data = data
                self.called = []
            def open(self, request, timeout=18):
                self.called.append((request.full_url, timeout))
                return Response(self.data)

        fake = Opener(b"%PDF-1.7\nconteudo de teste")
        self.assertTrue(fetch_djen_certificate(certificate_hash, opener=fake).startswith(b"%PDF-"))
        self.assertEqual(fake.called[0][0], djen_certificate_url(certificate_hash))
        for data in (b"<html>bloqueio</html>", b"%PDF-" + b"x" * 8_000_001):
            with self.subTest(size=len(data)), self.assertRaises(SourceError):
                fetch_djen_certificate(certificate_hash, opener=Opener(data))
        with self.assertRaises(SourceError):
            _DjenCertificateRedirect().redirect_request(urllib.request.Request(djen_certificate_url(certificate_hash)),
                None, 302, "Moved", {}, "http://127.0.0.1/segredo")

    def test_campos_ausentes_e_resultado_incompativel(self):
        with self.assertRaises(SourceError) as check:
            parse_datajud_page({"hits": {"hits": []}}, cnj())
        self.assertEqual(check.exception.status, "incompatible")


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(self.tmp.name)
        self.number = cnj()
        self.store.sync_cases([{"id": "case1", "cnj": self.number, "court": "tjrj",
                                "courtLevel": "first", "processSystem": "pje"}])
        self.store.update_settings({"enabled": {"datajud": True}})

    def consult(self, events, *, status="success"):
        self.assertEqual(self.store.enqueue(["case1"], ["datajud"])["count"], 1)
        job = self.store.claim()
        self.assertIsNotNone(job)
        self.store.finish(job, result(*events, status=status))
        return self.store.case_detail("case1")

    def test_baseline_repeticao_novidades_e_correcoes(self):
        first = self.consult([movement("e1"), movement("e2")])
        self.assertEqual(len(first["events"]), 2)
        self.assertEqual(self.store.summary()["unseen"], 0)
        repeat = self.consult([movement("e1"), movement("e2")])
        self.assertEqual(len(repeat["events"]), 2)
        self.assertEqual(self.store.summary()["unseen"], 0)
        new = self.consult([movement("e2"), movement("e3", when="2026-01-01")])
        self.assertEqual(self.store.summary()["unseen"], 1)
        event = next(x for x in new["events"] if x["id"] == "e3")
        self.assertTrue(event["is_new"])
        self.assertEqual(event["occurred_at"], "2026-01-01")
        self.store.mark_seen("case1", "datajud", "e3")
        self.assertEqual(self.store.summary()["unseen"], 0)
        corrected = self.consult([movement("e1", "Conclusão retificada")])
        self.assertEqual(self.store.summary()["unseen"], 1)
        self.assertEqual(next(x for x in corrected["events"] if x["id"] == "e1")["correction_count"], 1)
        self.assertEqual(self.store.summary()["jobs"][0]["added"], 1)

    def test_resultado_parcial_nao_apaga_historico(self):
        self.consult([movement("e1")])
        info = self.consult([], status="partial")
        self.assertEqual(len(info["events"]), 1)
        self.assertEqual(info["consultations"][0]["status"], "partial")

    def test_falha_retentativa_e_cancelamento_preservam_dados(self):
        self.consult([movement("e1")])
        self.store.enqueue(["case1"])
        job = self.store.claim()
        self.store.finish(job, error=SourceError("unavailable", "Timeout", retryable=True))
        self.assertEqual(self.store.summary()["counts"]["queued"], 2)
        self.store.cancel()
        self.assertEqual(self.store.summary()["counts"]["cancelled"], 2)
        self.assertEqual(len(self.store.case_detail("case1")["events"]), 1)

    def test_estado_persistido_e_agendamento_sem_aba(self):
        self.consult([movement("e1")])
        same = Store(self.tmp.name)
        self.assertEqual(len(same.case_detail("case1")["events"]), 1)
        self.store.update_settings({"autoEnabled": True, "autoTimes": ["08:00", "18:00"]})
        self.assertEqual(self.store.scheduled("2026-11-05", "18:01"), 2)
        self.assertEqual(self.store.scheduled("2026-11-05", "18:01"), 0)
        # Fila é observável por outra instância, mesmo com a página fechada.
        self.assertIsNotNone(Store(self.tmp.name).claim())

    def test_agendamento_recupera_ultima_janela_e_inclui_busca_oab(self):
        self.store.update_settings({"autoEnabled":True, "autoTimes":["08:00","18:00"],
                                    "oab":"123456","ufOab":"RJ"})
        self.assertEqual(self.store.scheduled("2026-11-05", "06:01"), 3)
        self.assertEqual(self.store.settings()["autoLast"], "2026-11-04T18:00")
        self.assertEqual(self.store.scheduled("2026-11-05", "06:01"), 0)
        self.assertEqual(self.store.scheduled("2026-11-05", "08:01"), 0)
        self.assertEqual(self.store.settings()["autoLast"], "2026-11-05T08:00")
        self.assertEqual(self.store.summary()["counts"]["queued"], 3)

    def test_backup_exportacao_e_restaura_sem_duplicacao(self):
        self.consult([movement("e1")])
        backup = self.store.export_monitoring()
        self.assertEqual(backup["format"], "pauta-monitoramento")
        self.assertFalse(backup["settings"]["datajudKey"])
        result = self.store.restore_monitoring(backup)
        self.assertTrue(Path(result["backupBeforeRestore"]).exists())
        self.assertEqual(len(self.store.case_detail("case1")["events"]), 1)
        self.store.restore_monitoring(backup)
        self.assertEqual(len(self.store.case_detail("case1")["events"]), 1)

    def test_cadastro_manual_e_outras_tramitacoes_inalterados(self):
        self.consult([movement("e1")])
        detail_before = self.store.case_detail("case1")
        self.store.sync_cases([{"id": "case1", "cnj": self.number, "court": "tjrj",
                               "courtLevel": "second", "processSystem": "pje"}])
        after = self.store.case_detail("case1")
        self.assertEqual(after["case"]["degree"], "second")
        self.assertEqual(detail_before["events"], after["events"])

    def test_troca_cnj_nao_exibe_historico_estrangeiro(self):
        self.consult([movement("e1")])
        other = cnj(seq=2)
        self.store.sync_cases([{"id": "case1", "cnj": other}])
        detail = self.store.case_detail("case1")
        self.assertEqual(detail["events"], [])
        self.assertEqual(detail["tramitations"], [])
        self.assertEqual(detail["previousNumberEvents"], 1)
        self.assertEqual(len(self.store.export_monitoring()["tables"]["events"]), 1)

    def test_origem_vazia_nao_desativa_acompanhamento_existente(self):
        previous = self.store.settings()
        before = self.store.case_detail("case1")
        response = self.store.sync_cases([])
        self.assertTrue(response["skipped"])
        self.assertEqual(response["active"], 1)
        self.assertEqual(self.store.case_detail("case1")["case"], before["case"])
        self.assertEqual(self.store.settings(), previous)

    def test_exclusao_explicita_da_ultima_ficha_desativa_sem_apagar_historico(self):
        before = self.store.case_detail("case1")
        result = self.store.sync_cases([], allow_empty=True)
        self.assertEqual(result["active"], 0)
        self.assertNotIn("skipped", result)
        after = self.store.case_detail("case1")
        self.assertEqual(after["case"]["id"], before["case"]["id"])
        self.assertEqual(after["case"]["active"], 0)

    def test_restore_recusa_fila_em_andamento_e_invalida_resposta_tardia(self):
        backup = self.store.export_monitoring()
        self.store.enqueue(["case1"], ["datajud"])
        old = self.store.claim()
        self.assertIsNotNone(old)
        with self.assertRaisesRegex(ValueError, "Cancele"):
            self.store.restore_monitoring(backup)
        self.store.cancel()
        self.store.restore_monitoring(backup)
        self.assertEqual(self.store.finish(old, result(movement("too-late"))), 0)
        self.assertEqual(len(self.store.case_detail("case1")["events"]), 0)

    def test_djen_oab_semeia_baseline_por_cnj_vinculado(self):
        self.store.update_settings({"oab": "123456", "ufOab": "RJ"})
        def publication(code):
            return {"id": "djen:"+code, "cnj": self.number, "source": "djen",
                    "tramitationId": "djen:"+self.number, "kind": "publication",
                    "occurredAt": "2026-11-03", "text": "Publicação "+code,
                    "digest": fingerprint({"code":code}), "sourceUpdatedAt": ""}
        def do(*events):
            self.assertEqual(self.store.enqueue([], oab=True)["count"], 1)
            job = self.store.claim()
            self.store.finish(job, {"status": "success", "source": "djen",
                "events": list(events), "tramitations": [], "sourceUpdatedAt": "",
                "limitation": "período", "documents": []})
        do(publication("p1"))
        self.assertEqual(self.store.summary()["unseen"], 0)
        do(publication("p1"), publication("p2"))
        self.assertEqual(self.store.summary()["unseen"], 1)
        self.assertEqual(len(self.store.publications()["events"]), 2)
        self.assertEqual(len(self.store.case_detail("case1")["events"]), 2)

    def test_djen_oab_reconcilia_so_com_cnj_exato(self):
        self.store.update_settings({"oab": "123456", "ufOab": "RJ"})
        unknown = cnj(seq=3)
        self.store.enqueue([], oab=True)
        self.store.finish(self.store.claim(), {"status": "success", "source": "djen",
            "tramitations": [], "documents": [], "sourceUpdatedAt": "",
            "events": [{"id":"djen:z1","cnj":unknown,"tramitationId":"djen:"+unknown,
                         "source":"djen","kind":"publication","occurredAt":"2026-11-03",
                         "text":"Publicação de outro CNJ","digest":fingerprint("z1")}],
            "limitation": "período"})
        self.assertEqual(self.store.publications()["events"][0]["case_id"], "")
        self.store.sync_cases([{"id":"case1","cnj":self.number},
                               {"id":"case2","cnj":unknown}])
        self.assertEqual(self.store.publications()["events"][0]["case_id"], "case2")
        self.assertEqual(len(self.store.case_detail("case1")["events"]), 0)
        self.assertEqual(len(self.store.case_detail("case2")["events"]), 1)

    def test_hash_da_certidao_fica_preservado_no_sqlite_e_backup(self):
        cert = "qo8LEjMv6g2sAodc5TGKzLJRmrz2A1"
        def record(value):
            return {"id":"djen:cert-test", "cnj":self.number,"source":"djen",
                    "tramitationId":"djen:"+self.number,"kind":"publication",
                    "occurredAt":"2026-11-03","text":"Inteiro teor fictício",
                    "digest":fingerprint("metadata:"+value),"certificateHash":value}
        def do(value):
            self.store.enqueue(["case1"], ["djen"])
            job=self.store.claim(("djen",))
            self.store.finish(job,{"status":"success","source":"djen", "events":[record(value)],
                                   "tramitations":[],"documents":[],"sourceUpdatedAt":""})
        do("")
        self.assertEqual(self.store.certificate_hash_for_publication("djen:cert-test"),"")
        do(cert)
        self.assertEqual(self.store.certificate_hash_for_publication("djen:cert-test"),cert)
        do("")
        self.assertEqual(self.store.certificate_hash_for_publication("djen:cert-test"),cert)
        self.assertEqual(self.store.publications()["events"][0]["certificate_hash"],cert)
        self.assertEqual(self.store.publications()["events"][0]["correction_count"],0)
        self.assertEqual(self.store.publications()["events"][0]["seen"],0)
        exported=self.store.export_monitoring()
        self.assertEqual(exported["version"],3)
        self.store.restore_monitoring(exported)
        self.assertEqual(self.store.certificate_hash_for_publication("djen:cert-test"),cert)
        for invalid in ("", "../../etc/passwd", "datajud:cert-test"):
            with self.subTest(id=invalid),self.assertRaises(ValueError):
                self.store.certificate_hash_for_publication(invalid)

    def test_backup_antigo_restaura_com_hash_vazio(self):
        self.consult([movement("old")])
        exported=self.store.export_monitoring()
        exported["version"]=1
        for event in exported["tables"]["events"]:
            del event["certificate_hash"]
            del event["publication_details"]
        self.store.restore_monitoring(exported)
        self.assertEqual(self.store.case_detail("case1")["events"][0]["certificate_hash"],"")

    def test_migracao_do_banco_legado_adiciona_hash_sem_apagar_eventos(self):
        folder=Path(self.tmp.name)/"legacy"
        folder.mkdir()
        filename=folder/"pauta-monitoramento.sqlite3"
        with closing(sqlite3.connect(filename)) as db:
            db.execute("""CREATE TABLE events(case_id TEXT NOT NULL,source TEXT NOT NULL,
                id TEXT NOT NULL,cnj TEXT NOT NULL,tramitation_id TEXT NOT NULL,
                kind TEXT NOT NULL,occurred_at TEXT NOT NULL,text TEXT NOT NULL,
                digest TEXT NOT NULL,source_updated_at TEXT NOT NULL,
                first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,is_new INTEGER NOT NULL DEFAULT 0,
                seen INTEGER NOT NULL DEFAULT 0,correction_count INTEGER NOT NULL DEFAULT 0,
                url TEXT NOT NULL DEFAULT '',PRIMARY KEY(case_id,source,id))""")
            db.execute("""INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                       ("", "djen", "djen:legacy", cnj(), "", "publication", "2026-11-03",
                        "Teor antigo", "digest", "", "2026-11-04", "2026-11-04", 0,0,0,""))
            db.commit()
        migrated=Store(folder)
        self.assertEqual(migrated.publications()["events"][0]["text"],"Teor antigo")
        self.assertEqual(migrated.publications()["events"][0]["certificate_hash"],"")


class ApiTests(unittest.TestCase):
    def test_iniciador_exibe_diretorio_do_servidor_e_encerra_com_seguranca(self):
        with patch("service.main.Server") as factory, redirect_stdout(io.StringIO()) as output:
            server = factory.return_value
            server.store.directory = "temporary-test-data"
            server.serve_forever.side_effect = KeyboardInterrupt
            self.assertEqual(main(["--port", "9876"]), 0)
            self.assertIn("temporary-test-data", output.getvalue())
            server.worker.start.assert_called_once()
            server.djen_worker.start.assert_called_once()
            server.server_close.assert_called_once()

    def test_segunda_instancia_nao_abre_banco_nem_invalida_fila(self):
        with patch("service.main.Store") as factory:
            with self.assertRaises(OSError):
                Server(self.server.server_port)
            factory.assert_not_called()

    def test_djen_previa_consulta_sem_cadastrar_e_sem_depender_datajud(self):
        csrf = self.req("GET", "/api/v1/session")[1]["csrf"]
        headers = {"X-Pauta-CSRF": csrf}
        self.assertEqual(self.req("POST", "/api/v1/djen/preview", {"cnj": "123"}, headers)[0], 400)
        with patch("service.main.consult_djen", return_value={"status":"success", "events":[{"text":"Publicação"}]}) as fetch:
            status, info = self.req("POST", "/api/v1/djen/preview", {"cnj":cnj()}, headers)
        self.assertEqual(status, 200)
        fetch.assert_called_once_with(cnj(), days=30)
        self.assertEqual(len(info["events"]), 1)
        self.assertEqual(info["days"], 30)
        self.assertRegex(info["periodStart"], r"^\d{4}-\d\d-\d\d$")
        self.assertRegex(info["periodEnd"], r"^\d{4}-\d\d-\d\d$")
        with patch("service.main.consult_djen", return_value={"status":"not_found", "events":[]}) as fetch:
            status, info = self.req("POST", "/api/v1/djen/preview",
                                    {"cnj":cnj(), "days":365}, headers)
        self.assertEqual(status, 200)
        fetch.assert_called_once_with(cnj(), days=365)
        self.assertEqual(info["days"], 365)
        self.assertEqual(self.server.store.summary()["jobs"], [])
        self.assertEqual(self.req("POST", "/api/v1/djen/preview",
                                  {"cnj":cnj(), "days":366}, headers)[0], 400)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.server = Server(0, Store(self.tmp.name), auth=False)
        self.server.origin = f"http://127.0.0.1:{self.server.server_port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def req(self, method, path, data=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        payload = json.dumps(data).encode() if data is not None else None
        opts = dict(headers or {})
        if payload is not None:
            opts.setdefault("Content-Type", "application/json")
        conn.request(method, path, body=payload, headers=opts)
        res = conn.getresponse()
        raw = res.read()
        conn.close()
        return res.status, json.loads(raw.decode())

    def test_pdf_oficial_serve_bytes_apenas_de_publicacao_salva(self):
        token = self.req("GET", "/api/v1/session")[1]["csrf"]
        headers = {"X-Pauta-CSRF": token}
        self.assertEqual(self.req("GET", "/api/v1/publications/djen:sem-registro/certidao",
                                  headers=headers)[0],404)
        self.server.store.sync_cases([{"id":"case1","cnj":cnj()}])
        self.server.store.enqueue(["case1"],["djen"])
        job=self.server.store.claim(("djen",))
        self.server.store.finish(job,{"status":"success","source":"djen", "tramitations":[],
            "documents":[],"sourceUpdatedAt":"","events":[{"id":"djen:testpdf","cnj":cnj(),
            "kind":"publication","source":"djen","occurredAt":"2026-11-03",
            "text":"Texto integral de exemplo","digest":fingerprint("pdf"),
            "certificateHash":"qo8LEjMv6g2sAodc5TGKzLJRmrz2A1"}]})
        with patch("service.main.fetch_djen_certificate",return_value=b"%PDF-1.7\npdf-ficticio") as source:
            conn=http.client.HTTPConnection("127.0.0.1",self.server.server_port,timeout=3)
            conn.request("GET","/api/v1/publications/djen:testpdf/certidao",headers=headers)
            response=conn.getresponse();body=response.read()
            self.assertEqual(response.status,200)
            self.assertEqual(response.getheader("Content-Type"),"application/pdf")
            self.assertIn("attachment",response.getheader("Content-Disposition"))
            self.assertEqual(body,b"%PDF-1.7\npdf-ficticio")
            conn.close()
        source.assert_called_once_with("qo8LEjMv6g2sAodc5TGKzLJRmrz2A1")
        with patch("service.main.fetch_djen_certificate",side_effect=SourceError("unavailable","CNJ recusou a certidao (HTTP 429).")):
            status,data=self.req("GET","/api/v1/publications/djen:testpdf/certidao",
                                 headers=headers)
            self.assertEqual(status,429)
            self.assertIn("429",data["error"])

    def test_health_contrato_e_caminhos_static(self):
        status, info = self.req("GET", "/api/v1/health")
        self.assertEqual(status, 200)
        self.assertEqual(info["contractVersion"], 1)
        self.assertEqual(self.req("GET", "/../../.public-datajud-key.txt")[0], 404)
        self.assertEqual(self.req("GET", "/service/store.py")[0], 404)

    def test_csp_sem_script_inline_e_boot_check_publico(self):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        conn.request("GET", "/dashboard.html")
        response = conn.getresponse()
        dashboard = response.read().decode("utf-8")
        csp = response.getheader("Content-Security-Policy")
        conn.close()
        self.assertEqual(response.status, 200)
        self.assertIn("script-src 'self'", csp)
        self.assertNotIn("script-src 'self' 'unsafe-inline'", csp)
        self.assertIn("style-src 'self'", csp)
        self.assertNotIn("style-src 'self' 'unsafe-inline'", csp)
        self.assertIn('<script src="boot-check.js" defer></script>', dashboard)
        self.assertNotIn('<script>', dashboard)
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        conn.request("GET", "/boot-check.js")
        response = conn.getresponse()
        payload = response.read()
        conn.close()
        self.assertEqual(response.status, 200)
        self.assertIn(b"__PAUTA_BOOTED__", payload)

    def test_host_e_csrf_cors_negado(self):
        self.assertEqual(self.req("GET", "/api/v1/health", headers={"Host": "evil.test"})[0], 403)
        self.assertEqual(self.req("POST", "/api/v1/jobs", {"ids": []})[0], 403)
        for path in ("/api/v1/health", "/api/v1/session", "/api/v1/status",
                     "/api/v1/connectors"):
            self.assertEqual(self.req("GET", path)[0], 200, path)
        for path in ("/api/v1/dashboard", "/api/v1/backup", "/api/v1/publications",
                     "/api/v1/notifications", "/api/v1/processes/inexistente",
                     "/api/v1/publications/x/certidao"):
            self.assertEqual(self.req("GET", path)[0], 403, path)
        session = self.req("GET", "/api/v1/session")[1]
        valid = {"X-Pauta-CSRF": session["csrf"]}
        for path in ("/api/v1/dashboard", "/api/v1/backup", "/api/v1/publications",
                     "/api/v1/notifications"):
            self.assertEqual(self.req("GET", path, headers=valid)[0], 200, path)
        self.assertEqual(self.req("POST", "/api/v1/jobs", {"ids": []},
                                  {**valid, "Origin": "https://evil.test"})[0], 403)
        self.assertEqual(self.req("POST", "/api/v1/jobs", {"ids": []},
                                  {**valid, "Origin": "null"})[0], 403)
        self.assertEqual(self.req("POST", "/api/v1/jobs", {"ids": []}, valid)[0], 200)

    def test_diagnostico_requer_csrf_e_retorna_somente_estados(self):
        self.assertEqual(self.req("POST", "/api/v1/diagnostics", {})[0], 403)
        token = self.req("GET", "/api/v1/session")[1]["csrf"]
        with patch("service.main.probe_public_sources", return_value=[
            {"source": "datajud", "status": "reachable", "message": "OK"},
            {"source": "djen", "status": "unavailable", "message": "HTTP 429"},
        ]) as probe:
            status, report = self.req("POST", "/api/v1/diagnostics", {}, {"X-Pauta-CSRF": token})
        self.assertEqual(status, 200)
        self.assertEqual(report["results"][0]["status"], "reachable")
        self.assertEqual(report["results"][1]["status"], "unavailable")
        probe.assert_called_once()

    def test_previa_api_sem_salvar_sem_vazar_chave_e_com_protecao_csrf(self):
        number = cnj()
        self.assertEqual(self.req("POST", "/api/v1/datajud/preview", {"cnj": number})[0], 403)
        csrf = self.req("GET", "/api/v1/session")[1]["csrf"]
        headers = {"X-Pauta-CSRF": csrf}
        self.assertEqual(self.req("POST", "/api/v1/datajud/preview", {"cnj": "invalido"}, headers)[0], 400)
        self.server.store.update_settings({"datajudKey": "sensitive-test-key"})
        with patch("service.main.consult_datajud", return_value={"status": "success", "tramitations": [
            {"id": "datajud:primeira", "tribunal": "TJRJ", "grau": "G1",
             "sistema": "eproc", "classe": {"nome": "Procedimento"}, "assuntos": [],
             "orgao": {"nome": "1ª Vara"}}]}) as connector:
            status, response = self.req("POST", "/api/v1/datajud/preview", {"cnj": number}, headers)
        self.assertEqual(status, 200)
        connector.assert_called_once_with(number, "sensitive-test-key")
        self.assertEqual(response["records"][0]["orgao"], "1ª Vara")
        self.assertNotIn("sensitive-test-key", json.dumps(response))
        self.assertEqual(self.server.store.summary()["jobs"], [])
        self.assertEqual(self.server.store.export_monitoring()["tables"]["cases"], [])

    def test_previa_api_nao_encontrado_bloqueio_e_formato_incompativel(self):
        number=cnj()
        token=self.req("GET", "/api/v1/session")[1]["csrf"]
        headers={"X-Pauta-CSRF": token}
        with patch("service.main.consult_datajud", return_value={"status": "not_found", "tramitations": []}):
            status, data=self.req("POST", "/api/v1/datajud/preview", {"cnj": number}, headers)
            self.assertEqual(status, 200)
            self.assertEqual(data["status"], "not_found")
        for source_error, expected in [
            (SourceError("unavailable", "Fonte respondeu HTTP 429."), 429),
            (SourceError("auth_required", "Fonte respondeu HTTP 401."), 401),
            (SourceError("unsupported", "Tribunal fora do escopo."), 422),
        ]:
            with self.subTest(error=expected), patch("service.main.consult_datajud", side_effect=source_error):
                status, error=self.req("POST", "/api/v1/datajud/preview", {"cnj": number}, headers)
                self.assertEqual(status, expected)
                self.assertIn("error", error)
                self.assertNotIn("datajudKey", json.dumps(error))
        with patch("service.main.consult_datajud", side_effect=RuntimeError("SENSITIVE TEST")):
            status, error=self.req("POST", "/api/v1/datajud/preview", {"cnj": number}, headers)
        self.assertEqual(status, 502)
        self.assertNotIn("SENSITIVE", json.dumps(error))


class WorkerTests(unittest.TestCase):
    def test_djen_publica_resultado_enquanto_datajud_esta_bloqueado(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Store(temp)
            store.sync_cases([{"id": "case1", "cnj": cnj()}])
            store.update_settings({"enabled": {"datajud": True, "djen": True}, "autoEnabled": False})
            store.enqueue(["case1"], ["datajud", "djen"])
            started, release = threading.Event(), threading.Event()
            def slow_datajud(*args, **kwargs):
                started.set()
                release.wait(8)
                raise SourceError("unavailable", "DataJud expirou.")
            publication = {**movement("djen:independent", "Intimação publicada"),
                           "source": "djen", "kind": "publication", "cnj": cnj()}
            response = {"status": "success", "source": "djen", "events": [publication],
                        "tramitations": [], "documents": [], "sourceUpdatedAt": ""}
            server = Server(0, store)
            with patch("service.main.consult_datajud", side_effect=slow_datajud), \
                 patch("service.main.consult_djen", return_value=response) as djen:
                server.worker.start()
                try:
                    self.assertTrue(started.wait(3))
                    server.djen_worker.start()
                    for _ in range(60):
                        detail = store.case_detail("case1")
                        if detail["events"]:
                            break
                        time.sleep(.05)
                    else:
                        self.fail("DJEN ficou bloqueado pelo DataJud.")
                    self.assertEqual(detail["events"][0]["kind"], "publication")
                    self.assertEqual({j["source"]: j["status"] for j in detail["sourceJobs"]},
                                     {"datajud": "running", "djen": "success"})
                    djen.assert_called_once()
                    release.set()
                    for _ in range(60):
                        detail = store.case_detail("case1")
                        if any(j["status"] == "unavailable" for j in detail["sourceJobs"]):
                            break
                        time.sleep(.05)
                    self.assertEqual(len(detail["events"]), 1)
                    self.assertTrue(any(j["status"] == "unavailable" for j in detail["sourceJobs"]))
                finally:
                    release.set()
                    server.worker.stop_event.set()
                    server.djen_worker.stop_event.set()
                    server.worker.join(5)
                    if server.djen_worker.ident:
                        server.djen_worker.join(5)
                    server.server_close()

    def test_worker_processa_consulta_sem_navegador(self):
        with tempfile.TemporaryDirectory() as temp:
            store = Store(temp)
            number = cnj()
            store.sync_cases([{"id":"case1","cnj":number}])
            store.update_settings({"enabled":{"datajud":True},"autoEnabled":False})
            store.enqueue(["case1"], ["datajud"])
            fake = result(movement("automatic1"))
            with patch("service.main.consult_datajud", return_value=fake) as source:
                worker = Worker(store)
                worker.start()
                try:
                    for _ in range(60):
                        if store.summary()["counts"].get("success"):
                            break
                        time.sleep(0.05)
                    else:
                        self.fail("Serviço não processou a fila no prazo esperado.")
                    source.assert_called_once()
                finally:
                    worker.stop_event.set()
                    worker.join(timeout=5)
                self.assertEqual(len(store.case_detail("case1")["events"]),1)
                self.assertFalse(worker.is_alive())


if __name__ == "__main__":
    unittest.main()
