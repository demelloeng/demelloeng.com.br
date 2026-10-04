// Arquitetura comercial do /orcamento/: deep links por situação e por disciplina, valores inválidos em estado seguro,
// contato SOMENTE depois do resultado, dados diferenciados (estimativa / proposta / dúvida / avaliação),
// consistência "cinco entradas" e versão vigente da tabela.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { SERVICE_DEEPLINKS, routeFromSearch, serviceFromSearch, initialState, deeplinkInfo, effectiveRoute } from '../src/deeplink.mjs';
import { routes, starts, nodes, valid, advance, updateAnswer, titleOf, FUNNEL_KEYS, needsReview } from '../src/journey.mjs';
import { packageForCRMv2 } from '../src/payload_v2.mjs';
import { resultKind, allowedIntents, isIntentAllowed, estimateState, canSend, LEAD_STAGE, INTENT_LABEL, evaluateQualifiedLead, REQUEST_INTENTS } from '../src/funnel.mjs';
import { TABLE_LABEL, ENTRY_COUNT, ENTRY_COUNT_WORD } from '../src/labels.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const readSrc = (p) => readFile(path.join(appRoot, 'src', p), 'utf8');
const LOC = { city: 'Curitiba', uf: 'PR' };

// ---------------------------------------------------------------------------------------------------------------------
// Deep links por SITUAÇÃO
// ---------------------------------------------------------------------------------------------------------------------
test('deep link por situação: as cinco rotas abrem no primeiro nó, com Voltar para a escolha de situação', () => {
  assert.equal(ENTRY_COUNT, 5);
  for (const route of Object.keys(routes)) {
    const s = initialState(`?situacao=${route}`);
    assert.equal(s.id, starts[route], route);
    assert.equal(s.answers.route, route);
    assert.deepEqual(s.history, ['HOME']);
    assert.equal(deeplinkInfo(`?situacao=${route}`).route, route);
    assert.equal(deeplinkInfo(`?situacao=${route}`).service, null, 'sem disciplina quando não pedida');
  }
});

test('deep link por situação: valores inválidos caem no HOME, sem estado parcial', () => {
  const bad = ['', '?', '?situacao=', '?situacao=BUILD', '?situacao=Build', '?situacao=construir', '?situacao=build%20', '?situacao=%00',
    '?situacao=__proto__', '?situacao=constructor', '?situacao=toString', '?situacao=hasOwnProperty', '?situacao=build,known',
    '?situacao=<script>alert(1)</script>', '?situacao=' + 'a'.repeat(5000), '?x=build', '?servico=estrutural', 'situacao=build'.replace('s', 'x')];
  for (const q of bad) {
    assert.equal(routeFromSearch(q), null, q.slice(0, 40));
    assert.deepEqual(initialState(q), { id: 'HOME', answers: {}, history: [] }, q.slice(0, 40));
    assert.equal(deeplinkInfo(q), null, q.slice(0, 40));
  }
  assert.equal(routeFromSearch(undefined), null);
  assert.equal(routeFromSearch(null), null);
});

// ---------------------------------------------------------------------------------------------------------------------
// Deep links por DISCIPLINA (nove frentes)
// ---------------------------------------------------------------------------------------------------------------------
test('deep link por disciplina: as nove frentes têm entrada explícita e testada', () => {
  assert.deepEqual(Object.keys(SERVICE_DEEPLINKS).sort(), [
    'arquitetura', 'compatibilizacao', 'estrutural', 'gas-glp', 'hidrossanitario', 'incendio', 'orcamento-tecnico', 'regularizacao', 'terraplenagem',
  ]);
  const EXPECT = {
    estrutural: { id: 'S1', route: 'known', services: ['Estrutural'] },
    hidrossanitario: { id: 'S1', route: 'known', services: ['Hidrossanitário'] },
    incendio: { id: 'S1', route: 'known', services: ['Incêndio'] },
    'gas-glp': { id: 'S1', route: 'known', services: ['Gás'] },
    compatibilizacao: { id: 'S1', route: 'known', services: ['Compatibilização BIM'] },
    arquitetura: { id: 'S1', route: 'known', services: ['Arquitetura'] },
    'orcamento-tecnico': { id: 'S1', route: 'known', services: ['Orçamento técnico'] },
    terraplenagem: { id: 'S1', route: 'known', services: ['Terraplenagem'] },
    regularizacao: { id: 'REG_R1', route: 'regularize' },
  };
  for (const [servico, exp] of Object.entries(EXPECT)) {
    const q = `?situacao=known&servico=${servico}`;
    const s = initialState(q);
    assert.equal(s.id, exp.id, servico);
    assert.equal(s.answers.route, exp.route, servico);
    assert.deepEqual(s.answers.services, exp.services, servico);
    assert.equal(s.answers.otherService, undefined, `${servico}: nunca usa Outro/otherService`);
    assert.ok(!(s.answers.services ?? []).includes('Outro'), `${servico}: sem Outro`);
    assert.deepEqual(s.history, ['HOME']);
    assert.equal(serviceFromSearch(q), servico);
    assert.equal(effectiveRoute(q), exp.route);
    // nada além do esperado entra nas respostas
    assert.deepEqual(Object.keys(s.answers).sort(), ['route', ...(exp.services ? ['services'] : [])].sort(), servico);
  }
});

