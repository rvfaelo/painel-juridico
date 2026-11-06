// Organização visual: preserva formulários, listeners e registros existentes.
let settingsView='Fontes';
const work=['agendados','tasks','agenda'];
export function organizePanel(route){
 const root=document.getElementById('content');if(!root)return;
 document.getElementById('update-all').hidden=!['home','cases','notifications','publications','sources'].includes(route);
 const nav=document.getElementById('navigation');
 if(!nav.querySelector('[data-work-menu]')){
  const links=work.map(k=>nav.querySelector(`[href="#${k}"]`)).filter(Boolean);
  const group=document.createElement('div');group.dataset.workMenu='';
  group.innerHTML='<a class="nav-item" href="#agendados">Trabalho</a>';
  links[0]?.before(group);for(const link of links){link.classList.add('work-subnav');group.append(link);}
 }
 for(const link of nav.querySelectorAll('.work-subnav'))link.hidden=!work.includes(route);
 if(work.includes(route)&&!root.querySelector('[data-work-views]')){
  const bar=document.createElement('nav');bar.dataset.workViews='';bar.className='organization-tabs';bar.setAttribute('aria-label','Vistas de Trabalho');
  bar.innerHTML=work.map((k,i)=>`<a class="button ${k===route?'primary':'secondary'}" href="#${k}" ${k===route?'aria-current="page"':''}>${['Por processo','Tarefas','Agenda'][i]}</a>`).join('');root.prepend(bar);
 }
 if(route!=='sources')return;
 let tabs=root.querySelector('[data-settings-views]');
 if(!tabs){
  tabs=document.createElement('nav');tabs.dataset.settingsViews='';tabs.className='organization-tabs';tabs.setAttribute('aria-label','Seções de Ajustes');
  for(const name of ['Fontes','Automação','Dados','Diagnóstico']){
   const button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent=name;
   button.onclick=()=>{settingsView=name;apply();};tabs.append(button);
   const section=document.createElement('div');section.dataset.settingsSection=name;root.append(section);
  }
  root.prepend(tabs);
 }
 const destination=name=>root.querySelector(`[data-settings-section="${name}"]`);
 // Capturar apenas painéis exteriores; mover os nós mantém rascunhos e eventos.
 const panels=[...root.querySelectorAll('.panel')].filter(el=>!el.parentElement.closest('.panel'));
 for(const panel of panels){
  if(panel.closest('[data-settings-section]'))continue;
  const heading=panel.querySelector('h2')?.textContent||'';
  const group=panel.querySelector('#auto-form')?'Automação':heading.includes('Dados sob')?'Dados':/Histórico|Comparação|evidências|Conectividade|Integridade|Preparar/.test(heading)?'Diagnóstico':'Fontes';
  destination(group).append(panel);
 }
 const jobs=root.querySelector('#integrated-service-jobs');if(jobs)destination('Diagnóstico').append(jobs);
 for(const grid of [...root.querySelectorAll('.two-columns')])if(!grid.children.length)grid.remove();
 function apply(){
  for(const section of root.querySelectorAll('[data-settings-section]'))section.hidden=section.dataset.settingsSection!==settingsView;
  for(const button of tabs.children){button.className='button '+(button.textContent===settingsView?'primary':'secondary');button.setAttribute('aria-pressed',String(button.textContent===settingsView));}
 }
 apply();
}
