// Motor de previsão DEMELLO V2 (regime STRUCT_COMPOSITE_REFS_R1) no browser — porte fiel de scripts/site_intake_pricing.py.
// Determinístico, sem rede. Mesmo pricing_inputs => mesmo pricing_preview do Python.
import TABLE from './pricing-table.v2.json' with { type: 'json' };
import { dec, num, add, sub, mul, absD, cmp, toStr, money, brl, numberOut } from './decimal.mjs';

// Regime CORRENTE (única EMISSÃO): table_version DEMELLO_V2 + pricing_rule STRUCT_COMPOSITE_REFS_R1.
// Regimes históricos (DEMELLO_V1 legado e STRUCT_INCL_FOUNDATIONS_V2) são só REPRODUZIDOS pelo motor Python
// canônico (validate_payload_v2); este motor JAMAIS os emite.
const TABLE_VERSION = 'DEMELLO_V2';
const PRICING_RULE = 'STRUCT_COMPOSITE_REFS_R1';
const STRUCTURAL_SYSTEMS = ['CONCRETO_ARMADO', 'METALICA', 'MADEIRA'];
const STRUCTURAL_SCOPES = ['FULL', 'FOUNDATION_ONLY'];
const COMPONENT_STATES = ['DETERMINED', 'NOT_REQUIRED', 'UNDETERMINED'];
const CALC = 'CALCULATED';
const REVIEW = 'NEEDS_HUMAN_REVIEW';

const REASON_SYSTEM_SCOPE_UNDOCUMENTED = 'SYSTEM_SCOPE_UNDOCUMENTED';
const REASON_TYPOLOGY_NOT_APPLICABLE = 'TYPOLOGY_NOT_APPLICABLE';
const REASON_TYPOLOGY_NOT_CONFIRMED = 'TYPOLOGY_NOT_CONFIRMED';
const REASON_SYSTEM_NOT_INCORPORATED = 'SYSTEM_NOT_INCORPORATED';
const REASON_NO_REFERENCE_FOR_TYPOLOGY = 'NO_REFERENCE_FOR_TYPOLOGY';

const CUSTOMER_FALLBACK_TEXT =
  'A DEMELLO precisa entrar em contato para entender melhor o seu problema. ' +
  'Iremos verificar as informações fornecidas e retornar assim que possível.';

if (TABLE.table_version !== TABLE_VERSION) throw new Error('pricing-table.v2.json: table_version inesperada');
const FACTOR = dec(String(TABLE.factor_demello));
const TYPOLOGIES = TABLE.typologies;

// Componentes (superestrutura + fundação) precisam bater com o total publicado (mesmo pacote, uma vez).
function verifyStructuralTotals(table) {
  const est = table.services.ESTRUTURAL;
  const sup = est.components.SUPERESTRUTURA;
  const fun = est.components.FUNDACAO;
  const chk = est.published_totals_check;
  for (const [system, published] of Object.entries(chk.SECID_PR)) {
    const total = add(dec(sup.SECID_PR.by_structural_system[system]), dec(fun.SECID_PR.unit_value));
    if (cmp(total, dec(published)) !== 0) throw new Error(`ESTRUTURAL: componentes SECID/PR ${system} != total publicado`);
  }
  const fundFp = dec(fun.FUNDEPAR_001_2025.unit_value);
  const fp = sup.FUNDEPAR_001_2025;
  if (cmp(add(dec(fp.by_structural_system.CONCRETO_ARMADO), fundFp), dec(chk.FUNDEPAR_001_2025.CONCRETO_ARMADO)) !== 0) {
    throw new Error('ESTRUTURAL: componentes FUNDEPAR CA != total publicado');
  }
  const bands = chk.FUNDEPAR_001_2025.METALICA_BY_AREA;
  if (bands) {
    fp.metalica_by_area.forEach((band, i) => {
      if (cmp(add(dec(band.unit_value), fundFp), dec(bands[i])) !== 0) {
        throw new Error('ESTRUTURAL: componentes FUNDEPAR metalica != total publicado');
      }
    });
  }
}
verifyStructuralTotals(TABLE);

function upper(v) { return typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : null; }

function componentState(v) {
  if (v === true) return 'DETERMINED';
  if (v === false) return 'NOT_REQUIRED';
  const t = upper(v);
  return COMPONENT_STATES.includes(t) ? t : 'UNDETERMINED';
}

