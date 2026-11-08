// P02 — municípios oficiais do IBGE ligados à UF; WhatsApp e e-mail do contato.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildIndex, search, setIndex, locationValid, ufOfId, normalizeText, UF_CODES, DF_REGIOES_ADMINISTRATIVAS } from '../src/municipios.mjs';
import { parsePhone, emailValid, contactCheck, PHONE_MESSAGE, DDDS } from '../src/phone.mjs';
import { valid, nodes, updateAnswer, advance } from '../src/journey.mjs';
import { packageForCRMv2 } from '../src/payload_v2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(await readFile(path.join(HERE, '..', 'public', 'assets', 'municipios-ibge.v1.json'), 'utf8'));
const INDEX = buildIndex(RAW);
setIndex(INDEX);

const loc = (city, uf, id) => ({ city, uf, ibge_id: id });

test('catálogo IBGE: todos os municípios, as 27 UFs, códigos de 7 dígitos com prefixo da UF e nenhum nome repetido na UF', () => {
  assert.ok(RAW.total >= 5570, `total ${RAW.total}`);
  assert.equal(RAW.m.length, RAW.total);
  assert.equal(INDEX.total, RAW.total, 'nenhum registro descartado na leitura');
  assert.deepEqual(Object.keys(INDEX.byUf).sort(), Object.values(UF_CODES).sort());
  for (const uf of Object.keys(INDEX.byUf)) assert.ok(INDEX.byUf[uf].length > 0, uf);
  assert.equal(INDEX.byUf.DF.length, 1, 'o DF tem um único município');
  const seen = new Set();
  for (const [id, nome] of RAW.m) {
    assert.match(String(id), /^[0-9]{7}$/);
    assert.ok(ufOfId(id), `UF do código ${id}`);
    const key = `${ufOfId(id)}|${nome}`;
    assert.ok(!seen.has(key), `nome repetido na UF: ${key}`);
    seen.add(key);
  }
  assert.match(RAW.fonte, /IBGE/);
  assert.match(RAW.consulta, /^\d{4}-\d{2}-\d{2}$/);
});

test('catálogo IBGE: casos de referência (acento, apóstrofo, DF, municípios recentes)', () => {
  const nome = (id) => INDEX.byId.get(id)?.nome;
  assert.equal(nome('4106902'), 'Curitiba');
  assert.equal(nome('5300108'), 'Brasília');
  assert.equal(nome('2111300'), 'São Luís');
  assert.equal(nome('3545803'), "Santa Bárbara d'Oeste");
  assert.equal(nome('4220000'), 'Balneário Rincão');
  assert.equal(nome('4212650'), 'Pescaria Brava');
  assert.equal(nome('5101837'), 'Boa Esperança do Norte');
});

test('município: cidade inexistente ou de outra UF não é resposta válida', () => {
  assert.equal(locationValid(loc('Curitiba', 'PR', '4106902')), true);
  assert.equal(locationValid(loc('Brasília', 'DF', '5300108')), true);
  assert.equal(locationValid(loc('Cidade Inexistente XYZ', 'SP', '3500000')), false, 'código que não existe no catálogo');
  assert.equal(locationValid(loc('Curitiba', 'SP', '4106902')), false, 'Curitiba com a UF errada');
  assert.equal(locationValid(loc('São Paulo', 'PR', '3550308')), false, 'código de SP com UF PR');
  assert.equal(locationValid(loc('Curitiba', 'PR', '')), false, 'sem código IBGE');
  assert.equal(locationValid({ city: 'Curitiba', uf: 'PR' }), false, 'só texto, sem escolher da lista');
  assert.equal(locationValid(loc('Curitibaa', 'PR', '4106902')), false, 'nome diferente do registro oficial do código');
  assert.equal(locationValid(loc('<script>x</script>', 'AC', '1200401')), false);
  assert.equal(locationValid(loc('  ', 'PR', '4106902')), false);
  assert.equal(locationValid(null), false);
});

