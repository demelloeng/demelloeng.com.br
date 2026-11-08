// Rótulos públicos das referências de preço — comercialmente compreensíveis, SEM composição interna.
//
// As chaves INTERNAS do preview (browser) e as chaves PÚBLICAS do registro verificável
// (PUBLIC_PREVIEW_V1) entram aqui. A referência composta (superestrutura AltoQi + fundação SECID/PR)
// nunca é apresentada como preço AltoQi: chega como `altoqi_composta` (interno) / `mercado` (público)
// e sai como "Referência de mercado".
export const REFERENCE_LABEL = {
  secid_pr: 'SECID/PR',
  fundepar_001_2025: 'FUNDEPAR',
  fundepar: 'FUNDEPAR',
  altoqi: 'AltoQi',
  altoqi_composta: 'Referência de mercado',
  mercado: 'Referência de mercado',
  maxicad_bim: 'MaxiCAD',
  maxicad: 'MaxiCAD',
  rfb_bim: 'Receita Federal',
  rfb: 'Receita Federal',
  cim_amunesc_2026: 'CIM-AMUNESC',
  cim_amunesc: 'CIM-AMUNESC',
  ibape_pr: 'IBAPE-PR',
  ibape: 'IBAPE-PR',
  // Projeto elétrico residencial: valor comercial DEMELLO documentado (base derivada; não é publicação AltoQi).
  demello_eletrica_documentada: 'Base DEMELLO documentada',
};

export const REFERENCE_ORDER = Object.keys(REFERENCE_LABEL);

// R2: a FUNDEPAR publica várias categorias por serviço (chaves fundepar_001_2025_<categoria>); a exibição mostra UMA entrada
// FUNDEPAR, a de MENOR total, para o preço DEMELLO nunca ficar abaixo de todas as referências exibidas.
// Previews R1 (chave única) saem iguais. Espelho: publicService() do preview-worker.
const FUNDEPAR_KEY = 'fundepar_001_2025';
function withLowestFundepar(references) {
  const cents = (t) => Math.round(Number(t) * 100);
  const candidates = Object.keys(references)
    .filter((k) => (k === FUNDEPAR_KEY || k.startsWith(`${FUNDEPAR_KEY}_`)) && references[k] && references[k].total != null)
    .map((k) => references[k].total);
  if (candidates.length === 0) return references;
  const lowest = candidates.reduce((a, b) => (cents(b) < cents(a) ? b : a));
  return { ...references, [FUNDEPAR_KEY]: { total: lowest } };
}

// references de UM serviço -> [{ key, label, total }] em ordem estável; ignora chaves desconhecidas e sem total.
export function referenceEntries(references) {
  if (!references || typeof references !== 'object') return [];
  const refs = withLowestFundepar(references);
  return REFERENCE_ORDER
    .filter((key) => refs[key] && refs[key].total != null)
    .map((key) => ({ key, label: REFERENCE_LABEL[key], total: refs[key].total }));
}
