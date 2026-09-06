// renderPreviewPng - desenha a peça 1080x1350 da PRÉVIA DEMELLO VERIFICÁVEL V1.
//
// Recebe SOMENTE o PREVIEW_RECORD confirmado pelo Worker. Nunca lê `answers`
// vivos. Todo valor visível vem de record.canonical / record.verification_code.
//
// buildPreviewLayout(record) -> estrutura de texto + dados do QR (testável, puro).
// renderPreviewPng(record, opts) -> Promise<Blob> (PNG), desenho fino sobre canvas.

import { brlStr } from './pricing/decimal.mjs';
import { encodeQr } from './qr.mjs';
import { verifyUrl } from './preview.mjs';

const W = 1080;
const H = 1350;

function assertConfirmed(record) {
  if (!record || typeof record !== 'object' ||
      !record.verification_code || !record.fingerprint ||
      !record.canonical || record.canonical.schema_version !== 'PREVIEW_RECORD_V1') {
    throw new Error('renderPreviewPng: registro não confirmado');
  }
}

const CASE_LABELS = {
  necessidade: 'Necessidade',
  situacao: 'Situação',
  finalidade: 'Finalidade',
  localizacao: 'Localização',
  tipo_imovel: 'Imóvel',
  documentos: 'Documentos',
  motivo_diferenca: 'Motivo da diferença',
  area_iptu: 'Área IPTU',
  area_matricula: 'Área matrícula',
  diferenca: 'Diferença',
  area_nova: 'Área nova',
  area_existente: 'Área existente',
  area_total: 'Área total',
  area_atendida: 'Área atendida',
  area_terreno: 'Área do terreno',
  area_escopo: 'Área do escopo',
  servicos: 'Serviços',
};
const CASE_ORDER = [
  'necessidade', 'situacao', 'finalidade', 'localizacao', 'tipo_imovel', 'documentos',
  'motivo_diferenca', 'servicos',
  'area_iptu', 'area_matricula', 'diferenca',
  'area_nova', 'area_existente', 'area_total', 'area_atendida', 'area_terreno', 'area_escopo',
];

