# Contrato da base municipal urbanística — v1 — **HISTÓRICO (fora do fluxo ativo)**

> **Decisão comercial vigente:** a estimativa inicial da Arquitetura **não depende** de base municipal. Este módulo (`src/municipal/`) não é importado por nenhum arquivo ativo, não controla nem bloqueia o fluxo e fica apenas como registro/compatibilidade. A estimativa vigente está em `docs/ARQUITETURA_ESTIMATIVA.md`. O estudo de legislação, zoneamento, recuos e potencial construtivo acontece depois, na tratativa técnica com o cliente.

**Estado da integração: PONTO DE INTEGRAÇÃO + FAIL-CLOSED. A base municipal canônica NÃO está neste pacote.**
Nenhum município, coeficiente, zona ou fórmula foi inventado ou simulado. `src/municipal/base.v1.json` está **vazio por design**
e `AUTHORIZED_RULES` (`src/municipal/engine.mjs`) está vazio: em produção o mecanismo **nunca devolve área**.

## Quando é acionado (e só então)

Dentro da jornada atual (`situação → serviço → perguntas → resumo → estimativa/enquadramento → intenção → contato → envio`):

1. "Arquitetura" selecionada;
2. área do **terreno** informada pelo usuário;
3. o usuário marcou **"Ainda não sei"** na área do projeto/área construída pretendida.

Área pretendida conhecida → é a Q_NOVA; **nenhuma** consulta. Nenhuma das duas áreas → nada é inventado, não precifica, avaliação humana.
Também não é acionado quando outro serviço que lê a mesma área do projeto (Estrutural, Fundações, Hidrossanitário, Drenagem, Incêndio) está selecionado — a área derivada contaminaria o preço dele.

## Registro (um por município/zona) — campos obrigatórios

`municipio`, `estado`, `legislacao_id`, `versao_vigencia`, `fonte_oficial`, `zona_classificacao`, `coeficiente_aproveitamento`, `taxa_ocupacao`,
`permeabilidade`, `recuos`, `limites_altura_pavimentos`, `condicoes_excecoes`, `data_atualizacao`, `status_completude` (= `COMPLETA`),
`evidencia_origem`, `abrangencia` (= `MUNICIPIO_INTEIRO`, pois a jornada não coleta zoneamento) e `regra_calculo` (id de uma regra **autorizada**).
Opcional: `conflitos[]` (normas em conflito registradas). Cabeçalho da base: `contrato`, `versao`, `atualizada_em`.

## Resultado e estados (todos fail-closed, nomeados)

| status | significado | consequência |
|---|---|---|
| `CALCULATED` | registro completo, regra autorizada, terreno válido | área derivada **preliminar** entra como Q_NOVA, identificada como estimada |
| `BASE_INDISPONIVEL` | município/UF sem registro | avaliação humana |
| `BASE_INCOMPLETA` | campo obrigatório ausente, `status_completude` ≠ COMPLETA, regra que falha | avaliação humana |
| `ZONA_NAO_DETERMINADA` | várias zonas ou abrangência ≠ MUNICIPIO_INTEIRO | avaliação humana |
| `NORMAS_CONFLITANTES` | `conflitos[]` não vazio — nunca se escolhe uma norma em silêncio | avaliação humana |
| `REGRA_NAO_AUTORIZADA` | `regra_calculo` fora de `AUTHORIZED_RULES` | avaliação humana |
| `ENTRADA_INVALIDA` | cidade/UF/terreno inválidos | avaliação humana |

Nunca: média nacional, regra de outro município, parâmetros pedidos a uma IA, metragem como direito adquirido, garantia de aprovação.

## Responsabilidade da IA

Pode: explicar em linguagem simples o resultado **já calculado**, apontar lacunas e conflitos, citar a origem normativa do registro.
Não pode: inventar regra urbanística, substituir o cálculo determinístico, escolher entre normas conflitantes, garantir aprovação.

## Proveniência (sem PII)

`answers.architecture_area = { origin: 'user' | 'municipal_estimate' | 'absent', rule_id, base_version, status }`.
Nunca se grava a área derivada como se fosse digitada: `answers.S3` continua "não sei", `pricing_inputs.area_new` recebe a derivada
somente quando `CALCULATED`, e o resumo mostra uma linha **separada** ("estimada pelo município, preliminar").
Analytics não recebe artigos, textos normativos, endereço, área, regra nem versão da base.

## O que falta para ativar (decisão/insumo humano)

1. Base municipal canônica no formato acima, com fonte oficial, vigência e evidência por registro;
2. regra(s) de cálculo **autorizadas** (id + definição + testes de paridade) registradas em `AUTHORIZED_RULES`;
3. decisão sobre coleta de zoneamento (hoje `abrangencia = MUNICIPIO_INTEIRO`);
4. confirmar com o Worker/CRM a aceitação de `answers.architecture_area` (ver `docs/CLASSIFICACAO_WORKER_CRM.md`).
