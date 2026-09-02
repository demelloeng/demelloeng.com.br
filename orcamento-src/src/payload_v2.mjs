// PAYLOAD V2 REAL da experiência ativa — jornada -> pricing_inputs -> site-intake/payload/2
// com pricing_preview DEMELLO V1 calculado offline no browser.
//
// Separação explícita: journey.packageForCRM() (source IT083, prototype:true, faixa
// fictícia) é LEGADO de regressão. Esta emissão é a real: source DEMELLO_SITE,
// prototype:false, pricing_preview determinístico. Nenhum proposal_value, nenhum
// MA_ACOES / gate / APPROVED / CONTACT / SEND. Nada é enviado: o payload só é
// serializado para download local.
import { summary, safetyHold } from './journey.mjs';
import { buildPricingPreview } from './pricing/engine.mjs';
import { dec, add, toStr } from './pricing/decimal.mjs';

export const V2_SOURCE = 'DEMELLO_SITE';

// Decisões congeladas (comando FRONTEND V1 + delta Elétrica).
const SERVICE_LABEL_TO_CODE = {
  Estrutural: 'ESTRUTURAL',
  Hidrossanitário: 'HIDROSSANITARIO',
  Drenagem: 'HIDROSSANITARIO', // drenagem entra em HIDROSSANITARIO, sem cobrança dupla
  Incêndio: 'INCENDIO',
  Gás: 'GAS_GLP',
  'Compatibilização BIM': 'COMPATIBILIZACAO',
};
const FOUNDATION_LABEL = 'Fundações';
const SERVICES_NOT_OFFERED = new Set(['Elétrica']); // fora do catálogo DEMELLO — nunca precificado
const TYPOLOGY_LABEL_TO_CODE = {
  'Casa/sobrado': 'CASA',
  'Residencial multifamiliar': 'PREDIO',
  Apartamento: 'PREDIO',
  'Condomínio / edifício': 'PREDIO',
  Comercial: 'COMERCIAL',
};

const areaValue = (raw) =>
  raw && typeof raw === 'object' && !raw.unknown && typeof raw.value === 'string' && raw.value.trim()
    ? raw.value.trim()
    : null;

function sumAreas(a, b) {
  try {
    return toStr(add(dec(a.replace(',', '.')), dec(b.replace(',', '.'))));
  } catch {
    return null;
  }
}

export function derivePricingInputs(a) {
  const route = a.route;
  let services = [];
  let structuralScope = null;

  if (route === 'regularize') services = ['REGULARIZACAO'];
  else if (route === 'problem') services = [];
  else if (route === 'build' || route === 'known') {
    let raw = Array.isArray(a.services) ? [...a.services] : [];
    if (raw.includes('Não sei quais preciso')) {
      const confirmed = Array.isArray(a.confirmedSuggestions) ? a.confirmedSuggestions : [];
      raw = raw.filter((x) => x !== 'Não sei quais preciso').concat(confirmed);
    }
    const foundationOnly = raw.includes(FOUNDATION_LABEL) && !raw.includes('Estrutural');
    const seen = new Set();
    for (const label of raw) {
      if (label === FOUNDATION_LABEL) {
        if (foundationOnly && !seen.has('ESTRUTURAL')) {
          services.push('ESTRUTURAL');
          seen.add('ESTRUTURAL');
        }
        continue;
      }
      if (SERVICES_NOT_OFFERED.has(label)) continue;
      const code = SERVICE_LABEL_TO_CODE[label];
      if (code && !seen.has(code)) {
        services.push(code);
        seen.add(code);
      }
    }
    if (foundationOnly && services.includes('ESTRUTURAL')) structuralScope = 'FOUNDATION_ONLY';
  }

  const typology = TYPOLOGY_LABEL_TO_CODE[a.property] ?? null;

  let areaExisting = null;
  let areaNew = null;
  let areaTotal = null;
  if (route === 'build') {
    if (a.CA1 === 'Construir do zero') {
      areaNew = areaValue(a.CA_AREA);
      areaTotal = areaValue(a.CA_AREA);
    } else if (a.CA1 === 'Ampliar um imóvel existente') {
      areaExisting = areaValue(a.CA_EXISTING);
      areaNew = areaValue(a.CA_NEW);
      if (areaExisting !== null && areaNew !== null) areaTotal = sumAreas(areaExisting, areaNew);
    }
  } else if (route === 'known') {
    // Decisão humana aprovada: "known" não caracteriza ampliação -> S3 é area_total.
    // area_new / area_existing ficam null (distinção existente/nova pertence à rota "Construir ou ampliar").
    areaTotal = areaValue(a.S3);
  }

  const reg = { area_matricula: null, area_iptu: null, levantamento: 'UNDETERMINED', projeto_legal: 'UNDETERMINED' };
  if (route === 'regularize' && a.REG_R1 === 'A') {
    reg.area_iptu = areaValue(a.REG_A1);
    reg.area_matricula = areaValue(a.REG_A2);
  }

  return {
    services,
    typology,
    structural_system: null, // nunca coletado -> motor usa CONCRETO_ARMADO default + gap
    structural_scope: structuralScope,
    area_existing: areaExisting,
    area_new: areaNew,
    area_total: areaTotal,
    area_atendida: services.includes('GAS_GLP') ? areaValue(a.area_atendida) : null,
    area_terreno: null,
    area_escopo: services.includes('COMPATIBILIZACAO') ? areaValue(a.area_escopo) : null,
    regularizacao: reg,
    hidro_scope_includes_existing: null,
  };
}

export function packageForCRMv2(a, mode) {
  const { photos, contact, ...data } = a;
  const pricing_inputs = derivePricingInputs(a);
  const pricing_preview = buildPricingPreview(pricing_inputs);
  return {
    schema: 'site-intake/payload/2',
    source: V2_SOURCE,
    prototype: false,
    sent_to_crm: false,
    route: a.route,
    summary: summary(a),
    answers: data,
    pricing_inputs,
    contact: contact ?? { name: '', whatsapp: '', email: '' },
    attachments: (photos ?? []).map(({ name, size, type }) => ({ name, size, type, uploaded: false })),
    safety_review_required: safetyHold(a),
    // result reflete a realidade do motor: X3A só quando há previsão calculável.
    result: pricing_preview.status === 'CALCULATED' ? 'X3A' : 'X3B',
    pricing_preview,
  };
}
