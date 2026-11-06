import test from 'node:test';
import assert from 'node:assert/strict';
import {caseMoment,courtDegree,probableCrossDegreeDuplicates,integratedCaseHTML,historyPage,CASE_HISTORY_PAGE_SIZE} from '../integrated-case-view.js';

const tracks=[
  {id:'datajud:g1',source:'datajud',tribunal:'TJRJ',grau:'G1',sistema:{nome:'PJe',codigo:1},
   orgao:{nome:'1ª Vara Cível',codigo:321},classe:{nome:'Procedimento Comum'},ultimaAtualizacaoFonte:'2026-11-05T13:00:00Z'},
  {id:'datajud:g2',source:'datajud',tribunal:'TJRJ',grau:'G2',sistema:'eproc',
   orgao:{nome:'2ª Câmara Cível'},ultimaAtualizacaoFonte:'2026-11-05T14:00:00Z'}
];

const events=[
  {id:'g1:a',source:'datajud',tramitation_id:'datajud:g1',kind:'movement',
   occurred_at:'2026-11-03T13:20:00Z',text:'Conclusão ao relator',is_new:1,seen:0,
   first_seen:'2026-11-05T15:00:00Z',last_seen:'2026-11-05T16:00:00Z',source_updated_at:'2026-11-05T13:00:00Z'},
  {id:'g2:b',source:'datajud',tramitation_id:'datajud:g2',kind:'movement',
   occurred_at:'2026-11-03T13:20:00Z',text:'Conclusão ao relator',is_new:0,seen:1,
   first_seen:'2026-11-05T15:05:00Z',last_seen:'2026-11-05T16:05:00Z',source_updated_at:'2026-11-05T14:00:00Z'},
  {id:'pub:1',source:'djen',tramitation_id:'djen:1',kind:'publication',
   occurred_at:'2026-11-01',text:'Intimação publicada',is_new:0,seen:0,
   first_seen:'2026-11-01T11:00:00Z',last_seen:'2026-11-05T16:10:00Z'}
];

const example={events,tramitations:tracks,lastAttempt:{attempted_at:'2026-11-05T19:00:00Z'},
  lastSuccess:{attempted_at:'2026-11-05T17:00:00Z'}};

test('DJEN fica acessível com publicação preservada e erro separado do DataJud',()=>{
  const html=integratedCaseHTML({...example,djenDays:60,sourceJobs:[
    {source:'djen',status:'success',message:'Publicações recebidas'},
    {source:'datajud',status:'unavailable',message:'Tempo de espera esgotado.'}
  ]},'case1');
  assert.match(html,/Buscar publicações no DJEN/);
  assert.match(html,/últimos 60 dias/);
  assert.match(html,/Intimação publicada/);
  assert.match(html,/DataJud · Fonte indisponível/);
  assert.match(html,/Tempo de espera esgotado/);
});

test('DJEN sem registros informa o período, sem declarar processo inexistente',()=>{
  const html=integratedCaseHTML({events:[],sourceJobs:[{source:'djen',status:'not_found'}]},'case1');
  assert.match(html,/Nenhuma publicação encontrada no período/);
  assert.match(html,/não significa que o processo não existe/);
});

test('datas: UTC e offset convertem ao fuso de São Paulo, data pura não recebe hora',()=>{
  assert.deepEqual(caseMoment('2026-11-05T14:30:00Z'),{
    text:'05/11/2026 às 11:30',datetime:'2026-11-05T14:30:00Z',kind:'converted'});
  assert.equal(caseMoment('2026-11-05T15:30:00+02:00').text,'05/11/2026 às 10:30');
  assert.deepEqual(caseMoment('2026-11-05'),{
    text:'05/11/2026',datetime:'2026-11-05',kind:'date'});
  assert.deepEqual(caseMoment('2026-11-05T10:20:00'),{
    text:'05/11/2026 às 10:20',datetime:'2026-11-05T10:20:00',kind:'no-zone'});
  assert.equal(caseMoment('2026-02-30T10:20:00'),null);
  assert.equal(caseMoment('2026-02-30T10:20:00Z'),null);
  assert.equal(caseMoment('not-a-date'),null);
});

test('graus: G1 e G2 são legíveis; não exibe código bruto desconhecido',()=>{
  assert.equal(courtDegree('G1'),'1º grau');
  assert.equal(courtDegree('G2'),'2º grau');
  assert.equal(courtDegree('SUP'),'Tribunal superior');
  assert.equal(courtDegree('G66'),'Grau não identificado');
  assert.equal(courtDegree({codigo:1}),'Grau não identificado');
});

test('possível repetição só entre graus diferentes da mesma fonte, sem excluir eventos',()=>{
  const pairs=probableCrossDegreeDuplicates(events,tracks);
  assert.deepEqual([...pairs].sort(),['datajud\u0000g1:a','datajud\u0000g2:b']);
  assert.equal(probableCrossDegreeDuplicates([
    {...events[0],id:'a'}, {...events[0],id:'b'}],tracks).size,0);
  assert.equal(probableCrossDegreeDuplicates([events[0],{...events[1],source:'djen'}],tracks).size,0);
  assert.equal(probableCrossDegreeDuplicates([
    {...events[0],text:'X'.repeat(241)+'AAA'}, {...events[1],text:'X'.repeat(241)+'BBB'}],tracks).size,0);
  const html=integratedCaseHTML(example,'case1');
  assert.equal((html.match(/class="integrated-event(?: integrated-event-pending)?"/g)||[]).length,3);
  assert.equal((html.match(/Possível repetição em outro grau/g)||[]).length,2);
  assert.equal((html.match(/data-event-id="g1:a"/g)||[]).length,1);
  assert.equal((html.match(/data-event-id="g2:b"/g)||[]).length,1);
});

