"""Cria distribuicao Windows do Painel H.B sem dados privados ou binarios da maquina.

Execute depois de npm run build. O ZIP funciona em modo arquivo imediatamente,
ou em modo integrado apos preparar um ambiente Python no computador de destino.
"""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json
import re
from release_inventory import release_files

ROOT = Path(__file__).resolve().parent.parent
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
NAME = f'Painel-HB-v{VERSION}-Windows'
ARCHIVE = ROOT / (NAME + '.zip')
PREFIX = 'Painel-HB/'

REQUIRED = (
    'dashboard.html', 'styles.css', 'app.bundle.js', 'app.js', 'boot-check.js',
    'actions/backup.js', 'actions/cases.js', 'actions/general.js', 'actions/publications.js',
    'html-utils.js', 'text-utils.js',
    'CENTRAL-PAINEL-HB.cmd', 'central-painel-hb.ps1',
    'ABRIR-PAINEL.cmd', 'ABRIR-PAINEL-INTEGRADO.cmd', 'PREPARAR-SERVICO.cmd',
    'PARAR-SERVICO.cmd', 'STATUS-SERVICO.cmd', 'requirements.txt',
    'package.json', 'package-lock.json', 'LEIA-ME.md',
    'THIRD-PARTY-LICENSES.md', 'service/__init__.py',
    'service/main.py', 'service/store.py', 'service/connectors.py',
    'service/datajud_mcp.py',
    'tools/build-app.mjs', 'tools/build-zip.mjs',
)

for name in REQUIRED:
    if not (ROOT / name).is_file():
        raise RuntimeError(f'Arquivo obrigatorio ausente: {name}')

source_version = (ROOT / 'core.js').read_text(encoding='utf-8')
if not re.search(r"VERSION\s*=\s*'" + re.escape(VERSION) + r"'", source_version):
    raise RuntimeError('Versao de core.js nao coincide com package.json')
bundle = (ROOT / 'app.bundle.js').read_text(encoding='utf-8')
if f'Painel H.B v{VERSION}' not in bundle or 'case-history-pagination' not in bundle:
    raise RuntimeError('Bundle nao parece atualizado: execute npm run build')
if re.search(r'\bfrom\s*["\']\./|chrome\.(runtime|storage|alarms)', bundle):
    raise RuntimeError('Bundle contem imports locais ou APIs antigas de extensao')

# Somente nomes revisados em release-files.json.
files = release_files(ROOT)

# O pacote de release nao inclui tests/ nem os utilitarios de navegador.
# Remove apenas esses atalhos do package.json distribuido, preservando o
# repositorio completo (com testes) intacto.
RELEASE_SCRIPTS = ('test', 'test:cnj', 'test:djen', 'test:ui',
                   'test:integrated', 'probe', 'probe:live')


