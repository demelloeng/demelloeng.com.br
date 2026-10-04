// Serviços nativos (Arquitetura Q_NOVA, Orçamento técnico Q_ESCOPO, Terraplenagem Q_TERRENO), estimativa municipal fail-closed,
// reforma sem aumento de área, parâmetros duplicados, R1 vigente e disciplina preservada no funil.
// Os registros/regras municipais abaixo são FIXTURES DE TESTE (nunca embarcados): servem só para provar o encanamento.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { SERVICE_DEEPLINKS, routeFromSearch, serviceFromSearch, initialState, deeplinkInfo } from '../src/deeplink.mjs';
import { services as SERVICE_OPTIONS, nodes, valid, advance, routeNodes, summary, missingData, updateAnswer, REFORMA, FUNNEL_KEYS } from '../src/journey.mjs';
import { packageForCRMv2, derivePricingInputs } from '../src/payload_v2.mjs';
import { resultKind, allowedIntents, canSend, evaluateQualifiedLead, scopeQuestionError, scopeQuestionValid, SCOPE_QUESTION_MAX } from '../src/funnel.mjs';
import { createTracking, serviceParams } from '../src/tracking.mjs';
import { createTracker } from '../../assets/js/analytics.mjs';
import { buildClientSummary } from '../src/client_summary.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, '..');
const LOC = { city: 'Curitiba', uf: 'PR' };
const known = (svc, extra = {}) => ({ route: 'known', services: svc, S2: 'Casa/sobrado', S3: { value: '200' }, location: LOC, S5: 'Só uma ideia / estudo', S6: 'Ainda sem prazo', ...extra });
const unknownArea = { value: '', unknown: true };
const svcOf = (p, code) => p.pricing_preview.services.find((s) => s.service === code);


// ---------------------------------------------------------------------------------------------------------------------
test('Arquitetura, Orçamento técnico e Terraplenagem são opções NATIVAS de "Já sei o serviço" (nenhuma usa Outro)', () => {
  const values = nodes.S1.options.map((o) => o.value);
  for (const v of ['Arquitetura', 'Orçamento técnico', 'Terraplenagem']) assert.ok(values.includes(v), v);
  assert.ok(SERVICE_OPTIONS.includes('Arquitetura'));
  // motor e analytics
  const codes = { Arquitetura: 'ARQUITETURA', 'Orçamento técnico': 'ORCAMENTO', Terraplenagem: 'TERRAPLENAGEM' };
  for (const [label, code] of Object.entries(codes)) {
    assert.deepEqual(derivePricingInputs(known([label], { area_orcamento: { value: '10' }, area_terreno: { value: '10' } })).services, [code], label);
    assert.equal(serviceParams(known([label])).service, code.toLowerCase(), label);
  }
  // deep links: seleção direta, sem Outro/otherService/texto livre
  for (const [servico, label] of [['arquitetura', 'Arquitetura'], ['orcamento-tecnico', 'Orçamento técnico'], ['terraplenagem', 'Terraplenagem']]) {
    const s = initialState(`?situacao=known&servico=${servico}`);
    assert.deepEqual(s.answers, { route: 'known', services: [label] }, servico);
    assert.equal(valid('S1', s.answers), true);
    assert.equal(SERVICE_DEEPLINKS[servico].otherService, undefined);
    assert.ok(!JSON.stringify(SERVICE_DEEPLINKS[servico]).includes('Outro'));
  }
});

test('bases do motor: Q_NOVA, Q_ESCOPO e Q_TERRENO com os preços da Tabela V2 (fator DEMELLO intocado)', () => {
  const arq = svcOf(packageForCRMv2(known(['Arquitetura'])), 'ARQUITETURA');
  assert.deepEqual([arq.status, arq.q_basis, arq.q], ['CALCULATED', 'Q_NOVA', 200]);
  assert.equal(packageForCRMv2(known(['Arquitetura'])).pricing_preview.total_demello, '5665.60'); // 200 × 35,41 × 0,80
  const orc = packageForCRMv2(known(['Orçamento técnico'], { area_orcamento: { value: '300' } }));
  assert.deepEqual([svcOf(orc, 'ORCAMENTO').q_basis, svcOf(orc, 'ORCAMENTO').q, orc.pricing_preview.total_demello], ['Q_ESCOPO', 300, '1610.40']); // 300 × 6,71 × 0,80
  const ter = packageForCRMv2(known(['Terraplenagem'], { area_terreno: { value: '500' } }));
  assert.deepEqual([svcOf(ter, 'TERRAPLENAGEM').q_basis, svcOf(ter, 'TERRAPLENAGEM').q, ter.pricing_preview.total_demello], ['Q_TERRENO', 500, '144.00']); // 500 × 0,36 × 0,80
});

