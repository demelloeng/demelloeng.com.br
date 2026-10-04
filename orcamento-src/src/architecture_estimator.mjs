// Estimador comercial de área da Arquitetura. Puro, determinístico, sem rede, sem IA, sem legislação.
//
// Hierarquia da área de referência (a primeira que existir):
//   1. USER_DECLARED            área do projeto informada pelo cliente (nada é estimado)
//   2. NEEDS_PROGRAM_ESTIMATE   só o programa de necessidades
//   3. PROGRAM_AND_LOT_ESTIMATE programa + terreno
//   4. LOT_ONLY_ESTIMATE        só o terreno
//   5. HUMAN_REVIEW_REQUIRED    dados insuficientes ou absurdos => conferência humana
//
// Fórmulas (todos os números em ARCH_CONFIG):
//   programa : soma = Σ(item × área do item); central = soma × (1 + circulação + extraPavimentos) × fatorPadrão;
//              faixa = [central × inferior, central × superior] arredondada a 5 m²; referência = ponto médio (5 m²).
//   terreno  : faixa = [terreno × fatorMin, terreno × fatorMax] limitada ao teto; referência = ponto médio (5 m²).
//   ambos    : interseção das duas faixas quando coerentes; se o programa é maior que o terreno sustenta,
//              NÃO rejeita: usa a faixa do programa com a referência no limite inferior dela e sinaliza `intense`;
//              se o programa é menor, usa a faixa do programa.
//
// Isto NÃO afirma metragem permitida, potencial construtivo, aprovação nem consulta a legislação.
import { ARCH_CONFIG } from './architecture_config.mjs';
import { area as parseArea } from './flow.mjs';

export const SOURCE = Object.freeze({
  USER_DECLARED: 'USER_DECLARED',
  NEEDS_PROGRAM_ESTIMATE: 'NEEDS_PROGRAM_ESTIMATE',
  PROGRAM_AND_LOT_ESTIMATE: 'PROGRAM_AND_LOT_ESTIMATE',
  LOT_ONLY_ESTIMATE: 'LOT_ONLY_ESTIMATE',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED',
});
export const PADROES = Object.freeze(['compacto', 'confortavel', 'amplo']);

const step = ARCH_CONFIG.arredondamentoM2;
export const roundStep = (n) => Math.round(n / step) * step;
// entrada de área: número, texto ('350,5') ou resposta {value, unknown} da jornada
const num = (x) => (typeof x === 'number' ? x : x && typeof x === 'object' ? parseArea(x) : typeof x === 'string' ? parseArea({ value: x }) : null);
const toInt = (v) => (typeof v === 'string' || typeof v === 'number') && /^\d+$/.test(String(v).trim()) ? Number(String(v).trim()) : null;

// ---- programa de necessidades -------------------------------------------------------------------------------------
// Devolve null (válido) ou um código estável: 'padrao' | 'pavimentos' | 'quartos' | 'suites' | 'banheiros' | 'garagem' | 'absurdo'.
export function programError(p) {
  if (!p || typeof p !== 'object' || p.unknown === true) return 'vazio';
  const L = ARCH_CONFIG.program.limites;
  if (!PADROES.includes(p.padrao)) return 'padrao';
  const pav = toInt(p.pavimentos);
  if (pav === null || pav < 1 || pav > L.pavimentos) return 'pavimentos';
  for (const [k, max] of [['quartos', L.quartos], ['suites', L.suites], ['banheiros', L.banheiros], ['garagem', L.garagem]]) {
    const n = toInt(p[k]);
    if (n === null || n > max) return k;
  }
  const raw = programRawArea(p);
  if (raw < ARCH_CONFIG.areaPlausivel.min || raw > ARCH_CONFIG.areaPlausivel.max) return 'absurdo';
  return null;
}
export const programValid = (p) => programError(p) === null;

function programRawArea(p) {
  const A = ARCH_CONFIG.program.areaPerItem;
  const n = (k) => toInt(p[k]) ?? 0;
  const flag = (k) => p[k] === true;
  const soma = n('quartos') * A.quarto + n('suites') * A.suite + n('banheiros') * A.banheiro + n('garagem') * A.garagemVaga
    + (flag('sala') ? A.sala : 0) + (flag('cozinha') ? A.cozinha : 0) + (flag('lavanderia') ? A.lavanderia : 0)
    + (flag('escritorio') ? A.escritorio : 0) + (flag('varanda') ? A.varanda : 0);
  const C = ARCH_CONFIG.program;
  const pav = toInt(p.pavimentos) ?? 1;
  return soma * (1 + C.circulacao + C.circulacaoPorPavimentoExtra * Math.max(0, pav - 1)) * (C.padraoFator[p.padrao] ?? 1);
}

export function programBand(p) {
  if (programError(p) !== null) return null;
  const central = programRawArea(p);
  const F = ARCH_CONFIG.program.faixa;
  const min = roundStep(central * F.inferior);
  const max = Math.max(min, roundStep(central * F.superior));
  return { min, max, reference: clampRef(roundStep((min + max) / 2), min, max) };
}

