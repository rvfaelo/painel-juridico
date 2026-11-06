"""Conectores processuais gratuitos. Somente metadados/publicacoes publicas.

DataJud usa o cliente instalado de https://github.com/DeHor-Labs/mcp-juridico-brasil
(MIT), via service.datajud_mcp. Nao ha fallback HTTP proprio para DataJud.
juscraper e dependencia opcional separada.
"""
from __future__ import annotations

from collections import Counter
from datetime import date, timedelta
import hashlib
import html
import json
import math
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

CONTRACT_VERSION = 1
PUBLIC_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
DATAJUD_ENDPOINT = "https://api-publica.datajud.cnj.jus.br/api_publica_"
DJEN_ENDPOINT = "https://comunicaapi.pje.jus.br/api/v1/comunicacao"
DJEN_CERTIFICATE_HASH = re.compile(r"[A-Za-z0-9_-]{16,128}\Z")
DJEN_PDF_LIMIT = 8_000_000
# Aliases publicados pelo CNJ em https://datajud-wiki.cnj.jus.br/api-publica/endpoints/.
# O ramo do Judiciario e o codigo do tribunal vem do numero CNJ; nunca
# construir o endpoint a partir de um nome de tribunal informado pelo usuario.
STATE_COURTS = {
    1: "ac", 2: "al", 3: "ap", 4: "am", 5: "ba", 6: "ce", 7: "dft",
    8: "es", 9: "go", 10: "ma", 11: "mt", 12: "ms", 13: "mg",
    14: "pa", 15: "pb", 16: "pr", 17: "pe", 18: "pi", 19: "rj",
    20: "rn", 21: "rs", 22: "ro", 23: "rr", 24: "sc", 25: "se",
    26: "sp", 27: "to",
}
MAX_PAGE = 100
MAX_RESULTS = 10000


def digits(value):
    return re.sub(r"\D", "", str(value or ""))


def valid_cnj(value):
    n = digits(value)
    if len(n) != 20 or len(set(n)) == 1:
        return False
    base = n[:7] + n[9:]
    return int(n[7:9]) == (98 - int(base + "00") % 97)


def cnj_alias(value):
    n = digits(value)
    if not valid_cnj(n):
        return ""
    branch, court = n[13], int(n[14:16])
    if branch == "8":
        return "tj" + STATE_COURTS[court] if court in STATE_COURTS else ""
    if branch == "4" and 1 <= court <= 6:
        return "trf" + str(court)
    if branch == "5":
        return "tst" if court == 0 else "trt" + str(court) if 1 <= court <= 24 else ""
    if branch == "6":
        return "tse" if court == 0 else "tre-" + STATE_COURTS[court] if court in STATE_COURTS else ""
    if branch == "3" and court == 0:
        return "stj"
    if branch == "7" and court == 0:
        return "stm"
    if branch == "9" and court in (13, 21, 26):
        return "tjm" + STATE_COURTS[court]
    return ""  # STF, CNJ e codigos nao documentados nao sao inferidos.


def now_utc():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
        separators=(",", ":"), default=str).encode("utf-8")).hexdigest()


def strip_html(value):
    text = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", str(value or ""), flags=re.I | re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", text))).strip()


class SourceError(Exception):
    def __init__(self, status, message, *, retryable=False, retry_after=0):
        super().__init__(message)
        self.status = status
        self.retryable = retryable
        self.retry_after = max(0, min(3600, int(retry_after or 0)))


class _DjenJSONRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        if (parsed.scheme != "https" or parsed.hostname != "comunicaapi.pje.jus.br"
                or parsed.port not in (None, 443) or parsed.username or parsed.password):
            raise SourceError("access_denied", "Redirecionamento externo do DJEN recusado.")
        return super().redirect_request(request, fp, code, msg, headers, newurl)


