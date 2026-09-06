// renderPreviewPng - desenha a peça 1080x1350 da PRÉVIA DEMELLO VERIFICÁVEL V1.
//
// Recebe SOMENTE o PUBLIC_PREVIEW_V1 confirmado pelo Worker (já sanitizado:
// sem o fator, sem a regra interna, sem inputs, sem a assinatura interna).
// Nunca lê `answers` vivos. Todo valor visível vem de record.preview /
// record.verification_code.
//
// buildPreviewLayout(record) -> estrutura de texto + dados do QR (testável, puro).
// renderPreviewPng(record, opts) -> Promise<Blob> (PNG), desenho fino sobre canvas.

import { brlStr } from './pricing/decimal.mjs';
import { friendlyServiceName } from './client_summary.mjs';
import { encodeQr } from './qr.mjs';
import { verifyUrl } from './preview.mjs';

const W = 1080;
const H = 1350;

function assertConfirmed(record) {
  if (!record || typeof record !== 'object' ||
      record.schema !== 'PUBLIC_PREVIEW_V1' ||
      !record.verification_code ||
      !record.preview || typeof record.preview !== 'object' ||
      record.preview.schema_version !== 'PREVIEW_RECORD_V1') {
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
  const view = record.preview;
  const pricing = view.pricing || {};
  const calc = (pricing.services || []).filter((s) => s.status === 'CALCULATED');

  const caseRows = [];
  for (const key of CASE_ORDER) {
    const v = view.case_summary ? view.case_summary[key] : undefined;
    if (v === undefined || v === null || v === '') continue;
    caseRows.push({ key, label: CASE_LABELS[key] || key, value: Array.isArray(v) ? v.join(', ') : String(v) });
  }

  const references = [];
  for (const s of calc) {
    const name = friendlyServiceName(s);
    if (s.references && s.references.secid_pr) {
      references.push(`SECID/PR — ${name}: ${brlStr(s.references.secid_pr.total)}`);
    }
    if (s.references && s.references.altoqi) {
      references.push(`AltoQi — ${name}: ${brlStr(s.references.altoqi.total)}`);
    }
  }

  return {
    width: W,
    height: H,
    wordmark: 'DEMELLO ENGENHARIA',
    title: 'PRÉVIA INICIAL DEMELLO',
    case_rows: caseRows,
    forecast_label: 'PREVISÃO DEMELLO',
    forecast_value: pricing.status === 'CALCULATED' && pricing.total_demello
      ? brlStr(pricing.total_demello)
      : 'Avaliação humana necessária',
    references,
    criterion: 'Critério: previsão calculada a partir da referência pública aplicável, conforme metodologia DEMELLO.',
    disclaimers: Array.isArray(view.disclaimers) ? view.disclaimers : [],
    issued_at_label: `Emitida em ${fmtIssuedAt(record.issued_at)}`,
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
  const PAD = 48;
  const INK = '#10161d';
  const NAVY = '#2b3844';
  const BLUE = '#235480';
  const MUTED = '#616161';
  const LINE = '#b9c1c8';
  const ICE = '#f2f5f7';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  let y = 34;
  const logo = await loadLogo(loadImage);
  if (logo) {
    const lw = 300; const lh = lw * (logo.height / logo.width || 0.26);
    ctx.drawImage(logo, PAD, y, lw, lh);
  } else {
    ctx.fillStyle = NAVY; ctx.font = `700 34px ${FONT}`;
    ctx.fillText(L.wordmark, PAD, y);
  }

  ctx.fillStyle = NAVY; ctx.font = `700 28px ${FONT}`;
  const titleWidth = ctx.measureText(L.title).width;
  const titleX = W - PAD - titleWidth;
  ctx.fillText(L.title, titleX, 56);
  ctx.strokeStyle = LINE; ctx.beginPath();
  ctx.moveTo(titleX - 32, 40); ctx.lineTo(titleX - 32, 96); ctx.stroke();

  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(PAD, 126); ctx.lineTo(W - PAD, 126); ctx.stroke();

  // previsão: primeiro bloco de conteúdo, com referência e critério no mesmo módulo.
  ctx.fillStyle = ICE; ctx.fillRect(PAD, 146, W - PAD * 2, 210);
  ctx.fillStyle = BLUE; ctx.font = `700 22px ${FONT}`;
  ctx.fillText(L.forecast_label, PAD + 28, 170);
  ctx.fillStyle = NAVY; ctx.font = `800 62px ${FONT}`;
  ctx.fillText(L.forecast_value, PAD + 28, 202);

  const refY = 280;
  const refCols = L.references.length > 2 ? 2 : 1;
  const refWidth = refCols === 2 ? (W - PAD * 2 - 72) / 2 : W - PAD * 2 - 56;
  const refFont = L.references.length > 4 ? 14 : 17;
  ctx.fillStyle = INK; ctx.font = `600 ${refFont}px ${FONT}`;
  L.references.forEach((reference, index) => {
    const col = refCols === 2 ? index % 2 : 0;
    const row = refCols === 2 ? Math.floor(index / 2) : index;
    const rx = PAD + 28 + col * (refWidth + 16);
    const ry = refY + row * 21;
    ctx.fillText(reference, rx, ry);
  });
  ctx.fillStyle = MUTED; ctx.font = `400 17px ${FONT}`;
  ctx.fillText(L.criterion, PAD + 28, 326);

  // caso: narrativa em largura total, contexto em duas colunas e medidas em células.
  const caseTop = 376;
  const caseBottom = 854;
  ctx.strokeStyle = LINE; ctx.strokeRect(PAD, caseTop, W - PAD * 2, caseBottom - caseTop);
  ctx.fillStyle = BLUE; ctx.fillRect(PAD, caseTop, W - PAD * 2, 48);
  // glifo "pessoa" (cabeça + ombros) à esquerda do título
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.fillStyle = 'transparent';
  ctx.beginPath(); ctx.arc(PAD + 27, caseTop + 20, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(PAD + 27, caseTop + 40, 11, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = '#ffffff'; ctx.font = `700 23px ${FONT}`;
  ctx.fillText('SEU CASO', PAD + 48, caseTop + 12);

  const narrativeKeys = new Set(['necessidade', 'situacao', 'finalidade']);
  const metricKeys = new Set(['area_iptu', 'area_matricula', 'diferenca', 'area_nova', 'area_existente', 'area_total', 'area_atendida', 'area_terreno', 'area_escopo']);
  const narrative = L.case_rows.filter((row) => narrativeKeys.has(row.key));
  const metrics = L.case_rows.filter((row) => metricKeys.has(row.key));
  const context = L.case_rows.filter((row) => !narrativeKeys.has(row.key) && !metricKeys.has(row.key));
  const bodyTop = caseTop + 48;
  const metricHeight = metrics.length ? 82 : 0;
  const bodyHeight = caseBottom - bodyTop - metricHeight;
  const narrativeHeight = narrative.length ? Math.min(58, Math.floor(bodyHeight * 0.46 / narrative.length)) : 0;
  const contextRows = Math.ceil(context.length / 2);
  const contextHeight = contextRows ? Math.floor((bodyHeight - narrativeHeight * narrative.length) / contextRows) : 0;
  let cy = bodyTop;

  const drawField = (row, x, top, width, height, valueSize = 21) => {
    ctx.fillStyle = BLUE; ctx.font = `700 15px ${FONT}`;
    ctx.fillText(row.label.toUpperCase(), x + 22, top + 10);
    ctx.fillStyle = INK; ctx.font = `400 ${valueSize}px ${FONT}`;
    const lines = wrap(ctx, row.value, width - 44).slice(0, 2);
    lines.forEach((line, i) => ctx.fillText(line, x + 22, top + 31 + i * 22));
    ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(x, top + height); ctx.lineTo(x + width, top + height); ctx.stroke();
  };

  for (const row of narrative) {
    drawField(row, PAD, cy, W - PAD * 2, narrativeHeight, 21);
    cy += narrativeHeight;
  }
  const colWidth = (W - PAD * 2) / 2;
  context.forEach((row, index) => {
    const col = index % 2;
    const rowIndex = Math.floor(index / 2);
    const top = cy + rowIndex * contextHeight;
    drawField(row, PAD + col * colWidth, top, colWidth, contextHeight, 20);
    if (col === 0) {
      ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(PAD + colWidth, top); ctx.lineTo(PAD + colWidth, top + contextHeight); ctx.stroke();
    }
  });

  if (metrics.length) {
    const metricTop = caseBottom - metricHeight;
    const metricWidth = (W - PAD * 2) / metrics.length;
    metrics.forEach((row, index) => {
      const x = PAD + index * metricWidth;
      if (index) { ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(x, metricTop); ctx.lineTo(x, caseBottom); ctx.stroke(); }
      ctx.fillStyle = BLUE; ctx.font = `700 14px ${FONT}`;
      ctx.fillText(row.label.toUpperCase(), x + 18, metricTop + 14);
      ctx.fillStyle = NAVY; ctx.font = `700 ${metrics.length > 4 ? 24 : 31}px ${FONT}`;
      ctx.fillText(row.value, x + 18, metricTop + 39);
    });
  }

  // Ressalvas vêm literalmente do PREVIEW_RECORD e têm módulo próprio.
  const disclaimerTop = 874;
  const disclaimerBottom = 1062;
  ctx.fillStyle = ICE; ctx.fillRect(PAD, disclaimerTop, W - PAD * 2, disclaimerBottom - disclaimerTop);
  ctx.strokeStyle = LINE; ctx.strokeRect(PAD, disclaimerTop, W - PAD * 2, disclaimerBottom - disclaimerTop);
  let dy = disclaimerTop + 20;
  ctx.fillStyle = INK; ctx.font = `400 20px ${FONT}`;
  for (const d of L.disclaimers) {
    for (const ln of wrap(ctx, d, W - PAD * 2 - 48)) { ctx.fillText(ln, PAD + 24, dy); dy += 25; }
    dy += 9;
  }

  // Verificação: código, emissão, URL e QR real em um único módulo.
  const verifyTop = 1082;
  const verifyBottom = 1308;
  ctx.strokeStyle = BLUE; ctx.strokeRect(PAD, verifyTop, W - PAD * 2, verifyBottom - verifyTop);
  const qr = L.qr;
  const qn = qr.length;
  const qpx = Math.max(4, Math.floor(174 / qn));
  const qsize = qn * qpx;
  const qx = W - PAD - qsize - 26;
  const qy = verifyTop + Math.floor((verifyBottom - verifyTop - qsize) / 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(qx - 12, qy - 12, qsize + 24, qsize + 24);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < qn; r += 1) for (let cc = 0; cc < qn; cc += 1) {
    if (qr[r][cc]) ctx.fillRect(qx + cc * qpx, qy + r * qpx, qpx, qpx);
  }
  const vx = PAD + 26;
  // "Código: <code>" na mesma linha (rótulo azul + código mono navy)
  ctx.fillStyle = BLUE; ctx.font = `700 22px ${FONT}`;
  ctx.fillText('Código:', vx, verifyTop + 26);
  const codeLabelW = ctx.measureText('Código: ').width;
  ctx.fillStyle = NAVY; ctx.font = `600 24px ${MONO}`;
  ctx.fillText(L.verification_code, vx + codeLabelW, verifyTop + 25);
  ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(vx, verifyTop + 66); ctx.lineTo(qx - 28, verifyTop + 66); ctx.stroke();
  // linha "Emitida em" com glifo de calendário
  const ly1 = verifyTop + 92;
  ctx.strokeStyle = BLUE; ctx.lineWidth = 2;
  ctx.strokeRect(vx + 1, ly1 + 3, 18, 15);
  ctx.beginPath(); ctx.moveTo(vx + 1, ly1 + 8); ctx.lineTo(vx + 19, ly1 + 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx + 6, ly1 + 1); ctx.lineTo(vx + 6, ly1 + 5); ctx.moveTo(vx + 14, ly1 + 1); ctx.lineTo(vx + 14, ly1 + 5); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = MUTED; ctx.font = `400 18px ${FONT}`;
  ctx.fillText(L.issued_at_label, vx + 34, ly1);
  // linha "Verifique em" com glifo de globo
  const ly2 = verifyTop + 128;
  ctx.strokeStyle = BLUE; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(vx + 10, ly2 + 10, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(vx + 10, ly2 + 10, 4, 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx + 1, ly2 + 10); ctx.lineTo(vx + 19, ly2 + 10); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = MUTED; ctx.font = `400 18px ${FONT}`;
  ctx.fillText('Verifique em ', vx + 34, ly2);
  const prefW = ctx.measureText('Verifique em ').width;
  ctx.fillStyle = BLUE; ctx.font = `600 18px ${FONT}`;
  ctx.fillText('demelloeng.com.br/verificar', vx + 34 + prefW, ly2);

  const toBlob = () => new Promise((resolve, reject) => {
    if (canvas.toBlob) canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob nulo'))), 'image/png');
    else reject(new Error('canvas.toBlob indisponível'));
  });
  return toBlob();
}
