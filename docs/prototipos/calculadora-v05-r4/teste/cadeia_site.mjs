// R07 — lado SITE do roteiro do Gate B, com os módulos REAIS do site (orcamento-src/src), contra os serviços locais.
// Nada aqui reimplementa regra: monta o pedido, consulta o cupom, emite a prévia, anexa a oferta e envia o pedido
// exatamente como a tela faz; a página /verificar/ servida localmente roda num sandbox com fetch real.
//
// Uso: node cadeia_site.mjs '<json>'  -> imprime um JSON. Comandos ({"cmd": ...}):
//   emitir     {coupon_code?, coupon_cached?, emission_key?, area?}   consulta cupom (se houver), emite, devolve registro e flags
//   cupom      {code}                                     só a consulta do cupom (como o botão "Aplicar cupom")
//   emitir_cru {body}                                      POST cru (para chave repetida com corpo diferente)
//   verificar  {code}                                      abre /verificar/?codigo= local e devolve o texto exibido
//   pedido     {record, coupon, area?}                     anexa a oferta do registro e envia ao harness de intake
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..', '..', '..', '..', 'orcamento-src', 'src');
const load = (m) => import(pathToFileURL(path.join(src, m)).href);
const { packageForCRMv2 } = await load('payload_v2.mjs');
const { issuePreview, fetchCoupon, caseSummaryFromRows } = await load('preview.mjs');
const { refreshFactorConfig } = await load('pricing/active_config.mjs');
const { attachCommercialOffer } = await load('commercial.mjs');
const { submitToCRM } = await load('submit.mjs');
const { friendlyServiceName } = await load('client_summary.mjs');

const SITE = process.env.TESTE_SITE || 'http://127.0.0.1:8796';
const PREVIA = process.env.TESTE_PREVIA || 'http://127.0.0.1:8797/api/previews/v1';
const INTAKE = process.env.TESTE_INTAKE || 'http://127.0.0.1:8788/api/site-intake';
// O navegador manda a origem da página; aqui ela é declarada (o Worker e o harness só aceitam a origem local).
const fetchFromSite = (url, opts = {}) => fetch(url, { ...opts, headers: { ...(opts.headers || {}), Origin: SITE } });

const LOC = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const sobrado = (area = '320') => ({ route: 'build', CA1: 'Construir do zero', CA_AREA: { value: area }, property: 'Casa/sobrado', location: LOC,
  phase: 'Só uma ideia / estudo', CA5: { value: '2' }, CA6: 'Alto', services: ['Arquitetura', 'Estrutural', 'Hidrossanitário', 'Elétrica'],
  area_fundacao: { value: '160' }, deadline: 'Ainda sem prazo',
  contact: { name: 'Pessoa Ficticia Gate B', whatsapp: '', email: 'gate-b@exemplo.invalid' } });

async function caso(area) {
  await refreshFactorConfig({ endpoint: PREVIA, fetchImpl: fetch });   // como a tela na abertura: revisão ativa do fator
  const payload = packageForCRMv2(sobrado(area));
  const pv = payload.pricing_preview;
  const cs = caseSummaryFromRows(payload.summary, pv.services.map(friendlyServiceName));
  return { payload, pv, cs };
}

const cmds = {
  // coupon_cached: cupom consultado ANTES (a tela guarda o que o Worker respondeu); simula desativação/alteração depois.
  async emitir({ coupon_code, coupon_cached, emission_key, area }) {
    const { payload, pv, cs } = await caso(area);
    let coupon = coupon_cached || null, couponLookup = null;
    if (coupon_code && !coupon_cached) {
      couponLookup = await fetchCoupon(coupon_code, { endpoint: PREVIA, fetchImpl: fetch });
      if (couponLookup.ok) coupon = couponLookup.coupon;
    }
    const r = await issuePreview(payload.pricing_inputs, cs, { endpoint: PREVIA, fetchImpl: fetchFromSite, presented: pv,
      couponCode: coupon ? coupon.code : undefined, coupon, emissionKey: emission_key });
    return { presented_total: pv.total_demello, factor_config_revision: pv.factor_config_revision, couponLookup,
      coupon, ok: r.ok, status: r.status, error: r.error || null, flags: { outdated: !!r.outdated, factorChanged: !!r.factorChanged,
        couponChanged: !!r.couponChanged, couponInvalid: !!r.couponInvalid }, emissionKey: r.emissionKey, record: r.record || null };
  },
  async cupom({ code }) {
    return fetchCoupon(code, { endpoint: PREVIA, fetchImpl: fetch });
  },
  async emitir_cru({ body }) {
    const res = await fetchFromSite(PREVIA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let json = null; try { json = await res.json(); } catch { json = null; }
    return { status: res.status, body: json };
  },
  async verificar({ code }) {
    const html = await (await fetch(`${SITE}/verificar/`)).text();
    const logic = html.match(/<script>\n(\(function[\s\S]*?\n\}\)\(\);)\n<\/script>/)[1];
    const out = { innerHTML: '' };
    vm.runInNewContext(logic, { document: { getElementById: () => out }, location: { search: `?codigo=${encodeURIComponent(code)}` },
      URLSearchParams, encodeURIComponent, fetch });
    for (let i = 0; i < 50 && (!out.innerHTML || /Consultando|Verificando/i.test(out.innerHTML)); i += 1) await new Promise((r) => setTimeout(r, 100));
    return { endpoint_local: html.includes(PREVIA.replace(/\/?$/, '/')), text: out.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
  },
  async pedido({ record, coupon, area }) {
    const { payload } = await caso(area);
    const lead = attachCommercialOffer(payload, record ? { record, coupon } : null);
    const r = await submitToCRM(lead, '', { endpoint: INTAKE, fetchImpl: fetchFromSite });
    return { ok: r.ok, status: r.status, submission_id: (r.body && r.body.submission_id) || r.submission_id || null, result: r,
      commercial_offer: lead.commercial_offer || null, preview_verification_code: lead.preview_verification_code || null };
  },
};

const input = JSON.parse(process.argv[2] || '{}');
const fn = cmds[input.cmd];
if (!fn) { console.error(`comando desconhecido: ${input.cmd}`); process.exit(2); }
try {
  console.log(JSON.stringify(await fn(input)));
} catch (err) {
  console.log(JSON.stringify({ exception: String(err && err.stack || err) }));
}
