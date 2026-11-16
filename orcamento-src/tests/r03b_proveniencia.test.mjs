// R03 complementar (D03-A a D03-E): um único modelo de proveniência (maquetteFacts) para a V05 expandida, o fallback
// antigo e o chip compacto do celular. Pavimentos e padrão só da jornada ativa; área da edificação só quando declarada
// ou derivada de declarações; escopo, área atendida e terreno com o nome certo; referência do motor nunca vira área
// física. Dimensões-base do gerador válidas em entradas programáticas extremas.
import test from 'node:test';
import assert from 'node:assert/strict';

import { maquetteFacts, maquete5Input } from '../src/maquete5_input.mjs';
import { livePlanModel } from '../src/live_plan.mjs';
import { sceneSpec, describeScene } from '../src/maquete_model.mjs';
import { buildingSpec, generate, describe, MAX_FLOORS } from '../src/maquete5_building.mjs';
import { packageForCRMv2 } from '../src/payload_v2.mjs';
import { LAYER_LABEL } from '../src/live_plan.mjs';

const LOC = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const unk = { value: '', unknown: true };
const build = (extra = {}) => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '320' }, property: 'Casa/sobrado',
  location: LOC, services: ['Elétrica'], ...extra });
const known = (extra = {}) => ({ route: 'known', services: ['Arquitetura'], S2: 'Casa/sobrado', S3: { value: '200' }, location: LOC,
  S5: 'Só uma ideia / estudo', S6: 'Ainda sem prazo', ...extra });
const PROG = (o = {}) => ({ quartos: '3', suites: '1', banheiros: '2', garagem: '2', pavimentos: '3', padrao: 'amplo',
  sala: true, cozinha: true, lavanderia: true, escritorio: false, varanda: false, ...o });

// As três representações leem os mesmos fatos: V05 (maquete5Input), fallback e chip (livePlanModel -> sceneSpec).
function views(answers) {
  const f = maquetteFacts(answers);
  const v5 = maquete5Input(answers);
  const m = livePlanModel(answers);
  return { f, v5, m, scene: m ? sceneSpec(m) : null };
}

// ---------------------------------------------------------------- D03-A — pavimentos e padrão
test('D03-A: CA5 válido na rota Construir chega igual à V05, ao fallback e ao chip', () => {
  const { f, v5, m, scene } = views(build({ CA5: { value: '3' }, CA6: 'Alto' }));
  assert.equal(f.floors, 3);
  assert.equal(v5.floors, 3);
  assert.equal(m.floors, 3);
  assert.equal(scene.floors, 3);
  assert.equal(v5.standard, 'Alto');
});

test('D03-A: CA5 desconhecido, CA5 antigo de outra jornada e programa inativo/inválido não prevalecem em nenhuma vista', () => {
  for (const answers of [
    build({ CA5: { value: '12', unknown: true } }),
    known({ CA5: { value: '12' } }),                                   // CA5 de outra jornada; área informada -> sem programa
    known({ S3: { value: '200' }, arq_programa: PROG() }),              // programa guardado de etapa inativa
    known({ S3: unk, arq_programa: PROG({ pavimentos: '9' }) }),       // programa inválido
    known({ S3: unk, arq_programa: { ...PROG(), unknown: true } }),
  ]) {
    const { f, v5, m, scene } = views(answers);
    assert.equal(f.floors, null, JSON.stringify(answers));
    assert.equal(v5.floors, null);
    assert.equal(m.floors, null);
    assert.equal(m.floorsDrawn, null);
    assert.equal(scene.floorsKnown, false);
  }
});

test('D03-A: programa de Arquitetura ativo e válido fornece pavimentos às três vistas, mesmo com CA5/CA6 antigos', () => {
  const { f, v5, m, scene } = views(known({ S3: unk, arq_programa: PROG(), CA5: { value: '12' }, CA6: 'Econômico' }));
  assert.equal(f.floors, 3);
  assert.equal(v5.floors, 3);
  assert.equal(m.floors, 3);
  assert.equal(scene.floors, 3);
  assert.equal(v5.standard, 'amplo');
});

