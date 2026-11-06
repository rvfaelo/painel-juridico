"""Índice de monitoramento SQLite; carteira completa gerenciada por workspace.py."""
from __future__ import annotations

from contextlib import contextmanager, closing, nullcontext
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import json
import math
import os
import re
import secrets
import sqlite3
import threading
import time
import uuid

from .connectors import digits, valid_cnj, now_utc

DB_SCHEMA = 3
ACTIVE = ("queued", "running")
ALLOWED = {"datajud", "djen", "esaj_pg", "esaj_sg"}


def data_directory():
    if os.getenv("PAUTA_DATA_DIR"):
        return Path(os.environ["PAUTA_DATA_DIR"]).expanduser().resolve()
    return Path(os.environ.get("LOCALAPPDATA") or (Path.home() / ".local" / "share")) / "PautaJuridico"


def default_settings():
    return {"enabled": {"datajud": False, "djen": True, "esaj_pg": False, "esaj_sg": False},
            "autoEnabled": False, "autoTimes": ["08:00", "18:00"],
            "autoLast": "", "djenDays": 30, "datajudKey": "", "oab": "", "ufOab": ""}


def validated_settings(changes, base=None):
    if not isinstance(changes, dict):
        raise ValueError("Configuracoes invalidas.")
    s = {**default_settings(), **(base or {}), "enabled": {**default_settings()["enabled"], **(base or {}).get("enabled", {})}}
    if "enabled" in changes:
        values = changes["enabled"]
        if not isinstance(values, dict) or any(k not in ALLOWED or not isinstance(v, bool) for k, v in values.items()):
            raise ValueError("Conectores invalidos.")
        s["enabled"].update(values)
    if "autoEnabled" in changes:
        if not isinstance(changes["autoEnabled"], bool):
            raise ValueError("Agendamento invalido.")
        s["autoEnabled"] = changes["autoEnabled"]
    if "autoTimes" in changes:
        times = changes["autoTimes"]
        if not isinstance(times, list) or not 1 <= len(times) <= 6 or any(
            not isinstance(x, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", x) for x in times
        ):
            raise ValueError("Horarios invalidos.")
        s["autoTimes"] = sorted(set(times))
    if "djenDays" in changes:
        days = changes["djenDays"]
        if type(days) is not int or not 1 <= days <= 365:
            raise ValueError("Periodo DJEN invalido.")
        s["djenDays"] = days
    if "datajudKey" in changes:
        key = changes["datajudKey"]
        if not isinstance(key, str) or len(key) > 256:
            raise ValueError("Chave publica invalida.")
        s["datajudKey"] = key.removeprefix("APIKey ").strip()
    for field in ("oab", "ufOab"):
        if field in changes:
            v = changes[field]
            if not isinstance(v, str) or len(v) > 16:
                raise ValueError("Identificador OAB/UF invalido.")
            s[field] = v
    if s["oab"] and not re.fullmatch(r"\d{1,8}[A-Za-z]?", s["oab"]):
        raise ValueError("OAB invalida.")
    if s["ufOab"] and not re.fullmatch(r"[A-Z]{2}", s["ufOab"]):
        raise ValueError("UF de OAB invalida.")
    if "autoLast" in changes:
        value = changes["autoLast"]
        if not isinstance(value, str) or value and (not re.fullmatch(r"\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d", value)):
            raise ValueError("Ultima janela automatica invalida.")
        if value:
            try: datetime.fromisoformat(value)
            except ValueError: raise ValueError("Ultima janela automatica invalida.") from None
        s["autoLast"] = value
    return s


def validate_restored_row(table, row):
    integer_fields = {"active", "attempt", "added", "count", "is_new", "seen", "correction_count"}
    nullable = {"court", "degree", "system"}
    dates = {"synced_at", "created_at", "updated_at", "first_seen", "last_seen", "occurred_at", "source_updated_at", "changed_at", "at", "attempted_at"}
    for key, value in row.items():
        if key in integer_fields:
            if type(value) is not int or value < 0 or key in {"active", "is_new", "seen"} and value not in (0, 1):
                raise ValueError("Numero invalido na tabela " + table)
        elif key == "next_at":
            if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
                raise ValueError("Agendamento invalido no backup.")
        elif value is None and key in nullable:
            continue
        elif not isinstance(value, str) or len(value) > 1000000:
            raise ValueError("Valor invalido na tabela " + table)
        if key in dates and value:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}(?:T[0-9:.+Z-]+)?", value):
                raise ValueError("Data invalida na tabela " + table)
            try: datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError: raise ValueError("Data invalida na tabela " + table) from None
    if "source" in row and row["source"] not in ALLOWED:
        raise ValueError("Fonte invalida no backup.")
    if "cnj" in row and row["cnj"] and not valid_cnj(row["cnj"]):
        raise ValueError("CNJ invalido no backup.")
    if table == "events" and row["kind"] not in ("movement", "publication"):
        raise ValueError("Tipo de evento invalido no backup.")
    for key in ("payload", "publication_details"):
        if key in row:
            try: value = json.loads(row[key])
            except (ValueError, TypeError): raise ValueError("JSON invalido no backup.") from None
            if not isinstance(value, dict):
                raise ValueError("Objeto JSON invalido no backup.")


