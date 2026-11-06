"""Dados fictícios, banco temporário; sem consultas externas ou alterações reais."""
import base64
from contextlib import closing
import copy
import hashlib
import http.client
import json
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path

from service.main import Server
from service.store import Store
from service.workspace import Workspace, WorkspaceConflict


def empty():
    return dict(schemaVersion=2, revision=0, **{name:[] for name in (
        'clients','cases','tasks','appointments','fees','events','jobs','payments','documents','coverageSamples')},
        settings={'datajud':False,'djen':True,'djenDays':30,'datajudKey':'', 'oab':'','ufOab':'',
                  'autoUpdateEnabled':False,'autoUpdateTimes':'08:00,18:00'})


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)
        self.ws = Workspace(self.store)

    def tearDown(self):
        self.temp.cleanup()

    def migrate(self, state=None, attachments=None):
        return self.ws.write({'state':state or empty(),'attachments':attachments or []}, migrate=True)

    def command(self, command, revision=None):
        revision = self.ws.read()['state']['revision'] if revision is None else revision
        return self.ws.write({'command':command,'expectedRevision':revision},command=True)

    def test_crud_backup_revision_and_restart(self):
        first=self.migrate()
        self.assertTrue((Path(self.temp.name)/'backups'/first['migrationBackup']).is_file())
        created=self.command({'action':'create','fields':{'title':'Caso fictício','notes':'original'}})
        cid=created['result']['id']
        edited=self.command({'action':'edit','id':cid,'fields':{'notes':'editado'}})
        self.assertEqual(edited['result']['title'],'Caso fictício')
        with closing(sqlite3.connect(Path(self.temp.name)/'backups'/edited['backup'])) as db:
            before=json.loads(db.execute('SELECT payload FROM workspace').fetchone()[0])
        self.assertEqual(before['cases'][0]['notes'],'original')
        with self.assertRaises(WorkspaceConflict):
            self.command({'action':'edit','id':cid,'fields':{'title':'stale'}},created['state']['revision'])
        self.assertEqual(Workspace(Store(self.temp.name)).read()['state']['cases'][0]['notes'],'editado')
        self.command({'action':'archive','id':cid})
        with self.store.connection() as db:
            self.assertEqual(db.execute('SELECT active FROM cases WHERE id=?',(cid,)).fetchone()[0],0)
        self.command({'action':'unarchive','id':cid})
        self.command({'action':'delete','id':cid})
        self.assertEqual(self.ws.read()['state']['cases'],[])

    def test_invalid_edit_and_unknown_id_do_not_write(self):
        self.migrate()
        before=self.ws.read()
        for command in ({'action':'edit','id':'missing','fields':{'title':'x'}},
                        {'action':'create','fields':{'title':'x','cnj':'123'}},
                        {'action':'create','fields':{'title':''}}):
            with self.assertRaises(ValueError):self.command(command)
        self.assertEqual(self.ws.read(),before)

    def test_empty_wrong_origin_and_old_sync_cannot_erase(self):
        self.store.sync_cases([{'id':'original','cnj':''}])
        with self.assertRaises(WorkspaceConflict):self.migrate()
        state=empty();state['cases']=[{'id':'original','title':'Original','stage':'todo','cnj':''}]
        self.migrate(state)
        skipped=self.store.sync_cases([],allow_empty=True)
        self.assertTrue(skipped['skipped'])
        self.assertEqual(len(self.ws.read()['state']['cases']),1)
        self.assertFalse(self.migrate()['migrated'])

    def test_attachments_roundtrip_and_corruption_rollback(self):
        state=empty();state['cases']=[{'id':'c1','title':'Anexo fictício','stage':'todo','cnj':''}]
        data=b'arquivo de teste'
        state['documents']=[{'id':'d1','caseId':'c1','name':'arquivo.txt','mime':'text/plain',
                             'size':len(data),'sha256':hashlib.sha256(data).hexdigest()}]
        self.migrate(state,[{'id':'d1','data':base64.b64encode(data).decode()}])
        exported=self.ws.read(files=True)
        self.assertEqual(base64.b64decode(exported['attachments'][0]['data']),data)
        with self.assertRaises(ValueError):
            self.ws.write({'state':exported['state'],'expectedRevision':exported['state']['revision'],
                           'attachments':[{'id':'d1','data':'YQ=='}]})
        self.assertEqual(self.ws.read(files=True),exported)
        with self.assertRaises(ValueError):self.command({'action':'delete','id':'c1'})
        state=copy.deepcopy(exported['state']);state['documents']=[]
        self.ws.write({'state':state,'expectedRevision':state['revision']})
        self.assertEqual(self.ws.read(files=True)['attachments'],[])

    def test_concurrent_edits_only_one_wins(self):
        self.migrate();revision=self.ws.read()['state']['revision'];results=[]
        def edit(title):
            try:
                self.command({'action':'create','fields':{'title':title}},revision);results.append('saved')
            except WorkspaceConflict:results.append('conflict')
        threads=[threading.Thread(target=edit,args=(title,)) for title in ('A','B')]
        for thread in threads:thread.start()
        for thread in threads:thread.join()
        self.assertCountEqual(results,['saved','conflict'])


class WorkspaceHTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.server=Server(0,Store(self.temp.name))
        self.port=self.server.server_address[1]
        self.server.origin=f'http://127.0.0.1:{self.port}'
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()

    def tearDown(self):
        self.server.shutdown();self.thread.join();self.server.server_close();self.temp.cleanup()

    def req(self,path,body=None,token=True,origin=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.port)
        headers={'Content-Type':'application/json'}
        if token:headers['X-Pauta-CSRF']=self.server.csrf
        if origin:headers['Origin']=origin
        conn.request('GET' if body is None else 'POST','/api/v1/'+path,
                     body=None if body is None else json.dumps(body),headers=headers)
        response=conn.getresponse();value=json.loads(response.read());conn.close();return response.status,value

    def test_security_and_api_contract(self):
        self.assertEqual(self.req('workspace',token=False)[0],403)
        self.assertEqual(self.req('workspace',origin='https://evil.test')[0],403)
        self.assertEqual(self.req('workspace/migrate',{'state':empty()},token=False)[0],403)
        code,first=self.req('workspace/migrate',{'state':empty()});self.assertEqual(code,200)
        code,created=self.req('cases/command',{'expectedRevision':first['state']['revision'],
             'command':{'action':'create','fields':{'title':'Teste fictício API'}}})
        self.assertEqual(code,200)
        self.assertEqual(len(self.req('cases')[1]['cases']),1)
        self.assertEqual(self.req('cases/command',{'expectedRevision':0,
            'command':{'action':'delete','id':created['result']['id']}})[0],409)
        self.assertEqual(self.req('cases/command',{'expectedRevision':created['state']['revision'],
            'command':{'action':'edit','id':created['result']['id'],'fields':{'cnj':'invalido123'}}})[0],400)


if __name__=='__main__':unittest.main()