test('deep link por disciplina: a seleção é VÁLIDA para a opção real de S1 e segue o fluxo normal', () => {
  for (const servico of ['estrutural', 'hidrossanitario', 'incendio', 'gas-glp', 'compatibilizacao', 'arquitetura', 'orcamento-tecnico', 'terraplenagem']) {
    const s = initialState(`?situacao=known&servico=${servico}`);
    assert.equal(valid('S1', s.answers), true, `${servico}: S1 válido sem digitar nada`);
    const values = nodes.S1.options.map((o) => o.value);
    for (const v of s.answers.services) assert.ok(values.includes(v), `${servico}: "${v}" existe em S1`);
  }
  // Estrutural/Hidrossanitário/Incêndio/Gás/Compatibilização chegam a S2 (empreendimento) ao continuar
  const next = advance('S1', initialState('?situacao=known&servico=incendio').answers, 'preview');
  assert.equal(next.id, 'S2');
});

test('deep link por disciplina: valores inválidos/desconhecidos caem em estado seguro, SEM seleção indevida', () => {
  const bad = ['', 'ESTRUTURAL', 'Estrutural', ' estrutural', 'estrutural ', 'estrutural%20', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf',
    'estrutural,incendio', 'estrutural;incendio', 'eletrica', 'fundacoes', 'projeto-estrutural', '%00', '../estrutural', '<script>', "'; DROP TABLE x;--", 'a'.repeat(10000), 'null', 'undefined', '0', '[]', '{}'];
  for (const value of bad) {
    const q = `?situacao=known&servico=${value}`;
    assert.equal(serviceFromSearch(q), null, value.slice(0, 30));
    assert.deepEqual(initialState(q), { id: 'S1', answers: { route: 'known' }, history: ['HOME'] }, `sem seleção: ${value.slice(0, 30)}`);
    assert.equal(deeplinkInfo(q).service, null);
    assert.equal(valid('S1', initialState(q).answers), false, 'S1 continua exigindo escolha');
  }
});

test('deep link por disciplina: servico só vale com situacao=known; ordem dos parâmetros não importa', () => {
  for (const sit of ['build', 'regularize', 'problem', 'support']) {
    const s = initialState(`?situacao=${sit}&servico=estrutural`);
    assert.equal(s.id, starts[sit]);
    assert.equal(s.answers.services, undefined, `${sit}: ignora servico`);
    assert.equal(serviceFromSearch(`?situacao=${sit}&servico=estrutural`), null);
  }
  assert.equal(initialState('?servico=estrutural').id, 'HOME');
  assert.deepEqual(initialState('?servico=estrutural&situacao=known').answers.services, ['Estrutural'], 'ordem dos parâmetros não importa');
});

