"""Autenticação local: bootstrap de uso único, cookie e segredo administrativo."""
import http.client
from http.cookies import SimpleCookie
import json
import tempfile
import threading
import unittest
from urllib.parse import urlsplit

from unittest.mock import patch

from service.main import Server, request_status
from service.store import Store


class LocalAuthTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.server = Server(0, Store(self.tmp.name))
        self.server.origin = f"http://127.0.0.1:{self.server.server_port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def request(self, method, path, data=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        payload = json.dumps(data).encode() if data is not None else None
        opts = dict(headers or {})
        if payload is not None:
            opts.setdefault("Content-Type", "application/json")
        conn.request(method, path, body=payload, headers=opts)
        response = conn.getresponse()
        body = response.read()
        result = (response.status, dict(response.getheaders()), body)
        conn.close()
        return result

    def admin_headers(self):
        return {"Origin": self.server.origin, "X-Pauta-Admin": self.server.admin_secret,
                "Content-Type": "application/json"}

    def bootstrap(self):
        status, _, body = self.request("POST", "/api/v1/bootstrap", {}, self.admin_headers())
        self.assertEqual(status, 200)
        return json.loads(body)["url"]

    def login(self):
        url = self.bootstrap()
        parsed = urlsplit(url)
        status, headers, _ = self.request("GET", parsed.path + "?" + parsed.query)
        self.assertEqual(status, 302)
        cookie = SimpleCookie()
        cookie.load(headers["Set-Cookie"])
        return cookie["pauta_session"].value, headers["Set-Cookie"]

    def test_bootstrap_e_unico_e_cookie_http_only_same_site_strict(self):
        status, _, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("Abra o painel", body.decode("utf-8"))
        self.assertNotIn("boot-check.js", body.decode("utf-8"))

        url = self.bootstrap()
        parsed = urlsplit(url)
        status, headers, _ = self.request("GET", parsed.path + "?" + parsed.query)
        self.assertEqual(status, 302)
        self.assertEqual(headers["Location"], "/")
        cookie_header = headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie_header)
        self.assertIn("SameSite=Strict", cookie_header)
        self.assertIn("Path=/", cookie_header)

        session_id = SimpleCookie()
        session_id.load(cookie_header)
        sid = session_id["pauta_session"].value
        dashboard = self.request("GET", "/", headers={"Cookie": f"pauta_session={sid}"})
        self.assertEqual(dashboard[0], 200)
        self.assertIn("boot-check.js", dashboard[2].decode("utf-8"))

        reused = self.request("GET", parsed.path + "?" + parsed.query)
        self.assertEqual(reused[0], 200)
        self.assertIn("Abra o painel", reused[2].decode("utf-8"))
        self.assertNotIn("Set-Cookie", reused[1])

    def test_sessao_exige_cookie_e_csrf_por_sessao(self):
        self.assertEqual(self.request("GET", "/api/v1/session")[0], 401)
        sid, _ = self.login()
        cookie = {"Cookie": f"pauta_session={sid}"}
        status, _, body = self.request("GET", "/api/v1/session", headers=cookie)
        self.assertEqual(status, 200)
        csrf = json.loads(body)["csrf"]
        self.assertTrue(csrf)

        self.assertEqual(self.request("POST", "/api/v1/jobs", {"ids": []}, cookie)[0], 403)
        self.assertEqual(self.request("POST", "/api/v1/jobs", {"ids": []},
                                      {**cookie, "X-Pauta-CSRF": "errado"})[0], 403)
        self.assertEqual(self.request("POST", "/api/v1/jobs", {"ids": []},
                                      {**cookie, "X-Pauta-CSRF": csrf})[0], 200)

    def test_admin_le_status_e_encerra_sem_csrf_de_sessao(self):
        self.assertEqual(self.request("GET", "/api/v1/status")[0], 401)
        status, _, _ = self.request("POST", "/api/v1/bootstrap", {},
                                    {"Origin": self.server.origin, "Content-Type": "application/json"})
        self.assertEqual(status, 401)
        status, _, body = self.request("GET", "/api/v1/status", headers=self.admin_headers())
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["appVersion"], "0.6.6")
        status, _, body = self.request("POST", "/api/v1/shutdown", {}, self.admin_headers())
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["status"], "stopping")

    def test_parada_compativel_com_servico_sem_segredo(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        legacy = Server(0, Store(temporary.name), auth=False)
        legacy.origin = f"http://127.0.0.1:{legacy.server_port}"
        thread = threading.Thread(target=legacy.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(legacy.server_close)
        self.addCleanup(legacy.shutdown)
        with patch("service.main.read_admin_secret", return_value=""):
            result = request_status(legacy.server_port, "STOP")
        self.assertEqual(result["status"], "stopping")


if __name__ == "__main__":
    unittest.main()
