import tempfile
from service.store import Store
import json
import unittest
from service.connectors import parse_esaj_result, SourceError
from tests.test_service import cnj

class Frame:
    def __init__(self, rows):self.rows=rows
    def __len__(self):return len(self.rows)
    def head(self,n):return Frame(self.rows[:n])
    def to_json(self,**kwargs):return json.dumps(self.rows)

class EsajAdapterTests(unittest.TestCase):
    def test_pg_maps_movements_without_local_paths_or_nan(self):
        row={"data":"05/11/2026","movimento":"<b>Conclusão</b>","observacao":"Ao juiz","file_path":"dummy-local-path"}
        result=parse_esaj_result({"basicos":Frame([{"classe":"Teste","valor":float('nan')}]),"movimentacoes":Frame([row,row])},cnj(court=26),'pg')
        self.assertEqual(result['status'],'success')
        self.assertEqual(len(result['events']),1)
        self.assertEqual(result['events'][0]['occurredAt'],'2026-11-05')
        self.assertIn('Conclusão',result['events'][0]['text'])
        encoded=json.dumps(result,allow_nan=False)
        self.assertNotIn('file_path',encoded)
        self.assertNotIn('dummy-local-path',encoded)

    def test_sg_accepts_dataframe_with_nested_movements(self):
        result=parse_esaj_result(Frame([{"processo":cnj(court=26),"movimentacoes":[{"data":"04/11/2026","movimento":"Recebimento","descricao":"Na secretaria"}]}]),cnj(court=26),'sg')
        self.assertEqual(result['status'],'success')
        self.assertEqual(result['events'][0]['source'],'esaj_sg')

    def test_incomplete_rows_stay_partial_and_empty_does_not_claim_not_found(self):
        result=parse_esaj_result({"movimentacoes":[{"data":"99/11/2026","movimento":"Teste"}],"basicos":[{"classe":"Teste"}]},cnj(court=26),'pg')
        self.assertEqual(result['status'],'partial')
        self.assertEqual(result['events'],[])
        self.assertIn('1 movimento',result['limitation'])
        result=parse_esaj_result({"basicos":[{"classe":"Teste"}]},cnj(court=26),'pg')
        self.assertEqual(result['status'],'partial')
        for raw in [{},[],Frame([])]:
            with self.subTest(raw=type(raw).__name__),self.assertRaises(SourceError):parse_esaj_result(raw,cnj(court=26),'pg')

    def test_first_interpreted_history_is_baseline_then_only_new_movements_notify(self):
        number=cnj(court=26)
        with tempfile.TemporaryDirectory() as directory:
            store=Store(directory);store.sync_cases([{"id":"fixture","cnj":number}])
            store.update_settings({"enabled":{"esaj_pg":True}})
            def run(raw):
                store.enqueue(["fixture"],["esaj_pg"])
                job=store.claim();return store.finish(job,parse_esaj_result(raw,number,'pg'))
            self.assertEqual(run({"basicos":[{"classe":"Fixture"}]}),0)
            row={"data":"05/11/2026","movimento":"Primeiro movimento fictício"}
            self.assertEqual(run({"movimentacoes":[row]}),0)
            self.assertEqual(store.summary()['unseen'],0)
            later={"data":"06/11/2026","movimento":"Novo movimento fictício"}
            self.assertEqual(run({"movimentacoes":[row,later]}),1)
            self.assertEqual(store.summary()['unseen'],1)
