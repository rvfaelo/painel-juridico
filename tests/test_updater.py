"""Atualizações: somente dados fictícios, rede simulada e pastas temporárias."""
import copy
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from updates import updater as u

ROOT = Path(__file__).resolve().parent.parent
DEPS = json.loads((ROOT / 'update-dependencies.json').read_text())


@contextlib.contextmanager
def db_connection(path):
    db=sqlite3.connect(path)
    try:
        with db:
            yield db
    finally:
        db.close()


class FakeService:
    def __init__(self, data):
        self.data = data
        self.online = True
        self.fail_version = ''
        self.calls = []

    def locate_data(self): return self.data
    def health(self): return {'status': 'ok'} if self.online else None
    def stop(self): self.calls.append('stop');self.online = False
    def start(self, value, validation=False):
        self.calls.append(('start', value, validation))
        if value == self.fail_version:
            raise u.UpdateError('Falha simulada de reinicio.')
        self.online = True


class FakeNetwork:
    def __init__(self, release, blobs): self.release = release;self.blobs = blobs
    def json(self, url): return [self.release]
    def download(self, url, target, expected_size, progress=lambda p: None):
        blob = self.blobs[int(url.rsplit('/', 1)[1])]
        if isinstance(blob, Exception): raise blob
        Path(target).write_bytes(blob)
        u.require(len(blob) == expected_size, 'Download interrompido.')
        progress(100)


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='HB atualizacao espacos ')
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = self.base / 'Painel H.B com espacos';self.root.mkdir()
        self.state = self.base / 'estado';self.data = self.base / 'dados juridicos';self.data.mkdir()
        self.stage = self.base / 'stage';self.stage.mkdir()
        self.contents = {
            'package.json': json.dumps({'version': '1.1.0'}).encode(),
            'dashboard.html': b'<html>Painel ficticio</html>',
            'app.bundle.js': b'// novo codigo ficticio',
            'service/main.py': b'# servico ficticio',
            'update-dependencies.json': json.dumps(DEPS).encode(),
            'release-files.json': b'[]',
        }
        self.contents['release-files.json'] = json.dumps(list(self.contents)).encode()
        for name, raw in self.contents.items():
            for target in (self.root, self.stage):
                path=target/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
        (self.root/'package.json').write_text('{"version":"1.0.0"}')
        (self.root/'app.bundle.js').write_bytes(b'// codigo anterior')
        (self.root/'update-config.json').write_text('{"repository":"rvfaelo/painel-juridico"}')
        (self.root/'anotacoes-pessoais.txt').write_text('nao substituir')
        (self.root/'perfil-indexeddb-simulado').mkdir()
        (self.root/'perfil-indexeddb-simulado'/'dados').write_bytes(b'indexeddb ficticio preservado')
        self.database = self.data/'pauta-monitoramento.sqlite3'
        with db_connection(self.database) as db:
            db.execute('CREATE TABLE meta(k TEXT PRIMARY KEY,v TEXT)')
            db.execute("INSERT INTO meta VALUES('schema','3')")
            db.execute('CREATE TABLE juridico(id INTEGER,anexo BLOB)')
            db.execute('INSERT INTO juridico VALUES(1,?)', (b'anexo-ficticio',))
        self.service = FakeService(self.data)
        self.up = u.Updater(self.root,self.state,service=self.service)
        self.manifest = {'protocol':1,'repository':'rvfaelo/painel-juridico','version':'1.1.0','platform':'windows-x64',
                         'dependencies':DEPS,'files':{n:{'size':len(v),'sha256':hashlib.sha256(v).hexdigest()} for n,v in self.contents.items()}}
        self.archive = self.base/'package.zip'
        self.make_zip()

    def make_zip(self, extra=None):
        with zipfile.ZipFile(self.archive,'w') as z:
            for name, raw in self.contents.items():z.writestr('Painel-HB/'+name,raw)
            if extra:z.writestr(extra,b'malicioso')
        self.manifest['asset']={'name':'Painel-HB-v1.1.0-Windows.zip','size':self.archive.stat().st_size,'sha256':u.sha256(self.archive)}

    def fake_network(self):
        raw=json.dumps(self.manifest).encode()
        blobs={1:raw,2:b'assinatura simulada',3:self.archive.read_bytes()}
        release={'tag_name':'v1.1.0','draft':False,'prerelease':False,'body':'Mudancas ficticias','published_at':'2026-11-06',
                 'assets':[{'id':i,'name':n,'size':len(blobs[i]),'state':'uploaded'} for i,n in
                           [(1,'update-manifest.json'),(2,'update-manifest.sig'),(3,self.manifest['asset']['name'])]]}
        return FakeNetwork(release,blobs)

    def install_fake(self):
        self.up.network=self.fake_network()
        info={'python':[3,12],'bits':64,'packages':{k:v for k,v in DEPS['packages'].items()}}
        with patch.object(u,'verify_signature'),patch.object(u,'runtime_info',return_value=info),patch.object(u,'prepare_environment',return_value=(None,[])):
            return self.up.install(confirmed=True,indexeddb_confirmed=True)

    def assert_data(self):
        with db_connection(self.database) as db:
            self.assertEqual(db.execute('SELECT * FROM juridico').fetchall(),[(1,b'anexo-ficticio')])
        self.assertEqual((self.root/'perfil-indexeddb-simulado/dados').read_bytes(),b'indexeddb ficticio preservado')
        self.assertEqual((self.root/'anotacoes-pessoais.txt').read_text(),'nao substituir')

    def test_semver_stable_channel_and_highest_stable(self):
        self.assertGreater(u.version('v0.5.11'),u.version('0.5.9'))
        self.assertEqual(u.version('1.0.0+abc'),(1,0,0))
        for invalid in ('v01.2.3','1.2','1.2.3-rc.1','1.2.3;cmd'):
            with self.assertRaises(u.UpdateError):u.version(invalid)
        releases=[{'tag_name':'v2.0.0','prerelease':True},{'tag_name':'v1.9.0'},{'tag_name':'v1.10.0'}, {'tag_name':'v8.0.0','draft':True}]
        self.assertEqual(u.choose_release(releases)['tag_name'],'v1.10.0')

    def test_no_release_and_no_update_available(self):
        network=self.fake_network();network.json=lambda url:[];self.up.network=network
        self.assertFalse(self.up.check()['available'])
        (self.state/'last-check.json').unlink()
        (self.state/'last-attempt.json').unlink()
        network.json=lambda url:[{'tag_name':'v1.0.0'}]
        self.assertFalse(self.up.check()['available'])

    def test_new_release_cache_and_dependencies_verified(self):
        self.up.network=self.fake_network()
        with patch.object(u,'verify_signature') as signature:
            result=self.up.check()
            self.assertTrue(result['available']);signature.assert_called_once()
        self.up.network.json=lambda url:(_ for _ in ()).throw(AssertionError('cache deveria evitar rede'))
        self.assertTrue(self.up.check()['cached'])

    def test_offline_github_error_does_not_change_program(self):
        self.up.network=self.fake_network()
        self.up.network.json=lambda url:(_ for _ in ()).throw(u.UpdateError('Sem conexao'))
        with self.assertRaisesRegex(u.UpdateError,'Sem conexao'):self.up.check()
        self.assertEqual((self.root/'app.bundle.js').read_bytes(),b'// codigo anterior');self.assert_data()

    def test_signature_failure_happens_before_program_or_service_changes(self):
        self.up.network=self.fake_network()
        with patch.object(u,'verify_signature',side_effect=u.UpdateError('Assinatura invalida')):
            with self.assertRaisesRegex(u.UpdateError,'Assinatura'):self.up.install(True,True)
        self.assertEqual(self.service.calls,[]);self.assert_data()

    def test_confirmation_and_indexeddb_backup_required(self):
        for args in ((False,True),(True,False),(False,False)):
            with self.assertRaises(u.UpdateError):self.up.install(*args)
        self.assertEqual(self.service.calls,[])

    def test_install_never_substitutes_a_different_release_for_the_selected_version(self):
        network=self.fake_network();self.up.network=network
        original=network.release
        newer={**original,'tag_name':'v1.2.0'}
        network.json=lambda url:[newer,original]
        info={'python':[3,12],'bits':64,'packages':dict(DEPS['packages'])}
        with patch.object(u,'verify_signature'),patch.object(u,'runtime_info',return_value=info),patch.object(u,'prepare_environment',return_value=(None,[])):
            result=self.up.install(True,True,target_version='v1.1.0')
        self.assertEqual(result['version'],'1.1.0')

    def test_complete_install_restore_and_data_preservation_in_path_with_spaces(self):
        result=self.install_fake()
        self.assertEqual(result['version'],'1.1.0')
        self.assertEqual((self.root/'app.bundle.js').read_bytes(),self.contents['app.bundle.js'])
        self.assertIn(('start','1.1.0',True),self.service.calls)
        self.assert_data()
        backup=Path(result['backup'])
        self.assertEqual(u.database_schema(backup/'sqlite/pauta-monitoramento.sqlite3'),3)
        restored=self.up.restore();self.assertEqual(restored['version'],'1.0.0')
        self.assertEqual((self.root/'app.bundle.js').read_bytes(),b'// codigo anterior');self.assert_data()

    def test_service_stopped_is_not_left_running_after_health_validation(self):
        self.service.online=False
        result=self.install_fake()
        self.assertFalse(result['service_running']);self.assertFalse(self.service.online)

    def test_health_restart_failure_recovers_previous_code(self):
        self.service.fail_version='1.1.0'
        with self.assertRaisesRegex(u.UpdateError,'Falha simulada'):self.install_fake()
        self.assertEqual((self.root/'app.bundle.js').read_bytes(),b'// codigo anterior')
        self.assertEqual(u.load_json(self.state/'transaction.json')['status'],'rolled_back')
        self.assertTrue(self.service.online);self.assert_data()

    def test_permission_failure_during_replace_recovers_previous_files(self):
        original=u.os.replace;failed=False
        def replace(source,dest):
            nonlocal failed
            if Path(dest)==self.root/'dashboard.html' and not failed:
                failed=True;raise PermissionError('falha ficticia')
            return original(source,dest)
        with patch.object(u.os,'replace',side_effect=replace):
            with self.assertRaises(PermissionError):self.install_fake()
        self.assertEqual((self.root/'app.bundle.js').read_bytes(),b'// codigo anterior');self.assert_data()

    def test_download_interrupted_leaves_service_and_program_intact(self):
        network=self.fake_network();network.blobs[3]=u.UpdateError('Download interrompido');self.up.network=network
        with patch.object(u,'verify_signature'):
            with self.assertRaisesRegex(u.UpdateError,'interrompido'):self.up.install(True,True)
        self.assertEqual(self.service.calls,[]);self.assert_data()

    def test_checksum_invalid_and_malformed_zip(self):
        self.archive.write_bytes(b'tampered')
        with self.assertRaisesRegex(u.UpdateError,'Checksum'):u.extract_package(self.archive,self.base/'bad',self.manifest)
        self.manifest['asset'].update(size=self.archive.stat().st_size,sha256=u.sha256(self.archive))
        with self.assertRaisesRegex(u.UpdateError,'malformado'):u.extract_package(self.archive,self.base/'bad',self.manifest)

    def test_zip_slip_extra_file_duplicate_and_hash_tampering_rejected(self):
        self.make_zip('Painel-HB/../data/evil.txt')
        with self.assertRaises(u.UpdateError):u.extract_package(self.archive,self.base/'bad',self.manifest)
        self.contents['app.bundle.js']=b'adulterado'
        self.make_zip()
        with self.assertRaises(u.UpdateError):u.extract_package(self.archive,self.base/'bad2',self.manifest)

    def test_package_paths_do_not_accept_data_ads_devices_links_or_case_collision(self):
        for name in ('../p.txt','/p.txt','data/a.json','.venv/a.py','file.txt:stream','service\\main.py','NUL.txt','service/../a.py','backups/a.json','service/a.py.'):
            with self.assertRaises(u.UpdateError,msg=name):u.safe_path(self.root,name)
        manifest=copy.deepcopy(self.manifest);manifest['files']['APP.BUNDLE.JS']=manifest['files']['app.bundle.js']
        with self.assertRaisesRegex(u.UpdateError,'Colisao'):u.validate_manifest(manifest,self.up.repo,'v1.1.0',DEPS)

    def test_schema_origin_and_platform_mismatch_rejected_before_service_stop(self):
        for field,value in [('data_schema',4),('workspace_schema',3),('origin','http://localhost:9999')]:
            manifest=copy.deepcopy(self.manifest);manifest['dependencies'][field]=value
            with self.assertRaises(u.UpdateError):u.validate_manifest(manifest,self.up.repo,'v1.1.0',DEPS)
        manifest=copy.deepcopy(self.manifest);manifest['platform']='linux'
        with self.assertRaises(u.UpdateError):u.validate_manifest(manifest,self.up.repo,'v1.1.0',DEPS)
        self.assertEqual(self.service.calls,[])

    def test_restore_does_not_revert_new_database_schema(self):
        self.install_fake()
        with db_connection(self.database) as db:db.execute("UPDATE meta SET v='4' WHERE k='schema'")
        with self.assertRaisesRegex(u.UpdateError,'outro esquema'):self.up.restore()
        self.assertEqual((self.root/'app.bundle.js').read_bytes(),self.contents['app.bundle.js'])

    def test_cancel_and_install_lock(self):
        (self.up.job/'cancel').touch()
        with self.assertRaisesRegex(u.UpdateError,'cancelada'):self.up.cancel()
        with u.installation_lock(self.state):
            with self.assertRaisesRegex(u.UpdateError,'andamento'):
                with u.installation_lock(self.state):pass

    def test_dependency_delta_preserves_optional_connector(self):
        deps=copy.deepcopy(DEPS)
        info={'python':[3,12],'bits':64,'packages':{'tzdata':'old','mcp-juridico-brasil':'0.1.0','juscraper':'old'}}
        required,changed=u.dependency_changes(deps,info)
        self.assertEqual(set(changed),{'tzdata','juscraper'});self.assertIn('juscraper',required)
        info['python']=[3,10]
        self.assertIn('Python x64 compativel',u.dependency_changes(deps,info)[1])

    def test_failed_checks_also_respect_automatic_minimum_interval(self):
        network=self.fake_network();self.up.network=network
        with patch.object(network,'json',side_effect=u.UpdateError('Sem conexao')) as request:
            with self.assertRaisesRegex(u.UpdateError,'Sem conexao'):self.up.check()
            with self.assertRaisesRegex(u.UpdateError,'intervalo minimo'):self.up.check()
            self.assertEqual(request.call_count,1)

    def test_workspace_schema_cannot_be_reverted_silently(self):
        self.install_fake()
        with db_connection(self.database) as db:
            db.execute('CREATE TABLE workspace(id INTEGER PRIMARY KEY,payload TEXT)')
            db.execute('INSERT INTO workspace VALUES(1,?)',(json.dumps({'schema':3}),))
        with self.assertRaisesRegex(u.UpdateError,'Carteira evoluiu'):self.up.restore()

    def test_unsafe_network_targets_and_no_plain_http(self):
        network=u.Network('rvfaelo/painel-juridico')
        for url in ('http://github.com/rvfaelo/painel-juridico/releases/download/v1/a.zip','https://evil.test/a.zip','https://api.github.com/repos/outro/projeto/a','https://github.com/rvfaelo/painel-juridico/blob/main/a.zip','https://user:password@github.com/rvfaelo/painel-juridico/releases/download/v1/a.zip'):
            with self.assertRaises(u.UpdateError):network.allowed(url)
        self.assertEqual(network.allowed('https://release-assets.githubusercontent.com/asset'),'release-assets.githubusercontent.com')

    def test_streaming_download_detects_truncation_and_oversize(self):
        network=u.Network('rvfaelo/painel-juridico')
        for content in (b'abc',b'abcdefgh'):
            with patch.object(network,'open',return_value=io.BytesIO(content)):
                with self.assertRaises(u.UpdateError):network.download('https://github.com/x',self.base/'download',5)

    def test_other_service_is_not_stopped(self):
        service=u.LocalService(self.root)
        with patch.object(service,'request',return_value={'product':'other','installationId':'other'}):
            with self.assertRaisesRegex(u.UpdateError,'outra instalacao'):service.stop()

    def test_consistent_sqlite_backup_with_wal(self):
        with db_connection(self.database) as db:
            db.execute('PRAGMA journal_mode=WAL');db.execute('INSERT INTO juridico VALUES(2,?)',(b'wal',));db.commit()
            target=self.base/'backup';target.mkdir()
            u.backup_database(self.data,target,3)
            with db_connection(target/'sqlite/pauta-monitoramento.sqlite3') as copydb:
                self.assertEqual(copydb.execute('SELECT COUNT(*) FROM juridico').fetchone()[0],2)

    def test_interrupted_preparation_can_be_closed_without_touching_files(self):
        transaction={'status':'preparing','from':'1.0.0','root_id':u.install_id(self.root),'was_running':True}
        self.service.online=False
        result=self.up.restore(transaction)
        self.assertEqual(result['version'],'1.0.0');self.assertTrue(self.service.online)
        self.assertEqual((self.root/'app.bundle.js').read_bytes(),b'// codigo anterior')

    def test_restore_refuses_modified_backup(self):
        result=self.install_fake()
        (Path(result['backup'])/'program/app.bundle.js').write_bytes(b'backup adulterado')
        with self.assertRaisesRegex(u.UpdateError,'Backup'):self.up.restore()

    def test_dependency_install_failure_never_changes_active_environment(self):
        python=self.root/'.venv/Scripts/python.exe';python.parent.mkdir(parents=True);python.touch()
        info={'python':[3,12],'bits':64,'packages':{'tzdata':'old','mcp-juridico-brasil':'0.1.0'}}
        with patch.object(u,'runtime_info',return_value=info),patch.object(u,'run_local',side_effect=[b'v24.0.0',b'',u.UpdateError('Falha simulada pip')]):
            with self.assertRaisesRegex(u.UpdateError,'pip'):u.prepare_environment(self.root,self.up.job,DEPS)
        self.assertTrue(python.exists());self.assert_data()

    @unittest.skipUnless(os.name=='nt','Venv Windows x64 com wheels fictícias locais.')
    def test_clean_offline_venv_and_isolated_dependency_upgrade(self):
        runtime=self.base/'instalacao offline ficticia';runtime.mkdir()
        wheels=self.base/'wheels';wheels.mkdir()
        for number in ('1.0','2.0'):
            dist='hb_update_fixture-'+number+'.dist-info'
            with zipfile.ZipFile(wheels/('hb_update_fixture-'+number+'-py3-none-any.whl'),'w') as wheel:
                wheel.writestr(dist+'/METADATA','Metadata-Version: 2.1\nName: hb-update-fixture\nVersion: '+number+'\n')
                wheel.writestr(dist+'/WHEEL','Wheel-Version: 1.0\nGenerator: fixture\nRoot-Is-Purelib: true\nTag: py3-none-any\n')
                wheel.writestr(dist+'/RECORD','')
        u.run_local([sys._base_executable,'-m','venv',runtime/'.venv'],120)
        python=runtime/'.venv/Scripts/python.exe'
        u.run_local([python,'-m','pip','install','--no-index','--find-links',wheels,'hb-update-fixture==1.0'],60)
        deps=copy.deepcopy(DEPS);deps['packages']={'hb-update-fixture':'2.0'};deps['optional_packages']={};deps['node_min_major']=1
        prepared,changes=u.prepare_environment(runtime,self.up.job,deps,wheels)
        self.assertEqual(changes,['hb-update-fixture'])
        self.assertEqual(u.runtime_info(python)['packages']['hb-update-fixture'],'1.0')
        self.assertEqual(u.runtime_info(prepared/'Scripts/python.exe')['packages']['hb-update-fixture'],'2.0')

    def test_dependency_environment_is_restored_when_service_fails(self):
        current=self.root/'.venv';current.mkdir();(current/'marker').write_text('old')
        prepared=self.root/'.venv-update-test';prepared.mkdir();(prepared/'marker').write_text('new')
        self.service.fail_version='1.1.0'
        with self.assertRaises(u.UpdateError):self.up.apply(self.stage,self.manifest,prepared,['fixture'])
        self.assertEqual((self.root/'.venv/marker').read_text(),'old');self.assert_data()

    @unittest.skipUnless(os.name=='nt','Verificação RSA utiliza a API criptográfica do Windows.')
    def test_real_rsa_signature_then_modified_manifest_is_rejected(self):
        verification=self.root/'updates/verify-signature.ps1';verification.parent.mkdir(exist_ok=True)
        shutil.copy2(ROOT/'updates/verify-signature.ps1',verification)
        manifest=self.base/'manifest.json';manifest.write_text('{"test":"ficticio"}')
        signature=self.base/'signature.json';trust=self.root/'update-trust.json'
        script=self.base/'test-sign.ps1'
        script.write_text('''param($M,$S,$T)
$ErrorActionPreference='Stop'
$r=New-Object Security.Cryptography.RSACryptoServiceProvider -ArgumentList 3072
$r.PersistKeyInCsp=$false
try {
 $keys=@{fixture=$r.ToXmlString($false)}
 @{keys=$keys}|ConvertTo-Json|Set-Content -LiteralPath $T -Encoding UTF8
 @{algorithm='RSA-SHA256';key_id='fixture';signature=[Convert]::ToBase64String($r.SignData([IO.File]::ReadAllBytes($M),'SHA256'))}|ConvertTo-Json|Set-Content -LiteralPath $S -Encoding UTF8
}finally{$r.Dispose()}
''',encoding='utf-8')
        result=subprocess.run(['powershell.exe','-NoProfile','-File',str(script),str(manifest),str(signature),str(trust)],capture_output=True,creationflags=u.CREATE_HIDDEN)
        self.assertEqual(result.returncode,0,result.stderr.decode(errors='replace'))
        u.verify_signature(self.root,manifest,signature)
        manifest.write_text('{"test":"modificado"}')
        with self.assertRaisesRegex(u.UpdateError,'Assinatura'):u.verify_signature(self.root,manifest,signature)


if __name__=='__main__':unittest.main()
