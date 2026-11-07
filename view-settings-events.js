// Controles de horários e eventos de configuração.
export function createSettingsEvents(app) {
  function updateTimeControls(form){
    const enabled=form.querySelector('[name=autoUpdateEnabled]').checked;
    const rows=[...form.querySelectorAll('[data-time-list] > div')];
    rows.forEach((row,i)=>{row.querySelector('label').firstChild.textContent='Horário '+(i+1);row.querySelector('button').setAttribute('aria-label','Remover horário '+(i+1));});
    const add=form.querySelector('[data-time-add]');add.disabled=rows.length>=6||!enabled;
    form.querySelector('[data-time-help]').textContent=rows.length>=6?'Limite de 6 horários atingido. Remova um horário para adicionar outro.':!enabled?'Ative para editar os horários. Os horários salvos serão preservados.':rows.length?'Horários repetidos serão reunidos e ordenados ao salvar.':'Adicione ao menos um horário antes de salvar a ativação.';
    for(const button of form.querySelectorAll('[data-time-remove]'))button.disabled=!enabled;
  }

  function handleClick(event){
    const t=event.target;
    const form=t.closest('#settings-form');
    if(form&&t.matches('[data-key-edit],[data-key-remove],[data-key-cancel]')){
      app.settingsDirty=true;
      const box=form.querySelector('[data-key-editor]'),input=box.querySelector('input');
      if(t.matches('[data-key-edit]')){box.hidden=false;input.disabled=false;input.value='';input.required=true;input.focus();}
      if(t.matches('[data-key-cancel]')){box.hidden=true;input.disabled=true;input.required=false;input.value='';}
      if(t.matches('[data-key-remove]')&&confirm('Remover a chave ao salvar configurações? Consultas ao DataJud ficarão indisponíveis até configurar outra chave.')){box.hidden=false;input.disabled=false;input.required=false;input.value='';input.placeholder='Remoção pendente. Salve as configurações ou cancele.';}
      app.updateSettingsDirty();
    }
    const auto=t.closest('#auto-form');if(!auto)return;app.settingsDirty=true;
    if(t.matches('[data-time-add]')){
      const list=auto.querySelector('[data-time-list]');if(list.children.length>=6){app.toast('Você pode configurar até 6 horários.');return;}
      const enabled=auto.querySelector('[name=autoUpdateEnabled]').checked;
      list.insertAdjacentHTML('beforeend',app.scheduleRow('',list.children.length+1,enabled));
      const input=list.lastElementChild.querySelector('input');if(enabled)input.focus();
      updateTimeControls(auto);
    }
    if(t.matches('[data-time-remove]')){t.parentElement.remove();updateTimeControls(auto);auto.querySelector('[data-time-add]').focus();}
    app.updateSettingsDirty();
  }

  function handleChange(event){
    if(event.target.name==='autoUpdateEnabled'){const f=event.target.form;for(const x of f.querySelectorAll('[name=autoTime]')){x.required=event.target.checked;x.disabled=!event.target.checked;}updateTimeControls(f);app.updateSettingsDirty();}
  }

  return {updateTimeControls,handleClick,handleChange};
}
