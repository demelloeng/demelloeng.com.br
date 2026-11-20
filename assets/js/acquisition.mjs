const FIELDS = ['source', 'medium', 'campaign', 'content'];
const UTM_VALUE = /^[a-z0-9-]{1,40}$/;

export function readAcquisition(search) {
  const query = new URLSearchParams(search);
  const acquisition = {};
  for (const field of FIELDS) {
    const value = query.get(`utm_${field}`);
    if (value !== null && UTM_VALUE.test(value)) acquisition[field] = value;
  }
  return Object.keys(acquisition).length ? acquisition : undefined;
}

export function withAcquisition(payload, acquisition) {
  return acquisition ? { ...payload, acquisition } : payload;
}

export function forwardAcquisition(doc) {
  const page = new URL(doc.URL);
  const acquisition = readAcquisition(page.search);
  if (!acquisition || page.origin === 'null') return;

  for (const link of doc.querySelectorAll('a[href]')) {
    if (!URL.canParse(link.href)) continue;
    const target = new URL(link.href);
    if (target.protocol !== page.protocol || target.origin !== page.origin) continue;
    if (!['/orcamento/', '/orcamento', '/orcamento/index.html'].includes(target.pathname)) continue;

    for (const [field, value] of Object.entries(acquisition)) {
      target.searchParams.set(`utm_${field}`, value);
    }
    link.href = target.href;
  }
}
