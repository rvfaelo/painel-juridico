# Licenças de terceiros distribuídas com o Painel H.B

O arquivo gerado `zip-inflate.js` contém uma distribuição minimizada de `fflate` (v0.8.3), usada exclusivamente para ler arquivos ZIP de planilhas XLSX de forma local. Código de Arjun Barrett, disponível sob a licença MIT:

MIT License

Copyright (c) 2026 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

O build do arquivo é reproduzível via `node tools/build-zip.mjs`, usando as dependências de desenvolvimento `fflate` e `esbuild`. Essas dependências não precisam estar instaladas para abrir o painel HTML já compilado.

## Conectores Python na versão 0.6.1

- `juscraper==0.5.0`: dependência **opcional**, obtida via PyPI, licença MIT; consulte o pacote instalado para seu texto completo de licença e as licenças transitivas. Não distribuímos seu código-fonte modificado.
- `mcp-juridico-brasil` 0.1.0 (DeHor-Labs): dependência instalada pelo `requirements.txt` a partir do commit fixado `4dd19d146b2a3efe6fd3d0c7fcd2ceaefe40cfc1`, licença MIT. É usada em `service/datajud_mcp.py` como transporte do cliente DataJud; nenhum código-fonte do projeto upstream é copiado para este repositório. Consulte o pacote instalado para o texto completo da licença e das dependências transitivas.
- API Pública DataJud e Comunica/DJEN: serviços públicos externos, sujeitos a termos, limites e políticas próprias; **não** são bibliotecas incorporadas ao pacote.

As dependências Node utilizadas no desenvolvimento estão fixadas no `package-lock.json`. Não instale código diretamente da branch `main` de nenhum repositório. Propostas de atualização podem ser revisadas manualmente; não há execução automática de código por mudanças no GitHub.