test('perguntas condicionais dos serviços nativos: Orçamento técnico -> área abrangida; Terraplenagem -> área do terreno', () => {
  assert.deepEqual(routeNodes(known(['Orçamento técnico'])), ['S1', 'Q_ORC', 'S2', 'S3', 'S4', 'S5', 'S6']);
  assert.deepEqual(routeNodes(known(['Terraplenagem'])), ['S1', 'Q_TERR', 'S2', 'S3', 'S4', 'S5', 'S6']);
  assert.equal(nodes.Q_ORC.title, 'Qual a área abrangida pelo orçamento técnico?');
  assert.equal(nodes.Q_TERR.title, 'Qual a área do terreno?');
  assert.equal(advance('S1', known(['Orçamento técnico']), 'preview').id, 'Q_ORC');
  assert.equal(advance('S1', known(['Terraplenagem']), 'preview').id, 'Q_TERR');
  assert.equal(advance('Q_ORC', known(['Orçamento técnico'], { area_orcamento: { value: '300' } }), 'preview').id, 'S2');
  // resumo e rótulos
  const rows = summary(known(['Orçamento técnico', 'Terraplenagem'], { area_orcamento: { value: '300' }, area_terreno: { value: '500' } }));
  assert.ok(rows.some((r) => r.label === 'Área do orçamento técnico' && r.value === '300 m²'));
  assert.ok(rows.some((r) => r.label === 'Área do terreno' && r.value === '500 m²'));
  // desmarcar o serviço apaga a resposta da pergunta condicional
  const cleared = updateAnswer(known(['Orçamento técnico', 'Terraplenagem'], { area_orcamento: { value: '300' }, area_terreno: { value: '500' } }), 'S1', ['Estrutural']);
  assert.equal(cleared.area_orcamento, undefined);
  assert.equal(cleared.area_terreno, undefined);
});

