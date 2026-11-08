# Calculadora V04 — maquete 3D, WhatsApp acoplado e revisão de voz

Documento de trabalho (não publicado; fora da allowlist do Pages). Estado: implementado na branch `feat/calculadora-modernizacao-integrada`, testado, **aguardando o aceite visual do proprietário**.

## O que mudou em relação à versão anterior (V03/P05)

| Antes | Agora |
|---|---|
| Retângulo com linhas e círculos em SVG, minúsculo no painel | Maquete 3D paramétrica (Three.js), que cresce com a área, ganha pavimentos e as camadas das disciplinas escolhidas |
| Uma vista | Quatro vistas: Conjunto, Camadas, Corte e Planta; arrastar na horizontal gira |
| Botão do WhatsApp flutuante, que esconde ou deixa translúcido o que passa por baixo | Botão acoplado a uma barra fixa: rodapé no computador, painel "Seu projeto" no celular. Não existe mais cálculo de sobreposição |
| Aviso "Desenho ilustrativo: … não o seu projeto." | "Visualização ilustrativa. A maquete acompanha suas escolhas de área, pavimentos e disciplinas." (Voz DEMELLO V07; refino de 07/11, evidências em `evidencias/refino-f01-f03/`) |

Comparações lado a lado: `evidencias/comparacao-antes-depois-1440.jpg` e `evidencias/comparacao-antes-depois-390.jpg`.

## Ferramentas e fontes efetivamente usadas

- Skill de design: `frontend-design` (invocada), para direção de arte, hierarquia, composição e acabamento.
- Voz: `VOZ_DEMELLO_V07.md` lida inteira (180 linhas, um bloco) e skill `voz-demello`; agente `.claude/agents/revisor-copy.md` lido.
- Maquetes do site consultadas: `maquete-estrutura-3d.js` (paleta grafite-azul `#1b242d`, luz hemisférica + chave + contraluz azul, montagem por camadas, `IntersectionObserver`), `maquete-3d.css`, `three-d-stage.js` (palco), importmap das páginas de serviço e `assets/vendor/three/ORIGEM.txt`. Nenhum modelo GLB de cliente foi reaproveitado.
- Navegador: painel embutido do aplicativo (primeiras verificações) e Chrome DevTools (capturas exatas, emulação de largura, de movimento reduzido e de ausência de WebGL).

## Três composições exploradas

Quadros comparáveis em `evidencias/exploracao-tres-composicoes.jpg` (página `index.html` desta pasta, com a mesma cena e os mesmos dados).

| | A — Maquete em camadas | B — Corte tridimensional | C — Estúdio de orçamento |
|---|---|---|---|
| Qualidade visual | Alta: níveis, estrutura e instalações legíveis de uma vez | Boa: interior legível, conjunto perde força | Alta, mas a conta cobre parte da cena |
| Clareza | Alta | Média | Média |
| Legibilidade no celular | Boa | Boa | Ruim: o cartão disputa a cena |
| Desempenho | Igual (mesma cena) | Igual | Igual |
| Coerência com a marca | Alta (mesma linguagem das maquetes) | Alta | Média |

Escolha técnica: **A como base, B como vista alternável ("Corte")**; C descartada (a estimativa fica no painel, ao lado da maquete). A escolha técnica não é o aceite visual.

## Tecnologia de renderização

Three.js 0.160 **já hospedado** (`/assets/vendor/three/build/three.module.js`, mesmos bytes das maquetes, já na allowlist), carregado por `import()` dinâmico.
Comparação feita: (1) Three.js com cena paramétrica leve, escolhida; (2) renderização 3D integrada ao React com biblioteca adicional, descartada porque não traz benefício que justifique peso e manutenção; (3) isométrico vetorial como alternativa sem WebGL, **mantido como primeira pintura e fallback**, gerado do mesmo modelo.
Nenhuma dependência npm nova, nenhum serviço externo, nenhuma CDN.

## Arquivos

- `orcamento-src/src/maquete_model.mjs`: modelo puro da cena (sem DOM, sem Three, sem preço) e geometria do isométrico.
- `orcamento-src/src/maquete3d.mjs`: cena Three (módulo carregado sob demanda; chunk próprio de ~11,7 kB).
- `orcamento-src/src/LivePlan.jsx`: painel (estágio, vistas, legenda, linhas e total). Lê só `livePlanModel` (dados do motor).
- `assets/js/contato-flutuante.js`: acoplamento do botão (rodapé acima de 900 px; painel "Seu projeto" até 900 px).

## Desempenho e acessibilidade: o que foi verificado

Verificado: a cena só carrega quando pedida (computador: ao existir o painel; celular: ao expandir); a entrada não importa o Three; laço de desenho sob demanda e pausa fora da tela ou com a aba oculta; resolução limitada (1,5 no celular); recursos liberados ao recolher; fallback isométrico quando não há WebGL (testado com WebGL desligado); `prefers-reduced-motion` (testado com a emulação ativa: a cena vai direto ao estado final); texto equivalente no SVG e no `aria-label`; foco e setas do teclado na cena; `touch-action: pan-y` (a página continua rolando); barreira de erro que isola o painel; checagem geométrica de sobreposição do botão em 320, 360, 390, 768 e 1440 px.

Medido neste ambiente (Chrome sem GPU, servidor local sem compressão): cena pronta 92 ms depois de montada, com o arquivo do Three em cache; `three.module.js` tem 1,27 MB sem compressão. O custo de rede em produção (com compressão do GitHub Pages) **não foi medido**. **Não foram medidos** Lighthouse, LCP, INP, CLS nem quadros por segundo em dispositivo real.

## Limites da homologação

Testado: Chromium (painel embutido e Chrome DevTools) nas cinco larguras. **Não testado:** Safari/iOS, Firefox, Android real, leitor de tela, teclado virtual real, GPU de celular, rede lenta.

## Revisão editorial (Voz V07)

Ver o relatório de entrega. Locais alterados: `src/live_plan.mjs` (legenda: `ILLUSTRATIVE_LABEL` e `ILLUSTRATIVE_NOTICE`), `src/LivePlan.jsx` (rótulos de estado), `src/phone.mjs` (`PHONE_MESSAGE`), `src/pickers.jsx` (aviso do DF e erro da lista), `src/GlobalApp.jsx` (porte acima do limite).
