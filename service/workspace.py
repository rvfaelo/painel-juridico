"""Carteira local autoritativa, revisão otimista e backups antes de gravações."""
import base64
from contextlib import closing
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import uuid
from datetime import datetime, timezone

from .connectors import now_utc

TABLES = ('clients','cases','tasks','appointments','fees','events','jobs','payments','documents','coverageSamples')


def validate_attachment(data, mime):
    if not data or len(data) > 5 * 1024 * 1024:
        raise ValueError("Cada anexo deve ter de 1 byte a 5 MB.")
    signatures = {"application/pdf": b"%PDF-", "image/png": b"\x89PNG\r\n\x1a\n", "image/jpeg": b"\xff\xd8\xff"}
    if mime == "text/plain":
        try: data.decode("utf-8")
        except UnicodeError: raise ValueError("Texto deve estar em UTF-8.") from None
        if b"\x00" in data:
            raise ValueError("Arquivo de texto contem conteudo binario.")
        return
    if mime == "image/webp" and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return
    if mime not in signatures or not data.startswith(signatures[mime]):
        raise ValueError("Formato do anexo invalido.")


class WorkspaceConflict(ValueError):
    pass


class Workspace:
    def __init__(self, store):
        self.store = store
        with store.connection() as db:
            db.executescript('''CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS workspace_files(id TEXT PRIMARY KEY, data BLOB NOT NULL);''')

    def read(self, files=False):
        with self.store.lock, self.store.connection() as db:
            row = db.execute('SELECT payload FROM workspace WHERE id=1').fetchone()
            result = {'initialized': bool(row), 'state': json.loads(row[0]) if row else None}
            if files:
                result['attachments'] = [{'id': r[0], 'data': base64.b64encode(r[1]).decode('ascii')}
                                         for r in db.execute('SELECT id,data FROM workspace_files')]
            return result

    def validate(self, state, command=None):
        if not isinstance(state, dict) or type(state.get('revision')) is not int or state['revision'] < 0:
            raise ValueError('Revisão da carteira inválida.')
        for table in TABLES:
            if not isinstance(state.get(table), list):
                raise ValueError('Estrutura inválida: ' + table)
        node = shutil.which('node')
        if not node:
            raise ValueError('Node.js necessário para validar os cadastros. Instale Node.js e reinicie o serviço.')
        proc = subprocess.run([node, str(Path(__file__).resolve().parent.parent / 'tools/workspace-command.mjs')],
                              input=json.dumps({'state': state, 'command': command}),
                              capture_output=True, text=True, encoding='utf-8', timeout=30,
                              creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        try:
            result = json.loads(proc.stdout)
        except ValueError:
            raise ValueError('Falha no validador de cadastros. Nenhum dado foi alterado.') from None
        if proc.returncode or result.get('error'):
            raise ValueError(result.get('error', 'Cadastro inválido.'))
        return result

    def backup(self):
        directory = self.store.directory / 'backups'
        directory.mkdir(exist_ok=True)
        name = 'carteira-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-' + uuid.uuid4().hex[:8] + '.sqlite3'
        with self.store.connection() as source, closing(sqlite3.connect(directory / name)) as target:
            source.backup(target)
            target.commit()
        return name

    def write(self, body, migrate=False, command=False):
        # O lock também protege o índice de monitoramento contra abas antigas.
        with self.store.lock:
            current = self.read()
            if migrate and current['initialized']:
                return {**current, 'migrated': False}
            if not migrate and not current['initialized']:
                raise WorkspaceConflict('Abra o painel original para migrar os cadastros antes de editar.')
            expected = body.get('expectedRevision')
            if not migrate and (type(expected) is not int or expected != current['state']['revision']):
                raise WorkspaceConflict('A carteira mudou. Releia os dados antes de salvar; nenhuma alteração foi aplicada.')
            state = body.get('state') if not command else current['state']
            checked = self.validate(state, body.get('command') if command else None)
            state = checked['state']
            # Uma origem vazia/antiga não pode substituir a carteira monitorada.
            if migrate:
                with self.store.connection() as db:
                    known = {r[0] for r in db.execute('SELECT id FROM cases WHERE active=1')}
                if not known.issubset({c['id'] for c in state['cases']}):
                    raise WorkspaceConflict('Esta origem não contém a carteira monitorada. Recarregue o painel no navegador onde estão seus cadastros.')
            state['revision'] = (current['state']['revision'] if current['initialized'] else state['revision']) + 1
            incoming = body.get('attachments', [])
            if not isinstance(incoming, list):
                raise ValueError('Anexos inválidos.')
            files = {} if migrate or body.get('replaceAttachments') is True else {
                r['id']: base64.b64decode(r['data']) for r in self.read(files=True)['attachments']}
            seen = set()
            for item in incoming:
                if not isinstance(item, dict) or not isinstance(item.get('id'), str) or item['id'] in seen:
                    raise ValueError('Anexo inválido ou duplicado.')
                seen.add(item['id'])
                try:
                    files[item['id']] = base64.b64decode(item['data'], validate=True)
                except (ValueError, KeyError, TypeError):
                    raise ValueError('Conteúdo do anexo inválido.') from None
            if sum(d['size'] for d in state['documents']) > 25*1024*1024:
                raise ValueError('Anexos excedem 25 MB.')
            for d in state['documents']:
                data = files.get(d['id'])
                if data is None or len(data) != d['size'] or hashlib.sha256(data).hexdigest() != d['sha256']:
                    raise ValueError('Anexo ausente ou corrompido: ' + d['name'])
                validate_attachment(data, d['mime'])
            # Todos os dados já foram validados; backup e commit sob o mesmo lock.
            name = self.backup()
            migration_backup = ''
            if migrate:
                migration_backup = 'migracao-' + uuid.uuid4().hex + '.json'
                with (self.store.directory / 'backups' / migration_backup).open('x', encoding='utf-8') as output:
                    json.dump({'format':'pauta-backup','version':2,'state':body['state'],
                               'attachments':incoming}, output, ensure_ascii=False)
            with self.store.connection() as db:
                db.execute('INSERT OR REPLACE INTO workspace(id,payload) VALUES(1,?)',
                           (json.dumps(state, ensure_ascii=False),))
                db.execute('DELETE FROM workspace_files')
                db.executemany('INSERT INTO workspace_files(id,data) VALUES(?,?)',
                               [(d['id'], files[d['id']]) for d in state['documents']])
                self.store.sync_cases(state['cases'], allow_empty=True, connection=db)
                settings = state['settings']
                saved = json.loads(db.execute("SELECT v FROM meta WHERE k='settings'").fetchone()[0])
                saved['enabled'].update(datajud=settings['datajud'], djen=settings['djen'])
                saved.update(djenDays=settings['djenDays'], datajudKey=settings.get('datajudKey',''),
                             oab=settings.get('oab',''), ufOab=settings.get('ufOab',''),
                             autoEnabled=settings.get('autoUpdateEnabled',False),
                             autoTimes=settings.get('autoUpdateTimes','08:00,18:00').split(','))
                db.execute("UPDATE meta SET v=? WHERE k='settings'", (json.dumps(saved),))
                for source, enabled in saved['enabled'].items():
                    if not enabled:
                        db.execute("UPDATE jobs SET status='cancelled',message='Fonte desativada',updated_at=? WHERE source=? AND status IN ('queued','running')", (now_utc(),source))
            return {'initialized': True, 'state': state, 'backup': name, 'migrationBackup': migration_backup,
                    'migrated': migrate, 'result': checked['result']}