test('deep link: nada vindo da URL é gravado nas respostas (apenas valores controlados da tabela)', async () => {
  const hostile = '?situacao=known&servico=estrutural&foo=<img src=x>&answers=%7B%22route%22:%22build%22%7D&otherService=hack&services=Gás';
  const s = initialState(hostile);
  assert.deepEqual(s.answers, { route: 'known', services: ['Estrutural'] });
  const src = await readFile(path.join(appRoot, 'src', 'deeplink.mjs'), 'utf8');
  assert.doesNotMatch(src, /answers\.\w+\s*=\s*(?:new URLSearchParams|params|search)/, 'sem atribuição direta da query');
  assert.ok(Object.isFrozen(SERVICE_DEEPLINKS), 'tabela congelada');
});

// ---------------------------------------------------------------------------------------------------------------------
// Resultado antes do contato; escolhas pós-resultado; dados diferenciados
// ---------------------------------------------------------------------------------------------------------------------
const calculable = () => ({
  route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '120' }, property: 'Casa/sobrado', location: LOC,
  phase: 'Arquitetura pronta', CA5: { value: '1' }, CA6: 'Médio', services: ['Estrutural'], deadline: 'Ainda sem prazo',
});
const problemCase = () => ({ route: 'problem', P1: 'Apareceu algo no imóvel e quero entender o que é', P2: 'Apareceu uma rachadura depois da reforma.', property: 'Casa/sobrado', location: LOC, P5: 'Entender o que está acontecendo' });
const heldCase = () => ({ ...problemCase(), P2: 'A rachadura aumentou de repente e a parede está cedendo.' });

test('resultado: caso calculável oferece PROPOSTA (principal) e DÚVIDA SOBRE O ESCOPO; os demais, só avaliação', () => {
  assert.equal(resultKind(calculable()), 'calculated');
  assert.deepEqual(allowedIntents(calculable()), ['proposal', 'scope_question']);
  assert.equal(INTENT_LABEL.proposal, 'Quero receber uma proposta');
  assert.equal(INTENT_LABEL.scope_question, 'Tenho uma dúvida sobre o escopo');
  assert.equal(resultKind(problemCase()), 'review');
  assert.deepEqual(allowedIntents(problemCase()), ['evaluation_only']);
  assert.equal(resultKind(heldCase()), 'held', 'sinal de risco mantém a retenção');
  assert.deepEqual(allowedIntents(heldCase()), ['evaluation_only']);
  assert.deepEqual(REQUEST_INTENTS, ['proposal', 'scope_question', 'evaluation_only']);
});

test('contato continua POSTERIOR ao resultado: sem escolha pós-resultado não há envio', () => {
  for (const a of [calculable(), problemCase(), heldCase()]) {
    assert.equal(canSend(a), false, 'sem request_intent não se envia');
    assert.equal(canSend({ ...a, request_intent: 'inexistente' }), false);
  }
  // intenção incoerente com o resultado entregue é recusada
  assert.equal(isIntentAllowed(problemCase(), 'proposal'), false, 'sem estimativa não se pede proposta');
  assert.equal(isIntentAllowed(heldCase(), 'scope_question'), false);
  assert.equal(isIntentAllowed(calculable(), 'evaluation_only'), false);
  assert.equal(canSend({ ...calculable(), request_intent: 'proposal' }), true);
  assert.equal(canSend({ ...calculable(), request_intent: 'scope_question' }), false, 'dúvida sobre o escopo exige a dúvida escrita');
  assert.equal(canSend({ ...calculable(), request_intent: 'scope_question', scope_question: 'Inclui a fundação?' }), true);
  assert.equal(canSend({ ...problemCase(), request_intent: 'evaluation_only' }), true);
});

