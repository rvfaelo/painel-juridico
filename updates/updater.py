"""Atualizador Windows, somente stdlib. Nunca importa ou consulta conectores judiciais.

Manifesto assinado -> staging -> backup -> journal -> troca -> health -> commit.
O processo roda no Python-base, fora do .venv que pode ser substituido.
"""
from __future__ import annotations
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

PROTOCOL = 1
ORIGIN = 'http://127.0.0.1:8766'
MAX_PACKAGE = 512 * 1024 * 1024
MAX_EXPANDED = 1024 * 1024 * 1024
CREATE_HIDDEN = getattr(subprocess, 'CREATE_NO_WINDOW', 0)


class UpdateError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise UpdateError(message)


def load_json(path):
    return decode_json(Path(path).read_bytes())


def decode_json(raw):
    def unique(pairs):
        out = {}
        for key, value in pairs:
            require(key not in out, 'JSON com campos duplicados.')
            out[key] = value
        return out
    try:
        return json.loads(raw.decode('utf-8-sig'), object_pairs_hook=unique)
    except (ValueError, UnicodeError):
        raise UpdateError('Arquivo JSON invalido.') from None


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    with temporary.open('w', encoding='utf-8') as out:
        json.dump(value, out, ensure_ascii=True, indent=2)
        out.flush()
        os.fsync(out.fileno())
    os.replace(temporary, path)


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def version(value):
    # Canal estavel: prereleases nao sao instaladas por este protocolo.
    require(isinstance(value, str), 'Versao invalida.')
    match = re.fullmatch(r'v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?', value)
    require(match is not None, 'Versao estavel SemVer invalida.')
    return tuple(int(match[x]) for x in (1, 2, 3))


def repository(value):
    value = str(value).strip().removeprefix('https://github.com/').removesuffix('/').removesuffix('.git')
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9_.-]{1,100}', value) is not None,
            'Informe o repositorio no formato dono/projeto.')
    require(value.split('/')[1] not in ('.', '..'), 'Repositorio invalido.')
    return value


def install_id(root):
    return hashlib.sha256(os.path.normcase(str(Path(root).resolve())).encode('utf-8')).hexdigest()


def state_directory(root):
    base = Path(os.environ.get('LOCALAPPDATA', str(Path.home() / '.local/share')))
    return base / 'PainelHB' / 'updates' / install_id(root)[:20]


def linked(path):
    return path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction())


def safe_path(root, name):
    require(isinstance(name, str) and name and '\\' not in name and ':' not in name,
            'Caminho de pacote invalido.')
    parts = name.split('/')
    require(not PurePosixPath(name).is_absolute() and all(p not in ('', '.', '..') for p in parts),
            'Caminho fora da instalacao.')
    require(all(re.fullmatch(r'[A-Za-z0-9_.-]+', p) and not p.endswith(('.', ' ')) and
                p.split('.')[0].upper() not in {'CON', 'PRN', 'AUX', 'NUL', *('COM'+str(i) for i in range(10)), *('LPT'+str(i) for i in range(10))}
                for p in parts), 'Nome de arquivo nao permitido.')
    require(not any(p.lower() in {'data', 'dados', 'backups', 'backup', 'arquivo', 'node_modules', '.git', '.venv', 'dependencias-offline', '__pycache__'} or p.startswith('.') for p in parts),
            'Pacote tenta alterar dados ou ambiente local.')
    require(Path(name).suffix.lower() in {'.js', '.mjs', '.json', '.py', '.ps1', '.cmd', '.md', '.txt', '.html', '.css', '.lock'},
            'Tipo de arquivo nao permitido no programa.')
    require(len(parts) == 1 or parts[0] in {'service', 'updates', 'tools', 'docs'},
            'Diretorio nao permitido no programa.')
    root = Path(root).absolute()
    current = root
    # Verifica ancestrais, inclusive a instalacao; resolve nunca mascara um junction.
    for parent in [root, *root.parents]:
        require(not linked(parent), 'Instalacao em link ou junction nao suportada.')
    for part in parts:
        current = current / part
        require(not linked(current), 'Link ou junction nao permitido.')
    require(current.resolve().is_relative_to(root.resolve()), 'Caminho fora da instalacao.')
    return current


