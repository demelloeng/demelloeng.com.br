# Arquitetura comercial do site — mapa, deep links e terminologia

Lógica principal: **situação do cliente → orientação → estimativa → prova → proposta.** A estimativa é o principal mecanismo de aquisição; WhatsApp e Contato permanecem acessíveis, porém secundários.

## 1. Mapa de páginas

| Intenção | Página (URL) | CTA principal | Destino do CTA |
|---|---|---|---|
| Vai construir/ampliar? | `/` (home) | Calcular minha estimativa | `/orcamento/?situacao=build` |
| Construir casa / ampliar / reformar | `/construir-ou-ampliar/` *(nova)* | Calcular minha estimativa | `/orcamento/?situacao=build` |
| Fissura, dúvida técnica, alteração, problema na obra | `/avaliar-um-problema/` *(nova)* | Descrever meu caso | `/orcamento/?situacao=problem` |
| Já sei o serviço | `/servicos/` — **Outros serviços** | Calcular estimativa do serviço que procuro | `/orcamento/?situacao=known` |
| Cada disciplina | `/servicos/<slug>/` (9 páginas) | CTA específico (§2) | `/orcamento/?situacao=known&servico=<id>` ou `?situacao=regularize` |
| Como será trabalhar com a DEMELLO? | `/metodologia/` — **Como trabalhamos** (URL antiga preservada) | Calcular minha estimativa | `/orcamento/` |
| Já resolveram algo comparável? | `/experiencia-tecnica/` — **Experiência** | Calcular minha estimativa | `/orcamento/` |
| Apoio técnico por hora | link secundário na home e em Outros serviços | — | `/orcamento/?situacao=support` |
| Falar direto | `/contato/` + faixa superior (desktop) / menu (móvel) | WhatsApp | `https://wa.me/5541985124056` |
| Empresa / responsável técnico | `/empresa/` (fora da navegação principal; no rodapé e em *Como trabalhamos*) | — | — |

Navegação principal: **Início · Construir ou ampliar · Outros serviços · Experiência · Como trabalhamos · Calcular estimativa** (CTA persistente). *Contato* e *WhatsApp* ficam na faixa superior e, no móvel, dentro do menu. Nenhuma URL antiga foi removida ou redirecionada.

## 2. Deep links por disciplina (`src/deeplink.mjs`)

`/orcamento/?situacao=known&servico=<id>` — `servico` só vale com `situacao=known`. Lista **fechada**; qualquer outro valor (vazio, maiúsculas, espaços, `__proto__`, vários valores, texto longo…) é ignorado e a jornada abre em "Já sei o serviço" **sem nenhuma seleção**. Nada vindo da URL é gravado nas respostas.

| `servico` | Página | Efeito na jornada | CTA da página |
|---|---|---|---|
| `estrutural` | Projeto estrutural | S1 com "Estrutural" marcado | Ver uma estimativa para meu projeto |
| `hidrossanitario` | Projeto hidrossanitário | S1 com "Hidrossanitário" | Calcular estimativa do meu projeto |
| `incendio` | Prevenção contra incêndio | S1 com "Incêndio" | Avaliar meu projeto |
| `gas-glp` | Projeto de gás / GLP | S1 com "Gás" | Avaliar meu projeto |
| `compatibilizacao` | Compatibilização BIM | S1 com "Compatibilização BIM" | Avaliar a compatibilização do meu projeto |
| `arquitetura` | Projeto de arquitetura | S1 com "Arquitetura" marcada (serviço nativo, base Q_NOVA) | Descrever meu projeto de arquitetura |
| `orcamento-tecnico` | Orçamento técnico | S1 com "Orçamento técnico" marcado (nativo, base Q_ESCOPO) | Descrever o orçamento que preciso |
| `terraplenagem` | Projeto de terraplenagem | S1 com "Terraplenagem" marcada (nativa, base Q_TERRENO) | Descrever meu projeto de terraplenagem |
| `regularizacao` | Regularização | abre a rota `regularize` | Entender o que meu imóvel precisa (usa `?situacao=regularize`) |

