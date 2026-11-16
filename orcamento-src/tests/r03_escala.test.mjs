// R03 (HANDOFF_OPUS_R4_V03) — escala, pavimentos e medidas extremas da maquete V05.
// Pavimentos informados x representados, projeção média pelos pavimentos INFORMADOS, origem dos dados pela jornada
// ativa (CA5/CA6 na rota "Construir", programa de Arquitetura na rota "Já sei"), área de referência do motor nunca
// promovida a área física e nenhuma peça desenhada com dimensão não positiva ou não finita.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildingSpec, generate, describe, MAX_FLOORS } from '../src/maquete5_building.mjs';
import { maquete5Input } from '../src/maquete5_input.mjs';
import { derivePricingInputs } from '../src/payload_v2.mjs';

const ALL = ['ARQUITETURA', 'ESTRUTURAL', 'HIDROSSANITARIO', 'ELETRICA', 'INCENDIO', 'GAS_GLP'];
const LOC = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const unk = { value: '', unknown: true };
const build = (extra = {}) => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '320' }, property: 'Casa/sobrado',
  location: LOC, services: ['Arquitetura'], ...extra });
const known = (extra = {}) => ({ route: 'known', services: ['Arquitetura'], S2: 'Casa/sobrado', S3: { value: '200' }, location: LOC,
  S5: 'Só uma ideia / estudo', S6: 'Ainda sem prazo', ...extra });
const PROG = (o = {}) => ({ quartos: '3', suites: '1', banheiros: '2', garagem: '2', pavimentos: '3', padrao: 'amplo',
  sala: true, cozinha: true, lavanderia: true, escritorio: false, varanda: false, ...o });
const invalid = (parts) => parts.filter((p) => ![...p.p, ...p.s].every(Number.isFinite) || !p.s.every((v) => v > 0));

// ---------------------------------------------------------------- Grupo A — pavimentos e projeção
test('A: 14.400 m² / 12 pavimentos sem projeção explícita -> projeção média 1.200 m²; 12 informados, 8 desenhados', () => {
  const s = buildingSpec({ areaTotal: 14400, floors: 12, typology: 'PREDIO', services: ALL });
  assert.equal(s.areaProj, 1200);
  assert.equal(s.areaProjSource, 'media');
  assert.equal(s.floorsDeclared, 12);
  assert.equal(s.floors, MAX_FLOORS);
  assert.equal(s.floorsExtra, 4);
  assert.ok(Math.abs(s.w * s.d - 1200) / 1200 < 0.01, 'a planta desenhada tem a projeção média');
  const text = describe(s);
  assert.match(text, /12 pavimentos informados/);
  assert.match(text, /8 representados/);
});

test('A: projeção explícita válida prevalece (14.400 m² / 12 pavimentos / 1.200 m² informados)', () => {
  const s = buildingSpec({ areaTotal: 14400, areaProj: 1200, floors: 12, services: ALL });
  assert.equal(s.areaProj, 1200);
  assert.equal(s.areaProjSource, 'informada');
  const s2 = buildingSpec({ areaTotal: 14400, areaProj: 900, floors: 12 });
  assert.equal(s2.areaProj, 900, 'nunca substituída pela média');
});

test('A: fronteira 8/9 e 12 pavimentos: declarados preservados, desenho limitado e explicitado', () => {
  for (const [n, drawn, extra] of [[8, 8, 0], [9, 8, 1], [12, 8, 4]]) {
    const s = buildingSpec({ areaTotal: 900 * n, floors: n });
    assert.equal(s.floorsDeclared, n);
    assert.equal(s.floors, drawn);
    assert.equal(s.floorsExtra, extra);
    assert.equal(s.areaProj, 900, `${n} pavimentos: média pelos informados`);
    const text = describe(s);
    if (extra) assert.match(text, new RegExp(`${n} pavimentos informados, ${drawn} representados`));
    else { assert.match(text, new RegExp(`: ${n} pavimentos`)); assert.doesNotMatch(text, /representados/); }
  }
});

test('A: sem pavimentos válidos e sem área: nada é inventado', () => {
  for (const floors of [undefined, null, 0, -2, 2.5, '12', NaN]) {
    const s = buildingSpec({ areaTotal: 300, floors });
    assert.equal(s.floorsDeclared, null, String(floors));
    assert.equal(s.floorsKnown, false);
    assert.match(describe(s), /volume genérico/);
  }
  const s = buildingSpec({ floors: 3 });
  assert.equal(s.hasArea, false);
  assert.equal(s.areaProj, null);
  assert.equal(s.areaProjSource, null);
});

