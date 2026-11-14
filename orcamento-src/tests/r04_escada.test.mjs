// R04 (HANDOFF_OPUS_R4_V03): B4 e escada. Nos sobrados sem vão de escada, indicação contextual SÓ em Corte/Planta e
// SÓ com Arquitetura. Sem aviso geral, sem escada fictícia, sem redesenho; ausência geométrica != serviço desmarcado.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingSpec, generate, circulationNote, CIRCULATION_NOTE } from '../src/maquete5_building.mjs';

const ARQ = ['ARQUITETURA', 'ESTRUTURAL', 'HIDROSSANITARIO', 'ELETRICA'];
const SEM_ARQ = ['ESTRUTURAL', 'HIDROSSANITARIO', 'ELETRICA'];
const VIEWS = ['conjunto', 'disciplinas', 'pavimentos', 'corte', 'planta'];
const note = (input, view) => { const s = buildingSpec(input); return circulationNote(s, generate(s).dims, view); };
const ALTO_SEM_ESCADA = [140, 145, 150, 155, 160, 165, 170, 175, 180, 380, 385, 390, 395, 400, 405];

test('R04: os 15 sobrados Alto sem vão recebem a indicação só em Corte e Planta, com Arquitetura', () => {
  const comNota = [];
  for (let a = 60; a <= 1000; a += 5) {
    const input = { areaTotal: a, floors: 2, typology: 'CASA', standard: 'Alto', services: ARQ };
    const s = buildingSpec(input);
    const { dims, parts } = generate(s);
    for (const v of VIEWS) {
      const n = circulationNote(s, dims, v);
      if (v === 'corte' || v === 'planta') assert.equal(n, dims.hole ? null : CIRCULATION_NOTE, `${a} ${v}`);
      else assert.equal(n, null, `${a} ${v}: sem aviso fora de Corte/Planta`);
    }
    if (!dims.hole) { comNota.push(a); assert.ok(!parts.some((p) => p.name === 'Escada'), 'nenhuma escada fictícia'); }
  }
  assert.deepEqual(comNota, ALTO_SEM_ESCADA);
});

test('R04: sem Arquitetura não há indicação (escada ausente por serviço desmarcado, não por geometria)', () => {
  for (const a of [...ALTO_SEM_ESCADA, 320]) for (const v of VIEWS) {
    assert.equal(note({ areaTotal: a, floors: 2, typology: 'CASA', standard: 'Alto', services: SEM_ARQ }, v), null);
  }
});

test('R04: sobrado 320/160 intacto (varanda 1,50 m, 16 degraus, patamar) e sem indicação', () => {
  const s = buildingSpec({ areaTotal: 320, areaProj: 160, floors: 2, typology: 'CASA', standard: 'Alto', services: ARQ });
  const g = generate(s);
  assert.equal(g.dims.recess, 1.5);
  assert.equal(g.parts.filter((p) => p.name === 'Escada').length, 16);
  assert.ok(g.parts.some((p) => p.name === 'Patamar'));
  for (const v of VIEWS) assert.equal(circulationNote(s, g.dims, v), null);
});

test('R04: térreo, pavimentos desconhecidos (volume genérico) e terreno sem edificação não recebem indicação', () => {
  for (const v of ['corte', 'planta']) {
    assert.equal(note({ areaTotal: 60, floors: 1, typology: 'CASA', services: ARQ }, v), null);
    assert.equal(note({ areaTotal: 150, typology: 'CASA', standard: 'Alto', services: ARQ }, v), null);
    assert.equal(circulationNote(buildingSpec({ services: ['TERRAPLENAGEM'], areaTerreno: 500 }), { hole: null }, v), null);
  }
});

test('R04: o texto não promete medida nem afirma que a obra não terá escada', () => {
  assert.match(CIRCULATION_NOTE, /não representada/i);
  assert.match(CIRCULATION_NOTE, /projeto/i);
  assert.doesNotMatch(CIRCULATION_NOTE, /\d/);
});