test('D03-A: acima de 8, declarados preservados e desenho limitado também no fallback (texto diz os dois)', () => {
  const { m, scene } = views(build({ CA5: { value: '15' }, CA_AREA: { value: '100' } }));
  assert.equal(m.floors, 15);
  assert.equal(m.floorsDrawn, MAX_FLOORS);
  assert.equal(m.floorsExtra, 7);
  assert.equal(scene.floors, MAX_FLOORS);
  assert.match(describeScene(scene, LAYER_LABEL), /15 pavimentos informados, 8 representados/);
  assert.match(describeScene(sceneSpec({ floorsDrawn: 2, floors: 2, layers: [] }), LAYER_LABEL), /: 2 pavimentos/);
});

// ---------------------------------------------------------------- D03-B / D03-C — áreas
test('D03-B: área de referência do motor (Arquitetura sem área) não aparece como área informada em nenhuma vista', () => {
  const answers = known({ S3: unk, arq_programa: PROG() });
  assert.ok(Number(packageForCRMv2(answers).pricing_inputs.area_new) > 0, 'o motor segue usando a referência no preço');
  const { f, v5, m } = views(answers);
  assert.equal(f.area, null);
  assert.equal(v5.areaTotal, null);
  assert.equal(m.area, null);
});

test('D03-B: área desconhecida continua desconhecida (Construir com CA_AREA desconhecida)', () => {
  const { f, v5, m } = views(build({ CA_AREA: unk }));
  assert.equal(f.area, null);
  assert.equal(v5.areaTotal, null);
  assert.equal(m.area, null);
});

test('D03-B: área da edificação declarada ou derivada, com a origem certa', () => {
  assert.deepEqual(maquetteFacts(build()).area, { kind: 'building', source: 'declarada', value: '320' });
  assert.deepEqual(maquetteFacts(known()).area, { kind: 'building', source: 'declarada', value: '200' });
  const ampl = maquetteFacts(build({ CA1: 'Ampliar um imóvel existente', CA_EXISTING: { value: '120' }, CA_NEW: { value: '80' } }));
  assert.deepEqual(ampl.area, { kind: 'building', source: 'derivada', value: '200' });
  assert.equal(maquete5Input(build()).areaTotal, 320);
});

test('D03-C: área do escopo e área atendida não viram área construída; terreno segue para a vista de terreno', () => {
  const escopo = known({ services: ['Compatibilização BIM'], S3: unk, area_escopo: { value: '450' } });
  const fe = maquetteFacts(escopo);
  assert.deepEqual(fe.area, { kind: 'scope', source: 'declarada', value: '450' });
  assert.equal(maquete5Input(escopo).areaTotal, null, 'escopo não é área total da construção na V05');
  const me = livePlanModel(escopo);
  assert.equal(me.area.kind, 'scope');
  assert.equal(me.area.footprint, null, 'sem escala de edificação');
  assert.equal(sceneSpec(me).hasArea, true);

  const gas = build({ services: ['Gás'], CA_AREA: unk, area_atendida: { value: '90' } });
  const fg = maquetteFacts(gas);
  assert.deepEqual(fg.area, { kind: 'served', source: 'declarada', value: '90' });
  assert.equal(livePlanModel(gas).area.footprint, null);
  assert.equal(maquete5Input(gas).areaTotal, null, 'área atendida não é área total da construção na V05');

  const terra = { route: 'known', services: ['Terraplenagem'], area_terreno: { value: '800' }, location: LOC, deadline: 'Ainda sem prazo' };
  assert.deepEqual(maquetteFacts(terra).area, { kind: 'terrain', source: 'declarada', value: '800' });
  assert.equal(maquete5Input(terra).areaTerreno, 800);
  assert.equal(maquete5Input(terra).areaTotal, null);
  assert.equal(livePlanModel(terra).area.kind, 'terrain');
});

