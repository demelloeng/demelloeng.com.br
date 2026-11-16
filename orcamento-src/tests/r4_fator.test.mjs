// R4 — fator da configuração comercial no site (estado inicial: revisão 1, 0,60). SEM o pino de 0,80.
// Casos do HANDOFF_OPUS_R4_V03 §Sequência 6: sobrado 320 m² / projeção 160 m², quatro serviços = R$ 12.509,76.
import test from 'node:test';
import assert from 'node:assert/strict';

import { pricePreview, getFactorConfig, setFactorConfig, resetFactorConfig, refreshFactorConfig, onFactorConfig, configUrl }
  from '../src/pricing/active_config.mjs';
import { buildPricingPreview } from '../src/pricing/engine.mjs';
import { expectationFromPreview, issuePreview, FACTOR_CHANGED_REASON } from '../src/preview.mjs';

const SOBRADO = { services: ['ARQUITETURA', 'ESTRUTURAL', 'HIDROSSANITARIO', 'ELETRICA'], typology: 'CASA',
  area_new: '320', area_total: '320', area_fundacao: '160', structural_system: 'CONCRETO_ARMADO', structural_scope: 'FULL' };
const lines = (pv) => Object.fromEntries(pv.services.map((s) => [s.service, s.demello.total]));
const jsonResponse = (status, body) => ({ status, json: async () => body });

test.beforeEach(() => resetFactorConfig());

test('R4: o site parte da revisão publicada (1, 0,60) e o sentinela dá R$ 12.509,76', () => {
  assert.deepEqual(getFactorConfig(), { revision: 1, factor_demello: '0.60' });
  const pv = pricePreview(SOBRADO);
  assert.equal(pv.pricing_rule, 'STRUCT_COMPOSITE_REFS_R2_FC');
  assert.equal(pv.factor_config_revision, 1);
  assert.equal(pv.total_demello, '12509.76');
  assert.deepEqual(lines(pv), { ARQUITETURA: '6268.80', ESTRUTURAL: '3921.60', HIDROSSANITARIO: '1121.28', ELETRICA: '1198.08' });
});

test('R4: terraplenagem isolada (lote 500 = R$ 120,00; sem área, avaliação humana) e consultoria 2 h = R$ 258,12', () => {
  assert.equal(pricePreview({ services: ['TERRAPLENAGEM'], typology: 'CASA', area_terreno: '500' }).total_demello, '120.00');
  assert.equal(pricePreview({ services: ['TERRAPLENAGEM'], typology: 'CASA' }).status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(pricePreview({ services: ['CONSULTORIA_TECNICA'], hours: '2' }).total_demello, '258.12');
});

test('R4: o motor nunca cai no 0,80 da tabela; sem configuração, recusa', () => {
  assert.throws(() => buildPricingPreview(SOBRADO));
  assert.throws(() => setFactorConfig({ revision: 2, factor_demello: '0' }));
  assert.deepEqual(getFactorConfig(), { revision: 1, factor_demello: '0.60' }, 'configuração inválida não substitui a ativa');
});

test('R4: refreshFactorConfig troca a configuração, avisa a tela e a estimativa acompanha', async () => {
  const seen = [];
  const off = onFactorConfig((c) => seen.push(c.revision));
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push([url, opts.method, opts.cache]);
    return jsonResponse(200, { schema: 'PRICING_CONFIG_V1', pricing_rule: 'STRUCT_COMPOSITE_REFS_R2_FC', revision: 2, factor_demello: '0.75' }); };
  const r = await refreshFactorConfig({ endpoint: 'https://w/api/previews/v1/', fetchImpl });
  off();
  assert.deepEqual(r, { ok: true, changed: true, status: 200 });
  assert.deepEqual(calls, [['https://w/api/previews/v1/pricing-config', 'GET', 'no-store']]);
  assert.deepEqual(seen, [2]);
  assert.equal(pricePreview(SOBRADO).total_demello, '15637.20');
  // mesma revisão de novo: nada muda, ninguém é avisado
  const again = await refreshFactorConfig({ endpoint: 'https://w/api/previews/v1', fetchImpl });
  assert.equal(again.changed, false);
});

test('R4: falha ou resposta estranha do Worker mantém a configuração publicada (nunca lança)', async () => {
  for (const fetchImpl of [
    async () => jsonResponse(503, { error: 'CONFIG_UNAVAILABLE' }),
    async () => jsonResponse(200, { schema: 'OUTRA', revision: 9, factor_demello: '0.1' }),
    async () => jsonResponse(200, { schema: 'PRICING_CONFIG_V1', revision: 0, factor_demello: '0.6' }),
    async () => { throw new TypeError('rede'); },
  ]) {
    const r = await refreshFactorConfig({ endpoint: 'https://w/api/previews/v1', fetchImpl });
    assert.equal(r.ok, false);
    assert.deepEqual(getFactorConfig(), { revision: 1, factor_demello: '0.60' });
  }
  assert.deepEqual(await refreshFactorConfig({}), { ok: false, changed: false, status: 0 });
  assert.equal(configUrl('https://x/api/previews/v1'), 'https://x/api/previews/v1/pricing-config');
});

test('R4: a expectativa enviada ao Worker leva a revisão; 409 de revisão vira factorChanged (sem reemitir)', async () => {
  const pv = pricePreview(SOBRADO);
  assert.equal(expectationFromPreview(pv).factor_config_revision, 1);
  let posts = 0;
  const fetchImpl = async () => { posts += 1;
    return { status: 409, json: async () => ({ error: 'PRICING_VERSION_MISMATCH', reason: FACTOR_CHANGED_REASON }) }; };
  const r = await issuePreview(SOBRADO, {}, { endpoint: 'https://w/api/previews/v1', fetchImpl, presented: pv });
  assert.equal(r.ok, false);
  assert.equal(r.outdated, true);
  assert.equal(r.factorChanged, true);
  assert.equal(posts, 1, '4xx é final: nenhuma segunda tentativa');
});
