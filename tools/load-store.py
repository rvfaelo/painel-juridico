"""Carga local do Store: 5 mil processos e 20 mil publicações, sem rede."""
from pathlib import Path
import json
import sys
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from service.connectors import fingerprint  # noqa: E402
from service.store import Store  # noqa: E402


def cnj(serial):
    base = f"{serial:07d}2026" + "8" + "19" + "0001"
    check = 98 - int(base + "00") % 97
    return base[:7] + f"{check:02d}" + base[7:]


def main():
    metrics = {}
    with tempfile.TemporaryDirectory() as directory:
        started = time.perf_counter()
        store = Store(directory)
        cases = [{"id": f"case{index}", "cnj": cnj(index + 1)} for index in range(5000)]
        store.sync_cases(cases)
        store.enqueue(["case0"], ["djen"])
        job = store.claim(("djen",))
        events = [{
            "id": f"djen:carga:{index}", "tramitationId": "djen:" + cnj(1),
            "cnj": cnj(1), "source": "djen", "kind": "publication",
            "occurredAt": "2026-11-06", "text": f"Publicação sintética {index}",
            "sourceUpdatedAt": "", "digest": fingerprint({"index": index}),
            "url": "", "certificateHash": "", "publicationDetails": {},
        } for index in range(20000)]
        store.finish(job, {"status": "success", "source": "djen", "events": events,
                           "tramitations": [], "documents": [], "sourceUpdatedAt": ""})
        metrics["ingestao_ms"] = round((time.perf_counter() - started) * 1000)

        for label, action in (
            ("summary_ms", lambda: store.summary()),
            ("publications_ms", lambda: store.publications(limit=400)),
            ("case_detail_ms", lambda: store.case_detail("case0")),
            ("notifications_ms", lambda: store.notifications()),
            ("export_ms", lambda: store.export_monitoring()),
        ):
            mark = time.perf_counter()
            action()
            metrics[label] = round((time.perf_counter() - mark) * 1000)

        metrics["cases"] = len(cases)
        metrics["events"] = len(events)
        metrics["total_ms"] = round((time.perf_counter() - started) * 1000)
        print(json.dumps(metrics, ensure_ascii=False))
        if metrics["total_ms"] > 60000:
            raise SystemExit("Carga do Store excedeu 60 segundos.")
        if metrics["case_detail_ms"] > 10000:
            raise SystemExit("case_detail excedeu 10 segundos.")


if __name__ == "__main__":
    main()