class Store:
    def __init__(self, directory=None):
        self.directory = Path(directory or data_directory()).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.filename = self.directory / "pauta-monitoramento.sqlite3"
        self.lock = threading.RLock()
        with self.connection() as db:
            db.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS cases(
              id TEXT PRIMARY KEY, cnj TEXT NOT NULL, court TEXT, degree TEXT, system TEXT,
              active INTEGER NOT NULL DEFAULT 1, synced_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS jobs(
              id TEXT PRIMARY KEY, case_id TEXT NOT NULL, cnj TEXT NOT NULL, source TEXT NOT NULL,
              oab TEXT NOT NULL DEFAULT '', uf TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
              next_at REAL NOT NULL DEFAULT 0, attempt INTEGER NOT NULL DEFAULT 0,
              message TEXT NOT NULL DEFAULT '', added INTEGER NOT NULL DEFAULT 0,
              count INTEGER NOT NULL DEFAULT 0, source_updated_at TEXT NOT NULL DEFAULT '');
            CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(status,next_at);
            CREATE TABLE IF NOT EXISTS tramitations(
              case_id TEXT NOT NULL, source TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
              first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
              PRIMARY KEY(case_id,source,id));
            CREATE TABLE IF NOT EXISTS events(
              case_id TEXT NOT NULL, source TEXT NOT NULL, id TEXT NOT NULL, cnj TEXT NOT NULL,
              tramitation_id TEXT NOT NULL, kind TEXT NOT NULL, occurred_at TEXT NOT NULL,
              text TEXT NOT NULL, digest TEXT NOT NULL, source_updated_at TEXT NOT NULL,
              first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, is_new INTEGER NOT NULL DEFAULT 0,
              seen INTEGER NOT NULL DEFAULT 0, correction_count INTEGER NOT NULL DEFAULT 0,
              url TEXT NOT NULL DEFAULT '', certificate_hash TEXT NOT NULL DEFAULT '',
              PRIMARY KEY(case_id,source,id));
            CREATE INDEX IF NOT EXISTS idx_events_case ON events(case_id,first_seen);
            CREATE TABLE IF NOT EXISTS corrections(
              id TEXT PRIMARY KEY, case_id TEXT NOT NULL, source TEXT NOT NULL,
              event_id TEXT NOT NULL, changed_at TEXT NOT NULL,
              previous_text TEXT NOT NULL, current_text TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS baselines(
              case_id TEXT NOT NULL, source TEXT NOT NULL, at TEXT NOT NULL,
              PRIMARY KEY(case_id,source));
            CREATE TABLE IF NOT EXISTS consultations(
              id TEXT PRIMARY KEY, job_id TEXT NOT NULL, case_id TEXT NOT NULL, source TEXT NOT NULL,
              attempted_at TEXT NOT NULL, status TEXT NOT NULL, message TEXT NOT NULL,
              source_updated_at TEXT NOT NULL DEFAULT '', added INTEGER NOT NULL DEFAULT 0);
            CREATE INDEX IF NOT EXISTS idx_consultations_case ON consultations(case_id,attempted_at);
            """)
            current = db.execute("SELECT v FROM meta WHERE k='schema'").fetchone()
            if current and int(current[0]) > DB_SCHEMA:
                raise RuntimeError("Banco do monitoramento e mais novo que o servico instalado.")
            if "certificate_hash" not in {row[1] for row in db.execute("PRAGMA table_info(events)")}:
                db.execute("ALTER TABLE events ADD COLUMN certificate_hash TEXT NOT NULL DEFAULT ''")
            if "publication_details" not in {row[1] for row in db.execute("PRAGMA table_info(events)")}:
                db.execute("ALTER TABLE events ADD COLUMN publication_details TEXT NOT NULL DEFAULT '{}'")
            db.execute("INSERT OR IGNORE INTO meta(k,v) VALUES('schema',?)", (str(DB_SCHEMA),))
            db.execute("UPDATE meta SET v=? WHERE k='schema'", (str(DB_SCHEMA),))
            db.execute("INSERT OR IGNORE INTO meta(k,v) VALUES('settings',?)",
                       (json.dumps(default_settings()),))
            # Cada instância invalida resultados de consultas interrompidas
            # de instâncias anteriores, mesmo se o identificador do job coincidir.
            db.execute("INSERT OR REPLACE INTO meta(k,v) VALUES('run_epoch',?)",
                       (secrets.token_hex(16),))
            # Processo interrompido: reentrada segura após desligamento.
            db.execute("UPDATE jobs SET status='queued',next_at=?,message=? WHERE status='running'",
                       (time.time() + 5, "Consulta interrompida; retomada agendada"))

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.filename, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA busy_timeout=15000")
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def settings(self):
        with self.lock, self.connection() as db:
            settings = json.loads(db.execute("SELECT v FROM meta WHERE k='settings'").fetchone()[0])
        return {**default_settings(), **settings,
                "enabled": {**default_settings()["enabled"], **settings.get("enabled", {})}}

    def update_settings(self, changes):
        s = validated_settings(changes, self.settings())
        with self.lock, self.connection() as db:
            db.execute("UPDATE meta SET v=? WHERE k='settings'", (json.dumps(s),))
            for source, enabled in s["enabled"].items():
                if not enabled:
                    db.execute("UPDATE jobs SET status='cancelled',message='Fonte desativada',updated_at=? WHERE source=? AND status IN ('queued','running')",
                               (now_utc(), source))
        return {**s, "datajudKey": ""}  # nunca devolver chave pelo endpoint

    def sync_cases(self, supplied, *, allow_empty=False, connection=None):
        if not isinstance(supplied, list) or len(supplied) > 100000:
            raise ValueError("Carteira invalida.")
        checked, seen = [], set()
        for item in supplied:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not re.fullmatch(r"[a-zA-Z0-9:_.-]{1,120}", item["id"]):
                raise ValueError("Identificador de processo invalido.")
            if item["id"] in seen:
                raise ValueError("Processos duplicados.")
            seen.add(item["id"])
            cnj = digits(item.get("cnj"))
            if cnj and not valid_cnj(cnj):
                raise ValueError("CNJ invalido: " + cnj)
            checked.append((item["id"], cnj, str(item.get("court") or "")[:30],
                            str(item.get("courtLevel") or "")[:30], str(item.get("processSystem") or "")[:30],
                            0 if item.get("archived") else 1, now_utc()))
        with self.lock, (nullcontext(connection) if connection is not None else self.connection()) as db:
            if connection is None and db.execute("SELECT 1 FROM sqlite_master WHERE name='workspace'").fetchone() and db.execute('SELECT 1 FROM workspace WHERE id=1').fetchone():
                return {'skipped': True, 'warning': 'Carteira centralizada no serviço local. Recarregue o painel para usar a versão atual.'}
            # Nunca tomar uma origem do navegador recém-criada/vazia como
            # autorização para desativar a carteira de monitoramento anterior.
            if not checked and not allow_empty:
                count = db.execute("SELECT COUNT(*) FROM cases WHERE active=1").fetchone()[0]
                if count:
                    return {"count": 0, "active": count, "skipped": True,
                            "warning": "Esta origem do navegador não contém a carteira anterior. Restaure um backup antes de sincronizar."}
            db.execute("UPDATE cases SET active=0")
            db.executemany("""INSERT INTO cases(id,cnj,court,degree,system,active,synced_at)
                VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET cnj=excluded.cnj,
                court=excluded.court,degree=excluded.degree,system=excluded.system,
                active=excluded.active,synced_at=excluded.synced_at""", checked)
            db.execute("""UPDATE jobs SET status='cancelled',message='Cadastro alterado ou arquivado',
                updated_at=? WHERE status IN ('queued','running') AND case_id != '' AND
                NOT EXISTS(SELECT 1 FROM cases c WHERE c.id=jobs.case_id AND c.cnj=jobs.cnj AND c.active=1)""",
                (now_utc(),))
            # Publicacoes descobertas anteriormente pela OAB podem ser vinculadas
            # somente por CNJ EXATO. Nao inferir vinculos por nome, partes ou texto.
            for case_id, cnj, _, _, _, active, _ in checked:
                if cnj and active:
                    db.execute("UPDATE OR IGNORE events SET case_id=? WHERE case_id='' AND cnj=?",
                               (case_id, cnj))
                    for source, in db.execute("SELECT DISTINCT source FROM events WHERE case_id=? AND cnj=?",
                                              (case_id, cnj)):
                        db.execute("INSERT OR IGNORE INTO baselines(case_id,source,at) VALUES(?,?,?)",
                                   (case_id, source, now_utc()))
        return {"count": len(checked), "active": sum(x[5] for x in checked)}

    def enqueue(self, ids, sources=None, *, oab=False, force=False):
        s = self.settings()
        if oab:
            if not s["enabled"]["djen"] or not s["oab"] or not s["ufOab"]:
                raise ValueError("Configure DJEN e OAB/UF.")
            entries = [("", "", "djen", s["oab"], s["ufOab"])]
        else:
            if not isinstance(ids, list) or len(ids) > 100000 or any(not isinstance(x, str) for x in ids):
                raise ValueError("Selecao de processos invalida.")
            sources = sources or [k for k, enabled in s["enabled"].items() if enabled]
            if not isinstance(sources, list) or any(source not in ALLOWED for source in sources):
                raise ValueError("Fonte invalida.")
            with self.lock, self.connection() as db:
                cases = {x["id"]: x for x in db.execute("SELECT * FROM cases WHERE active=1")}
            entries = [(cid, cases[cid]["cnj"], source, "", "") for cid in dict.fromkeys(ids)
                       if cid in cases and cases[cid]["cnj"] for source in sources if s["enabled"].get(source)]
            # TJSP e-SAJ somente em TJSP, fonte automatica por capacidades.
            entries = [x for x in entries if not x[2].startswith("esaj_") or x[1][13:16] == "826"]
        count = 0
        with self.lock, self.connection() as db:
            for case_id, cnj, source, lawyer, uf in entries:
                if db.execute("""SELECT 1 FROM jobs WHERE case_id=? AND cnj=? AND source=? AND oab=? AND uf=?
                    AND status IN ('queued','running') LIMIT 1""", (case_id, cnj, source, lawyer, uf)).fetchone():
                    continue
                if force or case_id or lawyer:
                    db.execute("""INSERT INTO jobs(id,case_id,cnj,source,oab,uf,status,created_at,updated_at)
                      VALUES(?,?,?,?,?,?,'queued',?,?)""",
                      (uuid.uuid4().hex, case_id, cnj, source, lawyer, uf, now_utc(), now_utc()))
                    count += 1
        return {"count": count}

    def claim(self, sources=None):
        selected = sorted(ALLOWED if sources is None else sources)
        if not selected or any(source not in ALLOWED for source in selected):
            raise ValueError("Fonte invalida para execucao.")
        placeholders = ",".join("?" for _ in selected)
        with self.lock, self.connection() as db:
            row = db.execute(f"SELECT * FROM jobs WHERE status='queued' AND next_at <= ? AND source IN ({placeholders}) ORDER BY created_at,id LIMIT 1",
                             [time.time(), *selected]).fetchone()
            if row:
                db.execute("UPDATE jobs SET status='running',updated_at=? WHERE id=?", (now_utc(), row["id"]))
            if not row:
                return None
            claimed = dict(row)
            claimed["_epoch"] = db.execute("SELECT v FROM meta WHERE k='run_epoch'").fetchone()[0]
            return claimed

    def _attempt(self, db, job, status, message, updated="", added=0):
        db.execute("""INSERT INTO consultations(id,job_id,case_id,source,attempted_at,status,message,source_updated_at,added)
            VALUES(?,?,?,?,?,?,?,?,?)""", (uuid.uuid4().hex, job["id"], job["case_id"],
              job["source"], now_utc(), status, str(message)[:2000], updated, added))

    def finish(self, job, result=None, error=None):
        with self.lock, self.connection() as db:
            epoch = db.execute("SELECT v FROM meta WHERE k='run_epoch'").fetchone()
            if not epoch or job.get("_epoch") != epoch[0]:
                return 0  # Resposta de instância anterior ou anterior a restore.
            live = db.execute("SELECT * FROM jobs WHERE id=?", (job["id"],)).fetchone()
            if not live or live["status"] != "running":
                return 0  # cancelado enquanto a requisicao aguardava
            if error:
                status = error.status
                attempt = live["attempt"] + 1
                retry = error.retryable and attempt < 3
                wait = max(error.retry_after, min(3600, 5 * 2 ** (attempt - 1)))
                db.execute("""UPDATE jobs SET status=?,message=?,attempt=?,next_at=?,updated_at=? WHERE id=?""",
                           ("queued" if retry else status, str(error)[:1000], attempt,
                            time.time() + wait, now_utc(), job["id"]))
                self._attempt(db, job, status, str(error))
                return 0
            status = result["status"]
            if status not in ("success", "partial", "not_found"):
                raise ValueError("Resultado do conector invalido.")
            case_id, source = job["case_id"], job["source"]
            stamp = now_utc()
            baseline = bool(db.execute("SELECT 1 FROM baselines WHERE case_id=? AND source=?",
                                       (case_id, source)).fetchone())
            if source in ("esaj_pg", "esaj_sg"):
                # O adaptador antigo gravava baseline mesmo sem interpretar atos.
                # A primeira leitura interpretada estabelece a referencia, sem
                # anunciar todo o historico antigo como novidade.
                marker = "esaj-movements-v1:" + case_id + ":" + source + ":" + job["cnj"]
                mapped = db.execute("SELECT 1 FROM meta WHERE k=?", (marker,)).fetchone() or db.execute(
                    "SELECT 1 FROM events WHERE case_id=? AND source=? AND cnj=? LIMIT 1",
                    (case_id, source, job["cnj"])).fetchone()
                baseline = baseline and bool(mapped)
                if status == "success" or result.get("events"):
                    db.execute("INSERT OR IGNORE INTO meta(k,v) VALUES(?,?)", (marker, stamp))
            added, corrected = 0, 0
            for item in (result.get("tramitations", []) if source != "djen" else []):
                serialized = json.dumps({**item, "cnj": job["cnj"]}, ensure_ascii=False, default=str)
                db.execute("""INSERT INTO tramitations(case_id,source,id,payload,first_seen,last_seen)
                  VALUES(?,?,?,?,?,?) ON CONFLICT(case_id,source,id)
                  DO UPDATE SET payload=excluded.payload,last_seen=excluded.last_seen""",
                  (case_id, source, item["id"], serialized, stamp, stamp))
            linked_targets = set()
            for event in result.get("events", []):
                target_id = case_id
                if not target_id and event.get("cnj"):
                    match = db.execute("SELECT id FROM cases WHERE cnj=? AND active=1 LIMIT 1", (event["cnj"],)).fetchone()
                    if match:
                        target_id = match["id"]
                linked_targets.add(target_id)
                key = (target_id, source, event["id"])
                existing = db.execute("SELECT * FROM events WHERE case_id=? AND source=? AND id=?", key).fetchone()
                old_details = json.loads(existing["publication_details"]) if existing else {}
                incoming = event.get("publicationDetails") if source == "djen" else None
                details = {**old_details, **incoming} if isinstance(incoming, dict) else old_details
                metadata_changed = isinstance(incoming, dict) and any(
                    k in old_details and old_details[k] != v for k, v in incoming.items())
                seen = bool(db.execute("SELECT 1 FROM baselines WHERE case_id=? AND source=?",
                                       (target_id, source)).fetchone()) if target_id != case_id else baseline
                if not existing:
                    db.execute("""INSERT INTO events(case_id,source,id,cnj,tramitation_id,kind,occurred_at,
                      text,digest,source_updated_at,first_seen,last_seen,is_new,seen,url,certificate_hash)
                      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                      (target_id, source, event["id"], event.get("cnj") or job["cnj"],
                       event.get("tramitationId") or "", "publication" if source == "djen" else "movement",
                       event["occurredAt"], event["text"], event["digest"], event.get("sourceUpdatedAt") or "",
                       stamp, stamp, int(seen), 0, event.get("url") or "", event.get("certificateHash") or ""))
                    if seen:
                        added += 1
                elif (metadata_changed or existing["digest"] != event["digest"] and
                      (existing["text"] != event["text"] or existing["occurred_at"] != event["occurredAt"])):
                    db.execute("""INSERT INTO corrections(id,case_id,source,event_id,changed_at,previous_text,current_text)
                        VALUES(?,?,?,?,?,?,?)""", (uuid.uuid4().hex, target_id, source, event["id"], stamp,
                        existing["text"], event["text"]))
                    db.execute("""UPDATE events SET text=?,digest=?,occurred_at=?,source_updated_at=?,
                        certificate_hash=CASE WHEN ?!='' THEN ? ELSE certificate_hash END,
                        url=CASE WHEN ?!='' THEN ? ELSE url END,
                        last_seen=?,is_new=1,seen=0,correction_count=correction_count+1
                        WHERE case_id=? AND source=? AND id=?""",
                        (event["text"], event["digest"], event["occurredAt"], event.get("sourceUpdatedAt") or "",
                         event.get("certificateHash") or "", event.get("certificateHash") or "",
                         event.get("url") or "", event.get("url") or "",
                         stamp, *key))
                    corrected += 1
                else:
                    db.execute("""UPDATE events SET last_seen=?,digest=?,
                        certificate_hash=CASE WHEN ?!='' THEN ? ELSE certificate_hash END,
                        url=CASE WHEN ?!='' THEN ? ELSE url END
                        WHERE case_id=? AND source=? AND id=?""",
                        (stamp, event["digest"], event.get("certificateHash") or "", event.get("certificateHash") or "",
                         event.get("url") or "", event.get("url") or "", *key))
                db.execute("UPDATE events SET publication_details=? WHERE case_id=? AND source=? AND id=?",
                           (json.dumps(details, ensure_ascii=False, sort_keys=True), *key))
            db.execute("INSERT OR IGNORE INTO baselines(case_id,source,at) VALUES(?,?,?)",
                       (case_id, source, stamp))
            for target_id in linked_targets:
                db.execute("INSERT OR IGNORE INTO baselines(case_id,source,at) VALUES(?,?,?)",
                           (target_id, source, stamp))
            message = (f"{added} novo(s), {corrected} correcao(oes)"
                       + (". " + str(result.get("limitation") or "Consulta parcial: confira o portal.") if status == "partial" else ""))
            db.execute("""UPDATE jobs SET status=?,updated_at=?,source_updated_at=?,
                message=?,added=?,count=? WHERE id=?""",
                (status, stamp, result.get("sourceUpdatedAt") or "", message, added + corrected,
                 len(result.get("events", [])), job["id"]))
            self._attempt(db, job, status, result.get("limitation") or message,
                          result.get("sourceUpdatedAt") or "", added + corrected)
            return added + corrected

    def cancel(self, ids=None):
        if ids is not None and (not isinstance(ids, list) or len(ids) > 100000 or
                                any(not isinstance(x, str) for x in ids)):
            raise ValueError("Selecao invalida.")
        with self.lock, self.connection() as db:
            if ids is None:
                cursor = db.execute("UPDATE jobs SET status='cancelled',updated_at=?,message=? WHERE status IN ('queued','running')",
                                    (now_utc(), "Cancelado pelo usuario"))
            elif not ids:
                return {"count": 0}
            else:
                placeholders = ",".join("?" for _ in ids)
                cursor = db.execute(f"UPDATE jobs SET status='cancelled',updated_at=?,message=? WHERE id IN ({placeholders}) AND status IN ('queued','running')",
                                    [now_utc(), "Cancelado pelo usuario", *ids])
            return {"count": cursor.rowcount}

    def retry_job(self, job_id):
        with self.lock, self.connection() as db:
            job = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
            if not job or job["status"] in ACTIVE:
                return {"count": 0}
        return self.enqueue([job["case_id"]], [job["source"]], oab=bool(job["oab"]))

    def summary(self, limit=100):
        with self.lock, self.connection() as db:
            jobs = [dict(x) for x in db.execute("""SELECT * FROM jobs ORDER BY created_at DESC,id DESC LIMIT ?""",
                                                  (max(1, min(500, limit)),))]
            counts = {x["status"]: x["count"] for x in db.execute("SELECT status,COUNT(*) count FROM jobs GROUP BY status")}
            unseen = db.execute("SELECT COUNT(*) FROM events WHERE is_new=1 AND seen=0").fetchone()[0]
            recent_unseen = [dict(row) for row in db.execute("""SELECT case_id,source,id,cnj,kind,
                occurred_at,first_seen,substr(text,1,240) AS text
                FROM events WHERE is_new=1 AND seen=0
                ORDER BY first_seen DESC,id DESC LIMIT 8""")]
        return {"jobs": jobs, "counts": counts, "unseen": unseen,
                "recentUnseen": recent_unseen}

    def case_detail(self, case_id):
        with self.lock, self.connection() as db:
            c = db.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone()
            if not c:
                raise ValueError("Processo nao sincronizado.")
            tramitations = [{**json.loads(x["payload"]), "source": x["source"]}
                       for x in db.execute("SELECT * FROM tramitations WHERE case_id=? ORDER BY first_seen", (case_id,))]
            tramitations = [x for x in tramitations if not x.get("cnj") or x["cnj"] == c["cnj"]]
            prior = db.execute("SELECT COUNT(*) FROM events WHERE case_id=? AND cnj<>?",
                               (case_id, c["cnj"])).fetchone()[0]
            source_jobs = []
            for source in sorted(ALLOWED):
                latest = db.execute("SELECT * FROM jobs WHERE case_id=? AND cnj=? AND source=? ORDER BY created_at DESC,rowid DESC LIMIT 1",
                                    (case_id, c["cnj"], source)).fetchone()
                if latest:
                    source_jobs.append(dict(latest))
            settings = self.settings()
            return {"case": dict(c), "sourceJobs": source_jobs, "djenDays": settings["djenDays"],
                    "enabledSources": settings["enabled"],
                    "tramitations": tramitations, "previousNumberEvents": prior,
                    "events": [dict(x) for x in db.execute("""SELECT * FROM events WHERE case_id=?
                      AND cnj=? ORDER BY occurred_at DESC,id DESC LIMIT 2000""", (case_id,c["cnj"]))],
                    "consultations": [dict(x) for x in db.execute("""SELECT * FROM consultations WHERE case_id=?
                      ORDER BY attempted_at DESC LIMIT 60""", (case_id,))],
                    "documents": [], "lastAttempt": dict(db.execute("""SELECT * FROM consultations WHERE case_id=?
                       ORDER BY attempted_at DESC LIMIT 1""", (case_id,)).fetchone() or {}),
                    "lastSuccess": dict(db.execute("""SELECT * FROM consultations WHERE case_id=? AND
                      status IN ('success','not_found','partial') ORDER BY attempted_at DESC LIMIT 1""",
                      (case_id,)).fetchone() or {})}

    def notifications(self):
        """Complete lightweight index: initial baseline is not a new notification."""
        with self.lock, self.connection() as db:
            rows = [dict(x) for x in db.execute("""SELECT e.case_id,e.source,e.id,e.cnj,e.kind,
                e.occurred_at,substr(e.text,1,300) AS text,e.first_seen,e.seen,e.is_new,e.url,e.publication_details,
                COALESCE((SELECT MAX(c.changed_at) FROM corrections c WHERE c.case_id=e.case_id
                  AND c.source=e.source AND c.event_id=e.id),e.first_seen) AS last_seen
                FROM events e WHERE e.is_new=1 OR e.seen=1
                ORDER BY e.first_seen DESC,e.id DESC""")]
            for row in rows:
                details = json.loads(row.pop('publication_details') or '{}')
                row['tribunal'] = details.get('tribunal', '') if isinstance(details, dict) else ''
            return {"contractVersion": 1, "events": rows}

    def notification_detail(self, source, event_id, cnj):
        if source not in ALLOWED or not isinstance(event_id, str) or not 1 <= len(event_id) <= 250:
            raise ValueError("Notificação inválida.")
        if not isinstance(cnj, str) or not valid_cnj(cnj):
            raise ValueError("CNJ inválido.")
        with self.lock, self.connection() as db:
            row = db.execute("""SELECT * FROM events WHERE source=? AND id=? AND cnj=?
                AND (is_new=1 OR seen=1) ORDER BY last_seen DESC LIMIT 1""", (source,event_id,cnj)).fetchone()
            if not row:
                raise ValueError("Notificação não encontrada. Atualize a lista.")
            return {"event": dict(row)}

    def mark_notifications(self, events, seen):
        if type(seen) is not bool or not isinstance(events, list) or not 1 <= len(events) <= 100:
            raise ValueError("Seleção de notificações inválida.")
        keys = []
        for event in events:
            if not isinstance(event, dict) or event.get('source') not in ALLOWED:
                raise ValueError("Fonte inválida.")
            if not isinstance(event.get('id'), str) or not 1 <= len(event['id']) <= 250:
                raise ValueError("Identificador inválido.")
            if not isinstance(event.get('cnj'), str) or not valid_cnj(event['cnj']):
                raise ValueError("CNJ inválido.")
            keys.append((event['source'],event['id'],event['cnj']))
        with self.lock, self.connection() as db:
            # Validate the whole selection before writing. Reopening is reversible,
            # but a baseline that was never notified cannot become a novelty here.
            for key in keys:
                if not db.execute("""SELECT 1 FROM events WHERE source=? AND id=? AND cnj=?
                    AND (is_new=1 OR seen=1)""", key).fetchone():
                    raise ValueError("Uma notificação não está mais disponível. Atualize a lista.")
            count = 0
            for key in set(keys):
                count += db.execute("""UPDATE events SET seen=?,is_new=? WHERE source=? AND id=?
                    AND cnj=? AND (is_new=1 OR seen=1)""", (int(seen),int(not seen),*key)).rowcount
            return {"count": count}

    def publications(self, limit=400):
        with self.lock, self.connection() as db:
            rows = [dict(x) for x in db.execute("""SELECT * FROM events WHERE source='djen'
                ORDER BY occurred_at DESC,id DESC LIMIT ?""", (max(1, min(2000, limit)),))]
            return {"contractVersion": 1, "events": rows, "displayed": len(rows)}

    def certificate_hash_for_publication(self, event_id):
        if not isinstance(event_id, str) or not re.fullmatch(r"djen:[A-Za-z0-9:_.-]{1,120}", event_id):
            raise ValueError("Identificador de publicacao invalido.")
        with self.lock, self.connection() as db:
            row = db.execute("""SELECT certificate_hash FROM events
                WHERE source='djen' AND kind='publication' AND id=? AND certificate_hash!=''
                LIMIT 1""", (event_id,)).fetchone()
        return row[0] if row else ""

    def mark_seen(self, case_id, source, event_id):
        with self.lock, self.connection() as db:
            c = db.execute("UPDATE events SET seen=1,is_new=0 WHERE case_id=? AND source=? AND id=?",
                           (case_id, source, event_id))
            return {"count": c.rowcount}

    def scheduled(self, local_day, minutes):
        if not isinstance(minutes, str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", minutes):
            raise ValueError("Hora local invalida.")
        day = date.fromisoformat(local_day)
        with self.lock, self.connection() as db:
            saved = json.loads(db.execute("SELECT v FROM meta WHERE k='settings'").fetchone()[0])
            if not saved.get("autoEnabled"):
                return 0
            times = saved.get("autoTimes") or default_settings()["autoTimes"]
            due = [slot for slot in times if slot <= minutes]
            slot = (local_day + "T" + due[-1]) if due else (
                (day - timedelta(days=1)).isoformat() + "T" + times[-1])
            if saved.get("autoLast", "") >= slot:
                return 0
            enabled = [source for source, value in saved.get("enabled", {}).items()
                       if value and source in ALLOWED]
            entries = []
            for case_id, number in db.execute("SELECT id,cnj FROM cases WHERE active=1 AND cnj!=''"):
                for source in enabled:
                    if source.startswith("esaj_") and number[13:16] != "826":
                        continue
                    entries.append((case_id, number, source, "", ""))
            if "djen" in enabled and saved.get("oab") and saved.get("ufOab"):
                entries.append(("", "", "djen", saved["oab"], saved["ufOab"]))
            count = 0
            for case_id, number, source, oab, uf in entries:
                pending = db.execute("""SELECT 1 FROM jobs
                    WHERE case_id=? AND cnj=? AND source=? AND oab=? AND uf=?
                    AND status IN ('queued','running') LIMIT 1""",
                    (case_id, number, source, oab, uf)).fetchone()
                if pending:
                    continue
                db.execute("""INSERT INTO jobs(id,case_id,cnj,source,oab,uf,status,created_at,updated_at)
                    VALUES(?,?,?,?,?,?,'queued',?,?)""",
                    (uuid.uuid4().hex, case_id, number, source, oab, uf, now_utc(), now_utc()))
                count += 1
            saved["autoLast"] = slot
            db.execute("UPDATE meta SET v=? WHERE k='settings'", (json.dumps(saved),))
            return count

    def export_monitoring(self):
        tables = ("cases", "jobs", "tramitations", "events", "corrections", "baselines", "consultations")
        with self.lock, self.connection() as db:
            content = {table: [dict(row) for row in db.execute("SELECT * FROM " + table)] for table in tables}
        s = self.settings()
        s["datajudKey"] = ""
        return {"format": "pauta-monitoramento", "version": DB_SCHEMA, "createdAt": now_utc(),
                "settings": s, "tables": content}

    def restore_monitoring(self, blob):
        allowed = ("cases", "jobs", "tramitations", "events", "corrections", "baselines", "consultations")
        if (not isinstance(blob, dict) or blob.get("format") != "pauta-monitoramento"
                or blob.get("version") not in (1, 2, DB_SCHEMA) or not isinstance(blob.get("tables"), dict)):
            raise ValueError("Backup do monitoramento incompatível.")
        with self.lock:
            with self.connection() as db:
                column_map = {table: [x[1] for x in db.execute("PRAGMA table_info(" + table + ")")] for table in allowed}
                active = db.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')").fetchone()[0]
                if active:
                    raise ValueError("Cancele as consultas pendentes no serviço antes de restaurar.")
            clean = {}
            for table in allowed:
                records = blob["tables"].get(table)
                if not isinstance(records, list) or len(records) > 150000:
                    raise ValueError("Tabela do monitoramento invalida: " + table)
                missing = set()
                if table == "events":
                    if blob["version"] < 3:
                        missing.add("publication_details")
                    if blob["version"] == 1:
                        missing.add("certificate_hash")
                if any(not isinstance(r, dict) or set(r) != set(column_map[table]) - missing for r in records):
                    raise ValueError("Colunas invalidas no backup do monitoramento: " + table)
                defaults = {key: "{}" if key == "publication_details" else "" for key in missing}
                clean[table] = [{**defaults, **r} for r in records]
            settings = blob.get("settings", {})
            if not isinstance(settings, dict):
                raise ValueError("Configuracoes do monitoramento invalidas.")
            settings = validated_settings({**settings, "datajudKey": ""})
            for table, records in clean.items():
                for row in records:
                    validate_restored_row(table, row)
            # Banco atual guardado ANTES de qualquer substituicao.
            backups = self.directory / "backups"
            backups.mkdir(exist_ok=True)
            target = backups / ("antes-restauracao-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f") + ".sqlite3")
            with closing(sqlite3.connect(self.filename)) as src, closing(sqlite3.connect(target)) as dst:
                src.backup(dst)
                dst.commit()
            with self.connection() as db:
                for table in reversed(allowed):
                    db.execute("DELETE FROM " + table)
                for table in allowed:
                    columns = column_map[table]
                    marks = ",".join("?" * len(columns))
                    db.executemany("INSERT INTO " + table + "(" + ",".join(columns) + ") VALUES(" + marks + ")",
                                   [[r[c] for c in columns] for r in clean[table]])
                db.execute("UPDATE meta SET v=? WHERE k='settings'", (json.dumps(settings),))
                db.execute("UPDATE meta SET v=? WHERE k='run_epoch'", (secrets.token_hex(16),))
                db.execute("UPDATE jobs SET status='queued',next_at=?,message=? WHERE status='running'",
                           (time.time() + 10, "Retomada apos restauracao"))
        return {"tables": {name: len(clean[name]) for name in allowed}, "backupBeforeRestore": str(target)}