// `hours_by_service` = { CODIGO_DO_SERVICO: horas }. Ausente/não-objeto => null. Valor inválido => null (nunca inferido).
function hoursByService(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = upper(k);
    if (key) out[key] = num(v);
  }
  return out;
}

export function extractPricingInputs(pi) {
  pi = pi && typeof pi === 'object' ? pi : {};
  const reg = pi.regularizacao && typeof pi.regularizacao === 'object' ? pi.regularizacao : {};
  const services = (Array.isArray(pi.services) ? pi.services : [])
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => s.trim().toUpperCase());
  const typology = upper(pi.typology);
  const structuralSystem = upper(pi.structural_system);
  const structuralScope = upper(pi.structural_scope);
  const hidro = pi.hidro_scope_includes_existing;
  const foundationsSelected = pi.foundations_selected;
  return {
    services,
    typology: TYPOLOGIES.includes(typology) ? typology : null,
    structural_system: STRUCTURAL_SYSTEMS.includes(structuralSystem) ? structuralSystem : null,
    structural_scope: STRUCTURAL_SCOPES.includes(structuralScope) ? structuralScope : null,
    area_existing: num(pi.area_existing),
    area_new: num(pi.area_new),
    area_total: num(pi.area_total),
    area_atendida: num(pi.area_atendida),
    area_terreno: num(pi.area_terreno),
    area_escopo: num(pi.area_escopo),
    area_fundacao: num(pi.area_fundacao), // Q_FUNDACAO: área de projeção (footprint); nunca estimada
    hours: num(pi.hours), // Q_HORAS
    hours_by_service: hoursByService(pi.hours_by_service), // Q_HORAS discriminado por serviço (opcional)
    reg_area_matricula: num(reg.area_matricula),
    reg_area_iptu: num(reg.area_iptu),
    reg_levantamento: componentState(reg.levantamento),
    reg_projeto_legal: componentState(reg.projeto_legal),
    hidro_scope_includes_existing: hidro === null || hidro === undefined ? null : Boolean(hidro),
    foundations_selected:
      foundationsSelected === null || foundationsSelected === undefined ? null : Boolean(foundationsSelected),
  };
}

const isPositive = (d) => d !== null && d !== undefined && d.n > 0n;

// Quantidade de uma base Q_*. Nunca infere área inexistente.
function qFromBasis(basis, inp) {
  const ae = inp.area_existing;
  const an = inp.area_new;
  const at = inp.area_total;
  let q = null;
  if (basis === 'Q_NOVA' || basis === 'Q_SUPERESTRUTURA') {
    if (an !== null) q = an;
    else if (ae === null && at !== null) q = at;
  } else if (basis === 'Q_TOTAL') {
    if (ae !== null && an !== null) q = add(ae, an);
    else if (at !== null) q = at;
    else if (ae !== null) q = ae;
    else if (an !== null) q = an;
  } else if (basis === 'Q_ATENDIDA') q = inp.area_atendida;
  else if (basis === 'Q_TERRENO') q = inp.area_terreno;
  else if (basis === 'Q_ESCOPO') q = inp.area_escopo;
  else if (basis === 'Q_FUNDACAO') q = isPositive(inp.area_fundacao) ? inp.area_fundacao : null;
  else if (basis === 'Q_HORAS') q = isPositive(inp.hours) ? inp.hours : null;
  else if (basis === 'Q_REGULARIZACAO') {
    if (inp.reg_area_matricula !== null && inp.reg_area_iptu !== null) {
      q = absD(sub(inp.reg_area_iptu, inp.reg_area_matricula));
    }
  }
  return q;
}

function bandValue(bands, q) {
  for (const band of bands) {
    const lo = 'q_min_exclusive' in band ? dec(band.q_min_exclusive) : null;
    const hi = 'q_max' in band ? dec(band.q_max) : null;
    if (lo !== null && !(cmp(q, lo) > 0)) continue;
    if (hi !== null && !(cmp(q, hi) <= 0)) continue;
    return dec(band.unit_value);
  }
  return null;
}

