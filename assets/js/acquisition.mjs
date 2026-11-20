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