test('Orçamento técnico: sem a área abrangida vai para avaliação; não é confundido com a estimativa do site', () => {
  const sem = packageForCRMv2(known(['Orçamento técnico']));
  assert.equal(sem.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(resultKind(known(['Orçamento técnico'])), 'review');
  assert.equal(derivePricingInputs(known(['Orçamento técnico'])).area_escopo, null);
  assert.equal(derivePricingInputs(known(['Orçamento técnico'], { area_orcamento: { value: '300' } })).area_escopo, '300');
  assert.equal(resultKind(known(['Orçamento técnico'], { area_orcamento: { value: '300' } })), 'calculated');
});

test('Compatibilização + Orçamento técnico compartilham Q_ESCOPO no motor: áreas diferentes => avaliação (nada é escolhido em silêncio)', () => {
  const iguais = packageForCRMv2(known(['Compatibilização BIM', 'Orçamento técnico'], { area_escopo: { value: '300' }, area_orcamento: { value: '300' } }));
  assert.equal(iguais.pricing_preview.status, 'CALCULATED');
  const dif = packageForCRMv2(known(['Compatibilização BIM', 'Orçamento técnico'], { area_escopo: { value: '300' }, area_orcamento: { value: '400' } }));
  assert.equal(dif.pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(derivePricingInputs(known(['Compatibilização BIM', 'Orçamento técnico'], { area_escopo: { value: '300' }, area_orcamento: { value: '400' } })).area_escopo, null);
  // Compatibilização isolada: comportamento anterior preservado
  assert.equal(derivePricingInputs(known(['Compatibilização BIM'], { area_escopo: { value: '300' } })).area_escopo, '300');
});

test('Terraplenagem: só a área do TERRENO vale como Q_TERRENO; nunca área construída, nova, total ou volume', () => {
  const soTotal = known(['Terraplenagem'], { S3: { value: '999' } });
  assert.equal(derivePricingInputs(soTotal).area_terreno, null, 'área total do projeto não vira terreno');
  assert.equal(packageForCRMv2(soTotal).pricing_preview.status, 'NEEDS_HUMAN_REVIEW');
  const build = { route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '120' }, services: ['Terraplenagem'], property: 'Casa/sobrado', location: LOC };
  assert.equal(derivePricingInputs(build).area_terreno, null, 'área nova da rota build não vira terreno');
  const ok = known(['Terraplenagem'], { area_terreno: { value: '500' } });
  assert.equal(derivePricingInputs(ok).area_terreno, '500');
  assert.equal(derivePricingInputs(ok).area_total, '200', 'a área do projeto continua sendo só área do projeto');
  // sem Terraplenagem selecionada o terreno informado não vai para Q_TERRENO
  assert.equal(derivePricingInputs(known(['Arquitetura'], { area_terreno: { value: '500' } })).area_terreno, null);
});

// ---------------------------------------------------------------------------------------------------------------------
// Arquitetura: área pretendida x terreno x município
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// Disciplina no funil; R1
// ---------------------------------------------------------------------------------------------------------------------
function bridge() {
  const t = createTracker({ emitter: 'site' });
  const seen = [];
  t.subscribe((e) => seen.push(e));
  return { seen, tracking: createTracking({ track: t.track, pageView: () => {} }) };
}
const DISC = [
  ['Arquitetura', 'arquitetura', {}],
  ['Orçamento técnico', 'orcamento', { area_orcamento: { value: '300' } }],
  ['Terraplenagem', 'terraplenagem', { area_terreno: { value: '500' } }],
];

test('a disciplina (arquitetura, orcamento, terraplenagem) é preservada em TODOS os eventos do funil', () => {
  for (const [label, code, extra] of DISC) {
    const { seen, tracking } = bridge();
    const a = known([label], extra);
    tracking.situation({ route: 'known', entry: 'deeplink', service: code, step: 'S1' });
    tracking.result(a, 'X3A');
    for (const [i, intent] of ['proposal', 'scope_question'].entries()) {
      tracking.submissionAccepted({ answers: { ...a, request_intent: intent, scope_question: intent === 'scope_question' ? 'Tenho uma dúvida' : undefined }, sendResult: { ok: true, status: 202, submission_id: `${code}-${i}` }, contactValid: true });
    }
    const by = Object.fromEntries(seen.map((e) => [e.name, e]));
    for (const n of ['situation_selected', 'estimate_completed', 'proposal_requested', 'scope_question_requested', 'qualified_lead']) {
      assert.equal(by[n].params.service, code, `${code}: ${n}`);
    }
    assert.equal(seen.filter((e) => e.name === 'qualified_lead').length, 1, 'R1 só no pedido de proposta');
  }
  // caso sem estimativa (arquitetura sem nenhuma área) => framing_delivered + evaluation_requested com a disciplina
  const { seen, tracking } = bridge();
  const a = known(['Arquitetura'], { S3: unknownArea, area_terreno: unknownArea });
  tracking.result(a, 'X3A');
  tracking.submissionAccepted({ answers: { ...a, request_intent: 'evaluation_only' }, sendResult: { ok: true, status: 202, submission_id: 'arq-ev' }, contactValid: true });
  assert.deepEqual(seen.filter((e) => !e.name.startsWith('architecture_')).map((e) => [e.name, e.params.service]), [['framing_delivered', 'arquitetura'], ['evaluation_requested', 'arquitetura']]);
  assert.equal(seen.some((e) => e.name === 'qualified_lead'), false);
});

test('analytics sem query bruta, otherService ou texto livre (dúvida, relato, endereço, área derivada)', () => {
  const { seen, tracking } = bridge();
  const a = {
    ...known(['Arquitetura'], { S3: unknownArea, area_terreno: { value: '300' }, otherService: 'Rua Secreta 123', P2: 'relato sigiloso' }),
    request_intent: 'scope_question', scope_question: 'A prefeitura exige taxa de permeabilidade na Rua Secreta 123?',
  };
  tracking.result(a, 'X3A');
  tracking.submissionAccepted({ answers: a, sendResult: { ok: true, status: 202, submission_id: 'dv-1' }, contactValid: true });
  const blob = JSON.stringify(seen);
  for (const segredo of ['Rua Secreta', 'permeabilidade', 'relato sigiloso', 'Curitiba', '300', 'situacao=', 'servico=']) assert.equal(blob.includes(segredo), false, segredo);
});

test('R1 está APROVADA e vigente: critérios intactos e documentação sem "aguarda aprovação"', async () => {
  const base = { accepted: true, answers: { ...known(['Arquitetura']), request_intent: 'proposal' }, contactValid: true };
  assert.equal(evaluateQualifiedLead(base), true);
  assert.equal(evaluateQualifiedLead({ ...base, accepted: false }), false, '1. CRM aceitou');
  assert.equal(evaluateQualifiedLead({ ...base, answers: { ...base.answers, request_intent: 'scope_question' } }), false, '2. pediu proposta');
  assert.equal(evaluateQualifiedLead({ ...base, answers: { ...known(['Arquitetura'], { S3: unknownArea, area_terreno: unknownArea }), request_intent: 'proposal' } }), false, '3. estimativa calculada e exibida');
  assert.equal(evaluateQualifiedLead({ ...base, answers: { route: 'problem', P2: 'a rachadura aumentou de repente', request_intent: 'proposal' } }), false, '4. sem retenção');
  assert.equal(evaluateQualifiedLead({ ...base, contactValid: false }), false, '5. contato válido');
  const funnel = await readFile(path.join(appRoot, 'src/funnel.mjs'), 'utf8');
  assert.match(funnel, /REGRA COMERCIAL VIGENTE R1 \(aprovada/);
  assert.doesNotMatch(funnel, /proposta de regra|depende de aprovação/i);
  const docs = await readFile(path.join(siteRoot, 'docs/MENSURACAO_FUNIL.md'), 'utf8');
  assert.match(docs, /R1[^\n]*(aprovada|vigente)/i);
  assert.doesNotMatch(docs, /aguarda aprovação|proposta; aguarda|depende de aprovação comercial|proposta técnica, não decisão/i);
});

// ---------------------------------------------------------------------------------------------------------------------
// Dúvida sobre o escopo
// ---------------------------------------------------------------------------------------------------------------------
test('"Qual é a sua dúvida?": validação determinística, limite explícito e envio só com a dúvida válida', () => {
  assert.equal(SCOPE_QUESTION_MAX, 280);
  assert.equal(scopeQuestionError(undefined), 'vazio');
  assert.equal(scopeQuestionError(''), 'vazio');
  assert.equal(scopeQuestionError('    '), 'vazio');
  assert.equal(scopeQuestionError('ab'), 'curto');
  assert.equal(scopeQuestionError('a'.repeat(281)), 'longo');
  assert.equal(scopeQuestionError('a'.repeat(280)), null);
  assert.equal(scopeQuestionError('oi\u0000'), 'caractere_invalido');
  assert.equal(scopeQuestionError('linha 1\nlinha 2'), null);
  assert.equal(scopeQuestionError(12345), 'vazio');
  assert.equal(scopeQuestionValid('A fundação está incluída?'), true);
  const base = { ...known(['Arquitetura']), request_intent: 'scope_question' };
  assert.equal(canSend(base), false);
  assert.equal(canSend({ ...base, scope_question: 'ok' }), false);
  assert.equal(canSend({ ...base, scope_question: 'A fundação está incluída?' }), true);
  // outras intenções não exigem a dúvida
  assert.equal(canSend({ ...known(['Arquitetura']), request_intent: 'proposal' }), true);
});

test('dúvida: chave canônica answers.scope_question; vai ao CRM e ao resumo privado, nunca à URL/analytics/deduplicação', () => {
  const a = { ...known(['Arquitetura']), request_intent: 'scope_question', estimate_state: 'completed', lead_stage: 'duvida_sobre_escopo', scope_question: 'A fundação está incluída?', contact: { name: 'Fulana', whatsapp: '41999990000', email: '' } };
  const p = packageForCRMv2(a);
  assert.equal(p.answers.scope_question, 'A fundação está incluída?');
  assert.match(buildClientSummary(p), /SUA DÚVIDA SOBRE O ESCOPO\nA fundação está incluída\?/);
  assert.ok(FUNNEL_KEYS.includes('scope_question'));
  // a deduplicação do resultado ignora a dúvida (texto livre não participa)
  const { seen, tracking } = bridge();
  tracking.result({ ...a, scope_question: 'primeira versão' }, 'X3A');
  tracking.result({ ...a, scope_question: 'texto totalmente diferente' }, 'X3A');
  assert.equal(seen.filter((e) => e.name === 'estimate_completed').length, 1);
});

test('dúvida: editar respostas anteriores a limpa; preencher o contato não; trocar de intenção limpa; voltar preserva (código da UI)', async () => {
  const a = { ...known(['Arquitetura']), request_intent: 'scope_question', scope_question: 'Minha dúvida' };
  assert.equal(updateAnswer(a, 'S3', { value: '250' }).scope_question, undefined, 'editar resposta anterior invalida a dúvida');
  assert.equal(updateAnswer(a, 'X4', { name: 'Fulana', whatsapp: '', email: 'f@example.invalid' }).scope_question, 'Minha dúvida', 'contato não limpa');
  const app = await readFile(path.join(appRoot, 'src/GlobalApp.jsx'), 'utf8');
  assert.match(app, /if\(answers\.request_intent!==intent\)delete a\.scope_question;/, 'trocar a intenção limpa');
  // voltar: back() só muda o nó/histórico; as respostas (inclusive scope_question) permanecem em `answers`
  assert.match(app, /function back\(\)\{if\(!history\.length\)return;setId\(history\.at\(-1\)\);setHistory\(h=>h\.slice\(0,-1\)\);setSubmitted\(false\);setExpanded\(false\);\}/);
  // acessibilidade e limite explícito
  assert.match(app, /<label className="text-field" htmlFor="scope-question">Qual é a sua dúvida\?<\/label>/);
  assert.match(app, /maxLength=\{SCOPE_QUESTION_MAX\}/);
  assert.match(app, /aria-describedby="scope-question-count scope-question-error"/);
  assert.match(app, /aria-invalid=/);
  assert.match(app, /id="scope-question-error" className="field-error" role="alert"/);
  assert.match(app, /limite de \{SCOPE_QUESTION_MAX\} caracteres/);
  // o texto só sai pelo envio confirmado (X4): nenhuma outra chamada de rede
  assert.equal([...app.matchAll(/submitToCRM\(/g)].length, 1);
});

// ---------------------------------------------------------------------------------------------------------------------
// Reforma sem aumento de área
// ---------------------------------------------------------------------------------------------------------------------
const reforma = (svc, extra = {}) => ({ route: 'build', CA1: REFORMA, CA_REFORMA: { value: '100' }, property: 'Casa/sobrado', location: LOC, phase: 'Arquitetura pronta', CA5: { value: '1' }, CA6: 'Médio', services: svc, deadline: 'Ainda sem prazo', ...extra });

test('reforma sem aumento de área: quarta opção de CA1, só pergunta a área existente, sem "quanto ampliar"', () => {
  assert.deepEqual(nodes.CA1.options.map((o) => o.value), ['Construir do zero', 'Ampliar um imóvel existente', 'Reformar sem aumentar a área', 'Ainda estou definindo']);
  assert.equal(REFORMA, 'Reformar sem aumentar a área');
  assert.equal(advance('CA1', { route: 'build', CA1: REFORMA }, 'preview').id, 'CA_REFORMA');
  assert.equal(advance('CA_REFORMA', { ...reforma(['Incêndio']), property: undefined }, 'preview').id, 'CA2');
  const path1 = routeNodes(reforma(['Incêndio']));
  assert.deepEqual(path1.slice(0, 3), ['CA1', 'CA_REFORMA', 'CA2']);
  assert.ok(!path1.includes('CA_NEW') && !path1.includes('CA_EXISTING') && !path1.includes('CA_AREA'));
  assert.equal(nodes.CA_REFORMA.title, 'Qual a área do imóvel a reformar?');
  // as outras três opções seguem o caminho de antes
  assert.equal(advance('CA1', { route: 'build', CA1: 'Construir do zero' }, 'preview').id, 'CA_AREA');
  assert.equal(advance('CA1', { route: 'build', CA1: 'Ampliar um imóvel existente' }, 'preview').id, 'CA_EXISTING');
  assert.equal(advance('CA1', { route: 'build', CA1: 'Ainda estou definindo' }, 'preview').id, 'CA2');
  // trocar a opção apaga a área da reforma
  assert.equal(updateAnswer(reforma(['Incêndio']), 'CA1', 'Construir do zero').CA_REFORMA, undefined);
});

test('reforma sem aumento: não inventa área nova nem reaproveita a existente como ampliada; só calcula quando o motor tem dados', () => {
  for (const svc of [['Estrutural'], ['Hidrossanitário'], ['Incêndio']]) {
    const inputs = derivePricingInputs(reforma(svc));
    assert.deepEqual([inputs.area_existing, inputs.area_new, inputs.area_total], ['100', null, null], svc.join());
  }
  // faltam dados => avaliação humana (Q_NOVA/Q_SUPERESTRUTURA não se satisfazem só com a área existente)
  assert.equal(resultKind(reforma(['Estrutural'])), 'review');
  assert.equal(resultKind(reforma(['Hidrossanitário'])), 'review');
  assert.deepEqual(allowedIntents(reforma(['Estrutural'])), ['evaluation_only']);
  // Incêndio usa Q_TOTAL: o próprio motor tem dado suficiente (área existente) e calcula
  assert.equal(packageForCRMv2(reforma(['Incêndio'])).pricing_preview.status, 'CALCULATED');
  // continua sendo a rota build, nunca redirecionada para "problem"
  assert.equal(packageForCRMv2(reforma(['Incêndio'])).route, 'build');
  assert.equal(reforma(['Incêndio']).route, 'build');
  assert.ok(missingData(reforma(['Estrutural'])).includes('Dados suficientes para calcular a reforma sem aumento de área'));
  const rows = summary(reforma(['Incêndio']));
  assert.ok(rows.some((r) => r.label === 'Área a reformar' && r.value === '100 m²'));
  assert.ok(!rows.some((r) => /ampliar|Área nova/i.test(r.label)));
  // "problem" segue sendo para manifestações, dúvidas e viabilidade de alterações
  assert.equal(initialState('?situacao=problem').id, 'P1');
});

// ---------------------------------------------------------------------------------------------------------------------
// Parâmetros duplicados: fail-closed
// ---------------------------------------------------------------------------------------------------------------------
test('parâmetros duplicados (iguais, diferentes, válidos, inválidos, hostis) => estado seguro, sem erro e sem seleção', () => {
  const HOME = { id: 'HOME', answers: {}, history: [] };
  for (const q of [
    '?situacao=build&situacao=build', '?situacao=build&situacao=known', '?situacao=build&situacao=zzz', '?situacao=zzz&situacao=build',
    '?situacao=known&situacao=known&servico=estrutural', '?situacao=build&situacao=<script>', '?situacao=build&situacao=', '?situacao=&situacao=build',
    '?situacao=__proto__&situacao=build', '?situacao=build&SITUACAO=known&situacao=known',
  ]) {
    assert.doesNotThrow(() => initialState(q), q);
    assert.deepEqual(initialState(q), HOME, q);
    assert.equal(routeFromSearch(q), null, q);
    assert.equal(deeplinkInfo(q), null, q);
  }
  const SEM_SELECAO = { id: 'S1', answers: { route: 'known' }, history: ['HOME'] };
  for (const q of [
    '?situacao=known&servico=estrutural&servico=estrutural', '?situacao=known&servico=estrutural&servico=incendio', '?situacao=known&servico=foo&servico=estrutural',
    '?situacao=known&servico=estrutural&servico=foo', '?situacao=known&servico=&servico=estrutural', '?situacao=known&servico=arquitetura&servico=arquitetura',
    '?situacao=known&servico=__proto__&servico=arquitetura', '?servico=terraplenagem&situacao=known&servico=orcamento-tecnico', '?situacao=known&servico=regularizacao&servico=regularizacao',
    '?situacao=known&servico=<img src=x>&servico=estrutural',
  ]) {
    assert.doesNotThrow(() => initialState(q), q);
    assert.deepEqual(initialState(q), SEM_SELECAO, q);
    assert.equal(serviceFromSearch(q), null, q);
    assert.equal(deeplinkInfo(q).service, null, q);
  }
  // valores únicos continuam funcionando
  assert.deepEqual(initialState('?situacao=known&servico=arquitetura').answers.services, ['Arquitetura']);
  assert.equal(initialState('?situacao=build').id, 'CA1');
  // e a query bruta não é registrada
  assert.doesNotMatch(readSrcSync('deeplink.mjs'), /console\.|localStorage|sessionStorage|fetch\(/);
});
import { readFileSync } from 'node:fs';
function readSrcSync(f) { return readFileSync(path.join(appRoot, 'src', f), 'utf8'); }

// ---------------------------------------------------------------------------------------------------------------------
// Documentação, pendências humanas e bundle
// ---------------------------------------------------------------------------------------------------------------------
test('documentação: contrato municipal, classificação Worker/CRM e pendências humanas existem e dizem o que precisam dizer', async () => {
  const d = (f) => readFile(path.join(siteRoot, 'docs', f), 'utf8');
  const contrato = await d('CONTRATO_BASE_MUNICIPAL.md');
  assert.match(contrato, /HISTÓRICO/, 'a base municipal é só histórico, fora do fluxo ativo');
  assert.match(contrato, /Nenhum município, coeficiente, zona ou fórmula foi inventado/);
  const worker = await d('CLASSIFICACAO_WORKER_CRM.md');
  for (const t of ['compatível', 'incompatível', 'contrato validado (Marcos)', 'localizado e validado', 'request_intent', 'estimate_state', 'lead_stage', 'scope_question', 'architecture_area_source', 'architecture_area_reference', 'architecture_estimation_inputs', 'architecture_estimation_version']) assert.ok(worker.includes(t), t);
  const pend = await d('PENDENCIAS_VALIDACAO_HUMANA.md');
  assert.match(pend, /193[\s\S]*199[\s\S]*PENDENTE DE VALIDAÇÃO HUMANA/);
  assert.match(pend, /Não alterados automaticamente/);
});

test('193 e 199 permanecem exatamente como estavam (não alterados nem declarados validados)', async () => {
  const html = await readFile(path.join(siteRoot, 'avaliar-um-problema/index.html'), 'utf8');
  assert.equal([...html.matchAll(/Corpo de Bombeiros \(193\) ou a Defesa Civil \(199\)/g)].length, 2);
  assert.doesNotMatch(html, /validad[oa]/i);
});

test('bundle publicado reflete o código-fonte: serviços nativos, dúvida, reforma e nenhuma rota por "Outro" para as três disciplinas', async () => {
  const dir = path.join(siteRoot, 'orcamento/assets');
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(dir);
  const js = await readFile(path.join(dir, files.find((n) => /^index-.*\.js$/.test(n))), 'utf8');
  for (const marker of ['Qual é a sua dúvida?', 'Reformar sem aumentar a área', 'Qual a área do imóvel a reformar?', 'Qual a área abrangida pelo orçamento técnico?',
    'ARQ_EST_V1', 'LOT_ONLY_ESTIMATE', 'PROGRAM_AND_LOT_ESTIMATE', 'Seu ponto de partida', 'scope_question', 'ARQUITETURA', 'TERRAPLENAGEM', 'ORCAMENTO']) {
    assert.ok(js.includes(marker), `bundle sem "${marker}" — reconstruir o orcamento-src`);
  }
  assert.ok(!js.includes('Projeto de arquitetura",analytics'), 'deep link antigo via Outro ausente do bundle');
  assert.ok(!js.includes('otherService:"Projeto de'), 'nenhum otherService de disciplina no bundle');
  // o município saiu do fluxo ativo: nada da base municipal é embarcado
  for (const gone of ['base-municipal-urbanistica', 'BASE_INDISPONIVEL', 'municipal_estimate', 'REGRA_NAO_AUTORIZADA']) assert.ok(!js.includes(gone), `bundle ainda contém ${gone}`);
});

test('páginas de serviço de Arquitetura, Orçamento técnico e Terraplenagem descrevem a estimativa nativa, sem falar em "Outro" nem em município', async () => {
  for (const slug of ['projeto-arquitetura', 'orcamento-tecnico', 'projeto-terraplenagem']) {
    const html = await readFile(path.join(siteRoot, `servicos/${slug}/index.html`), 'utf8');
    assert.doesNotMatch(html, /com “Outro”|não calcula valor automático|Receba o enquadramento/, slug);
    assert.match(html, /já selecionado e responda só ao que se aplica ao seu caso/, slug);
  }
  const arq = await readFile(path.join(siteRoot, 'servicos/projeto-arquitetura/index.html'), 'utf8');
  assert.match(arq, /Não sabe a área\? Conta o que imagina para a casa e\/ou informa o terreno/);
  assert.doesNotMatch(arq, /município|legislação do/i);
});
