"""Gera manifesto canônico para ZIP de distribuição já construído. Sem segredos."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from updates.updater import load_json, sha256, safe_path


def build(root=ROOT, offline=None):
    root = Path(root)
    version = load_json(root / 'package.json')['version']
    name = f'Painel-HB-v{version}-Windows.zip'
    archive = root / name
    files = {}
    with zipfile.ZipFile(archive) as package:
        for info in package.infolist():
            if not info.filename.startswith('Painel-HB/') or info.is_dir():
                raise ValueError('Estrutura inesperada no pacote de distribuição.')
            relative = info.filename.removeprefix('Painel-HB/')
            safe_path(root, relative)
            if relative in files:
                raise ValueError('Arquivo duplicado no pacote.')
            content = package.read(info)
            files[relative] = {'size': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
    manifest = {'protocol': 1, 'repository': load_json(root / 'update-config.json')['repository'], 'version': version,
                'platform': 'windows-x64', 'asset': {'name': name, 'size': archive.stat().st_size, 'sha256': sha256(archive)},
                'dependencies': load_json(root / 'update-dependencies.json'), 'files': files}
    if offline:
        offline = Path(offline)
        manifest['offline_dependencies'] = {'name': offline.name, 'size': offline.stat().st_size, 'sha256': sha256(offline)}
    target = root / 'update-manifest.json'
    target.write_text(json.dumps(manifest, sort_keys=True, ensure_ascii=True, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'manifest': str(target), 'package': str(archive), 'files': len(files), 'signed': False}))
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--offline')
    args = parser.parse_args()
    build(offline=args.offline)