function fmtIssuedAt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]} UTC`;
}

export function buildPreviewLayout(record) {
  assertConfirmed(record);
  const c = record.canonical;
  const preview = c.preview || {};
  const calc = (preview.services || []).filter((s) => s.status === 'CALCULATED');

  const caseRows = [];
  for (const key of CASE_ORDER) {
    const v = c.case_summary ? c.case_summary[key] : undefined;
    if (v === undefined || v === null || v === '') continue;
    caseRows.push({ label: CASE_LABELS[key] || key, value: Array.isArray(v) ? v.join(', ') : String(v) });
  }

  const references = [];
  for (const s of calc) {
    if (s.references && s.references.secid_pr) {
      references.push(`SECID/PR — ${s.service}: ${brlStr(s.references.secid_pr.total)}`);
    }
    if (s.references && s.references.altoqi) {
      references.push(`AltoQi — ${s.service}: ${brlStr(s.references.altoqi.total)}`);
    }
  }

  return {
    width: W,
    height: H,
    wordmark: 'DEMELLO ENGENHARIA',
    title: 'PRÉVIA INICIAL DEMELLO',
    case_rows: caseRows,
    forecast_label: 'PREVISÃO DEMELLO',
    forecast_value: preview.status === 'CALCULATED' && preview.total_demello
      ? brlStr(preview.total_demello)
      : 'Avaliação humana necessária',
    references,
    criterion: `Critério: menor referência pública aplicável × fator DEMELLO ${c.methodology ? c.methodology.factor_demello : '0.80'}.`,
    disclaimers: Array.isArray(c.disclaimers) ? c.disclaimers : [],
    issued_at_label: `Emitida em ${fmtIssuedAt(c.issued_at)}`,
    verification_code: record.verification_code,
    verify_url: verifyUrl(record.verification_code),
    qr: encodeQr(verifyUrl(record.verification_code)),
  };
}

// -------------------------------------------------------------------- desenho
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else { line = test; }
  }
  if (line) lines.push(line);
  return lines;
}

async function loadLogo(loadImage) {
  if (!loadImage) return null;
  try { return await loadImage('/assets/images/logo.png'); } catch { return null; }
}

export async function renderPreviewPng(record, opts = {}) {
  const L = buildPreviewLayout(record);
  const canvasFactory = opts.canvasFactory ||
    (() => (typeof document !== 'undefined' ? document.createElement('canvas') : null));
  const loadImage = opts.loadImage ||
    ((src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }));

  const canvas = canvasFactory();
  if (!canvas) throw new Error('renderPreviewPng: canvas indisponível');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const FONT = "'Source Sans 3', system-ui, sans-serif";
  const MONO = "'JetBrains Mono', ui-monospace, monospace";
  const PAD = 72;
  const INK = '#10161d';
  const NAVY = '#1d2b3b';
  const MUTED = '#6b7680';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  let y = PAD;
  const logo = await loadLogo(loadImage);
  if (logo) {
    const lw = 300; const lh = lw * (logo.height / logo.width || 0.26);
    ctx.drawImage(logo, PAD, y, lw, lh);
    y += lh + 24;
  } else {
    ctx.fillStyle = NAVY; ctx.font = `700 34px ${FONT}`;
    ctx.fillText(L.wordmark, PAD, y); y += 52;
  }

  ctx.fillStyle = MUTED; ctx.font = `600 20px ${MONO}`;
  ctx.fillText(L.title, PAD, y); y += 40;

  ctx.strokeStyle = '#d5d9d8'; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  y += 28;

  // caso
  ctx.font = `400 20px ${FONT}`;
  for (const row of L.case_rows) {
    ctx.fillStyle = MUTED; ctx.font = `600 16px ${MONO}`;
    ctx.fillText(row.label.toUpperCase(), PAD, y);
    ctx.fillStyle = INK; ctx.font = `400 20px ${FONT}`;
    const lines = wrap(ctx, row.value, W - PAD * 2);
    y += 22;
    for (const ln of lines) { ctx.fillText(ln, PAD, y); y += 26; }
    y += 8;
  }

  y += 12;
  ctx.strokeStyle = '#d5d9d8'; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  y += 28;

  // previsão
  ctx.fillStyle = MUTED; ctx.font = `600 18px ${MONO}`;
  ctx.fillText(L.forecast_label, PAD, y); y += 30;
  ctx.fillStyle = NAVY; ctx.font = `800 64px ${FONT}`;
  ctx.fillText(L.forecast_value, PAD, y); y += 84;

  ctx.fillStyle = INK; ctx.font = `400 18px ${FONT}`;
  for (const r of L.references) { ctx.fillText(r, PAD, y); y += 26; }
  y += 6;
  ctx.fillStyle = MUTED; ctx.font = `400 17px ${FONT}`;
  for (const ln of wrap(ctx, L.criterion, W - PAD * 2)) { ctx.fillText(ln, PAD, y); y += 23; }
  y += 18;

  // ressalvas
  ctx.fillStyle = MUTED; ctx.font = `400 15px ${FONT}`;
  for (const d of L.disclaimers) {
    for (const ln of wrap(ctx, d, W - PAD * 2)) { ctx.fillText(ln, PAD, y); y += 20; }
    y += 8;
  }

  // rodapé: código + issued_at + QR
  const qr = L.qr;
  const qn = qr.length;
  const qpx = 8;
  const qsize = qn * qpx;
  const qx = W - PAD - qsize;
  const qy = H - PAD - qsize;
  ctx.fillStyle = '#000000';
  for (let r = 0; r < qn; r += 1) for (let cc = 0; cc < qn; cc += 1) {
    if (qr[r][cc]) ctx.fillRect(qx + cc * qpx, qy + r * qpx, qpx, qpx);
  }
  ctx.fillStyle = INK; ctx.font = `600 18px ${MONO}`;
  ctx.fillText(`Código: ${L.verification_code}`, PAD, H - PAD - 96);
  ctx.fillStyle = MUTED; ctx.font = `400 15px ${FONT}`;
  ctx.fillText(L.issued_at_label, PAD, H - PAD - 66);
  ctx.fillText('Verifique em demelloeng.com.br/verificar', PAD, H - PAD - 44);

  const toBlob = () => new Promise((resolve, reject) => {
    if (canvas.toBlob) canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob nulo'))), 'image/png');
    else reject(new Error('canvas.toBlob indisponível'));
  });
  return toBlob();
}
