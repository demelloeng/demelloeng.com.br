// R05 (HANDOFF_OPUS_R4_V03): painel comercial e legenda. Nomes de quantidade já existentes (Q_PT), motivo do motor
// traduzido sem fundir limite, dado ambíguo e avaliação humana na mesma frase; Arquitetura na legenda só quando a vista
// a desenha; endereço de verificação exibido = o mesmo do QR (ambiente real).
import './support/fator_080.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

import { livePlanModel, rowLabel, legendLayers } from '../src/live_plan.mjs';
import { Q_PT } from '../src/labels.mjs';
import { VERIFY_BASE, verifyUrl, VERIFY_DISPLAY } from '../src/preview.mjs';
import { REASON_ABOVE_AUTOMATIC_LIMIT, REASON_HOURLY_NOT_DISCRIMINATED } from '../src/pricing/engine.mjs';

const LOC = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const build = (extra = {}) => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '200' }, property: 'Casa/sobrado',
  location: LOC, CA5: { value: '2' }, ...extra });
const row = (svc, status, reason, total = null) => ({ state: status === 'CALCULATED' ? 'priced' : reason === REASON_ABOVE_AUTOMATIC_LIMIT ? 'over_limit' : 'pending',
  total, service: { service: svc, status, reason } });

test('R05: Estrutural sem projeção diz qual área falta, com o nome de quantidade já usado no detalhamento', () => {
  const m = livePlanModel(build({ services: ['Estrutural'] }));
  const r = m.rows.find((x) => x.key === 'ESTRUTURAL');
  assert.equal(r.state, 'pending');
  assert.equal(rowLabel(r), `Falta a ${Q_PT.Q_FUNDACAO}`);
  assert.equal(Q_PT.Q_FUNDACAO, 'área de projeção');
});

test('R05: limite, dado ambíguo, inconsistência, sem referência e falta de dado têm frases distintas', () => {
  const labels = [
    rowLabel(row('ESTRUTURAL', 'NEEDS_HUMAN_REVIEW', REASON_ABOVE_AUTOMATIC_LIMIT)),
    rowLabel(row('CONSULTORIA_TECNICA', 'NEEDS_HUMAN_REVIEW', REASON_HOURLY_NOT_DISCRIMINATED)),
    rowLabel(row('ESTRUTURAL', 'NEEDS_HUMAN_REVIEW', 'Q_FUNDACAO maior que Q_SUPERESTRUTURA: inconsistência de escopo')),
    rowLabel(row('INCENDIO', 'NEEDS_HUMAN_REVIEW', 'nenhuma referência externa aplicável')),
    rowLabel(row('ELETRICA', 'NEEDS_HUMAN_REVIEW', 'quantidade essencial (Q_TOTAL) não informada')),
  ];
  assert.equal(new Set(labels).size, labels.length, JSON.stringify(labels));
  assert.equal(labels[0], 'Avaliação da equipe');           // texto existente do limite, preservado
  assert.equal(labels[4], `Falta a ${Q_PT.Q_TOTAL}`);
  assert.equal(rowLabel(row('ESTRUTURAL', 'NEEDS_HUMAN_REVIEW', 'quantidade essencial (Q_SUPERESTRUTURA, Q_FUNDACAO) não informada')),
    `Faltam a ${Q_PT.Q_SUPERESTRUTURA} e a ${Q_PT.Q_FUNDACAO}`);
  assert.equal(rowLabel(row('ESTRUTURAL', 'NEEDS_HUMAN_REVIEW', 'motivo novo qualquer')), 'Aguardando dados');
});

test('R05: Arquitetura entra na legenda só quando a vista ativa a desenha (V05); o fallback não a desenha', () => {
  assert.deepEqual(legendLayers(['estrutura', 'eletrica'], ['arquitetura', 'estrutura', 'eletrica']), ['arquitetura', 'estrutura', 'eletrica']);
  assert.deepEqual(legendLayers(['estrutura', 'eletrica'], null), ['estrutura', 'eletrica']);
  assert.deepEqual(legendLayers(['estrutura'], ['estrutura']), ['estrutura']);
});

test('R05: o endereço de verificação exibido é o mesmo do QR (sem host fixo divergente)', () => {
  assert.equal(VERIFY_DISPLAY, VERIFY_BASE.replace(/^https?:\/\//, '').replace(/\/+$/, ''));
  assert.ok(verifyUrl('abc').includes(VERIFY_DISPLAY));
  assert.equal(VERIFY_DISPLAY, 'demelloeng.com.br/verificar');      // padrão de produção inalterado
});
