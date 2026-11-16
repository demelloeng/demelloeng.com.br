// Testes da transição entre estados da maquete (src/maquete5_transicao.mjs, cópia idêntica da usada pela calculadora).
// Cobre a decisão peça a peça. O que depende do desenho (tempo da animação, transparência na tela, chamadas de desenho)
// fica na página de verificação (verificar-cena.html), que roda no navegador.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingSpec, generate } from '../src/maquete5_building.mjs';
import { transition, keyParts } from '../src/maquete5_transicao.mjs';

// Mesma regra de cor da cena: material fosco tem cor por peça; os demais, branco.
const FOSCO = { parede: 0xf3f1ec, concreto: 0xb4bbc3, fundacao: 0x8d969f, porta: 0x3a3936, neutro: 0xd2d5d7, pedra: 0x9a7b5c, madeira: 0xa9683c, deck: 0xcdb999, escada: 0xd6d1c8, piso: 0x9a958c, fundo: 0x1f5f7d };
const tintOf = (p) => (p.shape === 'box' && FOSCO[p.mat] !== undefined ? FOSCO[p.mat] : 0xffffff);
const ALTO = { areaTotal: 320, floors: 2, typology: 'CASA', standard: 'Alto' };
const parts = (o) => generate(buildingSpec(o)).parts;
// Aplica uma sequência de estados como a cena faz (as que saíram ficam no estado, marcadas, até a próxima troca).
const step = (prev, o, opts) => { const ps = parts(o); const tr = transition(prev, ps, tintOf, opts); return { ps: [...ps, ...tr.leaving], tr, novas: ps }; };

test('primeira montagem: tudo cresce, nada sai, sem revelação', () => {
  const { tr, novas } = step(null, { ...ALTO, services: ['ESTRUTURAL'] });
  assert.ok(novas.every((p) => !p.settled && p.fromHex === null));
  assert.equal(tr.leaving.length, 0);
  assert.equal(tr.reveal, false);
  assert.equal(tr.recolor, false);
});

test('marcar Arquitetura: o acabamento fica no lugar e só muda de cor; só divisórias e escada crescem', () => {
  const a = step(null, { ...ALTO, services: [] });
  const b = step(a.ps, { ...ALTO, services: ['ARQUITETURA'] });
  const mudou = b.novas.filter((p) => p.fromHex !== null);
  assert.ok(mudou.length > 0 && mudou.every((p) => p.settled && p.keep), 'quem muda de cor é peça mantida');
  assert.deepEqual([...new Set(mudou.map((p) => p.name))].sort(), ['Forro do pórtico', 'Pergolado', 'Porta', 'Revestimento']);
  assert.deepEqual([...new Set(b.novas.filter((p) => !p.settled).map((p) => p.name))].sort(), ['Divisória', 'Escada', 'Patamar']);
  assert.equal(b.tr.reveal, true, 'Arquitetura é disciplina nova');
  assert.equal(b.tr.recolor, true);
});

test('desmarcar: o que saiu vira peça de saída, e volta ao estado de antes sem crescer nada', () => {
  const a = step(null, { ...ALTO, services: [] });
  const b = step(a.ps, { ...ALTO, services: ['ARQUITETURA', 'ESTRUTURAL'] });
  const c = step(b.ps, { ...ALTO, services: [] });
  assert.ok(c.tr.leaving.length > 0 && c.tr.leaving.every((p) => p.leaving && p.settled && p.fromHex === null));
  assert.ok(c.tr.leaving.some((p) => p.name === 'Pilar') && c.tr.leaving.some((p) => p.name === 'Divisória'));
  assert.ok(c.novas.every((p) => p.settled), 'nada cresce ao desmarcar');
  assert.equal(c.tr.reveal, false, 'desmarcar não revela');
  // o acabamento volta ao neutro com transição de cor, sem sair
  assert.ok(c.novas.filter((p) => p.name === 'Revestimento').every((p) => p.fromHex === FOSCO.pedra && p.tintHex === FOSCO.neutro));
});

test('repetir o mesmo estado: nada sai, nada cresce, nada muda de cor, sem revelação', () => {
  for (const o of [{ ...ALTO, services: ['ARQUITETURA', 'ESTRUTURAL', 'HIDROSSANITARIO', 'ELETRICA'] }, { areaTotal: 9600, floors: 8, typology: 'PREDIO', services: ['ESTRUTURAL', 'INCENDIO'] }]) {
    const a = step(null, o);
    const b = step(a.ps, o);
    assert.equal(b.tr.leaving.length, 0);
    assert.ok(b.novas.every((p) => p.settled && p.fromHex === null));
    assert.equal(b.tr.reveal, false);
    assert.equal(b.tr.recolor, false);
  }
});

test('peças de saída antigas não voltam como peças do estado anterior', () => {
  const a = step(null, { ...ALTO, services: ['ESTRUTURAL'] });
  const b = step(a.ps, { ...ALTO, services: [] });           // pilares saem
  const c = step(b.ps, { ...ALTO, services: [] });           // mesmo estado de novo
  assert.equal(c.tr.leaving.length, 0, 'a saída de antes não sai de novo');
  const d = step(c.ps, { ...ALTO, services: ['ESTRUTURAL'] });
  assert.ok(d.novas.filter((p) => p.name === 'Pilar').every((p) => !p.settled), 'pilar que saiu cresce de novo ao voltar');
});

test('revelação: só quando entra disciplina nova; não ao mudar padrão, área ou pavimentos', () => {
  const base = { areaTotal: 220, floors: 2, typology: 'CASA', standard: 'Médio', services: ['ARQUITETURA', 'HIDROSSANITARIO'] };
  const a = step(null, base);
  for (const muda of [{ standard: 'Alto' }, { standard: 'Econômico' }, { areaTotal: 300 }, { floors: 1, areaTotal: 160 }]) {
    const b = step(a.ps, { ...base, ...muda });
    assert.equal(b.tr.reveal, false, JSON.stringify(muda));
  }
  assert.equal(step(a.ps, { ...base, services: [...base.services, 'ELETRICA'] }).tr.reveal, true);
});

test('movimento reduzido: a transição nunca pede revelação', () => {
  const a = step(null, { ...ALTO, services: [] });
  const b = step(a.ps, { ...ALTO, services: ['ARQUITETURA', 'ESTRUTURAL'] }, { reduced: true });
  assert.equal(b.tr.reveal, false);
});

test('chave: peça mantida não depende da camada; repetidas ficam distintas', () => {
  const ps = keyParts([{ name: 'Porta', keep: true, layer: 'volume', floor: 0, shape: 'box' }, { name: 'Pilar', layer: 'estrutura', floor: 0, shape: 'box' }, { name: 'Pilar', layer: 'estrutura', floor: 0, shape: 'box' }]);
  const qs = keyParts([{ name: 'Porta', keep: true, layer: 'arquitetura', floor: 0, shape: 'box' }]);
  assert.equal(ps[0].key, qs[0].key);
  assert.notEqual(ps[1].key, ps[2].key);
});