// null se a referência se aplica à tipologia; senão o código do motivo (nunca infere aplicabilidade).
function typologyGate(ref, typology) {
  const allowed = ref.applicable_typologies;
  if (!allowed || allowed.includes(typology)) return null;
  if ((ref.not_confirmed_typologies || []).includes(typology)) return REASON_TYPOLOGY_NOT_CONFIRMED;
  return REASON_TYPOLOGY_NOT_APPLICABLE;
}

// [unit, null] ou [null, motivo]
function superUnit(source, supTbl, ctx, qSup) {
  const ref = supTbl[source];
  const typology = ctx.typology;
  const system = ctx.structural_system;
  const gate = typologyGate(ref, typology);
  if (gate) return [null, gate];
  if (source === 'SECID_PR') return [dec(ref.by_structural_system[system]), null];
  if (source === 'ALTOQI') {
    if (!Object.prototype.hasOwnProperty.call(ref.by_typology, typology)) return [null, REASON_NO_REFERENCE_FOR_TYPOLOGY];
    if (!ref.applicable_structural_systems.includes(system)) return [null, REASON_SYSTEM_SCOPE_UNDOCUMENTED];
    return [dec(ref.by_typology[typology]), null];
  }
  // FUNDEPAR_001_2025
  if (ref.by_structural_system && Object.prototype.hasOwnProperty.call(ref.by_structural_system, system)) {
    return [dec(ref.by_structural_system[system]), null];
  }
  if (system === 'METALICA') {
    const value = bandValue(ref.metalica_by_area, qSup);
    return value !== null ? [value, null] : [null, REASON_SYSTEM_NOT_INCORPORATED];
  }
  return [null, REASON_SYSTEM_NOT_INCORPORATED];
}

function foundationUnit(source, funTbl, ctx) {
  const ref = funTbl[source];
  const gate = typologyGate(ref, ctx.typology);
  if (gate) return [null, gate];
  return [dec(ref.unit_value), null];
}

function structuralContext(inp) {
  if (inp.structural_scope === 'FOUNDATION_ONLY') {
    // Só fundação: o sistema da superestrutura não entra no preço nem gera gap.
    return { typology: inp.typology, structural_scope: 'FOUNDATION_ONLY' };
  }
  const declared = inp.structural_system;
  return {
    typology: inp.typology,
    structural_system: declared || 'CONCRETO_ARMADO',
    structural_system_default_used: declared === null,
    structural_scope: 'FULL',
    foundations_included: true,
    foundations_selection: inp.foundations_selected ? 'EXPLICIT' : 'IMPLIED_BY_STRUCTURAL',
  };
}

function qInputsStructural(inp) {
  return {
    area_existing: numberOut(inp.area_existing),
    area_new: numberOut(inp.area_new),
    area_fundacao: numberOut(inp.area_fundacao),
  };
}

function structuralReview(inp, ctx, basis, reason) {
  return {
    service: 'ESTRUTURAL', status: REVIEW, q: null, q_basis: basis,
    q_inputs: qInputsStructural(inp), pricing_context: ctx, reason,
  };
}