// ---------------------------------------------------------------- Grupo B — origem dos dados
test('B: rota Construir: CA5/CA6 válidos chegam à maquete; CA5 marcado como desconhecido não ressuscita valor antigo', () => {
  const a = maquete5Input(build({ CA5: { value: '2' }, CA6: 'Alto' }));
  assert.equal(a.floors, 2);
  assert.equal(a.standard, 'Alto');
  assert.equal(a.areaTotal, 320);
  const u = maquete5Input(build({ CA5: { value: '12', unknown: true }, CA6: 'Ainda não sei' }));
  assert.equal(u.floors, null, 'resposta desconhecida não é declaração');
  assert.equal(u.standard, null, '"Ainda não sei" não é padrão');
});

test('B: rota Arquitetura (Já sei): pavimentos e padrão do programa válido; CA5/CA6 antigos de outra rota não prevalecem', () => {
  const a = maquete5Input(known({ S3: unk, arq_programa: PROG() }));
  assert.equal(a.floors, 3);
  assert.equal(a.standard, 'amplo');
  const stale = maquete5Input(known({ S3: unk, arq_programa: PROG(), CA5: { value: '12' }, CA6: 'Econômico' }));
  assert.equal(stale.floors, 3, 'CA5 de outra jornada não vale');
  assert.equal(stale.standard, 'amplo', 'CA6 de outra jornada não vale');
  const desconhecido = maquete5Input(known({ S3: unk, arq_programa: { ...PROG(), unknown: true } }));
  assert.equal(desconhecido.floors, null);
  assert.equal(desconhecido.standard, null);
  const invalido = maquete5Input(known({ S3: unk, arq_programa: PROG({ pavimentos: '9' }) }));
  assert.equal(invalido.floors, null, 'programa inválido não é fonte');
});

test('B: programa guardado de uma etapa que não está mais ativa não vale (área informada dispensa o programa)', () => {
  const a = maquete5Input(known({ S3: { value: '200' }, arq_programa: PROG() }));
  assert.equal(a.floors, null);
  assert.equal(a.standard, null);
  assert.equal(a.areaTotal, 200);
});

test('B: área de referência do motor (Arquitetura sem área) não vira área física da maquete', () => {
  const answers = known({ S3: unk, arq_programa: PROG() });
  const pi = derivePricingInputs(answers);
  assert.ok(Number(pi.area_new) > 0, 'o motor usa a área de referência para o preço (inalterado)');
  const a = maquete5Input(answers);
  assert.equal(a.areaTotal, null, 'referência não é área declarada');
  assert.equal(a.areaProj, null);
  assert.equal(buildingSpec(a).hasArea, false);
});

test('B: área desconhecida continua desconhecida em todas as rotas', () => {
  assert.equal(maquete5Input(build({ CA_AREA: unk })).areaTotal, null);
  assert.equal(maquete5Input(known({ S3: unk, services: ['Hidrossanitário'] })).areaTotal, null);
});

// ---------------------------------------------------------------- Grupo C — geometria extrema
test('C: áreas mínimas e extremas não geram peça com dimensão não positiva ou não finita', () => {
  const cases = [];
  for (const areaTotal of [0.01, 1, 5, 10, 60, 1e6, 99999999.99]) {
    for (const floors of [1, 2, 3, 8, 9, 12, 200]) {
      for (const standard of [undefined, 'Econômico', 'Médio', 'Alto']) {
        for (const typology of ['CASA', 'PREDIO']) cases.push({ areaTotal, floors, standard, typology, services: ALL });
      }
    }
  }
  cases.push({ areaTotal: 0.01, areaProj: 0.01, floors: 1, services: ALL }, { areaTotal: 10, floors: 8, services: ALL });
  const bad = [];
  for (const c of cases) {
    const { parts } = generate(buildingSpec(c));
    const inv = invalid(parts);
    if (inv.length) bad.push(`${JSON.stringify(c)} -> ${inv.length} (${[...new Set(inv.map((p) => p.name))].join(', ')})`);
    assert.ok(parts.some((p) => p.name === 'Piso térreo'), `${JSON.stringify(c)}: o volume continua desenhado`);
  }
  assert.deepEqual(bad, []);
});

test('C: área comercial e projeção da spec não mudam por causa da simplificação geométrica', () => {
  const s = buildingSpec({ areaTotal: 1, floors: 2, services: ALL });
  assert.equal(s.areaTotal, 1);
  assert.equal(s.areaProj, 0.5);
});
