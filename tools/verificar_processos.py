#!/usr/bin/env python3
"""Relatório de novidades e falhas dos processos do Painel H.B.

Usa a fila do serviço local em 127.0.0.1 e não altera a carteira, a planilha
nem o estado de leitura das notificações. A primeira consulta de cada
processo/fonte é linha de base, como no painel: ela não vira novidade.

Exemplos:
  .venv\\Scripts\\python.exe tools\\verificar_processos.py
  .venv\\Scripts\\python.exe tools\\verificar_processos.py --fontes djen
  .venv\\Scripts\\python.exe tools\\verificar_processos.py --sem-consultar --json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from service.connectors import digits, valid_cnj  # noqa: E402
from service.store import data_directory  # noqa: E402

HOST = "127.0.0.1"
DEFAULT_PORT = 8766
SOURCES = ("djen", "datajud")
ACTIVE = {"queued", "running"}
TERMINAL_OK = {"success", "partial", "not_found"}
SOURCE_LABEL = {"djen": "DJEN", "datajud": "DataJud", "servico": "Serviço"}
COURT_LEVEL = {
    "first": "1º grau",
    "second": "2º grau",
    "superior": "superior",
    "jef": "JEF",
    "federal_panel": "turma recursal federal",
}


class ServiceError(RuntimeError):
    """Falha de comunicação ou de contrato com o serviço local."""

    def __init__(self, message, status=0):
        super().__init__(message)
        self.status = status


def read_admin_secret():
    """Lê o segredo local sem imprimi-lo; ausente quando a autenticação está off."""
    path = Path(data_directory()) / "auth-admin.secret"
    try:
        value = path.read_text(encoding="utf-8").strip()
    except OSError:
        return ""
    return value if len(value) >= 32 else ""


def br_date(value):
    text = str(value or "").strip()[:10]
    try:
        return datetime.strptime(text, "%Y-%m-%d").strftime("%d/%m/%Y")
    except ValueError:
        return text or "data não informada"


def flat_text(value, limit):
    text = " ".join(str(value or "").split())
    if limit > 0 and len(text) > limit:
        return text[:limit].rstrip() + "…"
    return text


def parse_sources(value):
    requested = [part.strip().lower() for part in value.split(",") if part.strip()]
    unknown = [part for part in requested if part not in SOURCES]
    if unknown:
        raise ServiceError("Fonte inválida: " + ", ".join(unknown) + ". Use djen,datajud.")
    if not requested:
        raise ServiceError("Informe ao menos uma fonte: djen,datajud.")
    return list(dict.fromkeys(requested))


class Client:
    def __init__(self, port, admin_secret=""):
        self.port = port
        self.base = f"http://{HOST}:{port}/api/v1/"
        self.origin = f"http://{HOST}:{port}"
        self.admin = admin_secret
        self.csrf = ""

    def request(self, route, body=None, *, csrf=True, timeout=60):
        headers = {"Accept": "application/json", "Origin": self.origin}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if csrf and self.csrf:
            headers["X-Pauta-CSRF"] = self.csrf
        if self.admin:
            headers["X-Pauta-Admin"] = self.admin
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            self.base + route,
            data=data,
            headers=headers,
            method="GET" if body is None else "POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                raw = response.read()
                return json.loads(raw.decode("utf-8")) if raw else {}
        except urllib.error.HTTPError as error:
            try:
                detail = json.loads(error.read().decode("utf-8"))
            except Exception:
                detail = {}
            message = detail.get("error") or f"HTTP {error.code}"
            if error.code == 401:
                message += " Abra o Painel H.B pela Central para criar a sessão local."
            raise ServiceError(message, error.code) from None
        except urllib.error.URLError as error:
            reason = str(getattr(error, "reason", error))
            raise ServiceError(
                f"Serviço local não respondeu em {HOST}:{self.port}. "
                "Abra o Painel H.B pela Central e tente de novo. (" + reason + ")"
            ) from None
        except TimeoutError:
            raise ServiceError("O serviço local demorou demais para responder.") from None


def connect(port):
    client = Client(port, read_admin_secret())
    session = client.request("session", csrf=False, timeout=20)
    client.csrf = session.get("csrf", "")
    return client


def select_cases(payload, include_archived):
    cases = payload.get("cases") if isinstance(payload, dict) else None
    if not isinstance(cases, list):
        raise ServiceError("O serviço não devolveu a lista de processos.")
    selected, skipped = [], []
    for case in cases:
        if not isinstance(case, dict) or not case.get("id"):
            continue
        cnj = digits(case.get("cnj"))
        if not valid_cnj(cnj):
            skipped.append((case, "sem CNJ válido"))
            continue
        if case.get("archived") and not include_archived:
            skipped.append((case, "arquivado"))
            continue
        selected.append({**case, "cnj": cnj})
    return selected, skipped


def fetch_detail(client, case_id):
    try:
        return client.request("processes/" + urllib.parse.quote(case_id, safe=""), timeout=30)
    except ServiceError as error:
        if error.status == 400:
            return {"sourceJobs": [], "_error": str(error)}
        raise


def wait_for_jobs(client, cases, sources, seconds):
    deadline = time.monotonic() + max(1, seconds)
    details = {}
    pending = {case["id"] for case in cases}
    while True:
        for case_id in list(pending):
            detail = fetch_detail(client, case_id)
            details[case_id] = detail
            jobs = [job for job in detail.get("sourceJobs", [])
                    if job.get("source") in sources]
            if not any(job.get("status") in ACTIVE for job in jobs):
                pending.discard(case_id)
        if not pending or time.monotonic() >= deadline:
            break
        time.sleep(3)
    for case in cases:
        details.setdefault(case["id"], fetch_detail(client, case["id"]))
    return details, pending


def grau_for(event, case, detail):
    tramitation_id = str(event.get("tramitation_id") or "")
    for tramitation in detail.get("tramitations", []):
        if isinstance(tramitation, dict) and str(tramitation.get("id") or "") == tramitation_id:
            grau = str(tramitation.get("grau") or "").strip()
            if grau:
                return grau
    return COURT_LEVEL.get(str(case.get("courtLevel") or ""), "")


def events_by_case(client, selected_ids, sources):
    payload = client.request("notifications")
    rows = payload.get("events") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise ServiceError("O serviço não devolveu a lista de notificações.")
    selected = []
    for event in rows:
        if not isinstance(event, dict):
            continue
        if event.get("case_id") not in selected_ids:
            continue
        if event.get("source") not in sources:
            continue
        if not event.get("is_new") or event.get("seen"):
            continue
        selected.append(event)
    selected.sort(key=lambda event: (str(event.get("occurred_at") or ""),
                                     str(event.get("first_seen") or ""),
                                     str(event.get("id") or "")), reverse=True)
    return selected


def inspect_case(case, detail, sources, *, consulted):
    jobs = {job.get("source"): job for job in detail.get("sourceJobs", [])
            if isinstance(job, dict) and job.get("source") in sources}
    statuses, failures, caveats = {}, [], []
    if detail.get("_error"):
        caveats.append(("servico", "cadastro não sincronizado no serviço: " + str(detail["_error"])))
    for source in sources:
        job = jobs.get(source)
        if not job:
            statuses[source] = "sem consulta"
            if consulted:
                caveats.append((source, "sem consulta registrada para este processo"))
            else:
                caveats.append((source, "ainda sem consulta registrada"))
            continue
        status = str(job.get("status") or "")
        statuses[source] = status
        if status in ACTIVE:
            caveats.append((source, "consulta ainda em andamento"))
        elif status == "not_found":
            caveats.append((source, "não localizado; isso não comprova inexistência"))
        elif status == "partial":
            caveats.append((source, "consulta parcial; confira o portal oficial"))
        elif status not in TERMINAL_OK:
            message = flat_text(job.get("message") or status or "falha sem detalhe", 240)
            failures.append((source, message))
    return {"statuses": statuses, "failures": failures, "caveats": caveats}


def build_report(client, args, cases, sources, details, pending, consulted):
    selected_ids = {case["id"] for case in cases}
    novelties = events_by_case(client, selected_ids, sources) if cases else []
    novelty_cases = {event.get("case_id") for event in novelties}
    by_case, failures, caveats = {}, [], []
    quiet = []
    for case in cases:
        detail = details.get(case["id"], {})
        inspection = inspect_case(case, detail, sources, consulted=consulted)
        by_case[case["id"]] = inspection
        failures.extend((case, source, message) for source, message in inspection["failures"])
        caveats.extend((case, source, message) for source, message in inspection["caveats"])
        if (case["id"] not in novelty_cases and not inspection["failures"]
                and not inspection["caveats"]):
            quiet.append(case)

    novelty_rows = []
    for event in novelties:
        case = next((item for item in cases if item["id"] == event.get("case_id")), None)
        if not case:
            continue
        detail = details.get(case["id"], {})
        novelty_rows.append({
            "cnj": case["cnj"],
            "grau": grau_for(event, case, detail),
            "data": event.get("occurred_at", ""),
            "fonte": event.get("source", ""),
            "texto": flat_text(event.get("text"), args.limite_texto),
            "id": event.get("id", ""),
        })

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "consulted": consulted,
        "cases": cases,
        "sources": sources,
        "novelties": novelty_rows,
        "quiet": quiet,
        "caveats": caveats,
        "failures": failures,
        "pending": pending,
        "statuses": by_case,
    }


def print_text(report, skipped):
    try:
        local = datetime.now(ZoneInfo("America/Sao_Paulo"))
    except Exception:
        local = datetime.now().astimezone()
    print("Verificação de processos do Painel H.B — " + local.strftime("%d/%m/%Y %H:%M"))
    print(f"Processos considerados: {len(report['cases'])}"
          + (f" · ignorados: {len(skipped)}" if skipped else ""))
    if skipped:
        reasons = {}
        for _, reason in skipped:
            reasons[reason] = reasons.get(reason, 0) + 1
        print("Ignorados: " + ", ".join(f"{count} {reason}" for reason, count in reasons.items()))
    print()

    if report["novelties"]:
        print(f"NOVIDADES ({len(report['novelties'])})")
        for row in report["novelties"]:
            grau = row["grau"] or "grau não informado"
            fonte = SOURCE_LABEL.get(row["fonte"], row["fonte"])
            print(f"• {row['cnj']} · {grau} · {br_date(row['data'])} · {fonte}")
            if row["texto"]:
                print("  " + row["texto"])
        print()
    else:
        print("NOVIDADES: nenhuma.")
        print()

    if report["failures"]:
        print(f"FALHAS ({len(report['failures'])})")
        for case, source, message in report["failures"]:
            print(f"• {case['cnj']} · {SOURCE_LABEL.get(source, source)}: {message}")
        print()

    if report["caveats"]:
        print(f"RESSALVAS ({len(report['caveats'])})")
        for case, source, message in report["caveats"]:
            print(f"• {case['cnj']} · {SOURCE_LABEL.get(source, source)}: {message}")
        print()

    if report["pending"]:
        print(f"EM ANDAMENTO ({len(report['pending'])})")
        for case in report["cases"]:
            if case["id"] in report["pending"]:
                print(f"• {case['cnj']}: consulta ainda na fila; repita mais tarde.")
        print()

    if report["quiet"]:
        print(f"SEM NOVIDADE ({len(report['quiet'])})")
        for case in report["quiet"]:
            fontes = ", ".join(SOURCE_LABEL.get(source, source) for source in report["sources"])
            print(f"• {case['cnj']} ({fontes})")
        print()

    if not report["novelties"] and not report["failures"] and not report["caveats"] and not report["pending"]:
        print("Nenhuma novidade e nenhuma falha.")
    elif not report["novelties"] and (report["failures"] or report["caveats"] or report["pending"]):
        print("Não é possível afirmar ausência de novidades: há fonte com falha, ressalva ou consulta pendente.")


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        description="Relata novidades e falhas dos processos do Painel H.B sem alterar a carteira.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--port", type=int, default=int(os.getenv("PAUTA_PORT", DEFAULT_PORT)),
                        help="Porta do serviço local (padrão: 8766 ou PAUTA_PORT).")
    parser.add_argument("--fontes", default="djen,datajud",
                        help="Fontes a consultar, separadas por vírgula: djen,datajud.")
    parser.add_argument("--sem-consultar", action="store_true",
                        help="Não enfileira consultas; apenas relata o que já está no serviço.")
    parser.add_argument("--esperar", type=int, default=240,
                        help="Segundos máximos de espera pela fila (padrão: 240).")
    parser.add_argument("--incluir-arquivados", action="store_true",
                        help="Inclui processos arquivados.")
    parser.add_argument("--limite-texto", type=int, default=300,
                        help="Limite de caracteres por movimentação; 0 para texto completo (padrão: 300).")
    parser.add_argument("--json", action="store_true", help="Saída JSON para uso por rotinas.")
    parser.add_argument("--strict", action="store_true",
                        help="Retorna código 1 quando houver falha ou consulta pendente.")
    args = parser.parse_args(argv)

    if not 1024 <= args.port <= 65535:
        parser.error("Porta fora do intervalo permitido.")
    if args.esperar < 1:
        parser.error("--esperar deve ser pelo menos 1 segundo.")
    if args.limite_texto < 0:
        parser.error("--limite-texto não pode ser negativo.")

    try:
        sources = parse_sources(args.fontes)
        client = connect(args.port)
        status = client.request("status")
        enabled = (status.get("settings") or {}).get("enabled") or {}
        active_sources = [source for source in sources if enabled.get(source, True)]
        disabled = [source for source in sources if source not in active_sources]
        if not active_sources:
            raise ServiceError("Nenhuma das fontes pedidas está ativada no painel.")
        cases_payload = client.request("cases")
        cases, skipped = select_cases(cases_payload, args.incluir_arquivados)
        if disabled:
            print("Fontes desativadas no painel e não consultadas: "
                  + ", ".join(SOURCE_LABEL.get(source, source) for source in disabled))
        if not cases:
            print("Nenhum processo com CNJ válido para verificar.")
            return 0

        consulted = not args.sem_consultar
        if consulted:
            client.request("jobs", {"ids": [case["id"] for case in cases], "sources": active_sources})
        details, pending = wait_for_jobs(client, cases, active_sources, args.esperar)
        report = build_report(client, args, cases, active_sources, details, pending, consulted)

        if args.json:
            print(json.dumps({
                "generatedAt": report["generatedAt"],
                "consulted": consulted,
                "sources": active_sources,
                "disabledSources": disabled,
                "cases": len(cases),
                "ignored": [{"id": case.get("id"), "reason": reason}
                            for case, reason in skipped],
                "novelties": report["novelties"],
                "failures": [{"cnj": case["cnj"], "source": source, "message": message}
                             for case, source, message in report["failures"]],
                "caveats": [{"cnj": case["cnj"], "source": source, "message": message}
                            for case, source, message in report["caveats"]],
                "pending": [{"cnj": case["cnj"]} for case in cases if case["id"] in report["pending"]],
                "quiet": [case["cnj"] for case in report["quiet"]],
            }, ensure_ascii=False, indent=2))
        else:
            print_text(report, skipped)

        return 1 if args.strict and (report["failures"] or report["pending"]) else 0
    except ServiceError as error:
        print("Falha: " + str(error), file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("Interrompido.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
