"""Verifica a distribuicao gerada em diretorio temporario e sem chamadas externas."""
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile
import json
import os
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
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
    for required in (
        'dashboard.html', 'styles.css', 'app.bundle.js',
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
    assert 'Painel H.B' in (install / 'dashboard.html').read_text(encoding='utf-8')
    assert 'case-history-pagination' in (install / 'app.bundle.js').read_text(encoding='utf-8')

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
                    'assert "/dashboard.html" in STATIC'],
                   cwd=install, env=env, check=True, capture_output=True, timeout=15)
    print(json.dumps({
        'zip_ok': True, 'servico_importavel': True,
        'js_verificados': checked, 'central_validada': bool(powershell),
        'dados_privados': False,
        'instalacao_de_destino_nao_executada': True,
    }, ensure_ascii=False))
