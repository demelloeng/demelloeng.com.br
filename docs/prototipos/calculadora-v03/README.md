# Protótipo — Calculadora V03: "Planta que se desenha" + "Orçamento em movimento"

**Estado:** PROTOTIPADO. Não publicado, fora da allowlist do Pages (`.github/pages/allowlist.txt`), sem efeito sobre a calculadora ativa.
Abra `index.html` direto no navegador (ou por um servidor estático na raiz do repositório, por causa da fonte). Arquivo único, sem dependência
externa e sem rede.

A aprovação dos cinco pacotes **não substitui o aceite visual específico** deste protótipo. Nada aqui entra na interface ativa antes desse aceite.

## O que mostra (três estados, botões "1 Entrada / 2 Jornada / 3 Resultado" no topo)

1. **Entrada.** Prancha vazia (lote tracejado, norte, grade) e as quatro situações. Escolher uma situação preenche o carimbo.
2. **Jornada.** Três perguntas, cada uma com resposta visual imediata:
   - **Área** (campo e controle deslizante): a planta redesenha a pegada da edificação e o rótulo "120 m² · 2 pavimentos";
   - **Pavimentos** (− / +): o corte ganha ou perde uma laje;
   - **Projetos** (marcar): cada disciplina liga uma camada na planta e no corte (estrutura = pilares; hidrossanitário = tubulação; incêndio = hidrante;
     gás = ramal tracejado; elétrica = circuito pontilhado). A cor só existe dentro do desenho, como convenção.
3. **Resultado.** "Orçamento em movimento": o total e as barras por serviço crescem com a formação da estimativa; cada linha diz a base de cálculo.
   A caixa "Mostrar o caso sem valor automático" mostra o outro desfecho (título "Já conseguimos organizar seu caso.", nenhuma promessa de valor).
   Marcar **Projeto Elétrico** leva o conjunto a esse desfecho, como a calculadora real faz enquanto a referência AltoQi não está documentada.

## Limites (leia antes de avaliar)

- **Os valores são de exemplo** (múltiplos redondos e inventados, avisados na tela). O protótipo **não calcula estimativa** e não usa a Tabela DEMELLO V2.
- O desenho é **esquema ilustrativo, sem escala de projeto**; a escala é a de um lote de exemplo e a legenda diz isso. Não é desenho técnico nem avaliação.
- Não envia nada, não guarda nada, não carrega nada de fora.

## Como a versão real ligaria ao que já existe (preparado, não feito)

| Elemento do protótipo | Dado real | Onde está hoje |
|---|---|---|
| Rótulo de área e pegada | `answers.CA_AREA`, `S3`, `CA_EXISTING + CA_NEW` | `journey.mjs`, `payload_v2.mjs` |
| Pavimentos no corte | `answers.CA5` | `journey.mjs` |
| Camadas por disciplina | `pricing_inputs.services` | `payload_v2.mjs` (`derivePricingInputs`) |
| Linhas do "orçamento em movimento" | `pricing_preview.services[]` (`q`, `q_basis`, `demello.total`) | `payload_v2.mjs` + `pricing/engine.mjs` |
| Desfecho sem valor | `pricing_preview.status` e `advanceJourney` | `funnel.mjs` (P01) |
| Carimbo | `summary(answers)` | `journey.mjs` |

A implementação definitiva seria um componente de desenho em SVG que lê o estado já existente (sem novo estado, sem novo motor, sem biblioteca de 3D) e
substitui apenas a coluna do resumo e a tela de resultado. O histórico do navegador, a validação, o município e o contato (P01 e P02) são independentes dele.

## Critérios de aceite do protótipo

| Critério | Como verificar |
|---|---|
| Três estados representativos | Botões do topo |
| Larguras 320, 360, 390, 768 e 1440 px, sem rolagem horizontal | Redimensionar; `document.documentElement.scrollWidth` igual à largura |
| Nada encoberto | Em 320 × 568 só o desenho fica fixo; os botões ficam alcançáveis rolando |
| Movimento com função | Toda transição dura no máximo 0,6 s e responde a uma escolha; nada anima sozinho |
| Movimento reduzido | Com `prefers-reduced-motion: reduce` não há transição nem contagem animada |
| Teclado | Tudo por Tab, Enter, espaço e setas; foco visível; o título recebe o foco a cada passo |
| Texto equivalente | O desenho muda o `title` com área, pavimentos e camadas |
| Sem desenho como projeto real | Legenda fixa "Esquema ilustrativo, sem escala de projeto" |

## Riscos conhecidos

- O desenho pode ser lido como projeto: mitigado pela legenda; decidir no aceite se a legenda aparece também no resultado impresso/baixado.
- Em tela muito baixa o desenho ocupa cerca de um quarto da altura; o carimbo some nessa faixa.
- Só cinco disciplinas têm camada; arquitetura, compatibilização, orçamento e terraplanagem ainda não têm representação.

## Implementação real (07/11/2026) e homologação

O desenho deixou de ser só protótipo: `orcamento-src/src/live_plan.mjs` (modelo puro, testado em `tests/p05_planta_orcamento.test.mjs`) e `LivePlan.jsx` entram no painel "Seu caso" da calculadora real, com os dados do motor
(`pricing_inputs` e `pricing_preview`); nada é inventado e o total só aparece quando o motor calculou todos os serviços. O desenho é sempre ilustrativo (aviso fixo no painel). Estados: sem preço, com preço e acima do limite da estimativa automática.
No celular o painel recolhido mostra uma linha com a estimativa; expandido mostra o desenho, a legenda e os valores.

Evidências visuais (capturas do navegador embutido, servidor local, dados fictícios): `evidencias-p05/` — 1440 sem preço, com preço e acima do limite; 768, 390, 360 e 320 com preço, painel expandido.

### Homologação do P04 (WhatsApp flutuante e badge do Simple Analytics)

| Ambiente | Resultado |
|---|---|
| Navegador embutido do aplicativo (Chromium), 320, 360, 390, 768 e 1440 px | Sem rolagem horizontal; botão fora do "Continuar"; recolhido no celular o botão não cobre o resumo. Com o painel expandido em tela baixa o botão passa ao modo translúcido previsto (`dm-fab--evitar`) e pode ficar sobre a última linha da lista |
| Defeito reproduzido e corrigido | O total do orçamento ficava coberto pelo botão: o total foi para o topo do painel e o script passou a evitar elementos marcados com `data-fab-evitar` |
| NÃO testado | Safari/iOS, Firefox, Chrome no Android real, leitor de tela, teclado virtual real de celular, `prefers-reduced-motion` ativado no sistema (só conferido no CSS) |
