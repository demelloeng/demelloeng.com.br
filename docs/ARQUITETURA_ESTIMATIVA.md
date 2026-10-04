# Arquitetura — estimativa comercial de área (ARQ_EST_V1)

Objetivo: transformar o pouco que o cliente sabe — metragem, ambientes ou só o terreno — em uma **primeira orientação útil e uma estimativa comercial de Arquitetura**.
Não é aprovação urbanística, não é potencial construtivo, não consulta legislação, não usa base municipal nem IA.

## Onde entra no pipeline (sem mudar a sequência global)

`situação → serviço → perguntas aplicáveis → resumo → estimativa ou enquadramento → intenção → contato → envio` (inalterada).
A ramificação existe **só** quando: *Arquitetura selecionada* **e** *o cliente declara que não sabe a área desejada do projeto* ("Ainda não sei" em S3).
Nesse caso, entre S3 e S4, aparecem (ambas opcionais): **área do terreno** (`Q_TERR_ARQ`, omitida se Terraplenagem já a perguntou) e **programa de necessidades** (`ARQ_PROG`).

## Hierarquia da área de referência

| # | Origem (`architecture_area_source`) | Quando |
|---|---|---|
| 1 | `USER_DECLARED` | área do projeto informada — usada diretamente, nada é estimado |
| 2 | `NEEDS_PROGRAM_ESTIMATE` | só o programa |
| 3 | `PROGRAM_AND_LOT_ESTIMATE` | programa e terreno |
| 4 | `LOT_ONLY_ESTIMATE` | só o terreno |
| 5 | `HUMAN_REVIEW_REQUIRED` | sem dados suficientes, ou resultado fora da faixa plausível |

## Fórmulas e parâmetros (todos em `src/architecture_config.mjs`, versão `ARQ_EST_V1`; **a validar por Marcos**)

**Programa:** `soma = Σ(quantidade × m² do item)`; `central = soma × (1 + 0,12 + 0,03 × (pavimentos − 1)) × fator do padrão`; faixa `[central × 0,92 ; central × 1,08]` arredondada a 5 m²; referência = ponto médio (5 m²).
m² por item: quarto 10 · suíte 14 (inclui o banheiro dela) · banheiro 3,5 · sala 16 · cozinha 9 · lavanderia 4 · vaga de garagem 12 · escritório 8 · varanda/área gourmet 10. Padrão: compacto 0,90 · confortável 1,00 · amplo 1,15.
Limites de entrada: quartos/suítes/banheiros ≤ 10, garagem ≤ 6, pavimentos 1–4.

**Terreno:** faixa `[terreno × 0,66 ; terreno × 0,69]`, arredondada a 5 m², teto de 600 m²; referência = ponto médio. Terreno aceito de 40 a 5.000 m²; fora disso, conferência humana.

**Programa + terreno:** (a) faixas se sobrepõem → interseção, referência no ponto médio; (b) programa maior do que o terreno sustenta → **não rejeita**: usa a faixa do programa, referência no limite inferior dela e avisa que pode exigir aproveitamento mais intenso; (c) programa menor → usa a faixa do programa.

**Plausibilidade:** referência fora de 20–1.500 m² → conferência humana.

## Preço
O preço inicial da Arquitetura é calculado pelo **mesmo motor e a mesma Tabela DEMELLO V2** (Q_NOVA) sobre a área de referência. Nenhuma fórmula de preço nova.

## Isolamento
A área inferida alimenta **somente** a Arquitetura. Se Estrutural, Fundações, Hidrossanitário, Drenagem ou Incêndio estiverem selecionados, ela **não** entra em `pricing_inputs` (esses serviços seguem sem área e vão para avaliação); a devolutiva mostra, ainda assim, o preço inicial só da Arquitetura. Uma área que o cliente **informou** (S3) continua valendo para todos, como antes.

## Devolutiva (nunca só um número)
Seu ponto de partida (terreno, faixa, referência, preço inicial de Arquitetura) · explicação curta ("Por que a construção não ocupa todo o terreno?" / "O que pesa nesse número?") · ressalva técnica · próximo passo. Textos em `src/architecture_return.mjs`; os testes proíbem afirmações do tipo "você pode construir X m²", "área permitida", "potencial construtivo legal", "a prefeitura autoriza", "consultamos o código de obras", "metragem aprovada".

## Campos do payload V2 (em `answers`, apenas dados estruturados)
`architecture_area_source` · `architecture_area_min` · `architecture_area_max` · `architecture_area_reference` · `architecture_estimation_inputs` (`area_declarada_m2`, `terreno_m2`, `programa{quartos,suites,banheiros,garagem,pavimentos,padrao,sala,cozinha,lavanderia,escritorio,varanda}`, `coerencia`, `programa_acima_do_terreno`, `referencia_alimenta_precificacao`) · `architecture_estimation_version`.
Sem texto livre. Contrato Worker/CRM localizado e validado (Marcos): ver `docs/CLASSIFICACAO_WORKER_CRM.md`.

## Exemplos (reproduzidos nos testes)
| Entrada | Saída |
|---|---|
| Área do projeto 200 m² | `USER_DECLARED`, referência 200 m², R$ 5.665,60 |
| Terreno 350 m², sem programa | `LOT_ONLY_ESTIMATE`, faixa 230–240 m², referência 235 m², R$ 6.657,08 |
| Programa: 3 quartos + 1 suíte, 2 banheiros, sala, cozinha, lavanderia, 2 vagas, 1 pavimento, confortável | `NEEDS_PROGRAM_ESTIMATE`, faixa 105–125 m², referência 115 m² |
| O programa acima + terreno 350 m² | `PROGRAM_AND_LOT_ESTIMATE`, programa menor que o terreno → faixa 105–125 m², referência 115 m² |
| Programa grande (5 quartos + 3 suítes, amplo, 2 pavimentos…) + terreno 200 m² | `PROGRAM_AND_LOT_ESTIMATE`, `intense`: referência no limite inferior do programa |
| Nada informado | `HUMAN_REVIEW_REQUIRED`, sem preço |

## Mensuração
Eventos `architecture_*` com parâmetros só em faixas/enums (ver `docs/MENSURACAO_FUNIL.md`). Nunca valores exatos, endereço, nome, contato ou texto livre.