def json_request(url, *, payload=None, headers=None, timeout=18):
    if not url.startswith("https://comunicaapi.pje.jus.br/"):
        raise SourceError("unsupported", "Host de consulta nao autorizado.")
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    h = {"Accept": "application/json", "User-Agent": "PautaLocal/0.4"}
    if payload is not None:
        h["Content-Type"] = "application/json"
    h.update(headers or {})
    try:
        with urllib.request.build_opener(_DjenJSONRedirect()).open(urllib.request.Request(url, data=data, headers=h), timeout=timeout) as r:
            if int(r.headers.get("Content-Length", "0") or 0) > 10_000_000:
                raise SourceError("incompatible", "Resposta maior que o limite.")
            content = r.read(10_000_001)
            if len(content) > 10_000_000:
                raise SourceError("incompatible", "Resposta maior que o limite.")
            result = json.loads(content.decode("utf-8"))
            if not isinstance(result, dict):
                raise ValueError("JSON nao e objeto")
            return result
    except urllib.error.HTTPError as e:
        status = ("auth_required" if e.code == 401 else "access_denied" if e.code == 403
                  else "unavailable" if e.code in (408, 429) or e.code >= 500 else "incompatible")
        retry = 0
        raw_retry = e.headers.get("Retry-After", "0") or "0"
        try:
            retry = int(raw_retry) if raw_retry.isdigit() else max(0, int(
                (parsedate_to_datetime(raw_retry) - datetime.now(timezone.utc)).total_seconds()))
        except (TypeError, ValueError, OverflowError):
            pass
        retryable = e.code in (408, 429) or e.code >= 500
        raise SourceError(status, f"Fonte respondeu HTTP {e.code}.", retryable=retryable,
                          retry_after=retry) from None
    except (TimeoutError, urllib.error.URLError, ConnectionError) as e:
        raise SourceError("unavailable", f"Conexao ou tempo de espera esgotado (limite {timeout} s).",
                          retryable=True) from e
    except (UnicodeError, ValueError) as e:
        raise SourceError("incompatible", "Fonte retornou estrutura nao reconhecida.") from e


def djen_certificate_url(hash_value):
    """Somente identificadores retornados pelo DJEN: nunca aceitar URL arbitraria."""
    if not isinstance(hash_value, str) or not DJEN_CERTIFICATE_HASH.fullmatch(hash_value):
        raise ValueError("Identificador da certidao DJEN invalido.")
    return DJEN_ENDPOINT + "/" + hash_value + "/certidao"


class _DjenCertificateRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        if (parsed.scheme != "https" or parsed.hostname != "comunicaapi.pje.jus.br"
                or parsed.port not in (None, 443) or parsed.username or parsed.password
                or not parsed.path.startswith("/api/v1/comunicacao/")):
            raise SourceError("access_denied", "Redirecionamento externo da certidao recusado.")
        return super().redirect_request(request, fp, code, msg, headers, newurl)


def fetch_djen_certificate(hash_value, *, opener=None, timeout=18):
    """PDF original emitido pelo CNJ, validado e limitado antes de servir localmente."""
    url = djen_certificate_url(hash_value)
    opener = opener or urllib.request.build_opener(_DjenCertificateRedirect())
    req = urllib.request.Request(url, headers={"Accept": "application/pdf", "User-Agent": "PautaLocal/0.4"})
    try:
        with opener.open(req, timeout=timeout) as response:
            if int(response.headers.get("Content-Length", "0") or 0) > DJEN_PDF_LIMIT:
                raise SourceError("incompatible", "Certidao excede o limite de 8 MB.")
            content = response.read(DJEN_PDF_LIMIT + 1)
            if len(content) > DJEN_PDF_LIMIT or len(content) < 8 or not content.startswith(b"%PDF-"):
                raise SourceError("incompatible", "CNJ nao retornou um arquivo PDF valido.")
            return content
    except urllib.error.HTTPError as exc:
        status = ("auth_required" if exc.code == 401 else "access_denied" if exc.code == 403
                  else "unavailable" if exc.code in (408, 429) or exc.code >= 500 else "not_found")
        raise SourceError(status, "CNJ recusou a certidao (HTTP %d)." % exc.code,
                          retryable=exc.code in (408, 429) or exc.code >= 500) from None
    except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
        raise SourceError("unavailable", "Nao foi possivel acessar a certidao do CNJ.", retryable=True) from exc


