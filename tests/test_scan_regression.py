"""Regressão do scan de movimentações no serviço Python.

Cobre o parser DataJud, a consulta DJEN e a ingestão/deduplicação no Store.
Nenhum teste faz chamada de rede: os requesters são substituídos por fixtures.
"""
import json
from pathlib import Path
import tempfile
import unittest

from service.connectors import consult_djen, parse_datajud_page
from service.store import Store

CNJ = "08129777920238190066"
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "scan"


def fixture(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class ScanRegressionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(self.tmp.name)
        self.store.sync_cases([{"id": "case1", "cnj": CNJ}])
        self.store.update_settings({"enabled": {"datajud": True, "djen": True}})

    def finish(self, source, result):
        self.store.enqueue(["case1"], [source])
        job = self.store.claim((source,))
        return self.store.finish(job, result=result)

    def test_parse_datajud_page_preserva_metadados_e_movimentos_duplicados(self):
        total, uncertain, tramitations, events = parse_datajud_page(fixture("datajud-page-1.json"), CNJ)
        self.assertEqual((total, uncertain), (2, False))
        self.assertEqual([x["id"] for x in tramitations], ["datajud:rec1", "datajud:rec2"])
        self.assertEqual([x["grau"] for x in tramitations], ["G1", "G2"])
        self.assertEqual(len(events), 3)
        self.assertEqual(events[0]["text"], "Juntada de petição — Petição Inicial 1")
        self.assertEqual(events[0]["occurredAt"], "2026-11-03T10:00:00Z")
        self.assertEqual(events[1]["text"], events[0]["text"])
        self.assertNotEqual(events[0]["id"], events[1]["id"])
        self.assertEqual(events[2]["id"], "datajud:rec2:mov-2")
        self.assertEqual(events[2]["kind"], "movement")

    def test_parse_datajud_page_rejeita_busca_incompleta_e_cnj_divergente(self):
        payload = fixture("datajud-page-1.json")
        for broken in (
            {**payload, "timed_out": True},
            {**payload, "_shards": {"failed": 1}},
            {**payload, "hits": {"total": {"value": "2", "relation": "eq"}, "hits": []}},
        ):
            with self.assertRaisesRegex(Exception, "incompleta|desconhecida"):
                parse_datajud_page(broken, CNJ)
        with self.assertRaisesRegex(Exception, "divergente"):
            parse_datajud_page(payload, "00000000000000000000")

    def test_consult_djen_preserva_texto_hash_link_e_duplicata(self):
        payload = fixture("djen-page.json")
        seen = []
        result = consult_djen(CNJ, requester=lambda url: seen.append(url) or payload)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["total"], 3)
        self.assertEqual([x["id"] for x in result["events"]], ["djen:15", "djen:15", "djen:16"])
        self.assertEqual(result["events"][0]["text"], "Decisão & petição")
        self.assertEqual(result["events"][0]["url"], "https://www.cnj.jus.br/")
        self.assertEqual(result["events"][0]["certificateHash"], "qo8LEjMv6g2sAodc5TGKzLJRmrz2A1")
        self.assertEqual(result["events"][0]["publicationDetails"]["destinatarios"][0]["nome"],
                         "Fulano <Teste>")
        self.assertEqual(result["events"][2]["url"], "")
        self.assertEqual(result["events"][2]["certificateHash"], "")
        self.assertIn("numeroProcesso=08129777920238190066", seen[0])
        self.assertIn("itensPorPagina=100", seen[0])

    def test_store_datajud_estabelece_baseline_e_deduplica_novo_evento(self):
        _, _, tramitations, events = parse_datajud_page(fixture("datajud-page-1.json"), CNJ)
        result = {"status": "success", "source": "datajud", "events": events,
                  "tramitations": tramitations, "documents": [],
                  "sourceUpdatedAt": "2026-11-05T13:00:00Z"}
        self.assertEqual(self.finish("datajud", result), 0)
        self.assertEqual(self.store.summary()["unseen"], 0)
        self.assertEqual(len(self.store.case_detail("case1")["events"]), 3)
        self.assertEqual(len(self.store.case_detail("case1")["tramitations"]), 2)

        # A mesma resposta não reabre nem duplica o histórico.
        self.assertEqual(self.finish("datajud", result), 0)
        self.assertEqual(len(self.store.case_detail("case1")["events"]), 3)
        self.assertEqual(self.store.summary()["unseen"], 0)

        # Um movimento realmente novo é anunciado uma única vez.
        extra = {**events[0], "id": "datajud:rec1:novo", "text": "Movimento novo",
                 "occurredAt": "2026-11-06T10:00:00Z"}
        result["events"] = [*events, extra]
        self.assertEqual(self.finish("datajud", result), 1)
        self.assertEqual(self.store.summary()["unseen"], 1)
        self.assertEqual(self.finish("datajud", result), 0)
        self.assertEqual(self.store.summary()["unseen"], 1)
        self.assertEqual(len(self.store.case_detail("case1")["events"]), 4)

    def test_store_djen_deduplica_identificador_repetido_no_mesmo_lote(self):
        payload = fixture("djen-page.json")
        result = consult_djen(CNJ, requester=lambda url: payload)
        # Um resultado vazio estabelece o baseline sem criar publicações.
        self.assertEqual(self.finish("djen", {"status": "success", "source": "djen",
                                              "events": [], "tramitations": [], "documents": []}), 0)
        self.assertEqual(len(self.store.publications()["events"]), 0)

        # Após o baseline, o lote com djen:15 repetido entra uma única vez.
        self.assertEqual(self.finish("djen", result), 2)
        rows = self.store.publications()["events"]
        self.assertEqual(sorted(x["id"] for x in rows), ["djen:15", "djen:16"])
        self.assertEqual(self.store.summary()["unseen"], 2)

        # Reconsultar não duplica nem reabre publicações já conhecidas.
        self.assertEqual(self.finish("djen", result), 0)
        self.assertEqual(len(self.store.publications()["events"]), 2)
        self.assertEqual(self.store.summary()["unseen"], 2)


if __name__ == "__main__":
    unittest.main()
