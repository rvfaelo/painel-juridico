"""Servidor Painel H.B local: HTML e API sob a mesma origem, somente loopback.

Uso: python -m service.main --open | --status | --stop
Nunca servir a rede, aceitar Origin:null ou caminhos locais arbitrarios.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from logging.handlers import RotatingFileHandler
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import argparse
import importlib.util
import hashlib
import json
import logging
import os
import secrets
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
import webbrowser

from .connectors import CONTRACT_VERSION, SourceError, capabilities, consult_datajud, consult_djen, consult_esaj, probe_public_sources, preview_datajud, fetch_djen_certificate
from .store import Store, data_directory
from .workspace import Workspace, WorkspaceConflict

HOST = "127.0.0.1"
DEFAULT_PORT = 8766
APP_VERSION = "0.6.8"
ROOT = Path(__file__).resolve().parent.parent
SESSION_COOKIE = "pauta_session"
SESSION_TTL = 12 * 60 * 60
BOOTSTRAP_TTL = 120
ADMIN_SECRET_NAME = "auth-admin.secret"
CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0
AUTH_REQUIRED_HTML = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Painel H.B · acesso local</title><link rel="stylesheet" href="/styles.css"></head>
<body><main class="auth-required"><h1>Painel H.B</h1>
<p>Abra o painel pelo atalho <strong>ABRIR-PAINEL-INTEGRADO.cmd</strong> ou pela Central.</p>
<p class="muted">O link de acesso expirou ou esta aba foi aberta sem a sessão local. Feche esta aba e abra novamente pelo iniciador.</p>
</main></body></html>"""


class JsonFormatter(logging.Formatter):
    """Log local e estruturado, sem URL, CNJ, token ou conteúdo processual."""
    def format(self, record):
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "event": getattr(record, "event", record.getMessage()),
        }
        for field in ("method", "status", "duration_ms", "port", "version", "worker"):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_logging(directory):
    logger = logging.getLogger("pauta")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()
    path = Path(directory) / "logs" / "painel-hb.log"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(path, maxBytes=2 * 1024 * 1024,
                                      backupCount=3, encoding="utf-8")
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    except OSError:
        logger.addHandler(logging.NullHandler())
    return logger


def admin_secret_path(directory=None):
    return Path(directory or data_directory()) / ADMIN_SECRET_NAME


def read_admin_secret(directory=None):
    path = admin_secret_path(directory)
    try:
        value = path.read_text(encoding="utf-8").strip()
    except OSError:
        return ""
    return value if len(value) >= 32 else ""