def _metadata(hit):
    source = hit.get("_source")
    if not isinstance(source, dict) or not hit.get("_id"):
        raise SourceError("incompatible", "Registro DataJud sem identificador.")
    tr = str(source.get("tribunal") or "")
    grau = str(source.get("grau") or "")
    system = source.get("sistema")
    if isinstance(system, dict):
        system = system.get("nome") or ("Código " + str(system["codigo"]) if system.get("codigo") is not None else "")
    return {"id": "datajud:" + str(hit["_id"]), "tribunal": tr,
            "grau": grau, "sistema": str(system or ""),
            "classe": source.get("classe") or {}, "assuntos": source.get("assuntos") or [],
            "orgao": source.get("orgaoJulgador") or {}, "dataAjuizamento": source.get("dataAjuizamento") or "",
            "ultimaAtualizacaoFonte": source.get("dataHoraUltimaAtualizacao") or source.get("@timestamp") or ""}


def parse_datajud_page(payload, cnj):
    # HTTP 200 pode ocultar timeout/falha de shards e um falso resultado vazio.
    if payload.get("timed_out") or (payload.get("_shards") or {}).get("failed", 0):
        raise SourceError("unavailable", "DataJud retornou busca incompleta (timeout interno ou falha de shards).",
                          retryable=True, retry_after=10)
    hits_block = payload.get("hits")
    if not isinstance(hits_block, dict) or not isinstance(hits_block.get("hits"), list):
        raise SourceError("incompatible", "Campo hits.hits ausente no DataJud.")
    total_data = hits_block.get("total")
    total = total_data.get("value") if isinstance(total_data, dict) else total_data
    if not isinstance(total, int) or total < 0:
        raise SourceError("incompatible", "Contagem DataJud desconhecida.")
    uncertain = isinstance(total_data, dict) and total_data.get("relation") == "gte"
    tram, events = [], []
    for hit in hits_block["hits"]:
        s = hit.get("_source")
        if not isinstance(s, dict) or digits(s.get("numeroProcesso")) != digits(cnj):
            raise SourceError("incompatible", "Numero CNJ divergente na resposta.")
        if int(s.get("nivelSigilo") or 0) > 0:
            raise SourceError("access_denied", "Registro restrito: confira o acesso no portal do tribunal.")
        metadata = _metadata(hit)
        tram.append(metadata)
        movements = s.get("movimentos")
        if movements is None:
            movements = []
        if not isinstance(movements, list):
            raise SourceError("incompatible", "Lista de movimentos invalida.")
        seen_duplicates = Counter()
        for movement in movements:
            if not isinstance(movement, dict):
                raise SourceError("incompatible", "Movimento nao estruturado.")
            when = movement.get("dataHora")
            code = movement.get("codigo")
            name = str(movement.get("nome") or "").strip()
            if not when or not (name or code is not None):
                raise SourceError("incompatible", "Movimento sem data ou identificacao.")
            complements = movement.get("complementosTabelados") or []
            if not isinstance(complements, list):
                complements = []
            suffix = " · ".join(" ".join(str(x.get(k) or "") for k in ("nome", "descricao", "valor")).strip()
                                for x in complements if isinstance(x, dict))
            description = (name or ("Movimento " + str(code))) + ((" — " + suffix) if suffix else "")
            stable = movement.get("id") or movement.get("identificador")
            content = fingerprint(movement)
            if stable is None:
                seen_duplicates[content] += 1
                stable = content + ":" + str(seen_duplicates[content])
            event_id = "datajud:" + str(hit["_id"]) + ":" + str(stable)
            events.append({"id": event_id, "tramitationId": metadata["id"], "source": "datajud",
                           "occurredAt": str(when), "text": description, "sourceUpdatedAt": metadata["ultimaAtualizacaoFonte"],
                           "digest": content, "code": code, "kind": "movement"})
    return total, uncertain, tram, events


