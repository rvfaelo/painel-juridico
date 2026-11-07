"""Adaptacao do cliente upstream: transporte real do mcp-juridico-brasil.

O metodo buscar_por_numero upstream limita size=1. Aqui usamos seu _http e
post com paginas completas, preservando todos os graus e os IDs originais.
"""
import asyncio
import threading
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

CLIENT_ID = "mcp-juridico-brasil"
CLIENT_COMMIT = "4dd19d146b2a3efe6fd3d0c7fcd2ceaefe40cfc1"
_REQUEST_LOCK = threading.Lock()


def request_datajud(url, *, payload=None, headers=None, timeout=120):
    from .connectors import SourceError, DATAJUD_ENDPOINT
    try:
        import httpx
        from mcp_juridico_brasil.datajud.client import DataJudClient
        from mcp_juridico_brasil.datajud.tribunais import TRIBUNAIS
    except ImportError:
        raise SourceError("unsupported", "Cliente MCP ausente. Execute PREPARAR-SERVICO.cmd.") from None
    aliases = {index: court for court, index in TRIBUNAIS.items()}
    alias = url.removeprefix(DATAJUD_ENDPOINT).removesuffix("/_search")
    if not url.startswith(DATAJUD_ENDPOINT) or not url.endswith("/_search") or alias not in aliases:
        raise SourceError("unsupported", "Tribunal fora do catalogo do cliente MCP.")

    async def query():
        # _http e post sao implementacoes do repositorio instalado, sem fallback
        # urllib. Alteracoes abaixo se limitam a esta instancia do transporte.
        client = DataJudClient()._http(aliases[alias])
        if client._base_url != url:
            raise SourceError("unsupported", "Endpoint MCP diverge do host DataJud permitido.")
        client._headers = dict(headers or {})
        client._timeout = timeout
        client._max_retries = 1  # a fila persistente controla tentativas/backoff
        # HTTPX resolve path="" acrescentando / ao base_url. Enviar a URL
        # completa preserva exatamente o endpoint documentado /_search.
        async with asyncio.timeout(timeout):
            async with client:
                return await client.post(url, json=payload)

    try:
        if not _REQUEST_LOCK.acquire(timeout=1):
            raise SourceError("unavailable", "Outra consulta DataJud esta em andamento; aguarde e tente novamente.",
                              retryable=True, retry_after=5)
        try:
            result = asyncio.run(query())
        finally:
            _REQUEST_LOCK.release()
    except httpx.HTTPStatusError as error:
        code = error.response.status_code
        raw_retry = error.response.headers.get("Retry-After", "0")
        retry_after = 0
        try:
            retry_after = int(raw_retry) if raw_retry.isdigit() else max(0, int(
                (parsedate_to_datetime(raw_retry) - datetime.now(timezone.utc)).total_seconds()))
        except (TypeError, ValueError, OverflowError):
            pass
        status = "auth_required" if code == 401 else "access_denied" if code == 403 else "unavailable"
        raise SourceError(status, f"Cliente MCP: fonte respondeu HTTP {code}.",
                          retryable=code == 429 or code in (500, 502, 503, 504),
                          retry_after=retry_after) from None
    except (httpx.RequestError, TimeoutError):
        raise SourceError("unavailable", f"Cliente MCP: conexao ou tempo de espera esgotado (limite {timeout} s).") from None
    except (ValueError, UnicodeError):
        raise SourceError("incompatible", "Cliente MCP recebeu JSON invalido.") from None
    if not isinstance(result, dict):
        raise SourceError("incompatible", "Cliente MCP recebeu estrutura invalida.")
    return result