Arquitetura (`ARQUITETURA`, Q_NOVA), Orçamento técnico (`ORCAMENTO`, Q_ESCOPO) e Terraplenagem (`TERRAPLENAGEM`, Q_TERRENO) são **serviços nativos e precificáveis** da TABELA DEMELLO V2: aparecem em S1, nenhum usa "Outro" e a disciplina segue nos eventos. Perguntas condicionais: Orçamento técnico → área abrangida; Terraplenagem → área do terreno (nunca convertida de outra área). `servico` repetido na URL (ou `situacao` repetido) é inválido e abre em estado seguro.

**Arquitetura sem área do projeto** (ramificação condicional dentro da jornada atual, detalhes em `docs/ARQUITETURA_ESTIMATIVA.md`): se a área pretendida é conhecida, ela é a Q_NOVA e nada é estimado. Se é desconhecida, o cliente informa o terreno e/ou o programa de necessidades e o site converte o que ele sabe em uma **área de referência para o orçamento** (faixa aproximada + referência), com origem registrada em `answers.architecture_area_source`. Sem nada disso, conferência humana. Nenhuma base municipal, legislação ou consulta externa participa da estimativa.

**Reforma sem aumento de área** é a 3ª opção de "O que você vai fazer?": só a área existente é perguntada, nenhuma área nova é presumida e o motor decide se há dados suficientes.

## 3. Fluxo da estimativa (o que mudou e o que não mudou)

Preservado: cinco rotas, perguntas condicionais, motor determinístico (`src/pricing/`, texto de paridade com o motor Python), resumo editável, resultado antes do contato, retenção por sinal de risco, envio ao CRM com retentativa, tratamento de falha, geração/verificação da prévia.

Novo, depois do resultado (o contato só existe depois dele):

- estimativa calculada → **Quero receber uma proposta** (principal) · **Tenho uma dúvida sobre o escopo**;
- sem valor (avaliação humana ou sinal de risco) → **Enviar meu caso para avaliação**.

Só então aparece o formulário de contato (nó `X4`), com título e botão conforme a escolha. O envio fica bloqueado sem uma escolha coerente com o resultado entregue.

## 4. Terminologia

| Termo | Significa | Onde |
|---|---|---|
| **Estimativa** (inicial) | Valor calculado na própria página pela **TABELA DEMELLO V2** a partir das respostas. Não é proposta, contrato nem garantia de preço. Termo da oferta e do CTA ("Calcular estimativa"). | Todas as páginas, UI do `/orcamento/`, resumo baixável |
| **Prévia** | Documento **verificável** com código, emitido a partir da estimativa (botão "Gerar prévia DEMELLO", página `/verificar/`). Opcional. | `/orcamento/`, `/verificar/` |
| **Proposta** | Documento comercial da DEMELLO, emitido **depois** da confirmação do escopo pela equipe. | Pedido via "Quero receber uma proposta" |
| **Orçamento técnico** | **Serviço** profissional contratado (planilha orçamentária, cronograma). Não é a estimativa. | `/servicos/orcamento-tecnico/` |
| **Orçamento de obra** | Custo de execução da obra. A DEMELLO não executa obra e a estimativa não o representa. | — |
| **Previsão** | Legado. Permanece **somente** (a) no texto do motor de preços (`nossa previsão inicial é de R$…`), mantido por paridade com o motor Python/Worker — a interface o exibe como "nossa estimativa inicial" por substituição de apresentação; (b) no rótulo da imagem da prévia verificável (`preview_png.mjs`). Não usar em texto novo. | motor, PNG da prévia |
| **/orcamento/** | Apenas a URL (legada, preservada). | — |

Versão vigente da tabela: **V2** (`table_version = DEMELLO_V2`). O rótulo exibido vem de `src/labels.mjs` (derivado da própria tabela), e o número de entradas por extenso ("cinco") vem de `Object.keys(routes).length`.
