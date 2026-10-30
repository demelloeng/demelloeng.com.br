---
name: gerar-pagina-servico
description: Gera ou atualiza uma página de serviço do site (/servicos/<slug>/) pelo ciclo copy central, importar, gerar, conferir e mostrar. Usar quando Marcos pedir uma página de serviço nova ou uma mudança de texto numa página existente. Não publica, não faz push e não mescla.
disable-model-invocation: true
---

# Gerar página de serviço

Ciclo fixo, aprendido nas páginas de Arquitetura, Estrutural e Hidrossanitário (29–30/10/2026). A página nunca é editada à mão: o texto sai da copy central e o HTML sai do gerador.

## Antes de escrever
1. Ler a Voz vigente: `C:\Users\mms_e\Documents\DEMELLO_ENGENHARIA\01_INSTITUCIONAL\MARCA_E_APRESENTACAO\VOZ_DEMELLO_V07.md` (ou a de maior número na pasta).
2. Ler os termos de busca medidos em `...\BEP\07_R5\out\site_20261024\` (`PLANEJADOR_RESULTADO_*.csv` e `SEO_PALAVRAS_MEDIDAS_SEMRUSH_20261024.md`). O título e o subtítulo usam os termos medidos, e não frases bonitas.
3. Ler a memória do projeto sobre o que Marcos já decidiu (fatos declarados se aceitam; nome duvidoso se pesquisa; versão nova a cada mudança).

## Regras de texto
- **Terraplanagem**, nunca "terraplenagem".
- **Não negar o que a DEMELLO faz** ("não executa obra", "projeto, não máquina"). Tirar a negação não é pôr propaganda no lugar.
- **ART é o documento**; responsabilidade técnica é o que ele registra. "RT" na transcrição = responsabilidade técnica.
- Acervo é do profissional (Marcos), sem ressalva de CNPJ. Sem "pacote automático" nem "salvo contratação expressa".
- Título e subtítulo não podem dizer a mesma coisa. Cada fato aparece uma vez por página (conferir repetição).
- Sem norma em texto de venda, sem regra externa (prefeitura, concessionária) além do que Marcos declarou.
- Texto antigo protegido (Prova técnica, Detalhes do escopo) só muda por ordem expressa; quando mudar, registrar em `REMOVIDOS` do importador.

## Ciclo
Rodar dentro do clone do site (`C:\Users\mms_e\Documents\MA_DEMELLO_PILOTO\demelloeng.com.br` ou o worktree em uso).

1. Gravar a copy em arquivo **novo**: `docs/arquivo/paginas-servico-v02/copy/COPY_<SERVICO>_V<NN>_<AAAAMMDD>.md`. Nunca editar a versão anterior.
2. `python scripts/importar-copy-servico-v02.py <slug> <arquivo-da-copy> "<Nome do serviço>"`
3. `python scripts/gerar-paginas-servico-v02.py gerar <slug>`
4. `python scripts/conferir-paginas-servico-v02.py` e olhar a linha da página: **trechos ausentes 0**.
5. Conferir o HTML: um H1, sem rolagem lateral em 390 px, sem erro no console.
6. Mostrar a página consolidada em tela larga e no celular **antes de qualquer commit**. Uma rodada de anotações.
7. **Atualizar `docs/CODEBASE_MAP.md`** na mesma entrega, se a mudança for estrutural (página nova, serviço renomeado ou agrupado, script, teste, allowlist, menu, rodapé, publicação). O mapa é o documento canônico do site (decisão de Marcos, 30/10/2026). Rodar o Cartographer em modo de atualização.
8. Commit só local, só com ordem. **Push, PR e merge são ordens separadas.**

## Maquete 3D (quando houver IFC)
- Passar o IFC antes por `scripts/otimizar_ifc.py` (sem perda).
- `scripts/ifc_para_glb_hidro.py` converte; teto de 2.000 KB, cores do IFC original, só o GLB derivado vai ao site (o IFC é dado de cliente).
- Para publicar: hospedar o `three.js` e liberar os arquivos em `.github/pages/allowlist.txt`.

## Cuidados que já custaram caro
- Edição com `\n` dentro de Python: gerar o caractere de quebra com `chr(92) + 'n'` ou usar o editor de arquivos; já corrompeu `layout_rico.py` duas vezes.
- Regerar uma página não pode mexer em outras: conferir `git diff` das demais.
- Servidor local: usar uma porta livre (a 8765 já estava ocupada por outro processo).