test('município: o nó de localização da jornada exige a escolha oficial', () => {
  assert.equal(valid('CA3', { location: loc('Curitiba', 'PR', '4106902') }), true);
  assert.equal(valid('CA3', { location: { city: 'Cidade Inexistente', uf: 'SP' } }), false);
  assert.equal(valid('CA3', { location: loc('Curitiba', 'SP', '4106902') }), false);
  for (const id of ['CA3', 'P4', 'S4', 'REG_C2']) assert.equal(nodes[id].type, 'location', id);
});

test('município: busca sem acento, sem maiúscula e com apóstrofo; resultados só da UF escolhida', () => {
  assert.equal(normalizeText("Santa Bárbara d'Oeste"), 'santa barbara doeste');
  assert.equal(search(INDEX, 'MA', 'sao luis')[0].nome, 'São Luís');
  assert.equal(search(INDEX, 'SP', 'santa barbara d oeste').length >= 0, true);
  assert.equal(search(INDEX, 'SP', "santa barbara d'oeste")[0].nome, "Santa Bárbara d'Oeste");
  assert.equal(search(INDEX, 'PR', 'CURITIBA')[0].nome, 'Curitiba');
  assert.ok(search(INDEX, 'PR', 'curi').every((r) => r.uf === 'PR'));
  assert.equal(search(INDEX, 'PR', 'zzzzzz').length, 0);
  assert.equal(search(INDEX, 'XX', 'curitiba').length, 0, 'UF desconhecida');
  assert.equal(search(INDEX, 'PR', 'curitiba', 3).length <= 3, true);
});

test('município: homônimos pedem a UF (o mesmo nome em UFs diferentes tem códigos diferentes)', () => {
  const byName = new Map();
  for (const it of INDEX.byId.values()) byName.set(it.nome, [...(byName.get(it.nome) ?? []), it]);
  const homonimos = [...byName.values()].filter((l) => l.length > 1);
  assert.ok(homonimos.length > 100, `homônimos: ${homonimos.length}`);
  const [a, b] = homonimos[0];
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.uf, b.uf);
  assert.equal(locationValid(loc(a.nome, a.uf, a.id)), true);
  assert.equal(locationValid(loc(a.nome, b.uf, a.id)), false, 'nome certo, UF do homônimo, código errado');
  assert.equal(search(INDEX, a.uf, a.nome)[0].id, a.id);
  assert.equal(search(INDEX, b.uf, b.nome)[0].id, b.id);
});

test('município: Distrito Federal — a região administrativa leva a Brasília, sem virar cidade', () => {
  const r = search(INDEX, 'DF', 'taguatinga');
  assert.equal(r.length, 1);
  assert.equal(r[0].nome, 'Brasília');
  assert.equal(r[0].apelido, 'Taguatinga');
  assert.equal(locationValid(loc('Taguatinga', 'DF', '5300108')), false, 'Taguatinga não é município');
  assert.ok(DF_REGIOES_ADMINISTRATIVAS.includes('Ceilândia'));
  assert.equal(search(INDEX, 'GO', 'taguatinga').length, 0, 'apelido vale só no DF');
});

test('município: trocar a UF limpa a cidade (o App chama onChange com cidade vazia) e a resposta deixa de valer', () => {
  const before = { route: 'build', location: loc('Curitiba', 'PR', '4106902') };
  assert.equal(valid('CA3', before), true);
  const after = updateAnswer(before, 'CA3', { uf: 'SP', city: '', ibge_id: '' });
  assert.equal(valid('CA3', after), false);
});

