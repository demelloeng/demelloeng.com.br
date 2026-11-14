import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingSpec, generate, fitBox, cameraBasis, describe, MAX_FLOORS, FH, BASE_Y } from '../src/maquete5_building.mjs';

const ALL = ['ARQUITETURA', 'ESTRUTURAL', 'HIDROSSANITARIO', 'ELETRICA', 'INCENDIO', 'GAS_GLP'];
const CASES = [
  { areaTotal: 270, areaProj: 150, floors: 2, typology: 'CASA', services: ['HIDROSSANITARIO', 'ESTRUTURAL', 'ELETRICA', 'ARQUITETURA'] },
  { areaTotal: 60, floors: 1, typology: 'CASA', services: ['ESTRUTURAL'] },
  { areaTotal: 9600, floors: 8, typology: 'PREDIO', services: ALL },
  { services: ['ELETRICA'] },
  { areaTotal: 40, floors: 3, typology: 'CASA', services: ALL },
  { areaTotal: 30000, floors: 20, typology: 'COMERCIAL', services: ALL },
  { areaTotal: 320, floors: 2, typology: 'CASA', standard: 'Alto', services: ['ESTRUTURAL'] },
  { areaTotal: 320, floors: 2, typology: 'CASA', standard: 'Alto', services: ALL },
  { areaTotal: 180, floors: 1, typology: 'CASA', standard: 'Alto', services: ['ARQUITETURA', 'HIDROSSANITARIO'] },
];

test('fidelidade: a projecao desenhada tem a area informada (1%) e os pavimentos sao os informados', () => {
  for (const c of CASES) {
    const s = buildingSpec(c);
    if (s.hasArea) assert.ok(Math.abs(s.w * s.d - s.areaProj) / s.areaProj < 0.01, JSON.stringify(c));
    if (c.floors) assert.equal(s.floors, Math.min(MAX_FLOORS, c.floors));
    assert.equal(s.floorsKnown, !!c.floors);
  }
  assert.equal(buildingSpec(CASES[0]).areaProj, 150);          // projecao informada vale sobre total/pavimentos
  assert.equal(buildingSpec({ areaTotal: 300, floors: 3 }).areaProj, 100);
  assert.equal(buildingSpec(CASES[5]).floorsExtra, 12);
});

test('camadas: so entram as disciplinas escolhidas; o volume sempre existe', () => {
  for (const c of CASES) {
    const s = buildingSpec(c);
    const { parts } = generate(s);
    const got = new Set(parts.map((p) => p.layer));
    for (const l of got) assert.ok(l === 'volume' || s.layers.includes(l), `${l} sem servico`);
    for (const l of s.layers) assert.ok(got.has(l), `${l} escolhido e nao desenhado`);
    assert.ok(got.has('volume'));
  }
});

test('geometria: toda peca e finita, positiva e fica dentro de uma caixa plausivel', () => {
  for (const c of CASES) {
    const s = buildingSpec(c);
    const { parts, dims } = generate(s);
    assert.ok(parts.length > 0);
    for (const p of parts) {
      for (const v of [...p.p, ...p.s]) assert.ok(Number.isFinite(v), `${p.name} nao finito em ${JSON.stringify(c)}`);
      for (const v of p.s) assert.ok(v > 0, `${p.name} com dimensao <= 0 (${p.s}) em ${JSON.stringify(c)}`);
      assert.ok(Math.abs(p.p[0]) <= s.w / 2 + 6 && Math.abs(p.p[2]) <= s.d / 2 + 3, `${p.name} fora da planta`);
      assert.ok(p.p[1] > -2 && p.p[1] < dims.height + 2, `${p.name} fora da altura`);
      assert.ok(typeof p.name === 'string' && p.name.length > 2);
    }
    assert.ok(Math.abs(dims.top - (BASE_Y + s.floors * FH)) < 1e-9);
  }
});

test('determinismo: a mesma entrada gera exatamente as mesmas pecas', () => {
  for (const c of CASES) assert.equal(JSON.stringify(generate(buildingSpec(c))), JSON.stringify(generate(buildingSpec(c))));
});

test('honestidade: o texto equivalente nao traz contagem de peca nem medida que a pessoa nao informou', () => {
  for (const c of CASES) {
    const txt = describe(buildingSpec(c));
    const nums = txt.match(/\d+/g) ?? [];
    for (const n of nums) assert.equal(Number(n), Math.min(MAX_FLOORS, c.floors), txt);
    assert.match(txt, /ilustrativa/);
  }
});

test('porte: a quantidade de pecas fica limitada no pior caso (8 pavimentos, todas as camadas, area grande)', () => {
  const { parts } = generate(buildingSpec(CASES[5]));
  assert.ok(parts.length < 9000, `pecas: ${parts.length}`);
});

