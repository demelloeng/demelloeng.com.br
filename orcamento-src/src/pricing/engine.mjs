// Motor de previsão DEMELLO V1 no browser — porte fiel de scripts/site_intake_pricing.py.
// Determinístico, sem rede. Mesmo pricing_inputs => mesmo pricing_preview do Python.
import TABLE from './pricing-table.v1.json' with { type: 'json' };
import { dec, num, add, sub, mul, absD, cmp, toStr, money, brl, numberOut } from './decimal.mjs';

const TYPOLOGIES = ['CASA', 'PREDIO', 'COMERCIAL'];
const STRUCTURAL_SYSTEMS = ['CONCRETO_ARMADO', 'METALICA', 'MADEIRA'];
const STRUCTURAL_SCOPES = ['FULL', 'FOUNDATION_ONLY'];
const COMPONENT_STATES = ['DETERMINED', 'NOT_REQUIRED', 'UNDETERMINED'];
// Regra de composição do ESTRUTURAL (paridade com scripts/site_intake_pricing.py). Este motor só
// EMITE previsões novas; previsões históricas (sem marcador = regra LEGADA) são revalidadas no
// motor Python canônico, nunca recalculadas aqui.
const PRICING_RULE = 'STRUCT_INCL_FOUNDATIONS_V2';
const CALC = 'CALCULATED';
const REVIEW = 'NEEDS_HUMAN_REVIEW';

const CUSTOMER_FALLBACK_TEXT =
  'A DEMELLO precisa entrar em contato para entender melhor o seu problema. ' +
  'Iremos verificar as informações fornecidas e retornar assim que possível.';

if (TABLE.table_version !== 'DEMELLO_V1') throw new Error('pricing-table.v1.json: table_version inesperada');
const FACTOR = dec(String(TABLE.factor_demello));

const STATIC_Q_BASIS = {
  ESTRUTURAL: 'Q_NOVA', INCENDIO: 'Q_TOTAL', GAS_GLP: 'Q_ATENDIDA', ARQUITETURA: 'Q_NOVA',
  REGULARIZACAO: 'Q_REGULARIZACAO', ORCAMENTO: 'Q_ESCOPO', TERRAPLENAGEM: 'Q_TERRENO', COMPATIBILIZACAO: 'Q_ESCOPO',
};

function upper(v) { return typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : null; }

function componentState(v) {
  if (v === true) return 'DETERMINED';
  if (v === false) return 'NOT_REQUIRED';
  const t = upper(v);
  return COMPONENT_STATES.includes(t) ? t : 'UNDETERMINED';
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
    reg_area_matricula: num(reg.area_matricula),
    reg_area_iptu: num(reg.area_iptu),
    reg_levantamento: componentState(reg.levantamento),
    reg_projeto_legal: componentState(reg.projeto_legal),
    hidro_scope_includes_existing: hidro === null || hidro === undefined ? null : Boolean(hidro),
    foundations_selected:
      foundationsSelected === null || foundationsSelected === undefined ? null : Boolean(foundationsSelected),
  };
}

function qBasis(service, inp) {
  if (service === 'HIDROSSANITARIO') return inp.hidro_scope_includes_existing === true ? 'Q_ATENDIDA' : 'Q_NOVA';
  return STATIC_Q_BASIS[service] || 'Q_NOVA';
}