test('município: o payload leva o código IBGE junto, aditivo, sem tirar nenhum campo antigo', () => {
  const a = {
    route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '120' }, property: 'Casa/sobrado', location: loc('Curitiba', 'PR', '4106902'),
    phase: 'Arquitetura pronta', CA5: { value: '1' }, CA6: 'Médio', services: ['Estrutural'], deadline: 'Ainda sem prazo',
  };
  const p = packageForCRMv2(a);
  assert.deepEqual(p.answers.location, { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' });
  assert.match(p.summary.find((r) => r.id === 'CA3').value, /^Curitiba \/ PR$/);
  assert.equal(p.pricing_preview.total_demello, '2409.60', 'preço pelo motor R2 (FUNDEPAR 25,10 x 120 x 0,80); município não altera o preço');
});

test('o catálogo é arquivo do próprio site (nenhuma chamada ao IBGE na visita) e está na área publicada', async () => {
  const src = await readFile(path.join(HERE, '..', 'src', 'municipios.mjs'), 'utf8');
  const pick = await readFile(path.join(HERE, '..', 'src', 'pickers.jsx'), 'utf8');
  assert.ok(!/servicodados\.ibge/.test(src.replace(/^\/\/.*$/gm, '')), 'sem URL do IBGE em código executável');
  assert.ok(!/servicodados\.ibge/.test(pick));
  assert.match(pick, /BASE_URL\}assets\/municipios-ibge\.v1\.json/);
  const allow = await readFile(path.join(HERE, '..', '..', '.github', 'pages', 'allowlist.txt'), 'utf8');
  assert.match(allow, /orcamento\/assets\/\*\*/, 'o catálogo entra por orcamento/assets/**');
});

// ---------------------------------------------------------------- telefone
test('WhatsApp: números reais aceitos em todas as formas usuais e normalizados para +55', () => {
  const good = ['(41) 98512-4056', '41985124056', '41 98512 4056', '+55 41 98512-4056', '+5541985124056', '5541985124056', '0055 41 98512-4056', '041 98512-4056', '(11) 91234-5679', '(41) 3333-4567'];
  for (const g of good) {
    const r = parsePhone(g);
    assert.equal(r.ok, true, g);
    assert.match(r.e164, /^\+55[1-9][0-9][2-9][0-9]{7,8}$/, g);
  }
  const r = parsePhone('(41) 98512-4056');
  assert.deepEqual({ e164: r.e164, national: r.national, ddd: r.ddd, type: r.type, display: r.display }, { e164: '+5541985124056', national: '41985124056', ddd: 41, type: 'mobile', display: '(41) 98512-4056' });
  assert.equal(parsePhone('(41) 3333-4567').type, 'landline');
  assert.equal(parsePhone('(41) 3333-4567').display, '(41) 3333-4567');
});

test('WhatsApp: números evidentemente artificiais ou mal formados são rejeitados, cada um com o seu motivo', () => {
  const bad = {
    '': 'vazio', '   ': 'vazio',
    '00000000000': 'artificial', '11111111111': 'artificial', '(41) 99999-9999': 'artificial', '(41) 98888-8888': 'artificial',
    '(41) 91234-5678': 'artificial', '(41) 98765-4321': 'artificial', '(41) 3333-3333': 'artificial', '(41) 1234-5678': 'formato',
    'abc 41985124056': 'caractere_invalido', '41985124056x': 'caractere_invalido', '41+985124056': 'caractere_invalido',
    '+1 555 123 4567': 'internacional', '+351 912 345 678': 'internacional',
    '(41) 8512-4056': 'formato', '(41) 78512-4056': 'formato', '41 9851-2405': 'formato',
    '419851240': 'curto', '985124056': 'curto', '41985124056789': 'longo', '+55 41 98512-40567': 'longo',
    '(10) 98512-4056': 'ddd_invalido', '(20) 98512-4056': 'ddd_invalido', '(23) 98512-4056': 'ddd_invalido', '(90) 98512-4056': 'ddd_invalido',
  };
  for (const [input, code] of Object.entries(bad)) {
    const r = parsePhone(input);
    assert.equal(r.ok, false, `"${input}" deveria falhar`);
    assert.equal(r.code, code, `"${input}"`);
    assert.ok(PHONE_MESSAGE[code], `mensagem para ${code}`);
  }
  assert.equal(DDDS.size, 67, 'DDDs em uso no Brasil');
});

