"""Servidor Painel H.B local: HTML e API sob a mesma origem, somente loopback.

Uso: python -m service.main --open | --status | --stop
Nunca servir a rede, aceitar Origin:null ou caminhos locais arbitrarios.
"""
from __future__ import annotations

from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import argparse
import importlib.util
import hashlib
import json
import os
import secrets
import socket
import threading
import time
import urllib.error
import urllib.request
import webbrowser

from .connectors import CONTRACT_VERSION, SourceError, capabilities, consult_datajud, consult_djen, consult_esaj, probe_public_sources, preview_datajud, fetch_djen_certificate
from .store import Store
from .workspace import Workspace, WorkspaceConflict

HOST = "127.0.0.1"
DEFAULT_PORT = 8766
APP_VERSION = "0.6.1"
ROOT = Path(__file__).resolve().parent.parent
STATIC = {"/": ("dashboard.html", "text/html; charset=utf-8"),
          "/dashboard.html": ("dashboard.html", "text/html; charset=utf-8"),
          "/app.bundle.js": ("app.bundle.js", "text/javascript; charset=utf-8"),
          "/boot-check.js": ("boot-check.js", "text/javascript; charset=utf-8"),
          "/styles.css": ("styles.css", "text/css; charset=utf-8")}


class Worker(threading.Thread):
    def __init__(self, store, sources=None, schedule=True):
        super().__init__(daemon=True, name="pauta-" + ("djen" if sources == ("djen",) else "monitoramento"))
        self.store = store
        self.sources = sources
        self.schedule = schedule
        self.stop_event = threading.Event()
        self.last_error = ""

    def run(self):
        while not self.stop_event.is_set():
            try:
                if self.schedule:
                    local = datetime.now(ZoneInfo("America/Sao_Paulo"))
                    self.store.scheduled(local.date().isoformat(), local.strftime("%H:%M"))
                job = self.store.claim(self.sources)
                if job:
                    try:
                        s = self.store.settings()
                        if not s["enabled"].get(job["source"]):
                            raise SourceError("unsupported", "Conector desabilitado.")
                        if job["source"] == "datajud":
                            result = consult_datajud(job["cnj"], s.get("datajudKey", ""))
                        elif job["source"] == "djen":
                            result = consult_djen(job["cnj"], oab=job["oab"], uf=job["uf"],
                                                  days=s["djenDays"])
                        elif job["source"] in ("esaj_pg", "esaj_sg"):
                            result = consult_esaj(job["cnj"], job["source"][-2:])
                        else:
                            raise SourceError("unsupported", "Conector nao implementado.")
                        self.store.finish(job, result=result)
                    except SourceError as e:
                        self.store.finish(job, error=e)
                    except Exception:
                        self.store.finish(job, error=SourceError("incompatible",
                                         "Erro na interpretacao da fonte; dados anteriores preservados."))
                    self.stop_event.wait(2.0)  # espacar consultas de cada fila independente
                    continue
            except Exception:
                # Nao registrar tokens, conteudos de processo ou tracebacks em logs.
                self.last_error = "O ciclo de monitoramento falhou. Confira a integridade do banco e reinicie o serviço."
            self.stop_event.wait(3.0)


