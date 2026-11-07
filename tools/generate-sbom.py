"""Gera um SBOM CycloneDX 1.5 a partir dos locks do projeto."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re


def python_components(root):
    components = {}
    required = (root / "requirements.txt").read_text(encoding="utf-8")
    optional = (root / "requirements-esaj.lock").read_text(encoding="utf-8")
    dependency_versions = json.loads((root / "update-dependencies.json").read_text(encoding="utf-8"))
    for line in required.splitlines():
        match = re.match(r"([A-Za-z0-9_.-]+)==([^\s]+)", line.strip())
        if match:
            components[match.group(1).lower()] = (match.group(1), match.group(2), "required")
        direct = re.match(r"([A-Za-z0-9_.-]+)\s*@\s*git\+.*@([0-9a-f]{40})", line.strip())
        if direct:
            name = direct.group(1)
            version = dependency_versions.get("packages", {}).get(name, "0.0.0")
            components[name.lower()] = (name, version, "required")
    for line in optional.splitlines():
        match = re.match(r"([A-Za-z0-9_.-]+)==([^\s]+)", line.strip())
        if not match or match.group(1).lower() == "pip":
            continue
        name = match.group(1)
        scope = "optional" if name.lower() != "tzdata" else "required"
        components.setdefault(name.lower(), (name, match.group(2), scope))
    return [
        {"type": "library", "name": name, "version": version,
         "bom-ref": f"pkg:pypi/{name.lower()}@{version}",
         "purl": f"pkg:pypi/{name.lower()}@{version}", "scope": scope}
        for name, version, scope in sorted(components.values(), key=lambda item: item[0].lower())
    ]


def npm_components(root):
    lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
    seen = {}
    for name, package in lock.get("packages", {}).items():
        if not name.startswith("node_modules/") or not package.get("version"):
            continue
        package_name = name.removeprefix("node_modules/")
        key = (package_name, package["version"])
        if key in seen:
            continue
        seen[key] = {
            "type": "library", "name": package_name, "version": package["version"],
            "bom-ref": f"pkg:npm/{package_name.replace('@', '%40')}@{package['version']}",
            "purl": f"pkg:npm/{package_name.replace('@', '%40')}@{package['version']}",
            "scope": "excluded" if package.get("dev") else "required",
        }
    return sorted(seen.values(), key=lambda item: (item["name"], item["version"]))


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="sbom.cdx.json")
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parent.parent
    application = json.loads((root / "package.json").read_text(encoding="utf-8"))
    bom = {
        "bomFormat": "CycloneDX", "specVersion": "1.5", "version": 1,
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "component": {
                "type": "application", "name": application["name"],
                "version": application["version"],
                "bom-ref": f"pkg:npm/{application['name']}@{application['version']}",
            },
        },
        "components": python_components(root) + npm_components(root),
    }
    Path(args.output).write_text(json.dumps(bom, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": args.output, "components": len(bom["components"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
