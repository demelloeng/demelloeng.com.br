const FIELDS = ['source', 'medium', 'campaign', 'content'];
const UTM_VALUE = /^[a-z0-9-]{1,40}$/;

const UTM_SOURCE_ALIASES = new Map([
  ['chatgpt.com', 'chatgpt'],
  ['perplexity.ai', 'perplexity'],
  ['copilot.microsoft.com', 'copilot'],
  ['gemini.google.com', 'gemini'],
  ['claude.ai', 'claude'],
]);

export const AI_SOURCES = Object.freeze([...UTM_SOURCE_ALIASES.values()]);

export function aiSourceOf(hostname) {
  return hostname === 'chat.openai.com' ? 'chatgpt' : UTM_SOURCE_ALIASES.get(hostname);
}

export function isEstimateLink(target, origin) {
  return origin !== 'null' && target.origin === origin &&
    ['http:', 'https:'].includes(target.protocol) &&
    ['/orcamento/', '/orcamento', '/orcamento/index.html'].includes(target.pathname);
}

export function readAcquisition(search) {
  const query = new URLSearchParams(search);
  const acquisition = {};
  for (const field of FIELDS) {
    const value = query.get(`utm_${field}`);
    if (value !== null && (UTM_VALUE.test(value) || (field === 'source' && UTM_SOURCE_ALIASES.has(value)))) {
      acquisition[field] = value;
    }
  }
  return Object.keys(acquisition).length ? acquisition : undefined;
}

export function withAcquisition(payload, acquisition) {
  if (!acquisition) return payload;
  const source = UTM_SOURCE_ALIASES.get(acquisition.source);
  return { ...payload, acquisition: source ? { ...acquisition, source } : acquisition };
}

export function forwardAcquisition(doc) {
  const page = new URL(doc.URL);
  const acquisition = readAcquisition(page.search);
  if (!acquisition || page.origin === 'null') return;

  for (const link of doc.querySelectorAll('a[href]')) {
    let target;
    try { target = new URL(link.href); } catch { continue; }  // URL.canParse falta no iOS 16
    if (!isEstimateLink(target, page.origin)) continue;

    for (const [field, value] of Object.entries(acquisition)) {
      target.searchParams.set(`utm_${field}`, value);
    }
    link.href = target.href;
  }
}
