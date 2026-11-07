// Se o bundle não carregar, explique a causa em vez de deixar a tela vazia.
window.addEventListener('load',()=>setTimeout(()=>{
  if(globalThis.__PAUTA_BOOTED__)return;
  const content=document.querySelector('#content');
  if(content)content.innerHTML='<div class="notice"><strong>Não foi possível carregar o aplicativo.</strong><p>Confira se <code>app.bundle.js</code> está na mesma pasta de <code>dashboard.html</code>. Se você alterou os módulos-fonte, gere o bundle com <code>npm run build</code>.</p></div>';
},1500));