test('D03-B: o texto acessível do fallback nomeia a área pela origem (nunca "informada" para o que não foi)', async () => {
  const { areaPhrase } = await import('../src/live_plan.mjs');
  assert.equal(areaPhrase({ kind: 'building', source: 'declarada', value: '320' }), 'Área informada: 320 m².');
  assert.equal(areaPhrase({ kind: 'building', source: 'derivada', value: '200.5' }), 'Área total (existente + nova): 200,5 m².');
  assert.equal(areaPhrase({ kind: 'scope', source: 'declarada', value: '450' }), 'Área do escopo informada: 450 m².');
  assert.equal(areaPhrase({ kind: 'served', source: 'declarada', value: '90' }), 'Área atendida informada: 90 m².');
  assert.equal(areaPhrase({ kind: 'terrain', source: 'declarada', value: '800' }), 'Área do terreno informada: 800 m².');
  assert.equal(areaPhrase(null), '');
});

test('D03-B: a estimativa comercial é idêntica com o novo modelo de proveniência', () => {
  for (const answers of [build(), known({ S3: unk, arq_programa: PROG() }), known({ services: ['Compatibilização BIM'], S3: unk, area_escopo: { value: '450' } })]) {
    const m = livePlanModel(answers);
    const pv = packageForCRMv2(answers).pricing_preview;
    assert.equal(m.total, pv.status === 'CALCULATED' ? pv.total_demello : null);
  }
});

// ---------------------------------------------------------------- D03-D — dimensões-base extremas
test('D03-D: 0,01 m² com 200, 500 e 999 pavimentos: dimensões-base finitas e positivas; acima de 200 não é pavimento válido', () => {
  for (const floors of [200, 500, 999]) {
    const s = buildingSpec({ areaTotal: 0.01, floors, services: ['ARQUITETURA', 'ESTRUTURAL'] });
    assert.ok(Number.isFinite(s.w) && s.w > 0 && Number.isFinite(s.d) && s.d > 0, `${floors}: w=${s.w} d=${s.d}`);
    if (floors > 200) assert.equal(s.floorsDeclared, null, 'fora do contrato da pergunta (1 a 200)');
    else assert.equal(s.floorsDeclared, 200);
    const { parts } = generate(s);
    assert.ok(parts.length > 0 && parts.every((p) => [...p.p, ...p.s].every(Number.isFinite) && p.s.every((v) => v > 0)));
  }
});

test('D03-D: áreas programáticas fora do representável caem no volume genérico, sem inventar medida', () => {
  for (const areaProj of [1e-12, 1e-300, 1e300, Number.MAX_VALUE]) {
    const s = buildingSpec({ areaProj, floors: 2 });
    assert.ok(Number.isFinite(s.w) && s.w > 0 && Number.isFinite(s.d) && s.d > 0, `${areaProj}`);
    assert.ok(generate(s).parts.every((p) => p.s.every((v) => Number.isFinite(v) && v > 0)));
  }
  const huge = buildingSpec({ areaProj: Number.MAX_VALUE, floors: 2 });
  assert.equal(huge.hasArea, false, 'sem representação válida: não mostra escala');
  assert.equal(huge.areaProj, Number.MAX_VALUE, 'o dado da pessoa é preservado');
});

test('D03-D: casos usuais inalterados: 14.400/12 = 1.200 m²; fronteira 8/9; área informada e desconhecida', () => {
  const s = buildingSpec({ areaTotal: 14400, floors: 12 });
  assert.equal(s.areaProj, 1200);
  assert.match(describe(s), /12 pavimentos informados, 8 representados/);
  assert.equal(buildingSpec({ areaTotal: 7200, floors: 8 }).floors, 8);
  assert.equal(buildingSpec({ areaTotal: 8100, floors: 9 }).floorsExtra, 1);
  assert.equal(buildingSpec({ areaProj: 160, areaTotal: 320, floors: 2 }).areaProjSource, 'informada');
  assert.equal(buildingSpec({ floors: 2 }).hasArea, false);
});