test('contato continua POSTERIOR ao resultado: a ordem dos nós e o código da interface', async () => {
  // a jornada só chega ao contato (X4) depois de X1 (resumo) e do resultado (X3A/X3B)
  const a = calculable();
  assert.equal(advance('X1', a, 'preview').id, 'X3A');
  assert.equal(advance('X3A', a, 'preview').id, 'X4');
  assert.equal(nodes.X4.type, 'contact');
  for (const id of ['CA1', 'CA_AREA', 'CA2', 'CA3', 'CA4', 'CA5', 'CA6', 'CA7', 'CA8', 'X1', 'X3A', 'X3B']) assert.notEqual(nodes[id].type, 'contact', id);

  const app = await readSrc('GlobalApp.jsx');
  // 1) campos de contato só são renderizados no nó X4
  const contactBlocks = [...app.matchAll(/\{id==='X4'&&!submitted&&<>/g)];
  assert.equal(contactBlocks.length, 1, 'formulário de contato exclusivo de X4');
  assert.match(app, /\[\['name','Nome','text'\],\['whatsapp','WhatsApp','tel'\],\['email','E-mail','email'\]\]/);
  // 2) o resultado não avança por "Continuar": só pelas escolhas pós-resultado
  assert.match(app, /resultStep\?<div className="intent-actions"/);
  assert.match(app, /&&!id\.startsWith\('X3'\)/, 'canContinue é falso nos resultados');
  assert.match(app, /function chooseIntent\(intent\)\{if\(!resultStep\|\|!isIntentAllowed\(answers,intent,mode\)\)return;/);
  // 3) envio ao CRM: uma única chamada, dentro de sendCase, e só a partir de X4
  assert.equal([...app.matchAll(/submitToCRM\(/g)].length, 1);
  assert.match(app, /if\(id==='X4'\)\{if\(sendState==='sending'\)return;/);
  assert.equal([...app.matchAll(/sendCase\(/g)].length, 3, 'definição + envio em X4 + nova tentativa em X4');
  // 4) enviar exige intenção coerente
  assert.match(app, /canContinue=valid\(id,answers\)&&\(id!=='X4'\|\|canSend\(answers,mode\)\)/);
});

test('dados: estimativa concluída / proposta solicitada / dúvida sobre escopo / caso só para avaliação são estados distintos', () => {
  assert.deepEqual(LEAD_STAGE, { proposal: 'proposta_solicitada', scope_question: 'duvida_sobre_escopo', evaluation_only: 'caso_para_avaliacao' });
  assert.equal(new Set(Object.values(LEAD_STAGE)).size, 3);
  assert.equal(estimateState(calculable()), 'completed');
  assert.equal(estimateState(problemCase()), 'not_available');
  assert.equal(estimateState(heldCase()), 'not_available');
  for (const intent of ['proposal', 'scope_question']) {
    const a = { ...calculable(), request_intent: intent, estimate_state: 'completed', lead_stage: LEAD_STAGE[intent], contact: { name: 'Fulana de Tal', whatsapp: '41999990000', email: '' } };
    const p = packageForCRMv2(a);
    assert.equal(p.answers.request_intent, intent);
    assert.equal(p.answers.estimate_state, 'completed');
    assert.equal(p.answers.lead_stage, LEAD_STAGE[intent]);
    assert.equal(p.sent_to_crm, false);
    assert.equal(p.schema, 'site-intake/payload/2');
    assert.equal(p.pricing_preview.status, 'CALCULATED', 'a estimativa não muda por causa da intenção');
  }
  const ev = packageForCRMv2({ ...problemCase(), request_intent: 'evaluation_only', estimate_state: 'not_available', lead_stage: LEAD_STAGE.evaluation_only });
  assert.equal(ev.answers.lead_stage, 'caso_para_avaliacao');
  assert.equal(ev.pricing_preview.status !== 'CALCULATED', true);
  // sem escolha pós-resultado o payload fica idêntico ao de antes (nenhuma chave nova)
  const plain = packageForCRMv2(calculable());
  for (const k of FUNNEL_KEYS) assert.equal(Object.hasOwn(plain.answers, k), false, k);
});

test('preço intocado: o motor determinístico dá o mesmo valor com ou sem a escolha pós-resultado', () => {
  const base = packageForCRMv2(calculable()).pricing_preview;
  const withIntent = packageForCRMv2({ ...calculable(), request_intent: 'proposal', estimate_state: 'completed', lead_stage: 'proposta_solicitada' }).pricing_preview;
  assert.deepEqual(withIntent, base);
});

test('a escolha pós-resultado é invalidada por qualquer resposta alterada (e o título do contato acompanha a intenção)', () => {
  const chosen = { ...calculable(), request_intent: 'proposal', estimate_state: 'completed', lead_stage: 'proposta_solicitada' };
  const edited = updateAnswer(chosen, 'CA_AREA', { value: '150' });
  for (const k of FUNNEL_KEYS) assert.equal(edited[k], undefined, `${k} removido ao editar`);
  const contactEdit = updateAnswer(chosen, 'X4', { name: 'Fulana', whatsapp: '', email: 'f@example.invalid' });
  assert.equal(contactEdit.request_intent, 'proposal', 'preencher o contato mantém a escolha');
  assert.equal(titleOf('X4', { request_intent: 'proposal' }), 'Para onde enviamos sua proposta?');
  assert.equal(titleOf('X4', { request_intent: 'scope_question' }), 'Como podemos responder à sua dúvida?');
  assert.equal(titleOf('X4', { request_intent: 'evaluation_only' }), 'Quer receber esta análise?');
  assert.equal(titleOf('X4', {}), 'Quer receber esta análise?');
});

test('lead qualificado só com regra objetiva R1 (envio aceito + proposta + estimativa calculada + sem risco + contato válido)', () => {
  const base = { accepted: true, answers: { ...calculable(), request_intent: 'proposal' }, contactValid: true };
  assert.equal(evaluateQualifiedLead(base), true);
  assert.equal(evaluateQualifiedLead({ ...base, accepted: false }), false, 'CRM não aceitou');
  assert.equal(evaluateQualifiedLead({ ...base, accepted: undefined }), false);
  assert.equal(evaluateQualifiedLead({ ...base, contactValid: false }), false);
  assert.equal(evaluateQualifiedLead({ ...base, answers: { ...base.answers, request_intent: 'scope_question' } }), false, 'dúvida sobre escopo não qualifica');
  assert.equal(evaluateQualifiedLead({ ...base, answers: { ...base.answers, request_intent: undefined } }), false);
  assert.equal(evaluateQualifiedLead({ ...base, answers: { ...problemCase(), request_intent: 'proposal' } }), false, 'sem estimativa calculada');
  assert.equal(evaluateQualifiedLead({ ...base, answers: { ...heldCase(), request_intent: 'proposal' } }), false, 'sinal de risco');
});

// ---------------------------------------------------------------------------------------------------------------------
// Consistência textual: cinco entradas, versão da tabela, terminologia
// ---------------------------------------------------------------------------------------------------------------------
test('"cinco entradas": o texto da interface é derivado da quantidade real de rotas', async () => {
  assert.equal(Object.keys(routes).length, 5);
  assert.equal(ENTRY_COUNT_WORD, 'cinco');
  const app = await readSrc('GlobalApp.jsx');
  assert.match(app, /\{ENTRY_COUNT_WORD\} entradas/);
  assert.doesNotMatch(app, /quatro (entradas|situações|rotas|opções)/i);
});

test('versão vigente da tabela: o rótulo vem da própria tabela e nenhum texto cita V1', async () => {
  const table = JSON.parse(await readSrc('pricing/pricing-table.v2.json'));
  assert.equal(table.table_version, 'DEMELLO_V2');
  assert.equal(TABLE_LABEL, 'TABELA DEMELLO V2');
  const app = await readSrc('GlobalApp.jsx');
  assert.match(app, /\{TABLE_LABEL\}/);
  assert.doesNotMatch(app, /TABELA(?: DEMELLO)? V1/);
  assert.doesNotMatch(app, /TABELA V2/, 'sem rótulo manual divergente');
});

test('terminologia: a interface chama o resultado de ESTIMATIVA; "prévia" só nomeia o documento verificável', async () => {
  const app = await readSrc('GlobalApp.jsx');
  assert.match(app, /ESTIMATIVA INICIAL DEMELLO/);
  assert.match(app, /<span>CALCULAR ESTIMATIVA<\/span>/);
  assert.doesNotMatch(app, /FAÇA SEU ORÇAMENTO|PREVISÃO DEMELLO/);
  assert.match(app, /replace\(\/nossa previsão inicial\/g,'nossa estimativa inicial'\)/);
  assert.doesNotMatch(app, /Primeiro, a prévia|escopo da sua prévia/);
  const summary = await readSrc('client_summary.mjs');
  assert.match(summary, /'ESTIMATIVA INICIAL DEMELLO'/);
  // texto do motor intocado (paridade com o motor Python / Worker)
  const engine = await readSrc('pricing/engine.mjs');
  assert.match(engine, /Pela tabela DEMELLO, nossa previsão inicial é de/);
});
