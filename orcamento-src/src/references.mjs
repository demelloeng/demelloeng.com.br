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
};

export const REFERENCE_ORDER = Object.keys(REFERENCE_LABEL);

// references de UM serviço -> [{ key, label, total }] em ordem estável; ignora chaves desconhecidas e sem total.
export function referenceEntries(references) {
  if (!references || typeof references !== 'object') return [];
  return REFERENCE_ORDER
    .filter((key) => references[key] && references[key].total != null)
    .map((key) => ({ key, label: REFERENCE_LABEL[key], total: references[key].total }));
}
