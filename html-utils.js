// Escapa texto para interpolação segura em HTML (atributos e conteúdo).
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
