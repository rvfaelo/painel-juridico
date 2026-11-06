import json
import unittest
from service.connectors import consult_djen, fingerprint
from tests import test_service as fixtures


class PublicationStoreTests(unittest.TestCase):
    def setUp(self):
        fixtures.StoreTests.setUp(self)
        self.store.update_settings({"enabled": {"djen": True}})

    def save_publication(self, details):
        self.store.enqueue(["case1"], ["djen"])
        job = self.store.claim(("djen",))
        event = {**fixtures.movement("djen:example"), "cnj": self.number, "publicationDetails": details,
                 "digest": fingerprint(details), "kind": "publication"}
        self.store.finish(job, {"status": "success", "events": [event], "tramitations": [
            {"id": "not-a-track", "grau": "G1", "sistema": "untrusted-publication"}]})
        return self.store.case_detail("case1")

    def test_enriquecimento_preserva_conferencia_mas_alteracao_real_reabre(self):
        self.save_publication({"tribunal": "TJRJ"})
        self.store.mark_seen("case1", "djen", "djen:example")
        info = self.save_publication({"tribunal": "TJRJ", "advogados": [{"nome": "Exemplo", "numeroOab": "123", "ufOab": "RJ"}]})
        self.assertEqual(info["events"][0]["seen"], 1)
        self.assertEqual(info["events"][0]["correction_count"], 0)
        self.assertEqual(info["tramitations"], [])
        info = self.save_publication({"advogados": []})
        self.assertEqual(info["events"][0]["seen"], 0)
        self.assertEqual(info["events"][0]["correction_count"], 1)

    def test_backup_v2_restaura_publicacoes_sem_perder_eventos(self):
        self.save_publication({"tribunal": "TJRJ"})
        blob = self.store.export_monitoring()
        blob["version"] = 2
        for event in blob["tables"]["events"]:
            del event["publication_details"]
        self.store.restore_monitoring(blob)
        self.assertEqual(self.store.case_detail("case1")["events"][0]["publication_details"], "{}")

    def test_djen_normaliza_destinatarios_e_preserva_no_backup(self):
        item = {"id": 5, "numero_processo": self.number, "data_disponibilizacao": "2026-11-05", "texto": "Exemplo",
                "nomeOrgao": "Vara exemplo", "destinatarios": [{"nome": "Parte exemplo", "polo": "A", "cpf": "nao copiar"}],
                "destinatarioadvogados": [{"advogado": {"nome": "Advogado exemplo", "numero_oab": "123", "uf_oab": "RJ"}}]}
        response = consult_djen(self.number, requester=lambda *a, **kw: {"count": 1, "items": [item]})
        details = response["events"][0]["publicationDetails"]
        self.assertEqual(details["advogados"][0]["numeroOab"], "123")
        self.assertNotIn("cpf", json.dumps(details))
        self.save_publication(details)
        blob = self.store.export_monitoring()
        self.store.restore_monitoring(blob)
        saved = json.loads(self.store.publications()["events"][0]["publication_details"])
        self.assertEqual(saved, details)
