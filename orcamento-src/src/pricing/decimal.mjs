// Aritmética decimal exata (BigInt) para o motor de previsão DEMELLO V1 no browser.
// Espelha o subconjunto de decimal.Decimal (Python) que o motor usa:
//   parse de string/número, add, sub, mul, abs, compare,
//   quantize para 2 casas com ROUND_HALF_UP,
//   toStr() preservando o expoente (zeros à direita) igual a str(Decimal).
// Valor = { n: BigInt, e: number >= 0 }  significando  n * 10^(-e).

const P10 = (k) => 10n ** BigInt(k);

export function dec(value) {
  if (value && typeof value === 'object' && typeof value.n === 'bigint') return value;
  let s = String(value).trim();
  let neg = false;
  if (s[0] === '+') s = s.slice(1);
  else if (s[0] === '-') { neg = true; s = s.slice(1); }
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('decimal inválido: ' + value);
  const dot = s.indexOf('.');
  let digits;
  let e;
  if (dot === -1) { digits = s; e = 0; } else { digits = s.slice(0, dot) + s.slice(dot + 1); e = s.length - dot - 1; }
  let n = BigInt(digits);
  if (neg) n = -n;
  return { n, e };
}

// Python _num: None/bool -> null ; número/str -> Decimal ou null (nunca coage para 0).
export function num(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'object' && typeof value.n === 'bigint') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? dec(String(value)) : null;
  if (typeof value === 'string') {
    const t = value.trim().replace(/ /g, '').replace(/,/g, '.');
    if (t === '') return null;
    try { return dec(t); } catch { return null; }
  }
  return null;
}

export function add(a, b) {
  const e = Math.max(a.e, b.e);
  return { n: a.n * P10(e - a.e) + b.n * P10(e - b.e), e };
}
export function sub(a, b) { return add(a, { n: -b.n, e: b.e }); }
export function mul(a, b) { return { n: a.n * b.n, e: a.e + b.e }; }
export function absD(a) { return { n: a.n < 0n ? -a.n : a.n, e: a.e }; }
export function cmp(a, b) { const d = sub(a, b); return d.n < 0n ? -1 : d.n > 0n ? 1 : 0; }

// str(Decimal) do Python: mantém o expoente, não normaliza zeros à direita.
export function toStr(a) {
  const neg = a.n < 0n;
  let digits = (neg ? -a.n : a.n).toString();
  if (a.e === 0) return (neg ? '-' : '') + digits;
  if (digits.length <= a.e) digits = '0'.repeat(a.e - digits.length + 1) + digits;
  const cut = digits.length - a.e;
  return (neg ? '-' : '') + digits.slice(0, cut) + '.' + digits.slice(cut);
}

export function isIntegral(a) { return a.e === 0 || a.n % P10(a.e) === 0n; }

// Python _number_out: int quando inteiro, senão float ; None -> null.
export function numberOut(a) {
  if (a === null || a === undefined) return null;
  if (isIntegral(a)) return Number(a.n / P10(a.e));
  return Number(toStr(a));
}

// quantize para 2 casas, ROUND_HALF_UP. Motor sempre opera com valores >= 0.
function quantize2(a) {
  if (a.e <= 2) return { n: a.n * P10(2 - a.e), e: 2 };
  const div = P10(a.e - 2);
  let q = a.n / div;
  let r = a.n % div;
  if (r < 0n) r = -r;
  if (r * 2n >= div) q += a.n < 0n ? -1n : 1n;
  return { n: q, e: 2 };
}

// Python _money: str(value.quantize(Decimal("0.01"), ROUND_HALF_UP)) -> string com 2 casas.
export function money(a) { return toStr(quantize2(a)); }

// Python _brl: "R$ 12.448,00".
export function brl(a) {
  const q = quantize2(a);
  const neg = q.n < 0n;
  const cents = (neg ? -q.n : q.n).toString().padStart(3, '0');
  let intPart = cents.slice(0, -2);
  const frac = cents.slice(-2);
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + 'R$ ' + intPart + ',' + frac;
}

// Conveniência de UI: formata uma string monetária "9958.40" como "R$ 9.958,40".
export function brlStr(s) { return brl(dec(s)); }