class Network:
    def __init__(self, repo, cancel=lambda: None):
        self.repo = repository(repo)
        self.cancel = cancel
        self.token = os.getenv('HB_GITHUB_TOKEN', '')

    def allowed(self, url):
        p = urllib.parse.urlsplit(url)
        require(p.scheme == 'https' and not p.username and not p.password and p.port in (None, 443), 'Download exige HTTPS.')
        host = p.hostname
        require(host in {'api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'},
                'Host de download nao autorizado.')
        if host == 'api.github.com':
            require(p.path.startswith('/repos/' + self.repo + '/'), 'Recurso de outro repositorio.')
        if host == 'github.com':
            require(p.path.startswith('/' + self.repo + '/releases/download/'), 'Download fora das Releases oficiais.')
        return host

    def open(self, url, binary=False):
        owner = self

        class Redirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                target = urllib.parse.urljoin(req.full_url, newurl)
                owner.allowed(target)
                result = super().redirect_request(req, fp, code, msg, headers, target)
                # Tokens privados nunca seguem para CDN ou outro host.
                if urllib.parse.urlsplit(target).hostname != urllib.parse.urlsplit(req.full_url).hostname:
                    result.remove_header('Authorization')
                return result

        host = self.allowed(url)
        headers = {'User-Agent': 'Painel-HB-Updater/1', 'Accept': 'application/octet-stream' if binary else 'application/vnd.github+json',
                   'X-GitHub-Api-Version': '2022-11-28'}
        if host == 'api.github.com' and self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        try:
            return urllib.request.build_opener(Redirect()).open(urllib.request.Request(url, headers=headers), timeout=15)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                raise UpdateError('Repositorio ou versao nao encontrados; confira acesso e publicacao.') from None
            raise UpdateError('GitHub indisponivel ou acesso limitado (HTTP ' + str(error.code) + ').') from None
        except (OSError, urllib.error.URLError):
            raise UpdateError('Sem conexao com o GitHub. O painel local continua disponivel.') from None

    def json(self, url):
        self.cancel()
        with self.open(url) as response:
            raw = response.read(2 * 1024 * 1024 + 1)
            require(len(raw) <= 2 * 1024 * 1024, 'Resposta do GitHub excede o limite.')
            self.cancel()
            return decode_json(raw)

    def download(self, url, target, expected_size, progress=lambda p: None):
        require(type(expected_size) is int and 0 < expected_size <= MAX_PACKAGE, 'Tamanho de download invalido.')
        start, total = time.monotonic(), 0
        try:
            with self.open(url, binary=True) as source, Path(target).open('wb') as dest:
                while True:
                    self.cancel()
                    require(time.monotonic() - start < 600, 'Tempo de download excedido.')
                    chunk = source.read(64 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    require(total <= expected_size, 'Download maior que o tamanho autorizado.')
                    dest.write(chunk)
                    progress(int(total * 100 / expected_size))
            require(total == expected_size, 'Download interrompido ou incompleto.')
        except (OSError, urllib.error.URLError):
            raise UpdateError('Download interrompido. Tente novamente; nenhum arquivo do painel foi substituido.') from None


def choose_release(releases):
    require(isinstance(releases, list), 'Lista de versoes invalida.')
    stable = []
    for release in releases:
        if not isinstance(release, dict) or release.get('draft') or release.get('prerelease'):
            continue
        try:
            stable.append((version(release.get('tag_name')), release))
        except UpdateError:
            continue
    return max(stable, key=lambda x: x[0])[1] if stable else None


def verify_signature(root, manifest, signature):
    result = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
                             str(Path(root) / 'updates/verify-signature.ps1'), '-Manifest', str(manifest),
                             '-Signature', str(signature), '-Trust', str(Path(root) / 'update-trust.json')],
                            capture_output=True, timeout=25, creationflags=CREATE_HIDDEN)
    require(result.returncode == 0 and b'VERIFIED' in result.stdout, 'Assinatura do editor invalida ou nao reconhecida. Instalacao bloqueada.')


def validate_manifest(manifest, repo, tag, installed_dependencies):
    require(isinstance(manifest, dict) and manifest.get('protocol') == PROTOCOL, 'Protocolo do atualizador incompativel.')
    require(manifest.get('repository') == repository(repo), 'Manifesto de outro repositorio.')
    require(version(manifest.get('version')) == version(tag), 'Versao do manifesto diverge da Release.')
    require(manifest.get('platform') == 'windows-x64', 'Pacote nao compativel com Windows x64.')
    deps = manifest.get('dependencies', {})
    require(deps.get('data_schema') == installed_dependencies.get('data_schema') and
            deps.get('workspace_schema') == installed_dependencies.get('workspace_schema') and
            deps.get('origin') == ORIGIN, 'Esquema ou origem incompativeis. Esta versao exige migracao assistida antes de atualizar.')
    require(deps.get('protocol') == PROTOCOL and deps.get('architecture') == 'win_amd64', 'Dependencias incompativeis.')
    for group in ('packages', 'optional_packages'):
        require(isinstance(deps.get(group), dict), 'Manifesto de dependencias invalido.')
        for name, value in deps[group].items():
            require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,100}', name) is not None and
                    isinstance(value, str) and re.fullmatch(r'[0-9][A-Za-z0-9_.+!-]{0,80}', value) is not None,
                    'Dependencia com nome ou versao nao permitidos.')
    for field in ('python_min', 'python_max_exclusive'):
        require(isinstance(deps.get(field), list) and len(deps[field]) == 2 and all(type(n) is int and 0 <= n < 100 for n in deps[field]),
                'Versao Python invalida no manifesto.')
    require(type(deps.get('node_min_major')) is int and 0 < deps['node_min_major'] < 100, 'Versao Node invalida.')
    files = manifest.get('files')
    require(isinstance(files, dict) and 5 <= len(files) <= 1000, 'Inventario de arquivos invalido.')
    lowered = set()
    for name, record in files.items():
        safe_path(Path(tempfile.gettempdir()) / 'hb-path-policy', name)
        require(name.lower() not in lowered, 'Colisao de nomes no Windows.')
        lowered.add(name.lower())
        require(isinstance(record, dict) and type(record.get('size')) is int and 0 <= record['size'] <= 32 * 1024 * 1024 and
                re.fullmatch(r'[a-f0-9]{64}', str(record.get('sha256', ''))) is not None, 'Hash ou tamanho de arquivo invalido.')
    require(sum(x['size'] for x in files.values()) < MAX_EXPANDED, 'Pacote expandido excede o limite.')
    for name in ('package.json', 'app.bundle.js', 'dashboard.html', 'service/main.py', 'update-dependencies.json', 'release-files.json'):
        require(name in files, 'Pacote sem arquivo essencial: ' + name)
    asset = manifest.get('asset', {})
    require(isinstance(asset.get('name'), str) and re.fullmatch(r'Painel-HB-v[0-9.]+-Windows\.zip', asset['name']) is not None and
            type(asset.get('size')) is int and 0 < asset['size'] <= MAX_PACKAGE and
            re.fullmatch(r'[a-f0-9]{64}', str(asset.get('sha256', ''))) is not None, 'Descricao de pacote invalida.')
    return manifest


