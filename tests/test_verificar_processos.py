import unittest
from types import SimpleNamespace

from tests.test_service import cnj
from tools.verificar_processos import (
    ServiceError, br_date, build_report, events_by_case, flat_text, inspect_case,
    parse_sources, select_cases,
)


class FakeClient:
    def __init__(self, events):
        self.events = events

    def request(self, route):
        assert route == "notifications"
        return {"events": self.events}


class VerificarProcessosTests(unittest.TestCase):
    def test_seleciona_apenas_processos_com_cnj_valido(self):
        payload = {"cases": [
            {"id": "c1", "cnj": cnj(1), "archived": False, "courtLevel": "first"},
            {"id": "c2", "cnj": "", "archived": False},
            {"id": "c3", "cnj": cnj(2), "archived": True},
        ]}
        cases, skipped = select_cases(payload, include_archived=False)
        self.assertEqual([case["id"] for case in cases], ["c1"])
        self.assertEqual(len(skipped), 2)
        cases, _ = select_cases(payload, include_archived=True)
        self.assertEqual([case["id"] for case in cases], ["c1", "c3"])

    def test_fonte_nao_localizada_e_ressalva_nao_falha(self):
        detail = {"sourceJobs": [
            {"source": "djen", "status": "success"},
            {"source": "datajud", "status": "not_found"},
        ]}
        result = inspect_case({"cnj": cnj()}, detail, ["djen", "datajud"], consulted=True)
        self.assertEqual(result["failures"], [])
        self.assertTrue(any("não localizado" in message for _, message in result["caveats"]))
        self.assertTrue(any("não comprova inexistência" in message for _, message in result["caveats"]))

    def test_erro_da_fonte_aparece_como_falha(self):
        detail = {"sourceJobs": [{"source": "djen", "status": "unavailable",
                                  "message": "Fonte fora do ar"}]}
        result = inspect_case({"cnj": cnj()}, detail, ["djen"], consulted=True)
        self.assertEqual(result["failures"], [("djen", "Fonte fora do ar")])

    def test_processo_sem_consulta_nao_e_tratado_como_sem_novidade(self):
        result = inspect_case({"cnj": cnj()}, {}, ["djen"], consulted=True)
        self.assertEqual(result["failures"], [])
        self.assertEqual(result["caveats"], [("djen", "sem consulta registrada para este processo")])

    def test_cadastro_nao_sincronizado_vira_ressalva(self):
        result = inspect_case({"cnj": cnj()}, {"sourceJobs": [], "_error": "Processo nao sincronizado."},
                              ["djen"], consulted=True)
        self.assertTrue(any(source == "servico" for source, _ in result["caveats"]))

    def test_processo_com_novidade_nao_entra_em_sem_novidade(self):
        case = {"id": "c1", "cnj": cnj(), "courtLevel": "first"}
        detail = {"sourceJobs": [{"source": "djen", "status": "success"}], "tramitations": []}
        client = FakeClient([{"case_id": "c1", "source": "djen", "is_new": 1, "seen": 0,
                              "id": "djen:1", "occurred_at": "2026-11-09", "text": "Intimação"}])
        report = build_report(client, SimpleNamespace(limite_texto=300), [case], ["djen"],
                              {"c1": detail}, set(), True)
        self.assertEqual(len(report["novelties"]), 1)
        self.assertEqual(report["quiet"], [])

    def test_novidade_exige_is_new_e_nao_vista(self):
        client = FakeClient([
            {"case_id": "c1", "source": "djen", "is_new": 1, "seen": 0,
             "id": "djen:1", "occurred_at": "2026-11-09"},
            {"case_id": "c1", "source": "djen", "is_new": 0, "seen": 1,
             "id": "djen:2", "occurred_at": "2026-11-08"},
            {"case_id": "c1", "source": "datajud", "is_new": 1, "seen": 0,
             "id": "datajud:1", "occurred_at": "2026-11-07"},
            {"case_id": "c2", "source": "djen", "is_new": 1, "seen": 0,
             "id": "djen:3", "occurred_at": "2026-11-06"},
        ])
        rows = events_by_case(client, {"c1"}, ["djen"])
        self.assertEqual([row["id"] for row in rows], ["djen:1"])

    def test_fontes_invalidas_sao_recusadas(self):
        self.assertEqual(parse_sources("djen,datajud,djen"), ["djen", "datajud"])
        with self.assertRaises(ServiceError):
            parse_sources("esaj")
        with self.assertRaises(ServiceError):
            parse_sources("")

    def test_texto_e_data_para_relatorio(self):
        self.assertEqual(flat_text("  Conclusão\n ao   relator  ", 30), "Conclusão ao relator")
        self.assertEqual(flat_text("abcdef", 3), "abc…")
        self.assertEqual(flat_text("abcdef", 0), "abcdef")
        self.assertEqual(br_date("2026-11-09"), "09/11/2026")
        self.assertEqual(br_date(""), "data não informada")


if __name__ == "__main__":
    unittest.main()
