"""Verifica a distribuicao gerada em diretorio temporario e sem chamadas externas."""
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile
import json
import os
import re
import shutil
import subprocess
import sys


def check_versions(base, expected):
    """Falha se package/core/servico/interface declararem versoes diferentes."""
    def fail(name, found=None):
        detail = f' ({found})' if found else ''
        raise SystemExit(f'Versao divergente em {name}{detail}; esperado {expected}.')

    core = (base / 'core.js').read_text(encoding='utf-8')
    match = re.search(r"export\s+const\s+VERSION\s*=\s*'([^']+)'", core)
    if not match:
        fail('core.js')
    if match.group(1) != expected:
        fail('core.js', match.group(1))

    main = (base / 'service/main.py').read_text(encoding='utf-8')
    match = re.search(r'^APP_VERSION\s*=\s*"([^"]+)"', main, re.MULTILINE)
    if not match:
        fail('service/main.py')
    if match.group(1) != expected:
        fail('service/main.py', match.group(1))

    dashboard = (base / 'dashboard.html').read_text(encoding='utf-8')
    stale = re.search(r'Vers[aã]o\s+(\d+\.\d+\.\d+)', dashboard)
    if stale:
        fail('dashboard.html', stale.group(1))
    if 'id="local-version"' not in dashboard:
        fail('dashboard.html', 'elemento #local-version ausente')
    app = (base / 'app.js').read_text(encoding='utf-8')
    if "$('#local-version').textContent=VERSION" not in app:
        fail('app.js', 'versao da interface nao usa a constante VERSION')


root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
check_versions(root, version)
archive = root / f'Painel-HB-v{version}-Windows.zip'
if not archive.is_file():
    raise SystemExit('Gere o ZIP com python tools/package.py primeiro')

with TemporaryDirectory(prefix='painel-hb-release-') as temp:
    with ZipFile(archive) as z:
        if z.testzip() is not None:
            raise RuntimeError('Erro de integridade do ZIP')
        if any(not name.startswith('Painel-HB/') or '..' in Path(name).parts
               for name in z.namelist()):
            raise RuntimeError('Caminho incorreto no ZIP')
        z.extractall(temp)
    install = Path(temp) / 'Painel-HB'
    check_versions(install, version)
    if json.loads((install / 'package.json').read_text(encoding='utf-8'))['version'] != version:
        raise SystemExit('Versao do package.json no ZIP diverge de package.json do repositorio')
    for required in (
        'dashboard.html', 'styles.css', 'app.bundle.js', 'boot-check.js',
        'CENTRAL-PAINEL-HB.cmd', 'central-painel-hb.ps1',
        'PREPARAR-SERVICO.cmd', 'ABRIR-PAINEL-INTEGRADO.cmd',
        'ABRIR-PAINEL.cmd', 'COMECE-AQUI-NOVO-PC.txt',
        'service/main.py', 'service/store.py', 'service/connectors.py',
        'requirements.txt',
    ):
        assert (install / required).is_file(), 'Falta ' + required
    forbidden = ('.venv', 'node_modules', 'data', 'arquivo', 'audit-context',
                 '.public-datajud-key.txt')
    assert all(not (install / name).exists() for name in forbidden)
    assert all(not file.suffix.lower() in {'.sqlite3', '.db', '.key', '.pem'}
               for file in install.rglob('*') if file.is_file())
    dashboard = (install / 'dashboard.html').read_text(encoding='utf-8')
    assert 'Painel H.B' in dashboard
    assert '<script src="boot-check.js" defer></script>' in dashboard
    assert '<script>' not in dashboard
    assert 'case-history-pagination' in (install / 'app.bundle.js').read_text(encoding='utf-8')

    release_lock = json.loads((install / 'package-lock.json').read_text(encoding='utf-8'))
    assert release_lock['version'] == version
    assert release_lock['packages']['']['version'] == version
    assert 'playwright' not in release_lock['packages'][''].get('devDependencies', {})
    assert 'axe-core' not in release_lock['packages'][''].get('devDependencies', {})
    assert 'node_modules/playwright' not in release_lock['packages']
    assert 'node_modules/playwright-core' not in release_lock['packages']
    assert 'node_modules/axe-core' not in release_lock['packages']

    npm = shutil.which('npm')
    npm_ci = False
    if npm:
        result = subprocess.run(
            [npm, 'ci', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund'],
            cwd=install, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError('npm ci --dry-run falhou no pacote: ' +
                               (result.stderr or result.stdout)[-600:])
        npm_ci = True
    else:
        print('AVISO: npm nao encontrado; npm ci --dry-run nao foi verificado.',
              file=sys.stderr)

    node = shutil.which('node')
    checked = 0
    if node:
        for file in install.glob('*.js'):
            subprocess.run([node, '--check', str(file)], check=True,
                           capture_output=True, timeout=15)
            checked += 1
    powershell = shutil.which('powershell.exe')
    if powershell:
        result = subprocess.run([powershell, '-NoProfile', '-ExecutionPolicy',
                                 'Bypass', '-STA', '-File',
                                 str(install / 'central-painel-hb.ps1'), '-SelfTest'],
                                cwd=install, capture_output=True, text=True,
                                timeout=25, check=True)
        assert json.loads(result.stdout.strip())['ok'] is True
    env = os.environ.copy()
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    subprocess.run([sys.executable, '-c',
                    'from service.main import ROOT,STATIC; '
                    'assert ROOT.name == "Painel-HB"; '
                    'assert "/dashboard.html" in STATIC; '
                    'assert "/boot-check.js" in STATIC'],
                   cwd=install, env=env, check=True, capture_output=True, timeout=15)
    print(json.dumps({
        'zip_ok': True, 'servico_importavel': True,
        'js_verificados': checked, 'central_validada': bool(powershell),
        'npm_ci_dry_run': npm_ci,
        'dados_privados': False,
        'instalacao_de_destino_nao_executada': True,
    }, ensure_ascii=False))