// ESTRUTURAL: MIN entre TOTAIS de mesmo escopo, com Q_SUPERESTRUTURA e Q_FUNDACAO distintos.
// TOTAL = SUPER x Q_SUPERESTRUTURA + FUNDACAO x Q_FUNDACAO (cada componente na sua própria fonte); a AltoQi é
// referência de superestrutura e entra como referência composta (+ fundação SECID/PR).
// Quantidade ausente/inconsistente => NEEDS_HUMAN_REVIEW (nunca preço aproximado).
function priceStructural(inp) {
  const svcTbl = TABLE.services.ESTRUTURAL;
  const ctx = structuralContext(inp);
  const foundationOnly = ctx.structural_scope === 'FOUNDATION_ONLY';
  const qFun = qFromBasis('Q_FUNDACAO', inp);
  const qSup = foundationOnly ? null : qFromBasis('Q_SUPERESTRUTURA', inp);
  let basis;
  if (foundationOnly) {
    basis = 'Q_FUNDACAO';
    if (qFun === null) return structuralReview(inp, ctx, basis, 'quantidade essencial (Q_FUNDACAO) não informada');
  } else {
    basis = 'Q_SUPERESTRUTURA';
    const missing = [['Q_SUPERESTRUTURA', qSup], ['Q_FUNDACAO', qFun]].filter(([, v]) => v === null).map(([n]) => n);
    if (missing.length) return structuralReview(inp, ctx, basis, `quantidade essencial (${missing.join(', ')}) não informada`);
    if (cmp(qFun, qSup) > 0) {
      return structuralReview(inp, ctx, basis, 'Q_FUNDACAO maior que Q_SUPERESTRUTURA: inconsistência de escopo');
    }
  }

  const supTbl = svcTbl.components.SUPERESTRUTURA;
  const funTbl = svcTbl.components.FUNDACAO;
  const candidates = [];
  const excluded = [];
  if (foundationOnly) {
    for (const ref of svcTbl.foundation_only_references) {
      const [unit, why] = foundationUnit(ref.fundacao_source, funTbl, ctx);
      if (unit === null) { excluded.push({ source: ref.id, reason: why }); continue; }
      candidates.push({
        id: ref.id, key: ref.public_key, total: mul(unit, qFun),
        components: { fundacao: { source: ref.fundacao_source, unit_value: toStr(unit), q: numberOut(qFun) } },
      });
    }
  } else {
    for (const ref of svcTbl.complete_scope_references) {
      const [sUnit, sWhy] = superUnit(ref.superestrutura_source, supTbl, ctx, qSup);
      const [fUnit, fWhy] = foundationUnit(ref.fundacao_source, funTbl, ctx);
      if (sUnit === null || fUnit === null) { excluded.push({ source: ref.id, reason: sWhy || fWhy }); continue; }
      candidates.push({
        id: ref.id, key: ref.public_key, total: add(mul(sUnit, qSup), mul(fUnit, qFun)),
        components: {
          superestrutura: { source: ref.superestrutura_source, unit_value: toStr(sUnit), q: numberOut(qSup) },
          fundacao: { source: ref.fundacao_source, unit_value: toStr(fUnit), q: numberOut(qFun) },
        },
      });
    }
  }
  if (candidates.length === 0) return structuralReview(inp, ctx, basis, 'nenhuma referência externa aplicável');

  let winner = candidates[0];
  for (const cand of candidates.slice(1)) if (cmp(cand.total, winner.total) < 0) winner = cand;
  const demelloUnrounded = mul(winner.total, FACTOR);
  const references = {};
  for (const c of candidates) references[c.key] = { total: money(c.total), components: c.components };
  const entry = {
    service: 'ESTRUTURAL', status: CALC,
    q: numberOut(foundationOnly ? qFun : qSup), q_basis: basis, q_inputs: qInputsStructural(inp),
    pricing_context: ctx, references, base_reference: winner.id,
    demello: { unrounded_total: toStr(demelloUnrounded), total: money(demelloUnrounded) },
    package: {
      scope: foundationOnly ? 'FUNDACAO_ISOLADA' : 'ESTRUTURA_COMPLETA_COM_FUNDACOES',
      references_compared: candidates.map((c) => c.id),
      excluded_references: excluded,
    },
  };
  if (!foundationOnly) entry.q_fundacao = numberOut(qFun);
  return entry;
}

function serviceContext(service, inp) {
  if (service === 'REGULARIZACAO') {
    return {
      components: { arquitetonico: 'DETERMINED', levantamento: inp.reg_levantamento, projeto_legal: inp.reg_projeto_legal },
    };
  }
  return { typology: inp.typology };
}

function qBasisFor(service, inp, svcTbl) {
  if (service === 'HIDROSSANITARIO' && inp.hidro_scope_includes_existing === true) {
    return svcTbl.q_basis_if_scope_includes_existing || svcTbl.q_basis || 'Q_NOVA';
  }
  return svcTbl.q_basis || 'Q_NOVA';
}

