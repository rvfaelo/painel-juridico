import copy
import json
from pathlib import Path
import tempfile
import unittest
import urllib.request
from unittest.mock import patch
from service.workspace import validate_attachment
from service.store import Store
from service.connectors import _DjenJSONRedirect, SourceError, json_request
from tools.release_inventory import release_files
from tests.test_service import cnj, movement, result

class SecurityRegressionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.store=Store(self.tmp.name)
        self.store.sync_cases([{"id":"case1","cnj":cnj()}])
        self.store.enqueue(["case1"],["djen"])
        job=self.store.claim();self.store.finish(job,result(movement("fixture")))

    def test_restore_rejects_invalid_settings_and_rows_before_backup_or_writes(self):
        before=self.store.export_monitoring()
        bad=[]
        for key,value in [("enabled",[]),("autoTimes",["99:00"]),("autoEnabled","yes"),("djenDays",0),("autoLast","2026-02-30T08:00")]:
            blob=copy.deepcopy(before);blob["settings"][key]=value;bad.append(blob)
        blob=copy.deepcopy(before);blob["tables"]["events"][0]["publication_details"]='[]';bad.append(blob)
        blob=copy.deepcopy(before);blob["tables"]["events"][0]["occurred_at"]='<textarea>';bad.append(blob)
        blob=copy.deepcopy(before);blob["tables"]["events"][0]["seen"]=3;bad.append(blob)
        for blob in bad:
            with self.subTest(blob=bad.index(blob)),self.assertRaises(ValueError):self.store.restore_monitoring(blob)
            after=self.store.export_monitoring()
            self.assertEqual(before["tables"],after["tables"])
            self.assertEqual(before["settings"],after["settings"])
            self.assertFalse((Path(self.tmp.name)/"backups").exists())

    def test_valid_legacy_restore_and_settings_share_rules(self):
        blob=self.store.export_monitoring();blob["version"]=1
        for row in blob["tables"]["events"]:
            row.pop("certificate_hash");row.pop("publication_details")
        self.store.restore_monitoring(blob)
        self.assertEqual(len(self.store.case_detail("case1")["events"]),1)
        self.assertEqual(self.store.case_detail("case1")["events"][0]["publication_details"],"{}")

    def test_json_redirect_rejects_other_authorities(self):
        handler=_DjenJSONRedirect();req=urllib.request.Request('https://comunicaapi.pje.jus.br/api/v1/comunicacao')
        for url in ['http://comunicaapi.pje.jus.br/x','https://example.invalid/x','https://127.0.0.1/x','https://user@comunicaapi.pje.jus.br/x','https://comunicaapi.pje.jus.br:8443/x']:
            with self.subTest(url=url),self.assertRaises(SourceError):handler.redirect_request(req,None,302,'Found',{},url)
        self.assertEqual(handler.redirect_request(req,None,302,'Found',{},'https://comunicaapi.pje.jus.br/next').host,'comunicaapi.pje.jus.br')
        with patch('urllib.request.build_opener') as factory:
            factory.return_value.open.side_effect=TimeoutError
            with self.assertRaises(SourceError):json_request(req.full_url)
            self.assertIsInstance(factory.call_args.args[0],_DjenJSONRedirect)

    def test_inventory_ignores_unlisted_json_and_rejects_traversal(self):
        root=Path(self.tmp.name)/'release';root.mkdir()
        (root/'app.js').write_text('// fixture',encoding='utf-8')
        (root/'private-backup.json').write_text('{"dummy":true}',encoding='utf-8')
        (root/'release-files.json').write_text('["app.js"]',encoding='utf-8')
        self.assertEqual([p.name for p in release_files(root)],['app.js'])
        for names in [['../outside.json'],['app.js','app.js'],['missing.js']]:
            (root/'release-files.json').write_text(json.dumps(names),encoding='utf-8')
            with self.assertRaises(ValueError):release_files(root)

    def test_service_checks_attachment_types_and_signatures(self):
        validate_attachment(b"exemplo ficticio", "text/plain")
        validate_attachment(b"%PDF-fixture", "application/pdf")
        for data,mime in [(b"<html>fixture</html>","text/html"),(b"<svg/>","image/png"),(b"\x00", "text/plain"),(b"\xff", "text/plain")]:
            with self.subTest(mime=mime),self.assertRaises(ValueError):validate_attachment(data,mime)