class Server(ThreadingHTTPServer):
    allow_reuse_address = os.name != "nt"
    daemon_threads = True

    def server_bind(self):
        if os.name == "nt":
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

    def __init__(self, port, store=None):
        super().__init__((HOST, port), Handler)
        # Reservar a porta antes de abrir o banco: abrir uma segunda instancia
        # nao pode invalidar a fila e respostas da instancia que ja esta rodando.
        try:
            self.store = store if store is not None else Store()
            self.workspace = Workspace(self.store)
        except Exception:
            self.server_close()
            raise
        self.csrf = secrets.token_urlsafe(40)
        self.origin = f"http://{HOST}:{port}"
        self.worker = Worker(self.store, sources=("datajud", "esaj_pg", "esaj_sg"))
        self.djen_worker = Worker(self.store, sources=("djen",), schedule=False)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "PautaLocal"
    sys_version = ""

    def log_message(self, fmt, *args):
        # Nao escrever URLs, dados processuais ou segredos em historico de console.
        pass

    def respond(self, obj, code=200):
        blob = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(blob)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(blob)

    def allowed_host(self):
        host = self.headers.get("Host", "")
        return host == self.server.origin.removeprefix("http://")

    def csrf_matches(self):
        token = self.headers.get("X-Pauta-CSRF", "")
        try:
            return secrets.compare_digest(token, self.server.csrf)
        except TypeError:
            return False

    def allowed_origin(self):
        origin = self.headers.get("Origin")
        site = self.headers.get("Sec-Fetch-Site", "")
        if origin is not None and origin != self.server.origin:
            return False
        if site in ("cross-site", "none"):
            return site == "none" and origin is None and self.csrf_matches()
        return True

    def guard_host(self):
        if not self.allowed_host():
            self.respond({"error": "Host nao autorizado."}, 403)
            return False
        return True

    def guard_read(self):
        if not self.allowed_origin() or not self.csrf_matches():
            self.respond({"error": "Sessão local necessária."}, 403)
            return False
        return True

    def guard_post(self):
        if not self.allowed_origin():
            self.respond({"error": "Origin nao autorizado."}, 403)
            return False
        if not self.csrf_matches():
            self.respond({"error": "Sessao local expirada; recarregue o painel."}, 403)
            return False
        if self.headers.get("Content-Type", "").split(";", 1)[0].lower() != "application/json":
            self.respond({"error": "A API aceita somente JSON."}, 415)
            return False
        return True

    def get_json_body(self):
        size = int(self.headers.get("Content-Length", "0"))
        if size < 2 or size > 40_000_000:
            raise ValueError("Tamanho do JSON excede o limite.")
        value = json.loads(self.rfile.read(size).decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("Objeto JSON esperado.")
        return value

    def do_GET(self):
        if not self.guard_host():
            return
        path = urlsplit(self.path).path
        try:
            if path == "/api/v1/health":
                from .datajud_mcp import CLIENT_ID, CLIENT_COMMIT
                return self.respond({"product": "pauta-local-service", "appVersion": APP_VERSION,
                                     "contractVersion": CONTRACT_VERSION, "status": "ok",
                                     "installationId": hashlib.sha256(os.path.normcase(str(ROOT.resolve())).encode('utf-8')).hexdigest(),
                                     "datajudClient": CLIENT_ID, "datajudClientCommit": CLIENT_COMMIT})
            if os.getenv('HB_UPDATE_VALIDATION') == '1' and path not in ('/api/v1/session', '/api/v1/status'):
                return self.respond({'error': 'Validacao de atualizacao em andamento. Aguarde a Central.'}, 503)
            if path == "/api/v1/session":
                return self.respond({"product": "pauta-local-service", "appVersion": APP_VERSION,
                                     "contractVersion": CONTRACT_VERSION, "csrf": self.server.csrf})
            if path == "/api/v1/status":
                s = self.server.store.settings()
                return self.respond({"appVersion": APP_VERSION, "contractVersion": CONTRACT_VERSION,
                                     "service": "online", "dataDirectory": str(self.server.store.directory),
                                     "settings": {**s, "datajudKey": ""}, "worker": self.server.worker.is_alive(),
                                     "workerError": self.server.worker.last_error,
                                     "djenWorker": self.server.djen_worker.is_alive(),
                                     "djenWorkerError": self.server.djen_worker.last_error})
            if path == "/api/v1/connectors":
                installed = importlib.util.find_spec("juscraper") is not None
                return self.respond({"contractVersion": CONTRACT_VERSION,
                                     "sources": capabilities(installed)})
            if (path in ("/api/v1/workspace", "/api/v1/workspace/export", "/api/v1/cases",
                         "/api/v1/dashboard", "/api/v1/publications", "/api/v1/notifications",
                         "/api/v1/backup")
                    or path.startswith("/api/v1/processes/")
                    or (path.startswith("/api/v1/publications/") and path.endswith("/certidao"))):
                # Dados locais exigem a sessão também para leitura, inclusive
                # os que antes eram entregues apenas com Host correto.
                if not self.guard_read():
                    return
            if path in ("/api/v1/workspace", "/api/v1/workspace/export", "/api/v1/cases"):
                result = self.server.workspace.read(files=path.endswith('/export'))
                if path == '/api/v1/cases':
                    return self.respond({'initialized': result['initialized'],
                        'revision': result['state']['revision'] if result['initialized'] else None,
                        'cases': result['state']['cases'] if result['initialized'] else []})
                return self.respond(result)
            if path == "/api/v1/dashboard":
                return self.respond({"contractVersion": CONTRACT_VERSION, **self.server.store.summary()})
            if path == "/api/v1/publications":
                return self.respond(self.server.store.publications())
            if path == "/api/v1/notifications":
                return self.respond(self.server.store.notifications())
            if path.startswith("/api/v1/publications/") and path.endswith("/certidao"):
                event_id = unquote(path[len("/api/v1/publications/"):-len("/certidao")])
                certificate_hash = self.server.store.certificate_hash_for_publication(event_id)
                if not certificate_hash:
                    return self.respond({"error": "Certidao nao disponivel neste registro. Atualize as publicacoes pelo DJEN para obter o hash."}, 404)
                try:
                    pdf = fetch_djen_certificate(certificate_hash)
                except SourceError as error:
                    code = (429 if "HTTP 429" in str(error) else
                            401 if error.status == "auth_required" else
                            403 if error.status == "access_denied" else
                            404 if error.status == "not_found" else
                            502 if error.status == "incompatible" else 503)
                    return self.respond({"error": str(error), "sourceStatus": error.status}, code)
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Disposition", "attachment; filename=certidao-djen.pdf")
                self.send_header("Content-Length", str(len(pdf)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("X-Frame-Options", "DENY")
                self.end_headers()
                self.wfile.write(pdf)
                return
            if path == "/api/v1/backup":
                return self.respond(self.server.store.export_monitoring())
            if path.startswith("/api/v1/processes/"):
                case_id = unquote(path[len("/api/v1/processes/"):])
                if not case_id or "/" in case_id or len(case_id) > 120:
                    return self.respond({"error": "Identificador invalido."}, 400)
                return self.respond({"contractVersion": CONTRACT_VERSION,
                                     **self.server.store.case_detail(case_id)})
            if path.startswith("/api/"):
                return self.respond({"error": "Rota nao encontrada."}, 404)
            item = STATIC.get(path)
            if not item:
                return self.respond({"error": "Arquivo nao disponivel."}, 404)
            name, mime = item
            payload = (ROOT / name).read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Cache-Control", "no-cache, must-revalidate")
            self.send_header("Content-Security-Policy",
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "connect-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'; object-src 'none'; base-uri 'none'")
            self.end_headers()
            self.wfile.write(payload)
        except (ValueError, KeyError) as e:
            self.respond({"error": str(e)}, 400)
        except OSError:
            self.respond({"error": "Arquivo ou banco indisponivel."}, 503)

    def do_POST(self):
        if not self.guard_host() or not self.guard_post():
            return
        path = urlsplit(self.path).path
        if os.getenv('HB_UPDATE_VALIDATION') == '1' and path != '/api/v1/shutdown':
            return self.respond({'error': 'Validacao de atualizacao em andamento.'}, 503)
        try:
            body = self.get_json_body()
            store = self.server.store
            if path in ('/api/v1/workspace/migrate', '/api/v1/workspace/save', '/api/v1/cases/command'):
                return self.respond(self.server.workspace.write(body,
                    migrate=path.endswith('/migrate'), command=path.endswith('/command')))
            if path == "/api/v1/cases/sync":
                return self.respond(store.sync_cases(body.get("cases"), allow_empty=body.get("allowEmpty") is True))
            if path == "/api/v1/settings":
                return self.respond({"settings": store.update_settings(body)})
            if path == "/api/v1/diagnostics":
                return self.respond({"contractVersion": CONTRACT_VERSION,
                                     "results": probe_public_sources(store.settings().get("datajudKey", "")),
                                     "scope": "Somente conectividade e formato; nenhum processo/OAB consultado."})
            if path == "/api/v1/datajud/preview":
                number = body.get("cnj")
                if not isinstance(number, str) or len(number) > 25:
                    return self.respond({"error": "Informe um número CNJ válido."}, 400)
                try:
                    result = preview_datajud(number, store.settings().get("datajudKey", ""),
                                             fetch=consult_datajud)
                except ValueError:
                    return self.respond({"error": "Informe um número CNJ válido (20 dígitos e verificadores)."}, 400)
                except SourceError as error:
                    # Nunca serializar exceções de transporte, cabeçalhos ou a chave.
                    code = (429 if "HTTP 429" in str(error) else
                            401 if error.status == "auth_required" else
                            403 if error.status == "access_denied" else
                            422 if error.status == "unsupported" else 503)
                    return self.respond({"error": str(error)[:180], "sourceStatus": error.status}, code)
                except Exception:
                    return self.respond({"error": "Falha ao interpretar resposta DataJud. Nenhum cadastro foi alterado."}, 502)
                return self.respond({"contractVersion": CONTRACT_VERSION, **result})
            if path == "/api/v1/djen/search":
                criterion, name = body.get("criterion"), body.get("name")
                days, page = body.get("days", 30), body.get("page", 1)
                if criterion not in ("nomeParte", "nomeAdvogado") or not isinstance(name, str) or not 3 <= len(name.strip()) <= 200:
                    raise ValueError("Escolha parte ou advogado e informe um nome entre 3 e 200 caracteres.")
                if type(days) is not int or not 1 <= days <= 365:
                    raise ValueError("Periodo invalido: use de 1 a 365 dias.")
                try:
                    result = consult_djen(days=days, search_page=page,
                        **({"nome_parte": name} if criterion == "nomeParte" else {"nome_advogado": name}))
                except SourceError as error:
                    return self.respond({"error": str(error), "sourceStatus": error.status}, 503)
                with store.connection() as db:
                    matches = {}
                    for row in db.execute("SELECT id,cnj FROM cases WHERE active=1 ORDER BY id"):
                        matches.setdefault(row["cnj"], row["id"])
                for event in result["events"]:
                    event["caseId"] = matches.get(event["cnj"], "")
                return self.respond({"contractVersion": CONTRACT_VERSION, **result})
            if path == "/api/v1/djen/preview":
                from .connectors import valid_cnj, digits
                number = body.get("cnj")
                if not isinstance(number, str) or len(number) > 25 or not valid_cnj(number):
                    return self.respond({"error": "Informe um número CNJ válido."}, 400)
                try:
                    result = consult_djen(digits(number), days=30)
                except SourceError as error:
                    return self.respond({"error": str(error), "sourceStatus": error.status}, 503)
                return self.respond({"contractVersion": CONTRACT_VERSION, **result})
            if path == "/api/v1/jobs":
                return self.respond(store.enqueue(body.get("ids", []), body.get("sources"),
                                                  oab=body.get("oab", False)))
            if path == "/api/v1/jobs/cancel":
                return self.respond(store.cancel(body.get("ids")))
            if path == "/api/v1/jobs/retry":
                return self.respond(store.retry_job(body.get("jobId", "")))
            if path == "/api/v1/events/seen":
                return self.respond(store.mark_seen(body.get("caseId", ""), body.get("source", ""),
                                                    body.get("eventId", "")))
            if path == "/api/v1/notifications/detail":
                return self.respond(store.notification_detail(body.get('source'), body.get('id'), body.get('cnj')))
            if path == "/api/v1/notifications/seen":
                return self.respond(store.mark_notifications(body.get('events'), body.get('seen')))
            if path == "/api/v1/restore":
                return self.respond(store.restore_monitoring(body.get("monitoring")))
            if path == "/api/v1/shutdown":
                self.respond({"status": "stopping"})
                self.server.worker.stop_event.set()
                self.server.djen_worker.stop_event.set()
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return
            return self.respond({"error": "Rota nao encontrada."}, 404)
        except WorkspaceConflict as e:
            self.respond({'error': str(e)}, 409)
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as e:
            self.respond({"error": str(e)[:250]}, 400)
        except Exception:
            self.respond({"error": "Operacao nao concluida; confira o banco local."}, 500)


def request_status(port, method="GET", data=None):
    url = f"http://{HOST}:{port}/api/v1/"
    try:
        with urllib.request.urlopen(url + "health", timeout=2) as response:
            info = json.load(response)
        if info.get("product") != "pauta-local-service":
            raise RuntimeError("Porta ocupada por outro servico.")
        if method == "STOP":
            with urllib.request.urlopen(url + "session", timeout=2) as response:
                session = json.load(response)
            req = urllib.request.Request(url + "shutdown", data=b"{}", method="POST",
                headers={"Content-Type": "application/json", "X-Pauta-CSRF": session["csrf"]})
            with urllib.request.urlopen(req, timeout=3) as response:
                return json.load(response)
        return info
    except urllib.error.HTTPError as e:
        raise RuntimeError("Porta ocupada ou acesso negado. HTTP " + str(e.code)) from e
    except urllib.error.URLError:
        raise RuntimeError("Nenhum servico Painel H.B respondeu na porta configurada.") from None


def main(argv=None):
    parser = argparse.ArgumentParser(description="Painel H.B local; escuta somente 127.0.0.1")
    parser.add_argument("--port", type=int, default=int(os.getenv("PAUTA_PORT", DEFAULT_PORT)))
    parser.add_argument("--open", action="store_true", help="Abre o navegador apos iniciar")
    parser.add_argument("--status", action="store_true", help="Consulta o estado do servico")
    parser.add_argument("--stop", action="store_true", help="Para a instancia do Painel H.B")
    args = parser.parse_args(argv)
    if not 1024 <= args.port <= 65535:
        parser.error("Porta fora do intervalo permitido.")
    if args.status or args.stop:
        try:
            print(json.dumps(request_status(args.port, "STOP" if args.stop else "GET"), ensure_ascii=False))
            return 0
        except RuntimeError as e:
            print(str(e))
            return 1
    try:
        ZoneInfo("America/Sao_Paulo")
    except ZoneInfoNotFoundError:
        print("Fuso America/Sao_Paulo indisponivel. Execute PREPARAR-SERVICO.cmd para instalar tzdata.")
        return 2
    try:
        server = Server(args.port)
    except OSError:
        try:
            existing = request_status(args.port)
            if existing["contractVersion"] != CONTRACT_VERSION:
                print("Uma versao incompativel do Painel H.B ocupa a porta. Pare-a antes de atualizar.")
                return 2
            if existing.get("appVersion") == APP_VERSION:
                print("Painel H.B ja esta rodando nesta porta; nao foi criada outra instancia.")
                if args.open:
                    webbrowser.open(f"http://{HOST}:{args.port}/")
                return 0
            print("Atualizando o servico local para a versao " + APP_VERSION + ".", flush=True)
            request_status(args.port, "STOP")
            # A porta so pode ser retomada depois que a instancia anterior encerrar.
            for attempt in range(50):
                try:
                    server = Server(args.port)
                    break
                except OSError:
                    time.sleep(.1)
            else:
                print("O servico anterior ainda esta encerrando. Aguarde e abra pelo iniciador integrado novamente.")
                return 2
        except RuntimeError:
            print(f"A porta {args.port} esta ocupada por outro programa. Configure PAUTA_PORT explicitamente.")
            return 2
    print(f"Painel H.B local iniciado em {server.origin}/ — dados em {server.store.directory}", flush=True)
    if os.getenv('HB_UPDATE_VALIDATION') != '1':
        server.worker.start()
        server.djen_worker.start()
    if args.open:
        webbrowser.open(server.origin + "/")
    try:
        server.serve_forever(poll_interval=.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.worker.stop_event.set()
        server.djen_worker.stop_event.set()
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
