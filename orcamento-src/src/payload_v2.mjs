// PAYLOAD V2 REAL da experiência ativa — jornada -> pricing_inputs -> site-intake/payload/2
// com pricing_preview DEMELLO V2 (regime STRUCT_COMPOSITE_REFS_R1) calculado offline no browser.
//
// Separação explícita: journey.packageForCRM() (source IT083, prototype:true, faixa
// fictícia) é LEGADO de regressão. Esta emissão é a real: source DEMELLO_SITE,
// prototype:false, pricing_preview determinístico. Nenhum proposal_value, nenhum
// MA_ACOES / gate / APPROVED / CONTACT / SEND. Nada é enviado: o payload só é
// serializado para download local.
import { summary, safetyHold, terreoDeclared, hourlyServices, hoursOf, REFORMA } from './journey.mjs';
import { architectureFields, referenceAreaForPricing } from './architecture.mjs';
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
  Arquitetura: 'ARQUITETURA', // Q_NOVA
  'Orçamento técnico': 'ORCAMENTO', // Q_ESCOPO
  Terraplenagem: 'TERRAPLENAGEM', // Q_TERRENO
  'Consultoria Técnica': 'CONSULTORIA_TECNICA', // Q_HORAS
  'Mentoria Técnica': 'MENTORIA_TECNICA', // Q_HORAS
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

// COMPATIBILIZACAO e ORCAMENTO usam a mesma Q_ESCOPO no motor. Com os dois e áreas diferentes, não há como discriminar: fail-closed (null => avaliação).
function areaEscopoOf(services, a) {
  const compat = services.includes('COMPATIBILIZACAO') ? areaValue(a.area_escopo) : null;
  const orc = services.includes('ORCAMENTO') ? areaValue(a.area_orcamento) : null;
  const wantsBoth = services.includes('COMPATIBILIZACAO') && services.includes('ORCAMENTO');
  if (wantsBoth) return compat !== null && compat === orc ? compat : null;
  return compat ?? orc;
}

export function derivePricingInputs(a) {
  const route = a.route;
  let services = [];
  let structuralScope = null;

  if (route === 'regularize') services = ['REGULARIZACAO'];
  else if (route === 'problem') services = [];
  else if (route === 'support') services = hourlyServices(a).map((label) => SERVICE_LABEL_TO_CODE[label]);
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
    } else if (a.CA1 === REFORMA) {
      // Reforma SEM aumento: só existe a área existente. Nunca vira área nova nem total; o motor decide se há dados suficientes.
      areaExisting = areaValue(a.CA_REFORMA);
    } else if (a.CA1 === 'Ampliar um imóvel existente') {
      areaExisting = areaValue(a.CA_EXISTING);
      areaNew = areaValue(a.CA_NEW);
      if (areaExisting !== null && areaNew !== null) areaTotal = sumAreas(areaExisting, areaNew);
    }
  } else if (route === 'known') {
    // Decisão humana aprovada: "known" não caracteriza ampliação -> S3 é area_total.
    // area_new / area_existing ficam null (distinção existente/nova pertence à rota "Construir ou ampliar").
    areaTotal = areaValue(a.S3);
    // Arquitetura sem área do projeto: área de REFERÊNCIA estimada (programa/terreno), só para a Arquitetura.
    // Nunca é gravada como digitada (origem em answers.architecture_area_source) e não entra se outro serviço
    // usa a mesma área do projeto (isolamento).
    if (services.includes('ARQUITETURA') && areaTotal === null) {
      const ref = referenceAreaForPricing(a);
      if (ref !== null) areaNew = ref;
    }
  }

  // Q_FUNDACAO (área de projeção): só do que o cliente informou (Q_FUND) ou de térreo DECLARADO (pavimentos = 1).
  // Nunca é estimada a partir da área total nem deduzida do tipo de imóvel; ausente => avaliação humana.
  let areaFundacao = null;
  if (services.includes('ESTRUTURAL')) {
    areaFundacao = areaValue(a.area_fundacao);
    if (areaFundacao === null && terreoDeclared(a)) areaFundacao = areaNew;
  }

  // Q_HORAS: `hours` é um ÚNICO escalar. Só é preenchido com exatamente UM serviço horário e horas declaradas pelo cliente;
  // nunca inferido, dividido ou replicado. Com 2+ serviços horários o motor força NEEDS_HUMAN_REVIEW.
  const hourly = services.filter((s) => s === 'CONSULTORIA_TECNICA' || s === 'MENTORIA_TECNICA');
  const hours = hourly.length === 1 && a.hours_known === 'sim' ? hoursOf(a.hours) : null;

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
    // Intenção explícita do cliente ("Fundações" marcada). Preservada; o motor a reconhece como
    // parte do pacote estrutural completo e nunca a cobra duas vezes.
    foundations_selected: services.length > 0 && (route === 'build' || route === 'known')
      ? (Array.isArray(a.services) && a.services.includes(FOUNDATION_LABEL))
      : null,
    area_existing: areaExisting,
    area_new: areaNew,
    area_total: areaTotal,
    area_atendida: services.includes('GAS_GLP') ? areaValue(a.area_atendida) : null,
    area_terreno: services.includes('TERRAPLENAGEM') ? areaValue(a.area_terreno) : null, // Q_TERRENO: só o que o usuário informou
    area_escopo: areaEscopoOf(services, a), // Q_ESCOPO (Compatibilização e Orçamento técnico compartilham o mesmo campo no motor)
    area_fundacao: areaFundacao,
    hours,
    regularizacao: reg,
    hidro_scope_includes_existing: null,
  };
}

export function packageForCRMv2(a, mode) {
  const { photos, contact, ...data } = a;
  const pricing_inputs = derivePricingInputs(a);
  const arch = architectureFields(a);
  const pricing_preview = buildPricingPreview(pricing_inputs);
  return {
    schema: 'site-intake/payload/2',
    source: V2_SOURCE,
    prototype: false,
    sent_to_crm: false,
    // A entrada "apoio técnico" é UX; o contrato/CRM só conhece as 4 rotas (origin_detail): serviço escolhido = known; "ainda não sei" = problem.
    route: a.route === 'support' ? (hourlyServices(a).length ? 'known' : 'problem') : a.route,
    summary: summary(a),
    answers: arch ? { ...data, ...arch } : data,
    pricing_inputs,
    contact: contact ?? { name: '', whatsapp: '', email: '' },
    attachments: (photos ?? []).map(({ name, size, type }) => ({ name, size, type, uploaded: false })),
    safety_review_required: safetyHold(a),
    // result reflete a realidade do motor: X3A só quando há previsão calculável.
    result: pricing_preview.status === 'CALCULATED' ? 'X3A' : 'X3B',
    pricing_preview,
  };
}