// Valor unitário de uma fonte para um serviço NÃO estrutural (null = não aplicável).
function referenceUnit(service, ref, ctx) {
  const allowed = ref.applicable_typologies;
  if (allowed && !allowed.includes(ctx.typology)) return null;
  if (service === 'REGULARIZACAO') {
    const comps = ref.components || {};
    if (!('ARQUITETONICO' in comps)) return null;
    let total = dec(comps.ARQUITETONICO.unit_value);
    if (ctx.components.levantamento === 'DETERMINED' && 'LEVANTAMENTO' in comps) total = add(total, dec(comps.LEVANTAMENTO.unit_value));
    if (ctx.components.projeto_legal === 'DETERMINED' && 'PROJETO_LEGAL' in comps) total = add(total, dec(comps.PROJETO_LEGAL.unit_value));
    return total;
  }
  if ('unit_value' in ref) return dec(ref.unit_value);
  const byTyp = ref.by_typology || {};
  return ctx.typology && Object.prototype.hasOwnProperty.call(byTyp, ctx.typology) ? dec(byTyp[ctx.typology]) : null;
}

// `hours` é um ÚNICO escalar: só vale com exatamente UM serviço horário (Q_HORAS); nunca é dividido nem replicado.
// `hours_by_service` (opcional) discrimina as horas por serviço: com 2+ serviços horários só calcula se cobrir TODOS
// com valores > 0; incompleto => NEEDS_HUMAN_REVIEW. Com 1 serviço horário tem precedência sobre `hours`.
// Paridade com scripts/site_intake_pricing.py (_resolve_hours).
export const REASON_HOURLY_NOT_DISCRIMINATED = 'quantidade horária (Q_HORAS) insuficientemente discriminada entre os serviços horários';
export function hourlyServices(inp) {
  return inp.services.filter((s) => (TABLE.services[s] || {}).q_basis === 'Q_HORAS');
}
export function resolveHours(service, inp, hourly) {
  const hbs = inp.hours_by_service;
  if (new Set(hourly).size !== hourly.length) return { q: null, source: null, review: REASON_HOURLY_NOT_DISCRIMINATED };
  if (hourly.length >= 2) {
    if (!hbs || hourly.some((s) => !isPositive(hbs[s]))) return { q: null, source: null, review: REASON_HOURLY_NOT_DISCRIMINATED };
    return { q: hbs[service], source: 'hours_by_service', review: null };
  }
  if (hbs && Object.prototype.hasOwnProperty.call(hbs, service)) {
    return { q: isPositive(hbs[service]) ? hbs[service] : null, source: 'hours_by_service', review: null };
  }
  return { q: isPositive(inp.hours) ? inp.hours : null, source: 'hours', review: null };
}

export function priceService(service, inp, hourly = null) {
  const svcTbl = TABLE.services[service];
  const qBaseInputs = { area_existing: numberOut(inp.area_existing), area_new: numberOut(inp.area_new) };
  if (!svcTbl) {
    return { service, status: REVIEW, q: null, q_basis: null, q_inputs: qBaseInputs, reason: 'serviço fora da TABELA DEMELLO V2' };
  }
  if (service === 'ESTRUTURAL') return priceStructural(inp);

  const basis = qBasisFor(service, inp, svcTbl);
  let q = qFromBasis(basis, inp);
  const qInputs = { ...qBaseInputs };
  let hoursReview = null;
  if (basis === 'Q_HORAS') {
    const h = resolveHours(service, inp, hourly || [service]);
    q = h.q;
    hoursReview = h.review;
    qInputs.hours = numberOut(h.source === 'hours_by_service' ? h.q : inp.hours);
    if (h.source === 'hours_by_service') qInputs.hours_source = 'hours_by_service';
  }
  const ctx = serviceContext(service, inp);
  if (basis === 'Q_HORAS' && hoursReview) {
    return { service, status: REVIEW, q: null, q_basis: basis, q_inputs: qInputs, pricing_context: ctx,
      reason: hoursReview };
  }
  if (q === null) {
    return { service, status: REVIEW, q: null, q_basis: basis, q_inputs: qInputs, pricing_context: ctx,
      reason: `quantidade essencial (${basis}) não informada` };
  }
  const applicable = [];
  for (const [sourceId, ref] of Object.entries(svcTbl.references)) {
    const unit = referenceUnit(service, ref, ctx);
    if (unit !== null) applicable.push([sourceId, unit]);
  }
  if (applicable.length === 0) {
    return { service, status: REVIEW, q: numberOut(q), q_basis: basis, q_inputs: qInputs, pricing_context: ctx,
      reason: 'nenhuma referência externa aplicável' };
  }
  let [baseRef, baseUnit] = applicable[0];
  for (const [name, unit] of applicable.slice(1)) if (cmp(unit, baseUnit) < 0) { baseRef = name; baseUnit = unit; }
  const demelloUnrounded = mul(mul(q, baseUnit), FACTOR);
  const references = {};
  for (const [sid, unit] of applicable) references[sid.toLowerCase()] = { unit_value: toStr(unit), total: money(mul(q, unit)) };
  return {
    service, status: CALC, q: numberOut(q), q_basis: basis, q_inputs: qInputs, pricing_context: ctx,
    references, base_reference: baseRef,
    demello: { unrounded_total: toStr(demelloUnrounded), total: money(demelloUnrounded) },
  };
}