def extract_package(archive, target, manifest):
    require(Path(archive).stat().st_size == manifest['asset']['size'] and sha256(archive) == manifest['asset']['sha256'],
            'Checksum SHA-256 ou tamanho do pacote nao confere.')
    expected, seen = manifest['files'], set()
    try:
        with zipfile.ZipFile(archive) as package:
            require(len(package.infolist()) == len(expected), 'ZIP contem arquivos extras ou faltantes.')
            for info in package.infolist():
                require(info.filename.startswith('Painel-HB/') and not info.is_dir() and not info.flag_bits & 1,
                        'Estrutura ZIP invalida.')
                name = info.filename.removeprefix('Painel-HB/')
                path = safe_path(target, name)
                mode = info.external_attr >> 16
                require(not stat.S_ISLNK(mode), 'ZIP contem link simbolico.')
                require(name in expected and name.lower() not in seen, 'Arquivo extra ou duplicado no ZIP.')
                seen.add(name.lower())
                record = expected[name]
                require(info.file_size == record['size'], 'Tamanho expandido divergente.')
                path.parent.mkdir(parents=True, exist_ok=True)
                digest, count = hashlib.sha256(), 0
                with package.open(info) as source, path.open('xb') as dest:
                    for chunk in iter(lambda: source.read(65536), b''):
                        count += len(chunk)
                        require(count <= record['size'], 'Arquivo expandido excedeu o manifesto.')
                        digest.update(chunk)
                        dest.write(chunk)
                require(count == record['size'] and digest.hexdigest() == record['sha256'], 'Arquivo adulterado no pacote.')
    except (zipfile.BadZipFile, EOFError, RuntimeError):
        raise UpdateError('Pacote ZIP malformado ou corrompido.') from None
    require(version(load_json(Path(target) / 'package.json')['version']) == version(manifest['version']), 'Versao instalada no pacote diverge do manifesto.')
    require(load_json(Path(target) / 'update-dependencies.json') == manifest['dependencies'], 'Dependencias do pacote divergem do manifesto.')
    inventory = load_json(Path(target) / 'release-files.json')
    require(isinstance(inventory, list) and len(inventory) == len(set(inventory)) and set(inventory) == set(expected) - {'COMECE-AQUI-NOVO-PC.txt'},
            'Inventario de distribuicao diverge do manifesto assinado.')


class LocalService:
    def __init__(self, root):
        self.root = Path(root)
        self.identity = install_id(root)
        self.data = Path(os.getenv('PAUTA_DATA_DIR', str(Path(os.getenv('LOCALAPPDATA', str(Path.home() / '.local/share'))) / 'PautaJuridico')))

    def admin_secret(self):
        path = self.data / 'auth-admin.secret'
        try:
            value = path.read_text(encoding='utf-8').strip()
        except OSError:
            value = ''
        return value if len(value) >= 32 else ''

    def request(self, route, body=None, csrf='', admin=False):
        headers = {'Origin': ORIGIN}
        if csrf:
            headers['X-Pauta-CSRF'] = csrf
        if admin:
            secret = self.admin_secret()
            if secret:
                headers['X-Pauta-Admin'] = secret
        if body is not None:
            headers['Content-Type'] = 'application/json'
        request = urllib.request.Request(ORIGIN + '/api/v1/' + route, headers=headers,
                                         data=None if body is None else json.dumps(body).encode())
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request, timeout=3) as response:
            return decode_json(response.read(1024 * 1024))

    def health(self):
        try:
            health = self.request('health')
        except urllib.error.URLError as error:
            if isinstance(error, urllib.error.HTTPError):
                raise UpdateError('Outro servico ocupa a porta local; nenhuma instancia foi encerrada.') from None
            return None
        require(health.get('product') == 'pauta-local-service' and health.get('installationId') == self.identity,
                'A porta pertence a outra instalacao ou a um servico antigo. Pare-o pela Central antes de atualizar.')
        return health

    def locate_data(self):
        if self.health():
            status = self.request('status', admin=True)
            self.data = Path(status['dataDirectory'])
        return self.data

    def stop(self):
        if not self.health():
            return
        try:
            self.request('shutdown', {}, admin=True)
        except urllib.error.HTTPError as error:
            if error.code not in (401, 403):
                raise
            # Compatibilidade com a versao anterior, que ainda usa CSRF de sessao.
            session = self.request('session')
            self.request('shutdown', {}, session['csrf'])
        for _ in range(100):
            time.sleep(.1)
            if not self.health():
                return
        raise UpdateError('O servico nao encerrou no prazo. Nenhum arquivo deve ser substituido.')

    def start(self, expected_version, validation=False):
        python = self.root / '.venv/Scripts/python.exe'
        require(python.is_file(), 'Ambiente Python local ausente. Prepare-o pela aba Instalacao.')
        env = os.environ.copy()
        env['PAUTA_DATA_DIR'] = str(self.data)
        env['PAUTA_PORT'] = '8766'
        if validation:
            env['HB_UPDATE_VALIDATION'] = '1'
        else:
            env.pop('HB_UPDATE_VALIDATION', None)
        process = subprocess.Popen([str(python), '-m', 'service.main'], cwd=self.root, env=env,
                                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=CREATE_HIDDEN)
        for _ in range(100):
            time.sleep(.15)
            if process.poll() is not None:
                break
            health = self.health()
            if health and health.get('appVersion') == expected_version:
                return
        raise UpdateError('O servico nao reiniciou na versao esperada. Recuperacao necessaria.')


