"""Exercita o cliente upstream real com HTTP simulado, sem processos privados."""
import json
import asyncio
import unittest
from unittest.mock import patch

import httpx
from mcp_juridico_brasil.datajud.client import DataJudClient

from service.connectors import consult_datajud, SourceError
from service.datajud_mcp import request_datajud
from tests.test_service import cnj


class MCPClientTests(unittest.TestCase):
    def mocked_http(self, handler):
        original = httpx.AsyncClient
        return patch("httpx.AsyncClient", side_effect=lambda **kwargs:
                     original(**kwargs, transport=httpx.MockTransport(handler)))

    def test_consulta_usa_transporte_upstream_e_preserva_dois_graus(self):
        calls = []
        number = cnj()
        def handler(request):
            calls.append(request)
            return httpx.Response(200, json={"timed_out": False, "_shards": {"failed": 0},
                "hits": {"total": 2, "hits": [
                    {"_id": degree, "_source": {"numeroProcesso": number, "grau": degree,
                     "movimentos": [{"codigo": 1, "nome": "Juntada", "dataHora": "2026-11-05T12:00:00Z"}]}}
                    for degree in ("G1", "G2")]}})
        with self.mocked_http(handler), patch("urllib.request.urlopen", side_effect=AssertionError("fallback proibido")):
            result = consult_datajud(number, "test-public-key")
        self.assertEqual(result["status"], "success")
        self.assertEqual(len(result["events"]), 2)
        self.assertEqual([t["grau"] for t in result["tramitations"]], ["G1", "G2"])
        self.assertEqual(calls[0].headers["Authorization"], "APIKey test-public-key")
        self.assertEqual(str(calls[0].url), "https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search")
        self.assertEqual(json.loads(calls[0].content)["size"], 100)
        self.assertEqual(calls[0].extensions["timeout"]["read"], 120)
        self.assertEqual(DataJudClient._http.__module__, "mcp_juridico_brasil.datajud.client")

    def test_timeout_upstream_nao_cai_no_cliente_antigo(self):
        def handler(request):
            raise httpx.ReadTimeout("timeout", request=request)
        with self.mocked_http(handler), patch("urllib.request.urlopen") as legacy:
            with self.assertRaises(SourceError) as caught:
                consult_datajud(cnj())
            legacy.assert_not_called()
        self.assertFalse(caught.exception.retryable)
        self.assertIn("Cliente MCP", str(caught.exception))

    def test_limite_total_cancela_a_operacao_e_libera_a_trava(self):
        from service.datajud_mcp import _REQUEST_LOCK
        async def handler(request):
            await asyncio.sleep(1)
            return httpx.Response(200, json={})
        with self.mocked_http(handler):
            with self.assertRaises(SourceError) as caught:
                request_datajud("https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search", timeout=.02)
        self.assertFalse(caught.exception.retryable)
        self.assertTrue(_REQUEST_LOCK.acquire(blocking=False))
        _REQUEST_LOCK.release()

    def test_consulta_simultanea_nao_dispara_segunda_requisicao(self):
        from service.datajud_mcp import _REQUEST_LOCK
        _REQUEST_LOCK.acquire()
        try:
            with patch("httpx.AsyncClient.request") as request:
                with self.assertRaises(SourceError) as caught:
                    consult_datajud(cnj())
                request.assert_not_called()
            self.assertTrue(caught.exception.retryable)
            self.assertIn("em andamento", str(caught.exception))
        finally:
            _REQUEST_LOCK.release()

    def test_resposta_parcial_upstream_nao_vira_nao_encontrado(self):
        with self.mocked_http(lambda request: httpx.Response(200, json={
                "_shards": {"failed": 1}, "hits": {"total": 0, "hits": []}})):
            with self.assertRaises(SourceError) as caught:
                consult_datajud(cnj())
        self.assertEqual(caught.exception.status, "unavailable")

    def test_json_invalido_e_host_arbitrario_sao_rejeitados(self):
        with self.mocked_http(lambda request: httpx.Response(200, text="not json")):
            with self.assertRaises(SourceError) as caught:
                consult_datajud(cnj())
        self.assertEqual(caught.exception.status, "incompatible")
        with self.assertRaises(SourceError):
            request_datajud("https://example.test/_search")


if __name__ == "__main__":
    unittest.main()