test('enquadramento: os 8 cantos da caixa ficam dentro do quadro na distancia calculada', () => {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (const box of [{ w: 15, h: 9, d: 10 }, { w: 120, h: 26, d: 80 }, { w: 7, h: 12, d: 5 }]) {
    for (const [az, el, fov] of [[38, 27, 30], [16, 34, 30], [0, 89.9, 6], [-120, 10, 30]]) for (const aspect of [0.7, 1.6, 2.4]) {
      const dist = fitBox(box, { az, el, fovDeg: fov, aspect, band: 0.2 });
      const { f, r, u } = cameraBasis(az, el);
      const tanV = Math.tan((fov * Math.PI) / 360);
      let maxX = 0;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const c = [sx * box.w / 2, sy * box.h / 2, sz * box.d / 2];
        const depth = dist + dot(c, f);
        assert.ok(depth > 0);
        const x = Math.abs(dot(c, r) / (depth * tanV * aspect));
        const y = Math.abs(dot(c, u) / (depth * tanV));
        assert.ok(x <= 0.9 + 1e-6 && y <= 0.9 * 0.8 + 1e-6, `fora: ${x},${y}`);
        maxX = Math.max(maxX, x, y / 0.8);
      }
      assert.ok(maxX > 0.9 - 1e-6, 'a distancia nao e a minima');
    }
  }
});

test('estilo moderno (casa de padrao alto): sem telhado de duas aguas, com portico no sobrado e laje em balanco na terrea', () => {
  const names = (c) => new Set(generate(buildingSpec(c)).parts.map((p) => p.name));
  const sob = names({ areaTotal: 320, floors: 2, typology: 'CASA', standard: 'Alto', services: ['ESTRUTURAL'] });
  assert.ok(!sob.has('Telhado') && sob.has('Pórtico') && sob.has('Platibanda'));
  const ter = names({ areaTotal: 180, floors: 1, typology: 'CASA', standard: 'Alto', services: [] });
  assert.ok(!ter.has('Telhado') && ter.has('Laje em balanço') && !ter.has('Pórtico'));
  assert.ok(!names({ areaTotal: 320, floors: 2, typology: 'CASA', standard: 'amplo', services: [] }).has('Telhado'));
  for (const st of ['Econômico', 'Médio', 'Ainda não sei', 'compacto', 'confortavel', undefined]) assert.ok(names({ areaTotal: 320, floors: 2, typology: 'CASA', standard: st, services: [] }).has('Telhado'));
  assert.ok(!names({ areaTotal: 900, floors: 3, typology: 'PREDIO', standard: 'Alto', services: [] }).has('Pórtico'), 'so casa vira moderna');
});

test('a maquete ganha vida com o servico: piscina fantasma sem Hidro e de verdade com Hidro; cor so com Arquitetura', () => {
  const gen = (services) => generate(buildingSpec({ areaTotal: 320, floors: 2, typology: 'CASA', standard: 'Alto', services })).parts;
  const semHidro = gen(['ESTRUTURAL']);
  const piscina = semHidro.filter((p) => p.name === 'Piscina');
  assert.equal(piscina.length, 1);
  assert.equal(piscina[0].mat, 'fantasma');
  assert.equal(piscina[0].layer, 'volume');
  assert.ok(!semHidro.some((p) => ['pedra', 'madeira', 'porta', 'agua', 'deck'].includes(p.mat)), 'sem o servico a peca fica neutra');
  const comTudo = gen(['ARQUITETURA', 'HIDROSSANITARIO']);
  assert.equal(comTudo.find((p) => p.name === 'Piscina').mat, 'agua');
  assert.equal(comTudo.find((p) => p.name === 'Piscina').layer, 'hidrossanitario');
  assert.ok(comTudo.some((p) => p.mat === 'pedra') && comTudo.some((p) => p.mat === 'madeira') && comTudo.some((p) => p.mat === 'porta'));
});