def release_bytes(path, relative):
    content = path.read_bytes()
    if relative == 'package.json':
        data = json.loads(content.decode('utf-8'))
        for name in RELEASE_SCRIPTS:
            data.get('scripts', {}).pop(name, None)
        data.get('devDependencies', {}).pop('playwright', None)
        content = (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    elif relative == 'package-lock.json':
        data = json.loads(content.decode('utf-8'))
        packages = data.get('packages', {})
        packages.get('', {}).get('devDependencies', {}).pop('playwright', None)
        for name in ('node_modules/playwright', 'node_modules/playwright-core'):
            packages.pop(name, None)

        def referenced(name):
            fields = ('dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies')
            return any(name in (package.get(field) or {})
                       for package in packages.values() for field in fields)

        # fsevents só era alcançável pelo Playwright neste lock.
        if 'node_modules/fsevents' in packages and not referenced('fsevents'):
            packages.pop('node_modules/fsevents')
        content = (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    return content

readme = f'''PAINEL H.B v{VERSION} - PACOTE PARA OUTRO COMPUTADOR WINDOWS

1. EXTRAIA todo o ZIP para uma pasta fixa, por exemplo Documentos\\Painel-HB.
   Nao execute os arquivos de dentro da visualizacao do ZIP.

2. ABRA CENTRAL-PAINEL-HB.cmd para acessar a central grafica unica.
   Ela oferece Abrir painel simples (Chrome/Edge, sem Python), Abrir painel
   integrado, instalacao de dependencias e controle do servico.
   Os scripts CMD anteriores continuam disponiveis se necessario.

3. MODO INTEGRADO (consultas e acompanhamento):
   - Opcao offline: extraia o ZIP de dependencias separado NESTA MESMA pasta.
     Use Central > Instalacao > Instalar dependencias offline.
     O ZIP offline inclui Python 3.12 x64 + bibliotecas e dispensa Git/Node/rede.
   - Opcao online: instale Python e Git; use Central > Preparar com internet.
   - Depois use Central > Abrir painel integrado.
   - Acesse http://127.0.0.1:8766/ (somente seu computador).
   - Para encerrar, use Central > Parar servico.
   Node.js e necessario apenas se voce quiser recompilar o codigo-fonte.

4. DADOS DO COMPUTADOR ANTIGO: o ZIP NAO contem processos, clientes,
   anexos, historicos, credenciais, tokens nem banco SQLite.
   Para levar seus dados, abra o painel antigo, exporte um backup com senha
   (incluindo o monitoramento integrado, se usado), leve o backup separadamente
   e restaure no novo PC em Fontes e ajustes > Restaurar backup.
   CONFIRA a previa e a quantidade de registros antes de confirmar.
   Chrome e Edge armazenam dados separadamente; o modo file:// e o modo
   http://127.0.0.1:8766/ tambem tem bancos separados.
   Mantenha a senha do backup fora do ZIP e evite mudar a pasta depois.

5. Se nao houver dados importados, o aplicativo comeca com carteira vazia.
   O monitoramento requer um computador ligado e o servico em execucao.

Documentacao adicional: LEIA-ME.md e docs/ATUALIZACOES-GITHUB.md.
Distribuicao sem instalador EXE e sem dados da maquina que criou o ZIP.
'''

with ZipFile(ARCHIVE, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    def add_reproducible(name, content):
        entry = ZipInfo(PREFIX + name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, content, compresslevel=9)
    add_reproducible('COMECE-AQUI-NOVO-PC.txt', ('\ufeff' + readme.replace('\n', '\r\n')).encode('utf-8'))
    for file in files:
        relative = file.relative_to(ROOT).as_posix()
        add_reproducible(relative, release_bytes(file, relative))

with ZipFile(ARCHIVE) as archive:
    members = archive.namelist()
    if archive.testzip() is not None:
        raise RuntimeError('Arquivo ZIP corrompido')
    if len(members) != len(set(members)):
        raise RuntimeError('Arquivo duplicado no ZIP')
    if any(PREFIX + name not in members for name in REQUIRED):
        raise RuntimeError('Arquivo obrigatorio nao incluído')
    if any(not m.startswith(PREFIX) for m in members):
        raise RuntimeError('Entrada fora do diretorio do ZIP')
    release_package = json.loads(archive.read(PREFIX + 'package.json'))
    if any(name in release_package.get('scripts', {}) for name in RELEASE_SCRIPTS):
        raise RuntimeError('Script de teste/utilitario ausente do repositorio no ZIP')
    if 'playwright' in release_package.get('devDependencies', {}):
        raise RuntimeError('Dependencia de testes Playwright no ZIP')
    release_lock = json.loads(archive.read(PREFIX + 'package-lock.json'))
    lock_packages = release_lock.get('packages', {})
    if (release_lock.get('version') != VERSION
            or lock_packages.get('', {}).get('version') != VERSION):
        raise RuntimeError('Versao do package-lock no ZIP diverge de package.json')
    if ('playwright' in lock_packages.get('', {}).get('devDependencies', {})
            or 'node_modules/playwright' in lock_packages
            or 'node_modules/playwright-core' in lock_packages):
        raise RuntimeError('Dependencia de testes Playwright no package-lock do ZIP')
    forbidden = ('node_modules/', '.venv/', 'audit-context/', 'arquivo/', 'tests/',
                 'data/', '__pycache__/', 'docs/ui-test/', '.public-datajud-key.txt')
    if any(any(part in m for part in forbidden)
           or m.lower().endswith(('.sqlite3', '.db', '.pem', '.key', '.env', '.zip'))
           for m in members):
        raise RuntimeError('Arquivo privado ou dependencia local no ZIP')

print(json.dumps({
    'arquivo': str(ARCHIVE),
    'versao': VERSION,
    'arquivos': len(members),
    'tamanho_bytes': ARCHIVE.stat().st_size,
    'sha256': hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    'inclui_codigo_e_servico': True,
    'inclui_dados_privados': False,
}, ensure_ascii=False))
