"""Observabilidade local: log estruturado e diagnóstico sem dados processuais."""
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest

from service.main import Server
from service.store import Store


class ObservabilityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(self.tmp.name)
        self.store.sync_cases([{"id": "case1", "cnj": "08129777920238190066",
                                "title": "Título sigiloso do cliente"}])
        self.server = Server(0, self.store, auth=False)
        self.server.origin = f"http://127.0.0.1:{self.server.server_port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def get(self, path):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        conn.request("GET", path)
        response = conn.getresponse()
        body = response.read()
        status = response.status
        conn.close()
        return status, body

    def test_status_operacional_nao_expoe_titulos_ou_cnj(self):
        status, body = self.get("/api/v1/status")
        self.assertEqual(status, 200)
        info = json.loads(body)
        self.assertEqual(info["operational"]["tables"]["cases"], 1)
        self.assertNotIn("Título sigiloso", body.decode("utf-8"))
        self.assertNotIn("08129777920238190066", body.decode("utf-8"))
        self.assertIn("diskFreeBytes", info["operational"])

        status, body = self.get("/api/v1/diagnostics/operational")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["operational"]["tables"]["cases"], 1)

    def test_log_e_json_sem_url_ou_conteudo_do_processo(self):
        self.get("/api/v1/status")
        entries = []
        for line in (Path(self.tmp.name) / "logs" / "painel-hb.log").read_text(encoding="utf-8").splitlines():
            entries.append(json.loads(line))
        request = next(item for item in entries if item["event"] == "http_request")
        self.assertEqual(request["method"], "GET")
        self.assertEqual(request["status"], 200)
        self.assertNotIn("path", request)
        payload = json.dumps(entries, ensure_ascii=False)
        self.assertNotIn("08129777920238190066", payload)
        self.assertNotIn("Título sigiloso", payload)
        self.assertNotIn("csrf", payload.lower())
        self.assertNotIn("token", payload.lower())


if __name__ == "__main__":
    unittest.main()