def database_schema(path):
    with contextlib.closing(sqlite3.connect(Path(path).as_uri() + '?mode=ro', uri=True)) as db:
        require(db.execute('PRAGMA quick_check').fetchone()[0] == 'ok', 'A integridade SQLite falhou; dados nao foram substituidos.')
        try:
            row = db.execute("SELECT v FROM meta WHERE k='schema'").fetchone()
            return int(row[0]) if row else 0
        except sqlite3.OperationalError:
            return 0


def require_database_contract(path, schema, workspace_schema=2):
    require(database_schema(path) == schema, 'Banco evoluiu para outro esquema; nao e seguro restaurar o codigo anterior automaticamente.')
    with contextlib.closing(sqlite3.connect(Path(path).as_uri() + '?mode=ro', uri=True)) as db:
        exists = db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='workspace'").fetchone()
        if exists:
            row = db.execute('SELECT payload FROM workspace WHERE id=1').fetchone()
            if row:
                state = decode_json(row[0].encode('utf-8'))
                require(state.get('schema') == workspace_schema, 'Carteira evoluiu para outro esquema; recuperacao automatica bloqueada.')


def backup_database(data, backup, expected_schema):
    source = Path(data) / 'pauta-monitoramento.sqlite3'
    if not source.exists():
        return None
    require(not linked(source), 'Banco local em link nao suportado.')
    require_database_contract(source, expected_schema)
    dest = Path(backup) / 'sqlite/pauta-monitoramento.sqlite3'
    dest.parent.mkdir(parents=True, exist_ok=True)
    with contextlib.closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src, contextlib.closing(sqlite3.connect(dest)) as target:
        deadline = time.monotonic() + 120
        src.backup(target, pages=512, progress=lambda status, remaining, total: require(time.monotonic() < deadline, 'Tempo de backup SQLite excedido.'), sleep=.1)
    require(database_schema(dest) == expected_schema, 'Backup SQLite nao foi validado.')
    return sha256(dest)


def run_local(args, timeout=300):
    try:
        result = subprocess.run([str(x) for x in args], capture_output=True, timeout=timeout, creationflags=CREATE_HIDDEN)
    except (OSError, subprocess.TimeoutExpired):
        raise UpdateError('Falha ou tempo excedido ao preparar dependencias; ambiente anterior preservado.') from None
    require(result.returncode == 0, 'Nao foi possivel preparar as dependencias. Use o pacote offline correspondente ou tente novamente.')
    return result.stdout


def runtime_info(python):
    code = "import sys,json,importlib.metadata as m;print(json.dumps({'python':list(sys.version_info[:2]),'bits':64 if sys.maxsize>2**32 else 32,'packages':{d.metadata['Name'].lower().replace('_','-'):d.version for d in m.distributions()}}))"
    return decode_json(run_local([python, '-c', code], 30))


def dependency_changes(deps, info):
    required = dict(deps['packages'])
    required.update({n: v for n, v in deps['optional_packages'].items() if n.lower().replace('_', '-') in info['packages']})
    changed = [name for name, value in required.items() if info['packages'].get(name.lower().replace('_', '-')) != value]
    if not tuple(deps['python_min']) <= tuple(info['python']) < tuple(deps['python_max_exclusive']) or info['bits'] != 64:
        changed.insert(0, 'Python x64 compativel')
    return required, changed


def prepare_environment(root, job, deps, offline=None):
    python = Path(root) / '.venv/Scripts/python.exe'
    require(not linked(Path(root) / '.venv') and not linked(python), 'Ambiente Python em link ou junction nao suportado.')
    require(python.is_file(), 'Prepare o ambiente integrado pela aba Instalacao antes de atualizar.')
    info = runtime_info(python)
    required, changed = dependency_changes(deps, info)
    require('Python x64 compativel' not in changed, 'E necessario instalar um Python x64 compativel antes desta versao; nenhum arquivo foi alterado.')
    node = shutil.which('node')
    require(node is not None, 'Esta instalacao exige Node.js para validar a carteira. Instale o runtime antes de atualizar.')
    node_version = run_local([node, '--version'], 15).decode().strip()
    require(int(node_version.lstrip('v').split('.')[0]) >= deps['node_min_major'], 'Node.js incompativel com a carteira desta versao.')
    if not changed:
        return None, []
    # Fora da instalacao ativa; o processo atual usa o Python-base.
    env = Path(root) / ('.venv-update-' + Path(job).name)
    require(not env.exists() and not linked(env), 'Diretorio temporario do ambiente ja existe.')
    run_local([python, '-m', 'venv', env], 120)
    target_python = env / 'Scripts/python.exe'
    requirements = [name + '==' + value for name, value in sorted(required.items())]
    args = [target_python, '-m', 'pip', 'install', '--disable-pip-version-check', '--only-binary=:all:']
    if offline:
        args += ['--no-index', '--find-links', str(offline)]
    else:
        args += ['--index-url', 'https://pypi.org/simple']
    run_local(args + requirements, 600)
    _, remaining = dependency_changes(deps, runtime_info(target_python))
    require(not remaining, 'Dependencias preparadas nao correspondem ao manifesto.')
    return env, changed