// Texto ao cliente — sem fórmula, fator, MIN, regime ou composição interna.
const TEXT_LABEL = { maxicad_bim: 'MaxiCAD', rfb_bim: 'Receita Federal', cim_amunesc_2026: 'CIM-AMUNESC', ibape_pr: 'IBAPE-PR' };

export function buildCustomerPricingText(preview) {
  const calculated = preview.services.filter((s) => s.status === CALC);
  if (preview.status !== CALC || calculated.length === 0) return CUSTOMER_FALLBACK_TEXT;
  // Soma da referência (primeira chave presente) só se cobrir TODOS os serviços calculados.
  const coveredTotal = (keys) => {
    let total = dec('0');
    const used = [];
    for (const svc of calculated) {
      const refs = svc.references || {};
      const key = keys.find((k) => refs[k]);
      if (key === undefined) return [null, []];
      total = add(total, dec(refs[key].total));
      used.push(key);
    }
    return [total, used];
  };
  const parts = [];
  const [secid] = coveredTotal(['secid_pr']);
  if (secid !== null) {
    parts.push(`Para as informações fornecidas, a referência pública SECID/PR resulta em aproximadamente ${brl(secid)}.`);
  }
  const [fundepar] = coveredTotal(['fundepar_001_2025']);
  if (fundepar !== null) parts.push(`A referência institucional FUNDEPAR resulta em aproximadamente ${brl(fundepar)}.`);
  const [market, used] = coveredTotal(['altoqi', 'altoqi_composta']);
  if (market !== null) {
    if (used.includes('altoqi_composta')) {
      parts.push(`A referência de mercado para esse tipo de projeto é de aproximadamente ${brl(market)}.`);
    } else {
      parts.push(`A referência de mercado AltoQi para esse tipo de projeto é de aproximadamente ${brl(market)}.`);
    }
  }
  const others = [];
  for (const key of ['maxicad_bim', 'rfb_bim', 'cim_amunesc_2026', 'ibape_pr']) {
    const [total] = coveredTotal([key]);
    if (total !== null) others.push(`${TEXT_LABEL[key]} ${brl(total)}`);
  }
  if (others.length) parts.push(`Outras referências aplicáveis: ${others.join('; ')}.`);
  parts.push(`Pela tabela DEMELLO, nossa previsão inicial é de ${brl(dec(preview.total_demello))}.`);
  if (calculated.some((s) => s.pricing_context && s.pricing_context.foundations_included)) {
    parts.push('O projeto estrutural contempla estrutura e fundações.');
  }
  parts.push('Entraremos em contato para confirmar as particularidades e o escopo.');
  return parts.join(' ');
}

export function buildPricingPreview(pricingInputs) {
  const inp = extractPricingInputs(pricingInputs);
  const hourly = hourlyServices(inp);
  const servicesOut = inp.services.map((service) => priceService(service, inp, hourly));
  const calculated = servicesOut.filter((s) => s.status === CALC);
  const needsReview = servicesOut.some((s) => s.status !== CALC) || calculated.length === 0;
  const status = needsReview ? REVIEW : CALC;
  let totalDemello = null;
  if (status === CALC) {
    let total = dec('0');
    for (const s of calculated) total = add(total, dec(s.demello.total));
    totalDemello = money(total);
  }
  const preview = {
    table_version: TABLE.table_version,
    factor_demello: Number(TABLE.factor_demello),
    currency: TABLE.currency,
    status,
    services: servicesOut,
    total_demello: totalDemello,
    presented_to_customer: { text: '' },
    pricing_rule: PRICING_RULE,
  };
  preview.presented_to_customer.text = buildCustomerPricingText(preview);
  return preview;
}
