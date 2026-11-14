// R4/R15 — cupom DEMELLO sobre a estimativa. Porte fiel de scripts/demello_coupon.py (autoridade).
// CÓPIA IDÊNTICA em demelloeng.com.br/orcamento-src/src/pricing/coupon.mjs (gate: test/coupon_copy.test.mjs).
// O cupom NÃO entra no pricing_preview: gera o bloco {base_total, coupon, discount, final_total}.
//   PERCENT: 0 < p <= 100, até 2 casas; desconto = round_half_up(base × p / 100, 2); final = base − desconto.
//   FIXED:   valor > 0, até 2 casas; desconto = min(valor, base); final = base − desconto.
// Estimativa não calculada (avaliação humana): o cupom não se aplica (null).
import { dec, mul, sub, cmp, money, toStr } from './decimal.mjs';

export const COUPON_KINDS = ['PERCENT', 'FIXED'];
const CODE_RE = /^[A-Z0-9-]{3,32}$/;

export function normalizeCouponCode(raw) {
  const code = String(raw ?? '').replace(/\s+/g, '').toUpperCase();
  if (!CODE_RE.test(code)) throw new Error('Código de cupom inválido: use 3 a 32 letras, números ou hífen.');
  return code;
}

function strip(d) {
  let { n, e } = d;
  while (e > 0 && n % 10n === 0n) { n /= 10n; e -= 1; }
  return { n, e };
}

export function parseBenefit(kind, value) {
  if (!COUPON_KINDS.includes(kind)) throw new Error('Tipo de cupom inválido.');
  const s = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('Valor do cupom inválido.');
  const v = strip(dec(s));
  if (v.n <= 0n) throw new Error('O valor do cupom precisa ser maior que zero.');
  if (v.e > 2) throw new Error('Use no máximo duas casas decimais no cupom.');
  if (kind === 'PERCENT' && cmp(v, dec('100')) > 0) throw new Error('O percentual do cupom vai até 100%.');
  return v;
}

export function applyCoupon(pricingPreview, coupon) {
  if (!pricingPreview || pricingPreview.status !== 'CALCULATED' || typeof pricingPreview.total_demello !== 'string') return null;
  const base = dec(pricingPreview.total_demello);
  const value = parseBenefit(coupon.kind, coupon.value);
  let discount;
  if (coupon.kind === 'PERCENT') discount = dec(money({ n: mul(base, value).n, e: mul(base, value).e + 2 }));
  else discount = cmp(value, base) < 0 ? value : base;
  return {
    base_total: money(base),
    coupon: { code: normalizeCouponCode(coupon.code), kind: coupon.kind, value: toStr(value), revision: Number(coupon.revision) },
    discount: money(discount),
    final_total: money(sub(base, dec(money(discount)))),
  };
}
