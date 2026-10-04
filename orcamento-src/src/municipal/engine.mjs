// HISTÓRICO — NÃO UTILIZADO NO FLUXO ATIVO. Mantido apenas para compatibilidade/histórico (decisão comercial: a estimativa inicial
// da Arquitetura NÃO depende de base municipal; o estudo de legislação acontece depois, na tratativa técnica).
// Nenhum arquivo ativo importa este módulo; ele não controla nem bloqueia o fluxo comercial.
//
// (Descrição original) Ponto de integração da ESTIMATIVA MUNICIPAL DE ÁREA APROVEITÁVEL.
//
// ESTADO ATUAL: a base municipal canônica NÃO está no escopo deste pacote. Este módulo define o CONTRATO versionado
// e o mecanismo, e em produção opera FAIL-CLOSED: base vazia + nenhum cálculo autorizado => nunca devolve área.
// Não existe município, coeficiente ou fórmula embutidos. Nada é simulado.
//
// Regras:
//  - sem município na base                      -> BASE_INDISPONIVEL
//  - registro incompleto / fora da vigência     -> BASE_INCOMPLETA
//  - várias zonas ou zona não determinável      -> ZONA_NAO_DETERMINADA (a jornada não coleta zoneamento)
//  - normas em conflito registradas             -> NORMAS_CONFLITANTES (nunca escolhe entre elas)
//  - `regra_calculo` ausente do registro de regras autorizadas -> REGRA_NAO_AUTORIZADA
//  - nunca usa média nacional nem regra de outro município; nunca pede a uma IA que invente parâmetros.
// A IA pode apenas EXPLICAR o resultado já calculado; o cálculo é sempre determinístico (função registrada em `rules`).
import { dec, toStr } from '../pricing/decimal.mjs';
import BASE from './base.v1.json' with { type: 'json' };

export const CONTRACT_ID = 'demello/base-municipal-urbanistica';
export const CONTRACT_VERSION = '1';

// Campos mínimos de cada registro da base (contrato). Todos obrigatórios para status_completude = COMPLETA.
export const REQUIRED_RECORD_FIELDS = Object.freeze([
  'municipio', 'estado', 'legislacao_id', 'versao_vigencia', 'fonte_oficial', 'zona_classificacao',
  'coeficiente_aproveitamento', 'taxa_ocupacao', 'permeabilidade', 'recuos', 'limites_altura_pavimentos',
  'condicoes_excecoes', 'data_atualizacao', 'status_completude', 'evidencia_origem', 'abrangencia', 'regra_calculo',
]);

export const STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  BASE_INDISPONIVEL: 'BASE_INDISPONIVEL',
  BASE_INCOMPLETA: 'BASE_INCOMPLETA',
  ZONA_NAO_DETERMINADA: 'ZONA_NAO_DETERMINADA',
  NORMAS_CONFLITANTES: 'NORMAS_CONFLITANTES',
  REGRA_NAO_AUTORIZADA: 'REGRA_NAO_AUTORIZADA',
  ENTRADA_INVALIDA: 'ENTRADA_INVALIDA',
});

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const present = (v) => v !== undefined && v !== null && !(typeof v === 'string' && !v.trim()) && !(Array.isArray(v) && v.length === 0);

// Valida um registro contra o contrato. Devolve a lista de campos ausentes/ inválidos (vazia = completo).
export function validateRecord(rec) {
  const problems = [];
  if (!rec || typeof rec !== 'object') return ['registro'];
  for (const f of REQUIRED_RECORD_FIELDS) if (!present(rec[f])) problems.push(f);
  if (rec.status_completude !== 'COMPLETA') problems.push('status_completude!=COMPLETA');
  return problems;
}

// Registro de regras de cálculo AUTORIZADAS: { [id]: (record, areaTerreno:Decimal) => Decimal }.
// Produção: vazio. Uma regra só entra aqui com autorização expressa (e teste de paridade).
export const AUTHORIZED_RULES = Object.freeze({});

export function createMunicipalEngine({ base = BASE, rules = AUTHORIZED_RULES } = {}) {
  const records = Array.isArray(base?.registros) ? base.registros : [];
  const baseVersion = base?.versao ?? null;

  function estimate({ city, uf, areaTerreno } = {}) {
    const meta = { base_version: baseVersion, contract: `${CONTRACT_ID}/${CONTRACT_VERSION}` };
    const terreno = areaTerreno === undefined || areaTerreno === null ? null : String(areaTerreno).trim().replace(',', '.');
    if (!norm(city) || !norm(uf) || terreno === null || !/^\d+(?:\.\d{1,2})?$/.test(terreno) || Number(terreno) <= 0) {
      return { status: STATUS.ENTRADA_INVALIDA, area: null, rule_id: null, ...meta };
    }
    const hits = records.filter((r) => norm(r?.municipio) === norm(city) && norm(r?.estado) === norm(uf));
    if (!hits.length) return { status: STATUS.BASE_INDISPONIVEL, area: null, rule_id: null, ...meta };
    if (hits.length > 1 || hits[0]?.abrangencia !== 'MUNICIPIO_INTEIRO') {
      return { status: STATUS.ZONA_NAO_DETERMINADA, area: null, rule_id: null, ...meta };
    }
    const rec = hits[0];
    if (validateRecord(rec).length) return { status: STATUS.BASE_INCOMPLETA, area: null, rule_id: null, ...meta };
    if (Array.isArray(rec.conflitos) && rec.conflitos.length) return { status: STATUS.NORMAS_CONFLITANTES, area: null, rule_id: null, ...meta };
    const rule = Object.prototype.hasOwnProperty.call(rules, rec.regra_calculo) ? rules[rec.regra_calculo] : null;
    if (typeof rule !== 'function') return { status: STATUS.REGRA_NAO_AUTORIZADA, area: null, rule_id: null, ...meta };
    let out;
    try { out = rule(rec, dec(terreno)); } catch { out = null; }
    if (out === null || out === undefined) return { status: STATUS.BASE_INCOMPLETA, area: null, rule_id: null, ...meta };
    return {
      status: STATUS.CALCULATED,
      area: toStr(out),
      rule_id: rec.regra_calculo,
      legislacao_id: rec.legislacao_id,
      fonte_oficial: rec.fonte_oficial,
      ...meta,
    };
  }
  return { estimate, baseVersion };
}

// Instância de produção: base vazia + nenhuma regra autorizada => sempre fail-closed.
export const municipalEngine = createMunicipalEngine();