test('contato: nome obrigatório; WhatsApp OU e-mail; o que foi preenchido precisa estar correto', () => {
  const ok = (c) => contactCheck(c).ok;
  assert.equal(ok({ name: 'Fulano', whatsapp: '(41) 98512-4056', email: '' }), true);
  assert.equal(ok({ name: 'Fulano', whatsapp: '', email: 'fulano@exemplo.com.br' }), true, 'e-mail como alternativa');
  assert.equal(ok({ name: 'Fulano', whatsapp: '(41) 98512-4056', email: 'fulano@exemplo.com' }), true);
  assert.equal(ok({ name: '', whatsapp: '(41) 98512-4056', email: '' }), false);
  assert.equal(ok({ name: 'Fulano', whatsapp: '', email: '' }), false);
  assert.equal(ok({ name: 'Fulano', whatsapp: '00000000000', email: 'fulano@exemplo.com' }), false, 'WhatsApp inválido bloqueia mesmo com e-mail bom');
  assert.equal(ok({ name: 'Fulano', whatsapp: '(41) 98512-4056', email: 'sem-arroba' }), false);
  assert.equal(contactCheck({ name: 'F', whatsapp: '', email: '' }).needsChannel, true);
  assert.match(contactCheck({ name: 'F', whatsapp: '0000', email: '' }).errors.whatsapp, /Faltam dígitos/);
  for (const bad of ['a@b', 'a@b.c', 'a b@c.com', 'a@@c.com', 'a@c..com', '@c.com', 'a@.com', `${'x'.repeat(250)}@a.com`]) assert.equal(emailValid(bad), false, bad);
  for (const good of ['a@b.co', 'nome.sobrenome+tag@empresa.com.br', 'x@exemplo.invalid']) assert.equal(emailValid(good), true, good);
});

test('contato: o nó da jornada usa a mesma regra (frontend = payload)', () => {
  assert.equal(valid('X4', { contact: { name: 'Fulano', whatsapp: '00000000000', email: '' } }), false);
  assert.equal(valid('X4', { contact: { name: 'Fulano', whatsapp: '+55 41 98512-4056', email: '' } }), true);
});

test('contato: o payload guarda o que foi digitado e o número normalizado ao lado (aditivo)', () => {
  const base = {
    route: 'problem', P1: 'Não sei bem como explicar', P2: 'Apareceu uma rachadura', P3: 'Casa/sobrado', property: 'Casa/sobrado', location: loc('Curitiba', 'PR', '4106902'), P5: 'Entender o que está acontecendo',
  };
  const p = packageForCRMv2({ ...base, contact: { name: 'Fulano Fictício', whatsapp: '(41) 98512-4056', email: 'x@exemplo.invalid' } });
  assert.deepEqual(p.contact, { name: 'Fulano Fictício', whatsapp: '(41) 98512-4056', email: 'x@exemplo.invalid', whatsapp_e164: '+5541985124056' });
  const semWa = packageForCRMv2({ ...base, contact: { name: 'Fulano Fictício', whatsapp: '', email: 'x@exemplo.invalid' } });
  assert.deepEqual(semWa.contact, { name: 'Fulano Fictício', whatsapp: '', email: 'x@exemplo.invalid' }, 'sem número, sem campo novo');
  assert.deepEqual(packageForCRMv2(base).contact, { name: '', whatsapp: '', email: '' });
});

test('contato: a interface mostra o número normalizado e não afirma que há conta de WhatsApp', async () => {
  const pick = await readFile(path.join(HERE, '..', 'src', 'pickers.jsx'), 'utf8');
  assert.match(pick, /Vamos usar \{phone\.display\}/);
  assert.ok(!/tem WhatsApp|conta (ativa )?(de|no) WhatsApp|número verificado|verificamos/i.test(pick));
  assert.equal(advance('X4', { route: 'known' }, 'preview').id, 'CRM');
});