export function resolveQ(service, inp) {
  const basis = qBasis(service, inp);
  const ae = inp.area_existing;
  const an = inp.area_new;
  const at = inp.area_total;
  let q = null;
  if (basis === 'Q_NOVA') {
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
  else if (basis === 'Q_REGULARIZACAO') {
    if (inp.reg_area_matricula !== null && inp.reg_area_iptu !== null) {
      q = absD(sub(inp.reg_area_iptu, inp.reg_area_matricula));
    }
  }
  return {
    q,
    q_basis: basis,
    status: q !== null ? 'OK' : 'MISSING',
    q_inputs: { area_existing: numberOut(ae), area_new: numberOut(an) },
  };
}

export function resolveServiceContext(service, inp) {
  if (service === 'ESTRUTURAL') {
    if (inp.structural_scope === 'FOUNDATION_ONLY') {
      return { typology: inp.typology, structural_scope: 'FOUNDATION_ONLY' };
    }
    const declared = inp.structural_system;
    // Regra STRUCT_INCL_FOUNDATIONS_V2 (emissões novas): o pacote estrutural COMPLETO inclui
    // as fundações. A seleção explícita de "Fundações" é preservada como intenção, nunca vira
    // uma 2a cobrança.
    return {
      typology: inp.typology,
      structural_system: declared || 'CONCRETO_ARMADO',
      structural_system_default_used: declared === null,
      structural_scope: 'FULL',
      foundations_included: true,
      foundations_selection: inp.foundations_selected ? 'EXPLICIT' : 'IMPLIED_BY_STRUCTURAL',
    };
  }
  if (service === 'REGULARIZACAO') {
    return {
      components: {
        arquitetonico: 'DETERMINED',
        levantamento: inp.reg_levantamento,
        projeto_legal: inp.reg_projeto_legal,
      },
    };
  }
  return { typology: inp.typology };
}

function altoqiUnit(svcTbl, typ) {
  const map = (svcTbl.altoqi && svcTbl.altoqi.by_typology) || {};
  return typ && Object.prototype.hasOwnProperty.call(map, typ) ? dec(map[typ]) : null;
}

// Pacote estrutural COMPLETO (estrutura + fundações), sem dupla contagem. SECID/PR publica
// componentes separados -> soma FUNDAÇÃO + SUPERESTRUTURA(sistema) e confere contra o total
// publicado. AltoQi só entra se a tabela documentar que o valor já inclui fundações;
// cobertura não determinada nunca é tratada como equivalente.
export function structuralFullPackage(svcTbl, ctx) {
  const system = ctx.structural_system;
  const comps = svcTbl.secid_pr.components;
  const parts = {};
  parts[`SUPERESTRUTURA_${system}`] = comps[`SUPERESTRUTURA_${system}`];
  parts.FUNDACAO = comps.FUNDACAO;
  let secid = dec('0');
  for (const v of Object.values(parts)) secid = add(secid, dec(v));
  const published = dec(svcTbl.secid_pr.by_structural_system[system]);
  if (cmp(secid, published) !== 0) {
    throw new Error(`ESTRUTURAL: componentes SECID/PR (${toStr(secid)}) != total publicado (${toStr(published)})`);
  }
  const altoqiTbl = svcTbl.altoqi || {};
  const coverage = altoqiTbl.foundation_coverage || 'UNDETERMINED';
  let altoqi = null;
  const excluded = [];
  const map = altoqiTbl.by_typology || {};
  if (ctx.typology && Object.prototype.hasOwnProperty.call(map, ctx.typology)) {
    if (coverage === 'INCLUDED') altoqi = dec(map[ctx.typology]);
    else excluded.push({ source: 'ALTOQI', reason: `FOUNDATION_COVERAGE_${coverage}` });
  }
  return { secid, altoqi, components: parts, excluded_references: excluded };
}

function secidAndAltoqiUnits(service, svcTbl, ctx) {
  if (service === 'ESTRUTURAL') {
    if (ctx.structural_scope === 'FOUNDATION_ONLY') {
      return [dec(svcTbl.secid_pr.components.FUNDACAO), null];
    }
    if (ctx.foundations_included) {
      const pkg = structuralFullPackage(svcTbl, ctx);
      return [pkg.secid, pkg.altoqi];
    }
    return [dec(svcTbl.secid_pr.by_structural_system[ctx.structural_system]), altoqiUnit(svcTbl, ctx.typology)];
  }
  if (service === 'REGULARIZACAO') {
    const comps = svcTbl.secid_pr.components;
    let secid = dec(comps.ARQUITETONICO.unit_value);
    if (ctx.components.levantamento === 'DETERMINED') secid = add(secid, dec(comps.LEVANTAMENTO.unit_value));
    if (ctx.components.projeto_legal === 'DETERMINED') secid = add(secid, dec(comps.PROJETO_LEGAL.unit_value));
    return [secid, null];
  }
  return [dec(svcTbl.secid_pr.unit_value), altoqiUnit(svcTbl, ctx.typology)];
}

export function priceService(service, qResult, ctx) {
  const svcTbl = TABLE.services[service];
  if (!svcTbl) {
    return {
      service, status: REVIEW, q: null, q_basis: qResult.q_basis ?? null,
      q_inputs: qResult.q_inputs || {}, reason: 'serviço fora da TABELA DEMELLO V1',
    };
  }
  if (qResult.status !== 'OK') {
    return {
      service, status: REVIEW, q: null, q_basis: qResult.q_basis, q_inputs: qResult.q_inputs,
      pricing_context: ctx, reason: `quantidade essencial (${qResult.q_basis}) não informada`,
    };
  }
  const q = qResult.q;
  const [secidUnit, altoqi] = secidAndAltoqiUnits(service, svcTbl, ctx);
  const applicable = [['SECID_PR', secidUnit]];
  if (altoqi !== null) applicable.push(['ALTOQI', altoqi]);
  let baseRef = applicable[0][0];
  let baseUnit = applicable[0][1];
  for (const [name, unit] of applicable) if (cmp(unit, baseUnit) < 0) { baseRef = name; baseUnit = unit; }
  const demelloUnrounded = mul(mul(q, baseUnit), FACTOR);
  const references = { secid_pr: { unit_value: toStr(secidUnit), total: money(mul(q, secidUnit)) } };
  if (altoqi !== null) references.altoqi = { unit_value: toStr(altoqi), total: money(mul(q, altoqi)) };
  const entry = {
    service, status: CALC, q: numberOut(q), q_basis: qResult.q_basis, q_inputs: qResult.q_inputs,
    pricing_context: ctx, references, base_reference: baseRef,
    demello: { unrounded_total: toStr(demelloUnrounded), total: money(demelloUnrounded) },
  };
  if (service === 'ESTRUTURAL' && ctx.foundations_included) {
    const pkg = structuralFullPackage(svcTbl, ctx);
    entry.package = {
      scope: 'ESTRUTURA_COMPLETA_COM_FUNDACOES',
      secid_pr_components: { ...pkg.components },
      excluded_references: pkg.excluded_references,
    };
  }
  return entry;
}

export function buildCustomerPricingText(preview) {
  const calculated = preview.services.filter((s) => s.status === CALC);
  if (preview.status !== CALC || calculated.length === 0) return CUSTOMER_FALLBACK_TEXT;
  let secidTotal = dec('0');
  for (const s of calculated) secidTotal = add(secidTotal, dec(s.references.secid_pr.total));
  const altoqiTotals = calculated.filter((s) => s.references.altoqi).map((s) => dec(s.references.altoqi.total));
  const demelloTotal = dec(preview.total_demello);
  if (preview.pricing_rule === PRICING_RULE) {
    // Só cita a AltoQi quando ela cobre TODOS os serviços calculados (soma parcial não é
    // comparável) e deixa claro que o estrutural contempla fundações.
    const foundations = calculated.some((s) => s.pricing_context && s.pricing_context.foundations_included);
    const parts = [
      'Para as informações fornecidas, a referência pública SECID/PR resulta em ' +
        `aproximadamente ${brl(secidTotal)}.`,
    ];
    if (altoqiTotals.length && altoqiTotals.length === calculated.length) {
      let altoqiTotal = dec('0');
      for (const t of altoqiTotals) altoqiTotal = add(altoqiTotal, t);
      parts.push(
        `A referência de mercado AltoQi para esse tipo de projeto é de aproximadamente ${brl(altoqiTotal)}.`,
      );
    }
    parts.push(`Pela tabela DEMELLO, nossa previsão inicial é de ${brl(demelloTotal)}.`);
    if (foundations) parts.push('O projeto estrutural contempla estrutura e fundações.');
    parts.push('Entraremos em contato para confirmar as particularidades e o escopo.');
    return parts.join(' ');
  }
  if (altoqiTotals.length) {
    let altoqiTotal = dec('0');
    for (const t of altoqiTotals) altoqiTotal = add(altoqiTotal, t);
    return (
      'Para as informações fornecidas, a referência pública SECID/PR resulta em ' +
      `aproximadamente ${brl(secidTotal)}. A referência de mercado AltoQi para esse tipo ` +
      `de projeto é de aproximadamente ${brl(altoqiTotal)}. Pela tabela DEMELLO, nossa ` +
      `previsão inicial é de ${brl(demelloTotal)}. Entraremos em contato para confirmar ` +
      'as particularidades e o escopo.'
    );
  }
  return (
    'Para as informações fornecidas, a referência pública SECID/PR resulta em ' +
    `aproximadamente ${brl(secidTotal)}. Pela tabela DEMELLO, nossa previsão inicial é de ` +
    `${brl(demelloTotal)}. Entraremos em contato para confirmar as particularidades e o escopo.`
  );
}

export function buildPricingPreview(pricingInputs) {
  const inp = extractPricingInputs(pricingInputs);
  const servicesOut = [];
  let needsReview = false;
  for (const service of inp.services) {
    const qResult = resolveQ(service, inp);
    const ctx = resolveServiceContext(service, inp);
    const entry = priceService(service, qResult, ctx);
    if (entry.status !== CALC) needsReview = true;
    servicesOut.push(entry);
  }
  const calculated = servicesOut.filter((s) => s.status === CALC);
  if (calculated.length === 0) needsReview = true;
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