@contextlib.contextmanager
def installation_lock(state):
    state = Path(state)
    state.mkdir(parents=True, exist_ok=True)
    lock = (state / 'install.lock').open('a+b')
    try:
        lock.seek(0); lock.write(b'1'); lock.flush(); lock.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise UpdateError('Outra atualizacao esta em andamento.') from None
        yield
    finally:
        lock.close()


class Updater:
    def __init__(self, root, state=None, job=None, network=None, service=None):
        self.root = Path(root).absolute()
        safe_path(self.root, 'package.json')
        self.state = Path(state or state_directory(root)).absolute()
        self.job = Path(job or self.state / 'jobs' / uuid.uuid4().hex).absolute()
        require(self.job.is_relative_to(self.state / 'jobs'), 'Diretorio de tarefa invalido.')
        self.job.mkdir(parents=True, exist_ok=True)
        self.installed = load_json(self.root / 'package.json')['version']
        self.deps = load_json(self.root / 'update-dependencies.json')
        config = load_json(self.root / 'update-config.json')
        saved = load_json(self.state / 'repository.json') if (self.state / 'repository.json').exists() else {}
        self.repo = repository(saved.get('repository', config['repository']))
        self.network = network or Network(self.repo, self.cancel)
        self.service = service or LocalService(root)

    def cancel(self):
        require(not (self.job / 'cancel').exists(), 'Operacao cancelada; a instalacao ativa foi preservada.')

    def progress(self, stage, percent, **fields):
        atomic_json(self.job / 'progress.json', {'stage': stage, 'percent': percent, 'finished': False, **fields})
        if getattr(self, '_last_stage', None) != stage:
            with (self.job / 'events.jsonl').open('a', encoding='utf-8') as log:
                log.write(json.dumps({'time': int(time.time()), 'stage': stage}) + '\n')
            self._last_stage = stage

    def finish(self, **fields):
        atomic_json(self.job / 'progress.json', {'finished': True, 'percent': 100, **fields})

    def check(self, manual=False):
        cached = self.state / 'last-check.json'
        if cached.exists():
            cache = load_json(cached)
            if cache.get('repository') == self.repo and cache.get('installed') == self.installed and time.time() - cache.get('checked_at', 0) < (30 if manual else 900):
                return {**cache, 'cached': True}
        self.progress('Consultando GitHub', 10)
        last_attempt = self.state / 'last-attempt.json'
        if last_attempt.exists():
            attempt = load_json(last_attempt)
            if attempt.get('repository') == self.repo:
                require(time.time() - attempt.get('time', 0) >= (30 if manual else 900), 'Consulta recente ao GitHub. Aguarde o intervalo minimo antes de tentar novamente.')
        atomic_json(last_attempt, {'repository': self.repo, 'time': time.time()})
        releases = self.network.json('https://api.github.com/repos/' + self.repo + '/releases?per_page=100')
        latest = choose_release(releases)
        result = {'repository': self.repo, 'installed': self.installed, 'checked_at': time.time(), 'connection': 'ok',
                  'latest': latest.get('tag_name', '') if latest else '',
                  'published_at': latest.get('published_at', '') if latest else '',
                  'changelog': str(latest.get('body') or '')[:30000] if latest else '',
                  'available': bool(latest and version(latest['tag_name']) > version(self.installed)),
                  'history': [{'version': r.get('tag_name'), 'date': r.get('published_at'), 'changelog': str(r.get('body') or '')[:10000]}
                              for r in releases[:30] if not r.get('draft') and not r.get('prerelease')], 'release': latest}
        # Dependencias mostradas apenas depois de verificar assinatura do manifesto.
        if result['available']:
            manifest = self.fetch_manifest(latest)
            python = self.root / '.venv/Scripts/python.exe'
            if python.exists():
                _, result['dependency_changes'] = dependency_changes(manifest['dependencies'], runtime_info(python))
            else:
                result['dependency_changes'] = ['Preparar ambiente Python']
        atomic_json(cached, result)
        return result

    def asset(self, release, name):
        assets = [a for a in release.get('assets', []) if a.get('name') == name]
        require(len(assets) == 1 and assets[0].get('state', 'uploaded') == 'uploaded', 'Release sem artefato obrigatorio: ' + name)
        a = assets[0]
        require(type(a.get('id')) is int and type(a.get('size')) is int, 'Artefato GitHub invalido.')
        # URL da API construida localmente, nao aceita comando ou URL do manifesto.
        return 'https://api.github.com/repos/' + self.repo + '/releases/assets/' + str(a['id']), a['size']

    def fetch_manifest(self, release):
        for name in ('update-manifest.json', 'update-manifest.sig'):
            url, size = self.asset(release, name)
            require(size <= 2 * 1024 * 1024, 'Manifesto excede o limite.')
            self.network.download(url, self.job / name, size)
        verify_signature(self.root, self.job / 'update-manifest.json', self.job / 'update-manifest.sig')
        return validate_manifest(load_json(self.job / 'update-manifest.json'), self.repo, release['tag_name'], self.deps)

    def offline_wheels(self, release, manifest):
        spec = manifest.get('offline_dependencies')
        if not spec:
            local = self.root / 'dependencias-offline/wheels'
            # Pacote local e explicitamente escolhido pelo operador na instalacao inicial.
            return local if local.is_dir() and not linked(local) else None
        require(re.fullmatch(r'Painel-HB-Dependencias-[A-Za-z0-9_.-]+\.zip', str(spec.get('name', ''))) is not None,
                'Nome do pacote offline invalido.')
        url, size = self.asset(release, spec['name'])
        require(size == spec.get('size') and size <= MAX_EXPANDED, 'Tamanho do pacote offline divergente.')
        # O downloader aplica limite conservador por artefato.
        target = self.job / 'dependencies.zip'
        self.network.download(url, target, size)
        require(sha256(target) == spec.get('sha256'), 'Pacote de dependencias adulterado.')
        wheelhouse = self.job / 'wheels';wheelhouse.mkdir()
        total = 0
        with zipfile.ZipFile(target) as package:
            for info in package.infolist():
                if not info.filename.startswith('dependencias-offline/wheels/'):
                    continue
                name = info.filename.removeprefix('dependencias-offline/wheels/')
                require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.+-]*\.whl', name) is not None and not stat.S_ISLNK(info.external_attr >> 16), 'Wheel com caminho invalido.')
                total += info.file_size
                require(total <= MAX_EXPANDED and info.file_size < 128 * 1024 * 1024, 'Wheelhouse excede o limite.')
                require(not (wheelhouse / name).exists(), 'Wheel duplicada.')
                with package.open(info) as src, (wheelhouse / name).open('xb') as out:
                    shutil.copyfileobj(src, out)
        require(any(wheelhouse.iterdir()), 'Pacote offline sem wheels.')
        return wheelhouse

    def install(self, confirmed=False, indexeddb_confirmed=False, target_version=None):
        require(confirmed and indexeddb_confirmed, 'Confirme a atualizacao e o backup protegido do navegador antes de instalar.')
        with installation_lock(self.state):
            require(not (self.state / 'transaction.json').exists() or load_json(self.state / 'transaction.json').get('status') in ('committed', 'restored', 'rolled_back'),
                    'Existe uma atualizacao interrompida. Use Restaurar versao anterior antes de continuar.')
            self.progress('Conferindo Release', 5)
            # Nunca instala somente a partir de metadados de cache.
            releases = self.network.json('https://api.github.com/repos/' + self.repo + '/releases?per_page=100')
            release = choose_release(releases)
            if target_version is not None:
                target = version(target_version)
                candidates = []
                for candidate in releases:
                    if not candidate.get('draft') and not candidate.get('prerelease'):
                        try:
                            if version(candidate.get('tag_name')) == target:
                                candidates.append(candidate)
                        except UpdateError:
                            pass
                require(len(candidates) == 1, 'A versao escolhida nao esta mais disponivel. Verifique novamente antes de confirmar.')
                release = candidates[0]
            require(release is not None and version(release['tag_name']) > version(self.installed), 'Nenhuma atualizacao estavel mais recente disponivel.')
            manifest = self.fetch_manifest(release)
            url, size = self.asset(release, manifest['asset']['name'])
            require(size == manifest['asset']['size'], 'Tamanho do artefato diverge do manifesto.')
            required_space = size + sum(r['size'] for r in manifest['files'].values()) * 3 + 64 * 1024 * 1024
            require(shutil.disk_usage(self.root).free > required_space and shutil.disk_usage(self.state).free > required_space,
                    'Espaco insuficiente para pacote, backup e recuperacao.')
            archive = self.job / 'package.zip'
            self.network.download(url, archive, size, lambda p: self.progress('Baixando pacote', 10 + p * 30 // 100))
            self.cancel();self.progress('Verificando pacote e assinatura', 42)
            stage = self.job / 'staging';stage.mkdir()
            extract_package(archive, stage, manifest)
            self.progress('Conferindo dependencias', 48)
            info = runtime_info(self.root / '.venv/Scripts/python.exe')
            _, differences = dependency_changes(manifest['dependencies'], info)
            offline = self.offline_wheels(release, manifest) if differences else None
            environment, changes = prepare_environment(self.root, self.job, manifest['dependencies'], offline)
            self.cancel()
            return self.apply(stage, manifest, environment, changes)

    def apply(self, stage, manifest, environment=None, changes=None):
        new_version = manifest['version']
        data = self.service.locate_data()
        active = self.service.health() is not None
        # Conferir caminhos e permissao antes de parar o servico.
        old_inventory = load_json(self.root / 'release-files.json')
        require(isinstance(old_inventory, list), 'Inventario instalado invalido.')
        targets = sorted(set(old_inventory) | set(manifest['files']))
        for name in targets:
            path = safe_path(self.root, name)
            require(not path.exists() or path.is_file(), 'Um arquivo do programa foi substituido por um diretorio.')
        for essential in ('package.json', 'dashboard.html', 'app.bundle.js', 'service/main.py'):
            require(safe_path(self.root, essential).is_file(), 'Instalacao incompleta; repare os arquivos essenciais antes de atualizar.')
        database = Path(data) / 'pauta-monitoramento.sqlite3'
        snapshot_space = (database.stat().st_size * 2 if database.exists() else 0) + sum(safe_path(self.root, n).stat().st_size for n in targets if safe_path(self.root, n).is_file()) + 64 * 1024 * 1024
        require(shutil.disk_usage(self.state).free > snapshot_space, 'Espaco insuficiente para o backup dos dados e do programa.')
        backup = self.state / 'backups' / (str(int(time.time())) + '-' + uuid.uuid4().hex[:8])
        backup.mkdir(parents=True)
        transaction = {'status': 'preparing', 'from': self.installed, 'to': new_version, 'root_id': install_id(self.root),
                       'backup': str(backup), 'data': str(data), 'schema': self.deps['data_schema'], 'workspace_schema': self.deps['workspace_schema'],
                       'was_running': active, 'records': [], 'environment': bool(environment)}
        # Toda interrupcao posterior encontra um journal fora do diretorio atualizado.
        atomic_json(self.state / 'transaction.json', transaction)
        try:
            self.progress('Parando servico e criando backups', 58, cancellable=False)
            self.service.stop()
            transaction['database_sha256'] = backup_database(data, backup, transaction['schema'])
            for name in targets:
                source = safe_path(self.root, name)
                record = {'path': name, 'existed': source.exists()}
                if record['existed']:
                    dest = backup / 'program' / name;dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, dest)
                    record['sha256'] = sha256(source)
                    require(sha256(dest) == record['sha256'], 'Backup do programa nao confere.')
                transaction['records'].append(record)
            transaction['status'] = 'prepared'
            atomic_json(backup / 'transaction.json', transaction)
            atomic_json(self.state / 'transaction.json', transaction)
            self.recovery_launcher(backup)
            if environment:
                transaction['status'] = 'environment'
                atomic_json(self.state / 'transaction.json', transaction)
                os.replace(self.root / '.venv', backup / 'venv')
                os.replace(environment, self.root / '.venv')
            transaction['status'] = 'applying'
            atomic_json(self.state / 'transaction.json', transaction)
            for index, name in enumerate(targets):
                source, destination = safe_path(stage, name), safe_path(self.root, name)
                self.progress('Instalando arquivos', 65 + index * 15 // len(targets), cancellable=False)
                if name not in manifest['files']:
                    if destination.exists(): destination.unlink()
                    continue
                destination.parent.mkdir(parents=True, exist_ok=True)
                temp = destination.with_name(destination.name + '.update-tmp')
                require(not temp.exists() and not linked(temp), 'Arquivo temporario da instalacao ja existe.')
                shutil.copy2(source, temp)
                os.replace(temp, destination)
            for name, record in manifest['files'].items():
                require(sha256(safe_path(self.root, name)) == record['sha256'], 'Verificacao apos instalacao falhou.')
            self.progress('Validando servico local', 85, cancellable=False)
            self.service.start(new_version, validation=True)
            self.service.stop()
            database = Path(data) / 'pauta-monitoramento.sqlite3'
            if database.exists():
                require_database_contract(database, transaction['schema'], transaction['workspace_schema'])
            if active:
                self.service.start(new_version)
            transaction['status'] = 'committed'
            atomic_json(self.state / 'transaction.json', transaction)
            self.history('installed', new_version)
            return {'version': new_version, 'backup': str(backup), 'dependency_changes': changes or [], 'service_running': active,
                    'message': 'Atualizacao instalada e validada. Recarregue as abas com Ctrl+F5.'}
        except Exception:
            # Antes de prepared nenhum arquivo mudou: basta reativar o servico anterior.
            if transaction['status'] == 'preparing':
                transaction['status'] = 'rolled_back';atomic_json(self.state / 'transaction.json', transaction)
                if active and not self.service.health(): self.service.start(self.installed)
            else:
                try:
                    self.restore(transaction, automatic=True)
                except Exception:
                    transaction['status'] = 'recovery_required'
                    atomic_json(self.state / 'transaction.json', transaction)
                    raise UpdateError('A instalacao falhou e a recuperacao automatica nao terminou. Use Restaurar versao anterior ou RESTAURAR.cmd na pasta do backup; os bancos nao foram revertidos.') from None
            raise

    def recovery_launcher(self, backup):
        # Resgate fora da pasta substituida, independente da nova Central.
        shutil.copy2(Path(__file__), Path(backup) / 'recovery.py')
        recovery_job = self.state / 'jobs' / ('recovery-' + uuid.uuid4().hex)
        atomic_json(Path(backup) / 'recovery-config.json', {'python': sys._base_executable, 'root': str(self.root),
                                                         'state': str(self.state), 'job': str(recovery_job)})
        ps = '''$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$c=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recovery-config.json') -Raw | ConvertFrom-Json
$answer=[Windows.Forms.MessageBox]::Show('Feche as abas do painel e confirme que guardou o backup protegido do navegador. Recuperar somente o codigo anterior? O servico sera interrompido; bancos nao serao revertidos.','Recuperar Painel H.B','YesNo','Warning')
if($answer -ne 'Yes'){exit 0}
& $c.python (Join-Path $PSScriptRoot 'recovery.py') restore --root $c.root --state $c.state --job $c.job --confirmed --indexeddb-confirmed
$p=Join-Path $c.job 'progress.json'
if(Test-Path -LiteralPath $p){$result=Get-Content -LiteralPath $p -Raw | ConvertFrom-Json;$message=if($result.ok){$result.result.message}else{$result.message}}
else{$message='Recuperacao nao confirmada. Preserve o backup e procure suporte.'}
[void][Windows.Forms.MessageBox]::Show($message,'Recuperacao do Painel H.B','OK','Information')
'''
        (Path(backup) / 'recovery.ps1').write_text(ps, encoding='utf-8-sig')
        (Path(backup) / 'RESTAURAR.cmd').write_text('@echo off\r\npowershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -STA -File "%~dp0recovery.ps1"\r\n', encoding='ascii')

    def restore(self, transaction=None, automatic=False):
        if transaction is None:
            with installation_lock(self.state):
                return self.restore(load_json(self.state / 'transaction.json'), automatic=False)
        require(transaction.get('root_id') == install_id(self.root), 'Backup pertence a outra instalacao.')
        require(transaction.get('status') not in ('restored', 'rolled_back'), 'Nao ha substituicao de arquivos para recuperar.')
        if transaction.get('status') == 'preparing':
            # Queda antes do backup completo: ainda nao houve troca de arquivos.
            if transaction.get('was_running') and not self.service.health():
                self.service.start(transaction['from'])
            transaction['status'] = 'rolled_back'
            atomic_json(self.state / 'transaction.json', transaction)
            return {'version': transaction['from'], 'message': 'Preparacao interrompida encerrada; codigo anterior preservado.'}
        backup = Path(transaction['backup']).absolute()
        require(backup.parent == self.state / 'backups' and not linked(backup), 'Backup fora do local autorizado.')
        data = Path(transaction['data']) / 'pauta-monitoramento.sqlite3'
        if data.exists():
            require_database_contract(data, transaction['schema'], transaction.get('workspace_schema', 2))
        for record in transaction['records']:
            safe_path(self.root, record['path'])
            if record['existed']:
                require(sha256(safe_path(backup / 'program', record['path'])) == record['sha256'], 'Backup do programa adulterado ou incompleto.')
        self.progress('Recuperando versao anterior', 90, cancellable=False)
        self.service.stop()
        for record in transaction['records']:
            destination = safe_path(self.root, record['path'])
            if record['existed']:
                destination.parent.mkdir(parents=True, exist_ok=True)
                temp = destination.with_name(destination.name + '.restore-tmp')
                require(not linked(temp), 'Link no caminho de recuperacao.')
                shutil.copy2(backup / 'program' / record['path'], temp)
                os.replace(temp, destination)
            elif destination.exists():
                destination.unlink()
            stale = destination.with_name(destination.name + '.update-tmp')
            if stale.exists() and not linked(stale): stale.unlink()
        if transaction.get('environment') and (backup / 'venv').exists():
            current = self.root / '.venv'
            if current.exists(): os.replace(current, self.root / ('.venv-failed-' + uuid.uuid4().hex[:8]))
            os.replace(backup / 'venv', current)
        # Restaura somente codigo/ambiente; nunca recua o banco ou IndexedDB.
        if transaction['was_running']:
            self.service.start(transaction['from'])
        transaction['status'] = 'rolled_back' if automatic else 'restored'
        atomic_json(self.state / 'transaction.json', transaction)
        self.history(transaction['status'], transaction['from'])
        return {'version': transaction['from'], 'backup': str(backup), 'message': 'Codigo anterior recuperado. Dados atuais preservados.'}

    def history(self, action, version_value):
        path = self.state / 'history.json'
        history = load_json(path) if path.exists() else []
        history.append({'time': int(time.time()), 'action': action, 'version': version_value})
        atomic_json(path, history[-50:])


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['check', 'history', 'install', 'restore'])
    parser.add_argument('--root', required=True)
    parser.add_argument('--state')
    parser.add_argument('--job', required=True)
    parser.add_argument('--repository')
    parser.add_argument('--manual', action='store_true')
    parser.add_argument('--confirmed', action='store_true')
    parser.add_argument('--indexeddb-confirmed', action='store_true')
    parser.add_argument('--target-version')
    args = parser.parse_args(argv)
    updater = Updater(args.root, args.state, args.job)
    try:
        if args.repository:
            updater.repo = repository(args.repository)
            updater.network = Network(updater.repo, updater.cancel)
            atomic_json(updater.state / 'repository.json', {'repository': updater.repo})
        if args.action in ('check', 'history'):
            result = updater.check(args.manual)
        elif args.action == 'install':
            require(args.target_version is not None, 'Escolha e confira uma versao na Central antes de instalar.')
            result = updater.install(args.confirmed, args.indexeddb_confirmed, args.target_version)
        else:
            require(args.confirmed and args.indexeddb_confirmed, 'Confirme a recuperacao e o backup do navegador.')
            result = updater.restore()
        updater.finish(ok=True, result=result, stage='Concluido')
        return 0
    except UpdateError as error:
        updater.finish(ok=False, stage='Operacao nao concluida', message=str(error))
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError, sqlite3.Error):
        updater.finish(ok=False, stage='Operacao nao concluida', message='Falha local de arquivo, permissao, ambiente ou pacote. Confira a recuperacao antes de tentar novamente.')
    # Sem traceback, URLs, tokens, nomes processuais ou conteudo de bancos no log.
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