export function programSummaryText(p) {
  if (!p || p.unknown === true) return 'Ainda não sei os ambientes';
  const n = (k) => toInt(p[k]) ?? 0;
  const plural = (x, um, varios) => (x === 1 ? `${x} ${um}` : `${x} ${varios}`);
  const itens = [plural(n('quartos'), 'quarto', 'quartos'), plural(n('suites'), 'suíte', 'suítes'), plural(n('banheiros'), 'banheiro', 'banheiros')];
  for (const [k, nome] of [['sala', 'sala'], ['cozinha', 'cozinha'], ['lavanderia', 'lavanderia'], ['escritorio', 'escritório'], ['varanda', 'varanda/área gourmet']]) if (p[k] === true) itens.push(nome);
  if (n('garagem')) itens.push(plural(n('garagem'), 'vaga de garagem', 'vagas de garagem'));
  itens.push(plural(n('pavimentos'), 'pavimento', 'pavimentos'), `padrão ${p.padrao === 'confortavel' ? 'confortável' : p.padrao}`);
  return itens.join(', ');
}

// ---- terreno -------------------------------------------------------------------------------------------------------
export function lotBand(terreno) {
  const t = num(terreno);
  const L = ARCH_CONFIG.lot;
  if (t === null || !Number.isFinite(t) || t < L.terrenoMin || t > L.terrenoMax) return null;
  const min = Math.min(roundStep(t * L.fatorMin), L.tetoAreaConstruida);
  const max = Math.min(Math.max(min, roundStep(t * L.fatorMax)), L.tetoAreaConstruida);
  return { min, max, reference: clampRef(roundStep((min + max) / 2), min, max), terreno: t };
}

const clampRef = (r, min, max) => Math.min(max, Math.max(min, r));
const plausible = (b) => b && b.reference >= ARCH_CONFIG.areaPlausivel.min && b.reference <= ARCH_CONFIG.areaPlausivel.max;

// ---- combinação ----------------------------------------------------------------------------------------------------
export function combineBands(prog, lot) {
  const lo = Math.max(prog.min, lot.min), hi = Math.min(prog.max, lot.max);
  if (lo <= hi) return { min: lo, max: hi, reference: clampRef(roundStep((lo + hi) / 2), lo, hi), coherence: 'COERENTE', intense: false };
  if (prog.min > lot.max) return { min: prog.min, max: prog.max, reference: prog.min, coherence: 'PROGRAMA_MAIOR_QUE_O_TERRENO', intense: true };
  return { min: prog.min, max: prog.max, reference: prog.reference, coherence: 'PROGRAMA_MENOR_QUE_O_TERRENO', intense: false };
}

// ---- estimativa completa -------------------------------------------------------------------------------------------
// entrada: { declared: número|null, program: objeto|undefined, lot: m²|null }  (somente dados estruturados)
export function estimateArea({ declared = null, program, lot = null } = {}) {
  const base = { version: ARCH_CONFIG.version, intense: false, coherence: null };
  const declaredN = num(declared);
  if (declaredN !== null && Number.isFinite(declaredN) && declaredN > 0) {
    return { ...base, source: SOURCE.USER_DECLARED, min: declaredN, max: declaredN, reference: declaredN, program: null, lot: null };
  }
  const prog = program && program.unknown !== true ? programBand(program) : null;
  const lotB = lot !== null && lot !== undefined ? lotBand(lot) : null;
  if (prog && lotB) {
    const c = combineBands(prog, lotB);
    if (!plausible(c)) return humanReview(base, prog, lotB);
    return { ...base, source: SOURCE.PROGRAM_AND_LOT_ESTIMATE, min: c.min, max: c.max, reference: c.reference, intense: c.intense, coherence: c.coherence, program: prog, lot: lotB };
  }
  if (prog) return plausible(prog)
    ? { ...base, source: SOURCE.NEEDS_PROGRAM_ESTIMATE, min: prog.min, max: prog.max, reference: prog.reference, program: prog, lot: null }
    : humanReview(base, prog, null);
  if (lotB) return plausible(lotB)
    ? { ...base, source: SOURCE.LOT_ONLY_ESTIMATE, min: lotB.min, max: lotB.max, reference: lotB.reference, program: null, lot: lotB }
    : humanReview(base, null, lotB);
  return humanReview(base, null, null);
}

function humanReview(base, program, lot) {
  return { ...base, source: SOURCE.HUMAN_REVIEW_REQUIRED, min: null, max: null, reference: null, program, lot };
}

// ---- faixas de apresentação para a mensuração (sem valores exatos) --------------------------------------------------
const band = (table, n) => {
  if (n === null || n === undefined) return 'na';
  for (const [limit, name] of table) if (n < limit) return name;
  return table === ARCH_CONFIG.bands.area ? 'gt_400' : table === ARCH_CONFIG.bands.lot ? 'gt_1000' : 'gt_220';
};
export const areaBand = (n) => band(ARCH_CONFIG.bands.area, n);
export const lotAreaBand = (n) => band(ARCH_CONFIG.bands.lot, n);
export const programSizeBand = (n) => band(ARCH_CONFIG.bands.program, n);