def consult_datajud(cnj, key="", requester=None):
    if requester is None:
        from .datajud_mcp import request_datajud
        requester = request_datajud
    alias = cnj_alias(cnj)
    if not alias:
        raise SourceError("unsupported", "Tribunal fora do escopo DataJud configurado ou CNJ invalido.")
    key = (key or os.getenv("PAUTA_DATAJUD_KEY") or PUBLIC_KEY).removeprefix("APIKey ").strip()
    tram, events = [], []
    total = None
    incomplete = False
    for page in range(MAX_RESULTS // MAX_PAGE):
        try:
            response = requester(DATAJUD_ENDPOINT + alias + "/_search",
                                 payload={"size": MAX_PAGE, "from": page * MAX_PAGE,
                                          "track_total_hits": True, "query": {"match": {"numeroProcesso": digits(cnj)}}},
                                 headers={"Authorization": "APIKey " + key})
            count, uncertain, new_tram, new_events = parse_datajud_page(response, cnj)
        except SourceError:
            if not tram:
                raise
            incomplete = True
            break
        if total is not None and count != total:
            incomplete = True
        total = count
        incomplete |= uncertain
        tram.extend(new_tram)
        events.extend(new_events)
        if len(new_tram) == 0 and page * MAX_PAGE < total:
            incomplete = True
            break
        if (page + 1) * MAX_PAGE >= total:
            break
        if len(new_tram) < MAX_PAGE:
            incomplete = True
            break
    else:
        incomplete = total is not None and total > MAX_RESULTS
    return {"status": "partial" if incomplete else "not_found" if not tram else "success",
            "source": "datajud", "tramitations": tram, "events": events, "documents": [],
            "sourceUpdatedAt": max((t["ultimaAtualizacaoFonte"] for t in tram), default=""),
            "limitation": "Mais resultados que a janela de paginacao ou contagem instavel." if incomplete else
                          "Metadados publicos; nao inclui autos, partes protegidas ou atualizacao em tempo real."}


def _public_label(value, limit=180):
    """Texto legível de códigos DataJud sem converter dicionários inteiros em strings."""
    if isinstance(value, dict):
        value = value.get("nome") or value.get("descricao") or ""
    if not isinstance(value, (str, int)):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()[:limit]


def preview_datajud(cnj, key="", fetch=consult_datajud):
    """Prévia avulsa, sem salvar no SQLite e sem expor movimentações ou chave.

    Usa o mesmo conector DataJud da fila, mas entrega somente campos públicos
    pertinentes ao cadastro; todos os registros vêm do CNJ consultado.
    """
    if not isinstance(cnj, str) or len(cnj) > 25 or not valid_cnj(cnj):
        raise ValueError("Informe um número CNJ válido (20 dígitos e verificadores).")
    response = fetch(digits(cnj), key)
    records = []
    for item in response.get("tramitations", [])[:100]:
        subjects = item.get("assuntos")
        if not isinstance(subjects, list):
            subjects = []
        labels = [_public_label(subject) for subject in subjects[:20]]
        records.append({
            "id": _public_label(item.get("id"), 150),
            "tribunal": _public_label(item.get("tribunal"), 35),
            "grau": _public_label(item.get("grau"), 35),
            "sistema": _public_label(item.get("sistema"), 100),
            "classe": _public_label(item.get("classe")),
            "assuntos": [x for x in labels if x],
            "orgao": _public_label(item.get("orgao")),
            "dataAjuizamento": _public_label(item.get("dataAjuizamento"), 45),
            "sourceUpdatedAt": _public_label(item.get("ultimaAtualizacaoFonte"), 45),
        })
    total = len(response.get("tramitations", []))
    partial = response.get("status") == "partial" or total > len(records)
    return {"status": "partial" if partial else "not_found" if not records else "success",
            "cnj": digits(cnj), "records": records, "partial": bool(partial),
            "totalReturned": total,
            "message": ("Consulta parcial. Confira os registros e o portal oficial."
                        if partial else "Nenhum registro localizado nesta resposta. Isso não comprova inexistência do processo."
                        if not records else "Metadados públicos recebidos. Confira antes de salvar.")}


def djen_details(item):
    """Metadados da publicacao; nunca preenche o cadastro processual."""
    details = {}
    for field, key in [("tribunal", "siglaTribunal"), ("orgao", "nomeOrgao"),
                       ("classe", "nomeClasse"), ("tipoComunicacao", "tipoComunicacao"),
                       ("tipoDocumento", "tipoDocumento"), ("meio", "meio"),
                       ("numeroComunicacao", "numeroComunicacao")]:
        if key in item:
            details[field] = _public_label(item[key])
    if "ativo" in item:
        details["ativo"] = item["ativo"] is not False
    if isinstance(item.get("destinatarios"), list):
        details["destinatarios"] = [{"nome": _public_label(x.get("nome")),
                                     "polo": _public_label(x.get("polo"), 30)}
                                    for x in item["destinatarios"] if isinstance(x, dict)]
    if isinstance(item.get("destinatarioadvogados"), list):
        lawyers = []
        for row in item["destinatarioadvogados"]:
            if not isinstance(row, dict):
                continue
            lawyer = row.get("advogado") if isinstance(row.get("advogado"), dict) else row
            lawyers.append({"nome": _public_label(lawyer.get("nome")),
                            "numeroOab": _public_label(lawyer.get("numero_oab"), 30),
                            "ufOab": _public_label(lawyer.get("uf_oab"), 2)})
        details["advogados"] = sorted(lawyers, key=lambda x: (x["nome"], x["numeroOab"], x["ufOab"]))
    if "destinatarios" in details:
        details["destinatarios"].sort(key=lambda x: (x["nome"], x["polo"]))
    return details


def consult_djen(cnj="", *, oab="", uf="", days=30, requester=json_request,
                 nome_parte="", nome_advogado="", search_page=None):
    for name in (nome_parte, nome_advogado):
        if not isinstance(name, str) or name and not 3 <= len(name.strip()) <= 200:
            raise ValueError("Informe um nome entre 3 e 200 caracteres.")
    if search_page is not None and (type(search_page) is not int or not 1 <= search_page <= 100):
        raise ValueError("Pagina invalida; reduza o periodo para buscas muito amplas.")
    if not cnj and not (oab and uf) and not (nome_parte.strip() or nome_advogado.strip()):
        raise SourceError("unsupported", "Informe numero CNJ ou OAB/UF.")
    end = date.today()
    start = end - timedelta(days=min(365, max(1, int(days))) - 1)
    events = []
    incomplete = False
    count = 0
    for page in ([search_page] if search_page else range(1, 101)):
        args = {"pagina": page, "itensPorPagina": 100,
                "dataDisponibilizacaoInicio": start.isoformat(), "dataDisponibilizacaoFim": end.isoformat()}
        if cnj:
            args["numeroProcesso"] = digits(cnj)
        elif oab and uf:
            args.update(numeroOab=oab, ufOab=uf)
        if nome_parte.strip():
            args["nomeParte"] = nome_parte.strip()
        if nome_advogado.strip():
            args["nomeAdvogado"] = nome_advogado.strip()
        try:
            data = requester(DJEN_ENDPOINT + "?" + urllib.parse.urlencode(args))
        except SourceError:
            if not events:
                raise
            incomplete = True
            break
        items, total = data.get("items"), data.get("count")
        if not isinstance(items, list) or not isinstance(total, int) or total < 0:
            raise SourceError("incompatible", "Formato DJEN nao reconhecido.")
        count = total
        if len(items) > 100:
            raise SourceError("incompatible", "DJEN retornou mais itens que o solicitado.")
        if (page - 1) * 100 + len(items) < total and len(items) != 100:
            incomplete = True
            break
        for item in items:
            if not isinstance(item, dict) or item.get("id") is None or not item.get("data_disponibilizacao") or not item.get("numero_processo"):
                raise SourceError("incompatible", "Publicacao sem ID, data ou numero.")
            if cnj and digits(item["numero_processo"]) != digits(cnj):
                raise SourceError("incompatible", "Publicacao retornada para outro processo.")
            url = item.get("link") or ""
            certificate_hash = item.get("hash")
            certificate_hash = certificate_hash if isinstance(certificate_hash, str) and DJEN_CERTIFICATE_HASH.fullmatch(certificate_hash) else ""
            events.append({"id": "djen:" + str(item["id"]), "tramitationId": "djen:" + digits(item["numero_processo"]),
                           "cnj": digits(item["numero_processo"]), "source": "djen", "kind": "publication",
                           "occurredAt": str(item["data_disponibilizacao"]), "text": strip_html(item.get("texto") or ""),
                           "sourceUpdatedAt": "", "digest": fingerprint(item),
                           "url": url if isinstance(url, str) and url.startswith("https://") else "",
                           "certificateHash": certificate_hash, "publicationDetails": djen_details(item)})
        if page * 100 >= total:
            break
    else:
        incomplete = not search_page and count > 10000
    return {"status": "partial" if incomplete else "not_found" if not events else "success",
            "source": "djen", "tramitations": [], "events": events, "documents": [],
            "sourceUpdatedAt": "", "page": search_page or 1, "total": count,
            "hasNext": bool(search_page and not incomplete and search_page < 100 and search_page * 100 < count),
            "limitReached": bool(search_page and search_page * 100 >= 10000 and count > 10000),
            "limitation": "Consulta por periodo; nao representa os autos ou todos os andamentos."}


def parse_esaj_result(raw, cnj, degree):
    """Contratos do juscraper TJSP: tabelas PG e DataFrame com movimentos SG."""
    source = "esaj_" + degree
    truncated = False

    def table_rows(table):
        nonlocal truncated
        if hasattr(table, "to_json") and hasattr(table, "head"):
            truncated = truncated or len(table) > 1000
            return json.loads(table.head(1000).to_json(orient="records", date_format="iso"))
        if isinstance(table, list):
            truncated = truncated or len(table) > 1000
            return table[:1000]
        if isinstance(table, dict):
            return [table]
        raise SourceError("incompatible", "Tabela e-SAJ em formato não reconhecido. Confira o processo no portal TJSP.")

    def clean(value):
        if isinstance(value, dict):
            return {str(k): clean(v) for k, v in value.items() if k != "file_path"}
        if isinstance(value, list):
            return [clean(v) for v in value[:1000]]
        if isinstance(value, float) and not math.isfinite(value):
            return None
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        return str(value)

    if isinstance(raw, dict):
        tables = {str(k): clean(table_rows(v)) for k, v in raw.items()}
        known = "movimentacoes" in tables
        movements = tables.get("movimentacoes", [])
    elif hasattr(raw, "to_json") and hasattr(raw, "head"):
        records = clean(table_rows(raw))
        tables = {"processos": records}
        known = bool(records) and all(isinstance(row, dict) and isinstance(row.get("movimentacoes"), list) for row in records)
        movements = [item for row in records if isinstance(row, dict) for item in row.get("movimentacoes", [])] if known else []
    else:
        raise SourceError("incompatible", "O juscraper retornou um formato e-SAJ não reconhecido. Confira no portal TJSP.")
    if not any(tables.values()):
        raise SourceError("unavailable", "O e-SAJ não retornou dados legíveis. Confira no portal TJSP; isso não prova que o processo inexiste.")
    events, skipped = {}, 0
    for row in movements[:1000]:
        if not isinstance(row, dict):
            skipped += 1
            continue
        text = strip_html(row.get("movimento") or "")
        extra = strip_html(row.get("observacao") or row.get("descricao") or "")
        text = text + (" — " + extra if extra else "")
        raw_date = row.get("data")
        try:
            if not isinstance(raw_date, str):
                raise ValueError()
            if re.fullmatch(r"\d{2}/\d{2}/\d{4}", raw_date.strip()):
                when = datetime.strptime(raw_date.strip(), "%d/%m/%Y").date().isoformat()
            else:
                when = date.fromisoformat(raw_date[:10]).isoformat()
            if not text:
                raise ValueError()
        except (ValueError, TypeError):
            skipped += 1
            continue
        digest = fingerprint({"cnj": digits(cnj), "degree": degree, "date": when, "text": text})
        event_id = source + ":" + digest
        events[event_id] = {"id": event_id, "source": source, "kind": "movement", "occurredAt": when,
                            "text": text, "digest": digest, "tramitationId": source + ":" + digits(cnj), "sourceUpdatedAt": ""}
    partial = not known or skipped > 0 or truncated or len(movements) > 1000
    limitation = ("Dados parciais do e-SAJ: " + (str(skipped) + " movimento(s) com data ou descrição não reconhecida. " if skipped else "") +
                  "Confira o histórico no portal TJSP." if partial else "Movimentos reconhecidos no retorno público do e-SAJ. Não inclui autos ou documentos restritos.")
    return {"status": "partial" if partial else "success", "source": source,
            "tramitations": [{"id": source + ":" + digits(cnj), "tribunal": "TJSP", "grau": "1" if degree == "pg" else "2", "sistema": "e-SAJ", "tabelas": tables}],
            "events": list(events.values()), "documents": [], "sourceUpdatedAt": "", "limitation": limitation}


def consult_esaj(cnj, degree="pg"):
    if cnj_alias(cnj) != "tjsp":
        raise SourceError("unsupported", "e-SAJ desta integração: apenas TJSP.")
    try:
        import juscraper as jus
    except ImportError:
        raise SourceError("unsupported", "Conector opcional indisponível. Instale juscraper==0.5.0.") from None
    if degree not in ("pg", "sg"):
        raise SourceError("unsupported", "Grau e-SAJ não suportado.")
    try:
        scraper = jus.scraper("tjsp")
        raw = getattr(scraper, "cpopg" if degree == "pg" else "cposg")(digits(cnj))
    except Exception as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (401, 403):
            raise SourceError("access_denied", "O portal TJSP recusou o acesso. Confira manualmente no e-SAJ; o painel não resolve CAPTCHA ou autenticação.") from None
        if isinstance(exc, ValueError):
            raise SourceError("incompatible", "O juscraper não conseguiu interpretar o retorno do e-SAJ. O portal pode ter mudado ou não ter retornado dados. Confira manualmente no TJSP.") from None
        raise SourceError("unavailable", "Consulta e-SAJ indisponível ou bloqueada pelo portal TJSP. Tente mais tarde ou confira manualmente; os dados anteriores foram preservados.") from None
    return parse_esaj_result(raw, cnj, degree)


def probe_public_sources(key="", requester=None):
    """Testa conexao/formato sem numeros reais, OAB, CPF ou dados da carteira.

    Acionado manualmente, nao como parte do monitoramento automatico.
    Os conteudos eventuais da resposta sao descartados imediatamente.
    """
    access_key = (key or os.getenv("PAUTA_DATAJUD_KEY") or PUBLIC_KEY).removeprefix("APIKey ").strip()
    today = date.today().isoformat()
    probes = [
        ("datajud", DATAJUD_ENDPOINT + "tjrj/_search",
         {"payload": {"size": 0, "query": {"match_none": {}}},
          "headers": {"Authorization": "APIKey " + access_key}, "timeout": 120}),
        ("djen", DJEN_ENDPOINT + "?" + urllib.parse.urlencode({
            "pagina": 1, "itensPorPagina": 1,
            "dataDisponibilizacaoInicio": today, "dataDisponibilizacaoFim": today}),
         {"timeout": 8}),
    ]
    results = []
    for name, url, options in probes:
        try:
            if requester is None:
                from .datajud_mcp import request_datajud
                fetch = request_datajud if name == "datajud" else json_request
            else:
                fetch = requester
            response = fetch(url, **options)
            if name == "datajud":
                valid = isinstance(response.get("hits"), dict) and isinstance(response["hits"].get("hits"), list)
            else:
                valid = isinstance(response.get("items"), list) and isinstance(response.get("count"), int)
            results.append({"source": name, "status": "reachable" if valid else "incompatible",
                            "message": "Conexão e formato reconhecidos." if valid else "A fonte respondeu em formato inesperado."})
        except SourceError as error:
            limited = "HTTP 429" in str(error)
            results.append({"source": name,
                            "status": "rate_limited" if limited else error.status,
                            "message": "Limite de consultas da fonte (HTTP 429). Aguarde antes de repetir." if limited else str(error)})
        except Exception:
            results.append({"source": name, "status": "unavailable",
                            "message": "Falha na verificação da fonte; tente novamente."})
    return results


def capabilities(installed=False):
    return [
        {"id": "datajud", "label": "DataJud via MCP Juridico Brasil", "enabled": True, "auth": "chave publica",
         "courts": ["TJs (27)", "TRFs (1-6)", "TRTs (1-24)", "TREs (27)",
                    "STJ", "TST", "TSE", "STM", "TJMs (MG, RS, SP)"],
         "process": True, "movements": True, "documents": False},
        {"id": "djen", "label": "DJEN", "enabled": True, "auth": "publica",
         "courts": ["publicacoes de tribunais participantes"], "process": False, "movements": False, "documents": False},
        *[{"id": "esaj_" + degree, "label": "TJSP e-SAJ " + ("1o grau" if degree == "pg" else "2o grau"),
            "enabled": installed, "auth": "publica ou restrita conforme consulta",
            "courts": ["TJSP"], "process": installed, "movements": False, "documents": False} for degree in ("pg", "sg")],
        {"id": "pdpj", "label": "Jus.br/PDPJ", "enabled": False, "auth": "login interativo necessario",
         "courts": [], "process": False, "movements": False, "documents": False}
    ]
