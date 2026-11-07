// P02 — municípios oficiais do IBGE vinculados à UF.
//
// Fonte: API de Localidades do IBGE (https://servicodados.ibge.gov.br/api/docs/localidades), consultada pelo
// script scripts/gerar-municipios-ibge.py e gravada como arquivo estático do próprio site
// (orcamento-src/public/assets/municipios-ibge.v1.json). A visita NÃO chama a API do IBGE: o catálogo vem do mesmo
// domínio, funciona com a rede do visitante instável e não envia o IP dele a um terceiro.
//
// Resposta do visitante: { uf, city, ibge_id }. O código IBGE tem 7 dígitos e os dois primeiros identificam a UF:
// por isso a combinação cidade/UF errada é detectada até sem o catálogo carregado.
export const UF_CODES = Object.freeze({
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
  21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
  31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
  41: 'PR', 42: 'SC', 43: 'RS',
  50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
});

export const ID_FORMAT = /^[0-9]{7}$/;
export const ufOfId = (id) => (ID_FORMAT.test(String(id ?? '')) ? (UF_CODES[String(id).slice(0, 2)] ?? null) : null);

// Sem acento, sem maiúscula, sem apóstrofo e com hífen virando espaço: "Sao Luis" acha "São Luís";
// "Santa Barbara d Oeste" e "Santa Bárbara d'Oeste" são a mesma busca.
export const normalizeText = (t) => String(t ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/['’`´]/g, '')
  .replace(/[-–—]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// O Distrito Federal tem um único município (Brasília). Quem mora numa região administrativa costuma digitar o nome dela.
// Estes nomes só servem de apelido de BUSCA e levam a Brasília; nunca entram como cidade.
export const DF_REGIOES_ADMINISTRATIVAS = Object.freeze([
  'Plano Piloto', 'Gama', 'Taguatinga', 'Brazlândia', 'Sobradinho', 'Planaltina', 'Paranoá', 'Núcleo Bandeirante',
  'Ceilândia', 'Guará', 'Cruzeiro', 'Samambaia', 'Santa Maria', 'São Sebastião', 'Recanto das Emas', 'Lago Sul',
  'Riacho Fundo', 'Lago Norte', 'Candangolândia', 'Águas Claras', 'Riacho Fundo II', 'Sudoeste', 'Octogonal', 'Varjão',
  'Park Way', 'SCIA', 'Estrutural', 'Sobradinho II', 'Jardim Botânico', 'Itapoã', 'SIA', 'Vicente Pires', 'Fercal',
  'Sol Nascente', 'Pôr do Sol', 'Arniqueira', 'Arapoanga', 'Água Quente',
]);

// raw = conteúdo do arquivo: { fonte, consulta, total, m: [[ibge_id, nome], ...] }
export function buildIndex(raw) {
  const byId = new Map();
  const byUf = {};
  for (const uf of Object.values(UF_CODES)) byUf[uf] = [];
  for (const entry of raw?.m ?? []) {
    const [id, nome] = entry;
    const key = String(id);
    const uf = ufOfId(key);
    if (!uf || typeof nome !== 'string' || !nome) continue;
    const item = { id: key, nome, uf, norm: normalizeText(nome) };
    byId.set(key, item);
    byUf[uf].push(item);
  }
  for (const list of Object.values(byUf)) list.sort((a, b) => (a.norm < b.norm ? -1 : a.norm > b.norm ? 1 : 0));
  return { byId, byUf, total: byId.size, fonte: raw?.fonte ?? null, consulta: raw?.consulta ?? null };
}

// Resultados da busca dentro da UF: começa com o termo, depois palavra que começa com o termo, depois contém.
export function search(index, uf, query, limit = 8) {
  const list = index?.byUf?.[uf];
  if (!list) return [];
  const q = normalizeText(query);
  if (!q) return list.slice(0, limit);
  const starts = [];
  const words = [];
  const has = [];
  for (const item of list) {
    if (item.norm.startsWith(q)) starts.push(item);
    else if (item.norm.split(' ').some((w) => w.startsWith(q))) words.push(item);
    else if (item.norm.includes(q)) has.push(item);
  }
  const out = [...starts, ...words, ...has];
  if (uf === 'DF') {
    const hit = DF_REGIOES_ADMINISTRATIVAS.find((r) => normalizeText(r).startsWith(q) || normalizeText(r).includes(q));
    const brasilia = index.byId.get('5300108');
    if (hit && brasilia && !out.includes(brasilia)) out.push({ ...brasilia, apelido: hit });
  }
  return out.slice(0, limit);
}

// Índice usado pela validação síncrona. O App o define quando o catálogo carrega; os testes, com o arquivo real.
let current = null;
export const setIndex = (index) => { current = index; };
export const getIndex = () => current;

// Resposta de localização válida: UF da lista, código IBGE de 7 dígitos com prefixo da UF escolhida e, com o catálogo
// carregado, nome e UF iguais aos do registro oficial daquele código. Sem catálogo (nunca ocorre na tela, que só
// oferece itens do catálogo) vale o prefixo; o servidor pode conferir o resto pelo código.
export function locationValid(v, index = current) {
  if (!v || typeof v !== 'object') return false;
  const city = typeof v.city === 'string' ? v.city.trim() : '';
  const id = String(v.ibge_id ?? '');
  if (!city || !Object.values(UF_CODES).includes(v.uf)) return false;
  if (ufOfId(id) !== v.uf) return false;
  if (!index) return true;
  const official = index.byId.get(id);
  return !!official && official.uf === v.uf && official.nome === city;
}

let loading = null;
// Carrega o catálogo uma vez (mesmo domínio). Falha devolve a promessa rejeitada para o App mostrar "tentar de novo".
export function loadCatalog(url, fetchImpl = (typeof fetch !== 'undefined' ? fetch : null)) {
  if (current) return Promise.resolve(current);
  if (loading) return loading;
  if (!fetchImpl) return Promise.reject(new Error('sem-fetch'));
  loading = fetchImpl(url, { credentials: 'omit' })
    .then((res) => { if (!res.ok) throw new Error(`http-${res.status}`); return res.json(); })
    .then((raw) => {
      const index = buildIndex(raw);
      if (index.total < 5000) throw new Error('catalogo-incompleto');
      current = index;
      return index;
    })
    .finally(() => { loading = null; });
  return loading;
}