test('painel: contagem útil, novidades separadas, horários técnicos em details fechado',()=>{
  const html=integratedCaseHTML(example,'case1');
  assert.match(html,/2 movimentos · 1 publicação no histórico/);
  assert.match(html,/1 por conferir/);
  assert.match(html,/linha de base ou consulta anterior/);
  assert.match(html,/não necessariamente um movimento ocorrido recentemente/);
  assert.match(html,/<time datetime="2026-11-03T13:20:00Z"[^>]*>03\/11\/2026 às 10:20<\/time>/);
  assert.match(html,/<time datetime="2026-11-01"[^>]*>01\/11\/2026<\/time>/);
  const news=html.slice(html.indexOf('aria-label="Novidades por conferir"'),
    html.indexOf('aria-label="Histórico de eventos"'));
  assert.match(news,/data-event-id="g1:a"/);
  assert.doesNotMatch(news,/data-event-id="g2:b"/);
  assert.doesNotMatch(news,/Última identificação|Primeira identificação|Atualização informada pela fonte/);
  const technical=html.slice(html.indexOf('<details class="integrated-technical"'));
  assert.match(technical,/Primeira identificação no histórico exibido/);
  assert.match(technical,/Última consulta tentada/);
  assert.match(technical,/Atualização informada pela fonte/);
  assert.doesNotMatch(technical,/\sopen(?:\s|>)/);
});

test('tramitações agrupadas por grau apresentam nomes em vez de objetos ou JSON',()=>{
  const html=integratedCaseHTML(example,'case1');
  assert.match(html,/aria-label="Tramitações do 1º grau"/);
  assert.match(html,/aria-label="Tramitações do 2º grau"/);
  assert.match(html,/<strong>Órgão julgador:<\/strong> 1ª Vara Cível/);
  assert.match(html,/<strong>Sistema:<\/strong> PJe/);
  assert.match(html,/<strong>Classe:<\/strong> Procedimento Comum/);
  assert.doesNotMatch(html,/\[object Object\]|codigo.*321|G1 ·/);
  const without=integratedCaseHTML({events:[],tramitations:[{id:'a',source:'datajud',grau:'G3',sistema:{codigo:1}}]},'case1');
  assert.match(without,/Grau não identificado/);
  assert.doesNotMatch(without,/Sistema:|G3|\[object Object\]/);
});

test('mensagens externas são escapadas, a ação de conferência mantém IDs separados por fonte',()=>{
  const info={...example,events:[{...events[0],id:'a" onmouseover="alert(1)',
    text:'<img src=x onerror=alert(1)>',source:'datajud'}]};
  const html=integratedCaseHTML(info,'case1');
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html,/<img /);
  assert.doesNotMatch(html,/data-id="a" onmouseover=/);
  assert.match(html,/data-integrated="seen"/);
  assert.match(html,/data-case-id="case1" data-source="datajud"/);
});

test('estado vazio não inventa contagem, data nem tribunal',()=>{
  const html=integratedCaseHTML({events:[],tramitations:[]},'case1');
  assert.match(html,/Nenhum evento no histórico/);
  assert.match(html,/0 por conferir/);
  assert.match(html,/Nenhuma tramitação estruturada/);
  assert.match(html,/Ainda não há datas técnicas disponíveis/);
  assert.doesNotMatch(html,/Invalid Date|undefined|null/);
});

test('páginas compactas de 12 preservam 157 movimentos sem alterar a ordem nem juntar registros iguais',()=>{
  assert.equal(CASE_HISTORY_PAGE_SIZE,12);
  const many=Array.from({length:157},(_,i)=>({...events[1],
    id:'extenso-'+i, text:i===156?'Último movimento individual':'Documento',
    occurred_at:'2026-05-14T13:11:00',tramitation_id:i%2?'datajud:g1':'datajud:g2'}));
  const page1=historyPage(many,1),page2=historyPage(many,2),last=historyPage(many,99);
  assert.equal(page1.items.length,12);
  assert.equal(page1.pages,14);
  assert.equal(page2.items[0].id,'extenso-12');
  assert.equal(last.page,14);
  assert.equal(last.items.at(-1).id,'extenso-156');
  const info={...example,events:many};
  const html=integratedCaseHTML(info,'case1');
  assert.equal((html.match(/class="integrated-event"/g)||[]).length,12);
  assert.match(html,/Histórico · 157/);
  assert.match(html,/Mostrando 1–12 de 157 · Página 1 de 14/);
  assert.doesNotMatch(html,/data-event-id="extenso-156"/);
  const lastHTML=integratedCaseHTML(info,'case1',{'datajud-history':14});
  assert.match(lastHTML,/data-event-id="extenso-156"/);
  assert.match(lastHTML,/Mostrando 157–157 de 157 · Página 14 de 14/);
  assert.equal((lastHTML.match(/class="integrated-event"/g)||[]).length,1);
});

test('resumo fica curto e detalhes extensos permanecem acessíveis e recolhidos',()=>{
  const long='<script>não executar</script>'+' texto preservado'.repeat(70);
  const html=integratedCaseHTML({...example,events:[{...events[1],text:long}]},'case1');
  assert.match(html,/<details class="integrated-event-disclosure"><summary/);
  assert.match(html,/class="integrated-event-snippet private"/);
  assert.match(html,/&lt;script&gt;não executar&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.doesNotMatch(html,/<details class="integrated-event-disclosure" open/);
});
