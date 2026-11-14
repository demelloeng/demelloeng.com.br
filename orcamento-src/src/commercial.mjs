// R4/R15 — oferta comercial (cupom) nas superfícies do site: tela, PNG, resumo e encaminhamento.
// Regra do desconto: pricing/coupon.mjs (cópia idêntica do Worker; não editar aqui). Este módulo só FORMATA e AMARRA:
//   - o que a tela mostra ANTES da emissão vem de applyCoupon(estimativa, cupom consultado no Worker);
//   - o que a tela, o PNG, o resumo e o lead mostram DEPOIS vem do registro emitido (record.preview.commercial).
import { brlStr } from './pricing/decimal.mjs';
import { applyCoupon } from './pricing/coupon.mjs';

// "10" -> "10%", "12.5" -> "12,5%"; FIXED "500" -> "R$ 500,00".
export function benefitLabel(kind, value) {
  if (kind === 'PERCENT') return `${String(value).replace('.', ',')}%`;
  if (kind === 'FIXED') return brlStr(String(value));
  return String(value ?? '');
}

// Projeção pública do Worker {base_total, coupon_code, coupon_kind, coupon_value, discount, final_total} -> textos.
export function commercialLines(pub) {
  if (!pub || typeof pub !== 'object' || typeof pub.final_total !== 'string' || typeof pub.coupon_code !== 'string') return null;
  return {
    base: brlStr(pub.base_total),
    code: pub.coupon_code,
    benefit: benefitLabel(pub.coupon_kind, pub.coupon_value),
    discount: brlStr(pub.discount),
    final: brlStr(pub.final_total),
  };
}

// Oferta calculada no navegador (forma interna de applyCoupon) -> mesma forma pública, para exibir antes da emissão.
export function publicFromOffer(offer) {
  if (!offer) return null;
  return {
    base_total: offer.base_total, coupon_code: offer.coupon.code, coupon_kind: offer.coupon.kind,
    coupon_value: offer.coupon.value, discount: offer.discount, final_total: offer.final_total,
  };
}

// Oferta para a tela antes da emissão: nunca lança (cupom malformado = sem oferta).
export function safeOffer(pricingPreview, coupon) {
  if (!coupon) return null;
  try { return applyCoupon(pricingPreview, coupon); } catch { return null; }
}

// Encaminhamento (lead): a oferta só vai junto quando a prévia EMITIDA trouxe exatamente o desconto que a regra
// reproduz sobre o pricing_preview do próprio lead. Forma interna (com revisão), a mesma que o validador de intake
// reproduz (demello_coupon.offer_errors). Se o visitante mudou o caso depois da emissão, nada é anexado.
// emitted = { record: PUBLIC_PREVIEW_V1, coupon: COUPON_V1 consultado }.
export function leadCommercialOffer(pricingPreview, emitted) {
  const pub = emitted && emitted.record && emitted.record.preview && emitted.record.preview.commercial;
  if (!pub || !emitted.coupon) return null;
  const offer = safeOffer(pricingPreview, emitted.coupon);
  if (!offer) return null;
  const same = offer.coupon.code === pub.coupon_code && offer.coupon.kind === pub.coupon_kind &&
    offer.coupon.value === pub.coupon_value && offer.base_total === pub.base_total &&
    offer.discount === pub.discount && offer.final_total === pub.final_total;
  return same ? offer : null;
}

// Anexa ao payload do lead a oferta e o código da prévia que a registrou. Sem oferta válida, o payload volta intacto.
export function attachCommercialOffer(payload, emitted) {
  const offer = leadCommercialOffer(payload && payload.pricing_preview, emitted);
  if (!offer) return payload;
  return { ...payload, commercial_offer: offer, preview_verification_code: emitted.record.verification_code };
}
