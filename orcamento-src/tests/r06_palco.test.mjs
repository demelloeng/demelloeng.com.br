// R06 (HANDOFF_OPUS_R4_V03): fatos exibidos junto ao modelo só de origem conhecida (maquetteFacts + spec da V05).
import './support/fator_080.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { stageFacts, maquete5Input } from '../src/maquete5_input.mjs';
import { buildingSpec } from '../src/maquete5_building.mjs';

const LOC = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const build = (extra = {}) => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '320' }, property: 'Casa/sobrado',
  location: LOC, CA5: { value: '2' }, CA6: 'Alto', services: ['Arquitetura'], ...extra });
const known = (extra = {}) => ({ route: 'known', services: ['Arquitetura'], S2: 'Casa/sobrado', S3: { value: '', unknown: true }, location: LOC, ...extra });
const facts = (a) => stageFacts(a, buildingSpec(maquete5Input(a)));

test('R06: área da edificação declarada e pavimentos informados', () => {
  assert.deepEqual(facts(build()), { area: '320 m²', floors: '2 pavimentos' });
  assert.deepEqual(facts(build({ CA_AREA: { value: '1500,5' }, CA5: { value: '1' } })), { area: '1.500,5 m²', floors: '1 pavimento' });
});

test('R06: acima de 8, mostra informados e representados', () => {
  assert.equal(facts(build({ CA_AREA: { value: '14400' }, CA5: { value: '12' } })).floors, '12 pavimentos · 8 representados');
});

test('R06: desconhecido, referência do motor, escopo e área atendida não viram área da edificação', () => {
  assert.deepEqual(facts(build({ CA_AREA: { value: '', unknown: true }, CA5: { value: '2', unknown: true } })), { area: null, floors: null });
  const P = { quartos: '3', suites: '1', banheiros: '2', garagem: '2', pavimentos: '2', padrao: 'amplo', sala: true, cozinha: true, lavanderia: true, escritorio: false, varanda: false };
  assert.deepEqual(facts(known({ arq_programa: P })), { area: null, floors: '2 pavimentos' });
  assert.equal(facts(known({ services: ['Compatibilização BIM'], area_escopo: { value: '450' } })).area, null);
  assert.equal(facts(build({ services: ['Gás'], CA_AREA: { value: '', unknown: true }, area_atendida: { value: '90' } })).area, null);
});
