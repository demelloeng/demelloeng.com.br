// P02 — telefone/WhatsApp brasileiro e e-mail do contato. Módulo puro.
//
// O que isto valida é o FORMATO de um número do Brasil (DDD real, quantidade de dígitos, tipo do número) e rejeita
// números evidentemente artificiais. Formato válido NÃO prova que o número existe nem que tem conta de WhatsApp: essa
// confirmação exigiria enviar mensagem, e o site não faz consulta externa de telefone (privacidade, custo e necessidade).
// Por isso a tela mostra o número normalizado para o visitante conferir antes de enviar.

// DDDs em uso no Brasil (Anatel).
export const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export const PHONE_MESSAGE = Object.freeze({
  vazio: 'Informe o número com DDD ou use o e-mail.',
  caractere_invalido: 'Use só números, espaço, parênteses, hífen e o + no começo.',
  curto: 'Faltam dígitos. Informe o DDD e o número, como (41) 9XXXX-XXXX.',
  longo: 'Sobraram dígitos. Informe o DDD e o número, como (41) 9XXXX-XXXX.',
  internacional: 'Este campo é para números do Brasil (+55). Se o seu contato é de outro país, use o e-mail.',
  ddd_invalido: 'Esse DDD não existe. Confira os dois primeiros dígitos.',
  formato: 'Esse número não parece de celular nem de telefone fixo. Confira os dígitos.',
  artificial: 'Esse número parece de teste. Informe o número que você usa de verdade.',
});

export const EMAIL_MESSAGE = 'Confira o e-mail: ele precisa ter o formato nome@dominio.com.';
export const NAME_MESSAGE = 'Informe seu nome.';

const ONLY_ALLOWED = /^\+?[0-9\s().-]+$/;

const allSame = (s) => /^(.)\1*$/.test(s);
const run = (s, step) => s.split('').every((d, i, a) => i === 0 || Number(d) - Number(a[i - 1]) === step);
const sequential = (s) => run(s, 1) || run(s, -1);

// "Evidentemente artificial": o número do assinante inteiro é o mesmo dígito, ou uma sequência corrida
// (12345678, 987654321). Não tenta adivinhar mais que isso, para não recusar número real.
function artificial(ddd, subscriber) {
  const digits = String(ddd) + subscriber;
  const tail = subscriber.length === 9 ? subscriber.slice(1) : subscriber; // sem o 9 inicial do celular
  return allSame(digits) || allSame(tail) || sequential(subscriber) || sequential(tail);
}

// Resultado: { ok:true, e164, national, ddd, type, display } ou { ok:false, code }.
export function parsePhone(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw) return { ok: false, code: 'vazio' };
  if (!ONLY_ALLOWED.test(raw) || raw.lastIndexOf('+') > 0) return { ok: false, code: 'caractere_invalido' };

  const hadPlus = raw.startsWith('+');
  let d = raw.replace(/\D/g, '');

  // Prefixos aceitos: +55, 0055 (internacional) e 0 antes do DDD (tronco nacional).
  if (hadPlus) {
    if (!d.startsWith('55')) return { ok: false, code: 'internacional' };
    d = d.slice(2);
  } else if (d.startsWith('0055')) {
    d = d.slice(4);
  } else if (d.startsWith('0')) {
    d = d.slice(1);
  } else if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    d = d.slice(2); // 55 + DDD + número, sem o +
  }

  if (d.length < 10) return { ok: false, code: 'curto' };
  if (d.length > 11) return { ok: false, code: 'longo' };
  if (allSame(d)) return { ok: false, code: 'artificial' };

  const ddd = Number(d.slice(0, 2));
  if (!DDDS.has(ddd)) return { ok: false, code: 'ddd_invalido' };

  const subscriber = d.slice(2);
  let type;
  if (subscriber.length === 9 && subscriber[0] === '9') type = 'mobile';
  else if (subscriber.length === 8 && /^[2-5]/.test(subscriber)) type = 'landline';
  else return { ok: false, code: 'formato' };

  if (artificial(ddd, subscriber)) return { ok: false, code: 'artificial' };

  const display = type === 'mobile'
    ? `(${ddd}) ${subscriber.slice(0, 5)}-${subscriber.slice(5)}`
    : `(${ddd}) ${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;
  return { ok: true, e164: `+55${d}`, national: d, ddd, type, display };
}

// e-mail: formato prático (um @, domínio com ponto e sufixo de 2+ letras, sem espaço nem pontos seguidos).
export function emailValid(value) {
  const t = typeof value === 'string' ? value.trim() : '';
  if (!t || t.length > 254 || /\s/.test(t) || t.includes('..')) return false;
  return /^[^\s@]+@[^\s@.][^\s@]*\.[^\s@.]{2,}$/.test(t);
}

// Estado do contato (nó X4): nome + pelo menos um meio; o que foi preenchido precisa estar correto.
export function contactCheck(contact) {
  const c = contact && typeof contact === 'object' ? contact : {};
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  const wa = typeof c.whatsapp === 'string' ? c.whatsapp.trim() : '';
  const em = typeof c.email === 'string' ? c.email.trim() : '';
  const phone = wa ? parsePhone(wa) : null;
  const errors = {};
  if (!name) errors.name = NAME_MESSAGE;
  if (wa && !phone.ok) errors.whatsapp = PHONE_MESSAGE[phone.code];
  if (em && !emailValid(em)) errors.email = EMAIL_MESSAGE;
  const hasChannel = (wa && phone.ok) || (em && emailValid(em));
  const ok = !!name && !errors.whatsapp && !errors.email && !!hasChannel;
  return { ok, errors, phone: phone && phone.ok ? phone : null, needsChannel: !wa && !em };
}
