import unittest
from urllib.parse import urlsplit, parse_qs
from unittest.mock import patch
from service.connectors import consult_djen, SourceError
from tests import test_service as fixtures


class NameQueryTests(unittest.TestCase):
    def test_nome_da_parte_preservado_em_todas_as_paginas(self):
        calls=[]
        def fetch(url):
            query=parse_qs(urlsplit(url).query);calls.append(query)
            page=int(query['pagina'][0])
            return {'count':101,'items':[{'id':f'{page}:{i}','numero_processo':fixtures.cnj(),
                'data_disponibilizacao':'2026-11-05','texto':'Exemplo'} for i in range(100 if page==1 else 1)]}
        first=consult_djen(nome_parte='José Exemplo',search_page=1,requester=fetch)
        second=consult_djen(nome_parte='José Exemplo',search_page=2,requester=fetch)
        self.assertTrue(first['hasNext']);self.assertFalse(second['hasNext'])
        self.assertEqual(len(second['events']),1)
        self.assertTrue(all(q['nomeParte']==['José Exemplo'] for q in calls))
        self.assertTrue(all('nomeAdvogado' not in q and 'numeroOab' not in q for q in calls))

    def test_nome_advogado_e_validacao_antes_da_rede(self):
        calls=[]
        consult_djen(nome_advogado='Advogado Exemplo',search_page=1,
            requester=lambda url:(calls.append(parse_qs(urlsplit(url).query)) or {'count':0,'items':[]}))
        self.assertEqual(calls[0]['nomeAdvogado'],['Advogado Exemplo'])
        for args in ({'nome_parte':'ab'},{'nome_advogado':' '},{'nome_parte':'Exemplo','search_page':True}):
            with self.subTest(args=args),self.assertRaises((ValueError,SourceError)):
                consult_djen(**args,requester=lambda url:self.fail('nao deve consultar'))


class NameAPITests(unittest.TestCase):
    def setUp(self):
        fixtures.ApiTests.setUp(self)
    req=fixtures.ApiTests.req

    def test_busca_avulsa_liga_cnj_existente_sem_escrever_no_historico(self):
        self.server.store.sync_cases([{'id':'case1','cnj':fixtures.cnj()}])
        headers={'Origin':self.server.origin,'X-Pauta-CSRF':self.server.csrf}
        fake={'status':'success','total':1,'page':1,'hasNext':False,'events':[{'cnj':fixtures.cnj()}]}
        with patch('service.main.consult_djen',return_value=fake) as fetch:
            status,data=self.req('POST','/api/v1/djen/search',{'criterion':'nomeParte','name':'Parte Exemplo','days':7,'page':1},headers)
        self.assertEqual(status,200);self.assertEqual(data['events'][0]['caseId'],'case1')
        fetch.assert_called_once_with(days=7,search_page=1,nome_parte='Parte Exemplo')
        self.assertEqual(self.server.store.publications()['events'],[])
        with patch('service.main.consult_djen') as fetch:
            status,_=self.req('POST','/api/v1/djen/search',{'criterion':'cpf','name':'invalid'},headers)
            self.assertEqual(status,400);fetch.assert_not_called()