def _restrict_admin_secret(path):
    try:
        path.chmod(0o600)
    except OSError:
        pass
    if os.name != "nt":
        return
    try:
        user = subprocess.check_output(["whoami"], text=True, stderr=subprocess.DEVNULL,
                                       creationflags=CREATE_NO_WINDOW).strip()
        if not user:
            return
        subprocess.run(["icacls", str(path), "/inheritance:r", "/grant:r", f"{user}:(R,W)"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       creationflags=CREATE_NO_WINDOW, check=False)
    except OSError:
        pass


def load_or_create_admin_secret(directory):
    path = admin_secret_path(directory)
    existing = read_admin_secret(directory)
    if existing:
        return existing
    value = secrets.token_urlsafe(48)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        handle.write(value + "\n")
    os.replace(temporary, path)
    _restrict_admin_secret(path)
    return value
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
                logging.getLogger("pauta").warning("worker_error", extra={
                    "event": "worker_error", "worker": self.name})
            self.stop_event.wait(3.0)


class Server(ThreadingHTTPServer):
    allow_reuse_address = os.name != "nt"
    daemon_threads = True

    def server_bind(self):
        if os.name == "nt":
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

    def server_close(self):
        logger = getattr(self, "logger", None)
        if logger:
            for handler in list(logger.handlers):
                logger.removeHandler(handler)
                handler.close()
        super().server_close()

    def __init__(self, port, store=None, auth=True):
        super().__init__((HOST, port), Handler)
        # Reservar a porta antes de abrir o banco: abrir uma segunda instancia
        # nao pode invalidar a fila e respostas da instancia que ja esta rodando.
        try:
            self.store = store if store is not None else Store()
            self.workspace = Workspace(self.store)
        except Exception:
            self.server_close()
            raise
        self.auth_required = bool(auth)
        self.origin = f"http://{HOST}:{port}"
        self.csrf = secrets.token_urlsafe(40)
        self.sessions = {}
        self.sessions_lock = threading.Lock()
        self.bootstrap_tokens = {}
        self.admin_secret = load_or_create_admin_secret(self.store.directory) if self.auth_required else ""
        self.logger = configure_logging(self.store.directory)
        self.worker = Worker(self.store, sources=("datajud", "esaj_pg", "esaj_sg"))
        self.djen_worker = Worker(self.store, sources=("djen",), schedule=False)

    def create_session(self):
        session_id = secrets.token_urlsafe(32)
        csrf = secrets.token_urlsafe(40)
        with self.sessions_lock:
            self.sessions[session_id] = {"csrf": csrf, "created": time.time()}
        return session_id, csrf

    def session_csrf(self, session_id):
        if not session_id:
            return ""
        with self.sessions_lock:
            entry = self.sessions.get(session_id)
            if not isinstance(entry, dict):
                return entry if isinstance(entry, str) else ""
            if time.time() - entry["created"] > SESSION_TTL:
                self.sessions.pop(session_id, None)
                return ""
            return entry["csrf"]

    def admin_matches(self, value):
        return bool(self.admin_secret and value and secrets.compare_digest(value, self.admin_secret))

    def issue_bootstrap(self):
        token = secrets.token_urlsafe(32)
        now = time.time()
        with self.sessions_lock:
            self.bootstrap_tokens = {key: expiry for key, expiry in self.bootstrap_tokens.items()
                                     if expiry > now}
            self.bootstrap_tokens[token] = now + BOOTSTRAP_TTL
        return token

    def consume_bootstrap(self, token):
        if not token:
            return False
        with self.sessions_lock:
            expiry = self.bootstrap_tokens.pop(token, None)
        return bool(expiry and expiry >= time.time())

    def bootstrap_url(self):
        return f"{self.origin}/?bootstrap={quote(self.issue_bootstrap())}"


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "PautaLocal"
    sys_version = ""

    def log_message(self, fmt, *args):
        # Nao escrever URLs, dados processuais ou segredos em historico de console.
        pass

    def send_response(self, code, message=None):
        self._response_code = code
        super().send_response(code, message)

    def handle_one_request(self):
        self._response_code = None
        started = time.monotonic()
        try:
            super().handle_one_request()
        finally:
            logger = getattr(self.server, "logger", None)
            if logger and self.command and self._response_code:
                logger.info("http_request", extra={
                    "event": "http_request", "method": self.command,
                    "status": self._response_code,
                    "duration_ms": round((time.monotonic() - started) * 1000, 1)})

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

    def session_id(self):
        raw = self.headers.get("Cookie", "")
        if not raw:
            return ""
        try:
            jar = SimpleCookie()
            jar.load(raw)
            morsel = jar.get(SESSION_COOKIE)
            return morsel.value if morsel else ""
        except Exception:
            return ""

    def admin_matches(self):
        matcher = getattr(self.server, "admin_matches", None)
        return bool(matcher and matcher(self.headers.get("X-Pauta-Admin", "")))

    def expected_csrf(self):
        if not getattr(self.server, "auth_required", False):
            return self.server.csrf
        return self.server.session_csrf(self.session_id())

    def csrf_matches(self):
        token = self.headers.get("X-Pauta-CSRF", "")
        expected = self.expected_csrf()
        try:
            return bool(token and expected and secrets.compare_digest(token, expected))
        except TypeError:
            return False

    def allowed_origin(self):
        origin = self.headers.get("Origin")
        site = self.headers.get("Sec-Fetch-Site", "")
        if origin is not None and origin != self.server.origin:
            return False
        if site in ("cross-site", "none"):
            return site == "none" and origin is None and (self.csrf_matches() or self.admin_matches())
        return True

    def guard_host(self):
        if not self.allowed_host():
            self.respond({"error": "Host nao autorizado."}, 403)
            return False
        return True

    def guard_read(self):
        if not self.allowed_origin():
            self.respond({"error": "Origin nao autorizado."}, 403)
            return False
        if self.admin_matches():
            return True
        if self.server.auth_required and not self.expected_csrf():
            self.respond({"error": "Sessão local necessária. Abra o painel pela Central."}, 401)
            return False
        if not self.csrf_matches():
            self.respond({"error": "Sessão local necessária."}, 403)
            return False
        return True

    def guard_post(self):
        if not self.allowed_origin():
            self.respond({"error": "Origin nao autorizado."}, 403)
            return False
        if not self.admin_matches():
            if self.server.auth_required and not self.expected_csrf():
                self.respond({"error": "Sessão local necessária. Abra o painel pela Central."}, 401)
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
        parsed = urlsplit(self.path)
        path = parsed.path
        try:
            if path == "/api/v1/health":
                from .datajud_mcp import CLIENT_ID, CLIENT_COMMIT
                return self.respond({"product": "pauta-local-service", "appVersion": APP_VERSION,
                                     "contractVersion": CONTRACT_VERSION, "status": "ok",
                                     "installationId": hashlib.sha256(os.path.normcase(str(ROOT.resolve())).encode('utf-8')).hexdigest(),
                                     "datajudClient": CLIENT_ID, "datajudClientCommit": CLIENT_COMMIT})
            if path in ("/", "/dashboard.html") and parsed.query:
                token = parse_qs(parsed.query).get("bootstrap", [""])[0]
                if token and self.server.consume_bootstrap(token):
                    session_id, _csrf = self.server.create_session()
                    self.send_response(302)
                    self.send_header("Location", "/")
                    self.send_header("Set-Cookie", f"{SESSION_COOKIE}={session_id}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_TTL}")
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("Referrer-Policy", "no-referrer")
                    self.send_header("X-Content-Type-Options", "nosniff")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
            if os.getenv('HB_UPDATE_VALIDATION') == '1' and path not in ('/api/v1/session', '/api/v1/status'):
                return self.respond({'error': 'Validacao de atualizacao em andamento. Aguarde a Central.'}, 503)
            if path == "/api/v1/session":
                if not self.server.auth_required:
                    return self.respond({"product": "pauta-local-service", "appVersion": APP_VERSION,
                                         "contractVersion": CONTRACT_VERSION, "csrf": self.server.csrf})
                if self.admin_matches():
                    return self.respond({"product": "pauta-local-service", "appVersion": APP_VERSION,
                                         "contractVersion": CONTRACT_VERSION, "csrf": "", "admin": True})
                csrf = self.server.session_csrf(self.session_id())
                if not csrf:
                    return self.respond({"error": "Sessão local necessária. Abra o painel pela Central."}, 401)
                return self.respond({"product": "pauta-local-service", "appVersion": APP_VERSION,
                                     "contractVersion": CONTRACT_VERSION, "csrf": csrf})
            if path == "/api/v1/status":
                if self.server.auth_required and not self.guard_read():
                    return
                s = self.server.store.settings()
                return self.respond({"appVersion": APP_VERSION, "contractVersion": CONTRACT_VERSION,
                                     "service": "online", "dataDirectory": str(self.server.store.directory),
                                     "settings": {**s, "datajudKey": ""}, "worker": self.server.worker.is_alive(),
                                     "workerError": self.server.worker.last_error,
                                     "djenWorker": self.server.djen_worker.is_alive(),
                                     "djenWorkerError": self.server.djen_worker.last_error,
                                     "operational": self.server.store.operational_status()})
            if path == "/api/v1/diagnostics/operational":
                return self.respond({"contractVersion": CONTRACT_VERSION, "appVersion": APP_VERSION,
                                     "worker": self.server.worker.is_alive(),
                                     "djenWorker": self.server.djen_worker.is_alive(),
                                     "operational": self.server.store.operational_status()})
            if path == "/api/v1/connectors":
                installed = importlib.util.find_spec("juscraper") is not None
                return self.respond({"contractVersion": CONTRACT_VERSION,
                                     "sources": capabilities(installed)})
            if (path in ("/api/v1/workspace", "/api/v1/workspace/export", "/api/v1/cases",
                         "/api/v1/dashboard", "/api/v1/publications", "/api/v1/notifications",
                         "/api/v1/backup", "/api/v1/diagnostics/operational")
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
            if self.server.auth_required and path in ("/", "/dashboard.html") and not self.admin_matches() \
                    and not self.server.session_csrf(self.session_id()):
                mime = "text/html; charset=utf-8"
                payload = AUTH_REQUIRED_HTML.encode("utf-8")
            else:
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
                "default-src 'self'; script-src 'self'; style-src 'self'; "
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
            if path == "/api/v1/bootstrap":
                if not self.admin_matches():
                    return self.respond({"error": "Acesso administrativo local necessario."}, 403)
                token = self.server.issue_bootstrap()
                return self.respond({"token": token, "expiresIn": BOOTSTRAP_TTL,
                                     "url": f"{self.server.origin}/?bootstrap={quote(token)}"})
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
                days = body.get("days", store.settings().get("djenDays", 30))
                if type(days) is not int or not 1 <= days <= 365:
                    return self.respond({"error": "Período DJEN inválido: use de 1 a 365 dias."}, 400)
                end = date.today()
                start = end - timedelta(days=days - 1)
                try:
                    result = consult_djen(digits(number), days=days)
                except SourceError as error:
                    return self.respond({"error": str(error), "sourceStatus": error.status}, 503)
                return self.respond({"contractVersion": CONTRACT_VERSION, **result,
                                     "days": days, "periodStart": start.isoformat(),
                                     "periodEnd": end.isoformat()})
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


def _admin_headers(port, required=True):
    secret = read_admin_secret()
    if not secret and required:
        raise RuntimeError("Segredo administrativo local ausente. Abra o painel pela Central.")
    headers = {"Content-Type": "application/json", "Origin": f"http://{HOST}:{port}"}
    if secret:
        headers["X-Pauta-Admin"] = secret
    return headers


def request_status(port, method="GET", data=None):
    url = f"http://{HOST}:{port}/api/v1/"
    try:
        with urllib.request.urlopen(url + "health", timeout=2) as response:
            info = json.load(response)
        if info.get("product") != "pauta-local-service":
            raise RuntimeError("Porta ocupada por outro servico.")
        if method == "STOP":
            req = urllib.request.Request(url + "shutdown", data=b"{}", method="POST",
                headers=_admin_headers(port, required=False))
            try:
                with urllib.request.urlopen(req, timeout=3) as response:
                    return json.load(response)
            except urllib.error.HTTPError as error:
                if error.code not in (401, 403):
                    raise
                # Compatibilidade com a versao anterior, que usa CSRF de sessao.
                with urllib.request.urlopen(url + "session", timeout=2) as response:
                    session = json.load(response)
                req = urllib.request.Request(url + "shutdown", data=b"{}", method="POST",
                    headers={"Content-Type": "application/json", "Origin": f"http://{HOST}:{port}",
                             "X-Pauta-CSRF": session["csrf"]})
                with urllib.request.urlopen(req, timeout=3) as response:
                    return json.load(response)
        if method == "BOOTSTRAP":
            req = urllib.request.Request(url + "bootstrap", data=b"{}", method="POST",
                headers=_admin_headers(port))
            with urllib.request.urlopen(req, timeout=3) as response:
                return json.load(response)
        if method == "STATUS":
            req = urllib.request.Request(url + "status", headers=_admin_headers(port, required=False))
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
            print(json.dumps(request_status(args.port, "STOP" if args.stop else "STATUS"), ensure_ascii=False))
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
                    try:
                        webbrowser.open(request_status(args.port, "BOOTSTRAP")["url"])
                    except RuntimeError:
                        webbrowser.open(f"http://{HOST}:{args.port}/")
                return 0
            print("Atualizando o servico local para a versao " + APP_VERSION + ".", flush=True)
            request_status(args.port, "STOP")
            # A porta so pode ser retomada depois que a instancia anterior encerrar.
            for _attempt in range(50):
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
    server.logger.info("service_started", extra={
        "event": "service_started", "port": args.port, "version": APP_VERSION})
    if os.getenv('HB_UPDATE_VALIDATION') != '1':
        server.worker.start()
        server.djen_worker.start()
    if args.open:
        webbrowser.open(server.bootstrap_url())
    try:
        server.serve_forever(poll_interval=.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.worker.stop_event.set()
        server.djen_worker.stop_event.set()
        server.logger.info("service_stopped", extra={"event": "service_stopped"})
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