test('padrao economico, medio e nao declarado sao diferentes entre si, sem mudar a projecao', () => {
  const mk = (standard, floors = 1) => { const spec = buildingSpec({ areaTotal: 140 * floors, floors, typology: 'CASA', standard, services: ['ARQUITETURA'] }); return { spec, g: generate(spec) }; };
  const eco = mk('Econômico'); const med = mk('Médio'); const nd = mk(undefined);
  assert.deepEqual([eco.spec.tier, med.spec.tier, nd.spec.tier, mk('Ainda não sei').spec.tier], ['eco', 'medio', null, null]);
  assert.equal(mk('compacto').spec.tier, 'eco');
  assert.equal(mk('confortavel').spec.tier, 'medio');
  assert.equal(buildingSpec({ areaTotal: 900, floors: 3, typology: 'PREDIO', standard: 'Médio' }).tier, null, 'so casa tem faixa');
  for (const c of [eco, med]) { assert.equal(c.spec.w, nd.spec.w); assert.equal(c.spec.d, nd.spec.d); }
  const has = (c, n) => c.g.parts.some((p) => p.name === n);
  assert.ok(has(med, 'Cobertura da varanda') && !has(eco, 'Cobertura da varanda') && !has(nd, 'Cobertura da varanda'));
  assert.ok(!has(med, 'Guarda-corpo') && has(mk('Médio', 2), 'Guarda-corpo'), 'a sacada so existe no sobrado');
  const roof = (c) => c.g.parts.find((p) => p.name === 'Telhado').s;
  assert.ok(roof(eco)[1] < roof(nd)[1] && roof(eco)[0] < roof(nd)[0], 'economico: telhado mais baixo e beiral mais curto');
  const widest = (c) => Math.max(...c.g.parts.filter((p) => p.name === 'Janela').map((p) => Math.max(p.s[0], p.s[2])));
  assert.ok(widest(eco) < widest(nd) && widest(nd) < widest(med));
  assert.ok(!mk('Médio').g.parts.concat(generate(buildingSpec({ areaTotal: 140, floors: 1, typology: 'CASA', standard: 'Médio', services: [] })).parts).filter((p) => p.name === 'Pilar da varanda' && p.layer === 'volume').some((p) => p.mat !== 'neutro'), 'sem Arquitetura o pilar da varanda fica neutro');
});

test('reservatorio: sob o telhado de duas aguas e abaixo do topo da platibanda no sobrado de padrao alto', () => {
  const tank = (c) => { const g = generate(buildingSpec(c)); const t = g.parts.find((p) => p.name === 'Reservatório'); return { topo: t.p[1] + t.s[1] / 2, g, t }; };
  for (const standard of ['Econômico', 'Médio', undefined]) for (const floors of [1, 2]) {
    const { topo, g, t } = tank({ areaTotal: 90 * floors, floors, typology: 'CASA', standard, services: ['HIDROSSANITARIO'] });
    const folga = g.dims.roofH * (1 - (Math.abs(t.p[2]) + t.s[0]) / (g.dims.d / 2 + 0.35));   // altura livre do telhado na borda do reservatório
    assert.ok(topo - g.dims.top <= folga + 1e-6, `reservatorio fora do telhado (${standard}, ${floors} pav.)`);
  }
  const alto = tank({ areaTotal: 320, floors: 2, typology: 'CASA', standard: 'Alto', services: ['HIDROSSANITARIO'] });
  assert.ok(alto.topo < alto.g.dims.top + alto.g.dims.roofH);
});

test('recuo (B4): no sobrado de padrao Alto o terreo recua do lado da piscina; lajes e pavimento de cima ficam com a projecao informada', () => {
  const mk = (o) => { const spec = buildingSpec(o); return { spec, g: generate(spec) }; };
  const alto = mk({ areaTotal: 320, floors: 2, typology: 'CASA', standard: 'Alto', services: ['ARQUITETURA', 'ESTRUTURAL'] });
  const { spec, g } = alto;
  assert.ok(g.dims.recess > 0);
  const paredeMaisDireita = (f) => Math.max(...g.parts.filter((p) => p.name === 'Parede' && p.floor === f).map((p) => p.p[0] + p.s[0] / 2));
  assert.ok(paredeMaisDireita(0) <= spec.w / 2 - g.dims.recess + 1e-6, 'parede do terreo recuada');
  assert.ok(Math.abs(paredeMaisDireita(1) - spec.w / 2) < 1e-6, 'pavimento de cima na projecao');
  for (const l of g.parts.filter((p) => p.name.startsWith('Laje') || p.name === 'Piso térreo')) assert.ok(l.p[0] + l.s[0] / 2 <= spec.w / 2 + 1e-6);
  const lajes = g.parts.filter((p) => p.name === 'Piso térreo');
  assert.ok(lajes.some((p) => Math.abs(p.s[0] - spec.w) < 1e-6 && Math.abs(p.s[2] - spec.d) < 1e-6), 'piso do terreo inteiro: a varanda e coberta e tem piso');
  assert.ok(Math.max(...g.parts.filter((p) => p.name === 'Divisória' && p.floor === 0).map((p) => p.p[0] + p.s[0] / 2)) <= spec.w / 2 - g.dims.recess, 'divisoria nao atravessa a varanda');
  if (g.dims.hole) assert.ok(g.dims.hole.x1 <= spec.w / 2 - g.dims.recess, 'escada dentro da parte fechada');
  for (const o of [{ standard: 'Médio' }, { floors: 1, areaTotal: 160 }, { typology: 'PREDIO' }, { areaTotal: 110 }]) {
    assert.equal(mk({ areaTotal: 320, floors: 2, typology: 'CASA', standard: 'Alto', services: [], ...o }).g.dims.recess, 0, JSON.stringify(o));
  }
});
