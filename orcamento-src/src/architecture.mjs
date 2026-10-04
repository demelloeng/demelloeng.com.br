// Arquitetura (ARQUITETURA, base Q_NOVA) dentro da jornada atual — uma RAMIFICAÇÃO CONDICIONAL, sem rota, produto ou pipeline novos.
//
// Gatilho (único): "Arquitetura" selecionada + o cliente declara que NÃO sabe a área desejada do projeto ("Ainda não sei" em S3).
// Área conhecida  -> é a Q_NOVA, nada é estimado.
// Área desconhecida -> perguntamos o terreno e o programa de necessidades (ambos opcionais, "não sei" vale) e
//                      src/architecture_estimator.mjs converte o que o cliente sabe em uma área de REFERÊNCIA para o orçamento.
// Nenhuma base municipal, nenhuma legislação, nenhuma consulta externa: o estudo urbanístico acontece depois, na tratativa técnica.
//
// Isolamento: a área inferida alimenta SOMENTE a precificação de Arquitetura. Se outro serviço que lê a área do projeto
// (Estrutural, Fundações, Hidrossanitário, Drenagem, Incêndio) está selecionado, ela NÃO entra em pricing_inputs; ainda assim a
// devolutiva mostra o preço inicial só da Arquitetura (ver architecture_return.mjs).
import { area } from './flow.mjs';
import { ARCH_CONFIG } from './architecture_config.mjs';
import { estimateArea, programValid, SOURCE, areaBand, lotAreaBand, programSizeBand } from './architecture_estimator.mjs';

export const ARQUITETURA = 'Arquitetura';
const SHARE_PROJECT_AREA = ['Estrutural', 'Fundações', 'Hidrossanitário', 'Drenagem', 'Incêndio'];

const picked = (a) => (a.services || []).includes(ARQUITETURA);
export const projectAreaKnown = (a) => area(a.S3) !== null;
export const projectAreaUnknown = (a) => a.S3?.unknown === true;
export const terrainKnown = (a) => area(a.area_terreno) !== null;

// A ramificação existe só aqui.
export const architectureBranch = (a) => a.route === 'known' && picked(a) && projectAreaUnknown(a);
// O terreno só é perguntado por Arquitetura se Terraplenagem não o perguntou antes (mesma resposta).
export const needsArchitectureTerrain = (a) => architectureBranch(a) && !(a.services || []).includes('Terraplenagem');
export const needsArchitectureProgram = (a) => architectureBranch(a);
// A área inferida pode alimentar pricing_inputs? (só quando nenhum outro serviço usa a mesma área do projeto)
export const inferredAreaCanFeedPricing = (a) => !(a.services || []).some((s) => SHARE_PROJECT_AREA.includes(s));

// Estimativa da Arquitetura a partir do que a jornada coletou. null quando Arquitetura não está em jogo.
export function architectureEstimate(a) {
  if (a.route !== 'known' || !picked(a)) return null;
  if (projectAreaKnown(a)) return estimateArea({ declared: a.S3 });
  if (!projectAreaUnknown(a)) return null; // S3 ainda não respondido
  return estimateArea({ program: a.arq_programa, lot: a.area_terreno });
}

// Área de referência que pode ir para pricing_inputs.area_new (string) — ou null.
export function referenceAreaForPricing(a) {
  const est = architectureEstimate(a);
  if (!est || est.source === SOURCE.USER_DECLARED || est.source === SOURCE.HUMAN_REVIEW_REQUIRED) return null;
  return inferredAreaCanFeedPricing(a) ? String(est.reference) : null;
}

// Campos explícitos do payload (documentados em docs/ARQUITETURA_ESTIMATIVA.md). Somente dados estruturados.
export function architectureFields(a) {
  const est = architectureEstimate(a);
  if (!est) return null;
  const prog = a.arq_programa && a.arq_programa.unknown !== true && programValid(a.arq_programa) ? a.arq_programa : null;
  const lotInformed = area(a.area_terreno);
  return {
    architecture_area_source: est.source,
    architecture_area_min: est.min,
    architecture_area_max: est.max,
    architecture_area_reference: est.reference,
    architecture_estimation_inputs: {
      area_declarada_m2: est.source === SOURCE.USER_DECLARED ? est.reference : null,
      terreno_m2: lotInformed,
      programa: prog && est.source !== SOURCE.USER_DECLARED
        ? { quartos: +prog.quartos, suites: +prog.suites, banheiros: +prog.banheiros, garagem: +prog.garagem, pavimentos: +prog.pavimentos, padrao: prog.padrao,
            sala: prog.sala === true, cozinha: prog.cozinha === true, lavanderia: prog.lavanderia === true, escritorio: prog.escritorio === true, varanda: prog.varanda === true }
        : null,
      coerencia: est.coherence,
      programa_acima_do_terreno: est.intense === true,
      referencia_alimenta_precificacao: referenceAreaForPricing(a) !== null,
    },
    architecture_estimation_version: ARCH_CONFIG.version,
  };
}

// Parâmetros de mensuração (somente faixas e enums; nunca valores exatos nem texto livre).
export function architectureAnalytics(a) {
  const est = architectureEstimate(a);
  if (!est) return null;
  return {
    area_source: est.source,
    area_band: areaBand(est.reference),
    lot_area_band: lotAreaBand(est.lot?.terreno ?? area(a.area_terreno)),
    program_size_band: programSizeBand(est.program?.reference ?? null),
    estimation_version: ARCH_CONFIG.version,
  };
}

// Linha de resumo e itens faltantes (jornada)
export function architectureMissing(a) {
  const est = architectureEstimate(a);
  return est && est.source === SOURCE.HUMAN_REVIEW_REQUIRED ? ['Área do projeto de Arquitetura (ou terreno e programa para estimar)'] : [];
}
