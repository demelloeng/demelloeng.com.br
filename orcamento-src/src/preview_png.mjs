// renderPreviewPng - desenha a peça 1080 de largura da PRÉVIA DEMELLO VERIFICÁVEL V1 (altura 1350, ou maior quando há
// muitos serviços: nada é cortado nem a fonte encolhe de forma abusiva).
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
import { referenceEntries } from './references.mjs';

const W = 1080;
const H_MIN = 1350;
const PAD = 48;
const CASE_HEAD = 48;       // faixa azul do título "SEU CASO"
const METRIC_H = 82;        // faixa das métricas (áreas) no rodapé do bloco
const NARRATIVE_KEYS = new Set(['necessidade', 'situacao', 'finalidade']);
const METRIC_KEYS = new Set(['area_iptu', 'area_matricula', 'diferenca', 'area_nova', 'area_existente', 'area_total', 'area_projecao', 'area_atendida', 'area_terreno', 'area_escopo']);
// altura de um campo: rótulo + n linhas de valor + respiro (o valor nunca encosta na linha divisória)
const fieldHeight = (lines) => 31 + lines * 22 + 14;
const VERIFY_H = 226;       // código + QR
const TOTAL_TOP = 146;
const TOTAL_H = 130;
const SERVICES_TOP = 292;
const SERVICES_BAND = 40;
const SERVICE_ROW_BASE = 46;
const REF_LINE = 22;
const REF_FONT = 17;

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
  area_projecao: 'Área de projeção',
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
  'area_nova', 'area_existente', 'area_total', 'area_projecao', 'area_atendida', 'area_terreno', 'area_escopo',
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
    if (key === 'servicos') continue;   // já listados, com o valor de cada um, no módulo SERVIÇOS (e a lista longa seria cortada)
    const v = view.case_summary ? view.case_summary[key] : undefined;
    if (v === undefined || v === null || v === '') continue;
    caseRows.push({ key, label: CASE_LABELS[key] || key, value: Array.isArray(v) ? v.join(', ') : String(v) });
  }

  // Um serviço por linha: nome, preço DEMELLO do serviço (quando o registro o traz) e as referências DAQUELE serviço.
  // Nunca se compara o total do pacote com a referência de um único serviço.
  const services = calc.map((s) => ({
    name: friendlyServiceName(s),
    price: typeof s.total_demello === 'string' ? brlStr(s.total_demello) : null,
    references: referenceEntries(s.references).map(({ label, total }) => ({ label, total: brlStr(total) })),
  }));

  return {
    width: W,
    wordmark: 'DEMELLO ENGENHARIA',
    title: 'PRÉVIA INICIAL DEMELLO',
    case_rows: caseRows,
    forecast_label: 'ESTIMATIVA INICIAL DEMELLO',
    forecast_value: pricing.status === 'CALCULATED' && pricing.total_demello
      ? brlStr(pricing.total_demello)
      : 'Avaliação humana necessária',
    services_label: 'SERVIÇOS',
    services,
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

const FONT_FAMILY = "'Source Sans 3', system-ui, sans-serif";

function refsText(refs) {
  return refs.map((r) => `${r.label} ${r.total}`).join('   ·   ');
}

// Mede (sem desenhar) e devolve as posições verticais de cada módulo. Determinístico para o mesmo registro.
export function planLayout(ctx, L) {
  const innerW = W - PAD * 2;
  const priceReserve = 230;                      // coluna do preço à direita
  ctx.font = `400 ${REF_FONT}px ${FONT_FAMILY}`;
  const rows = L.services.map((svc) => {
    const refLines = svc.references.length ? wrap(ctx, refsText(svc.references), innerW - 48) : [];
    return { svc, refLines, height: SERVICE_ROW_BASE + refLines.length * REF_LINE + (refLines.length ? 16 : 8) };
  });
  const servicesTop = SERVICES_TOP;
  const servicesBottom = servicesTop + SERVICES_BAND + rows.reduce((acc, r) => acc + r.height, 0);
  const criterionY = servicesBottom + 16;
  const caseTop = criterionY + 44;
  // Bloco "SEU CASO": a altura vem do conteúdo medido (nada de altura fixa que faça o valor passar por cima da linha).
  const fieldLines = (row, width, size) => { ctx.font = `400 ${size}px ${FONT_FAMILY}`; return wrap(ctx, row.value, width - 44).slice(0, 2); };
  const caseNarrative = L.case_rows.filter((r) => NARRATIVE_KEYS.has(r.key)).map((row) => {
    const lines = fieldLines(row, innerW, 21);
    return { row, lines, height: fieldHeight(lines.length) };
  });
  const colW = innerW / 2;
  const ctxItems = L.case_rows.filter((r) => !NARRATIVE_KEYS.has(r.key) && !METRIC_KEYS.has(r.key))
    .map((row) => ({ row, lines: fieldLines(row, colW, 20) }));
  const caseContext = [];
  for (let i = 0; i < ctxItems.length; i += 2) {
    const pair = ctxItems.slice(i, i + 2);
    caseContext.push({ pair, height: Math.max(...pair.map((it) => fieldHeight(it.lines.length))) });
  }
  const caseMetrics = L.case_rows.filter((r) => METRIC_KEYS.has(r.key));
  const metricHeight = caseMetrics.length ? METRIC_H : 0;
  const caseHeight = CASE_HEAD + caseNarrative.reduce((a, r) => a + r.height, 0) + caseContext.reduce((a, r) => a + r.height, 0) + metricHeight;
  const caseBottom = caseTop + Math.max(caseHeight, CASE_HEAD + 60);
  ctx.font = `400 20px ${FONT_FAMILY}`;
  const disclaimerLines = L.disclaimers.map((d) => wrap(ctx, d, innerW - 48));
  const disclaimerHeight = Math.max(150, 20 + disclaimerLines.reduce((acc, ls) => acc + ls.length * 25 + 9, 0) + 12);
  const disclaimerTop = caseBottom + 20;
  const disclaimerBottom = disclaimerTop + disclaimerHeight;
  const verifyTopMin = disclaimerBottom + 20;
  const height = Math.max(H_MIN, verifyTopMin + VERIFY_H + 42);
  const verifyTop = height - 42 - VERIFY_H;      // ancorado ao rodapé; a folga fica entre as ressalvas e a verificação
  return { rows, servicesTop, servicesBottom, criterionY, caseTop, caseBottom, caseNarrative, caseContext, caseMetrics, metricHeight, disclaimerLines, disclaimerTop, disclaimerBottom,
    verifyTop, verifyBottom: verifyTop + VERIFY_H, height, priceReserve };
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
  canvas.height = H_MIN;
  const ctx = canvas.getContext('2d');
  const FONT = FONT_FAMILY;
  const MONO = "'JetBrains Mono', ui-monospace, monospace";
  const plan = planLayout(ctx, L);
  canvas.width = W;
  canvas.height = plan.height;       // redimensionar limpa o estado do canvas: tudo é desenhado depois do plano
  const H = plan.height;
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

  // estimativa total: primeiro bloco de conteúdo.
  ctx.fillStyle = ICE; ctx.fillRect(PAD, TOTAL_TOP, W - PAD * 2, TOTAL_H);
  ctx.fillStyle = BLUE; ctx.font = `700 22px ${FONT}`;
  ctx.fillText(L.forecast_label, PAD + 28, TOTAL_TOP + 22);
  ctx.fillStyle = NAVY; ctx.font = `800 62px ${FONT}`;
  ctx.fillText(L.forecast_value, PAD + 28, TOTAL_TOP + 54);

  // serviços: um por linha, com o preço DEMELLO do serviço e as referências DAQUELE serviço.
  const svTop = plan.servicesTop;
  ctx.strokeStyle = LINE; ctx.strokeRect(PAD, svTop, W - PAD * 2, plan.servicesBottom - svTop);
  ctx.fillStyle = BLUE; ctx.fillRect(PAD, svTop, W - PAD * 2, SERVICES_BAND);
  ctx.fillStyle = '#ffffff'; ctx.font = `700 21px ${FONT}`;
  ctx.fillText(L.services_label, PAD + 24, svTop + 10);
  let ry = svTop + SERVICES_BAND;
  plan.rows.forEach((row, index) => {
    if (index) { ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(PAD, ry); ctx.lineTo(W - PAD, ry); ctx.stroke(); }
    ctx.fillStyle = INK; ctx.font = `700 25px ${FONT}`;
    ctx.fillText(row.svc.name, PAD + 24, ry + 10);
    if (row.svc.price) {
      ctx.fillStyle = NAVY; ctx.font = `800 27px ${FONT}`;
      const pw = ctx.measureText(row.svc.price).width;
      ctx.fillText(row.svc.price, W - PAD - 24 - pw, ry + 9);
    }
    ctx.fillStyle = MUTED; ctx.font = `400 ${REF_FONT}px ${FONT}`;
    row.refLines.forEach((line, i) => ctx.fillText(line, PAD + 24, ry + SERVICE_ROW_BASE - 2 + i * REF_LINE));
    ry += row.height;
  });
  ctx.fillStyle = MUTED; ctx.font = `400 17px ${FONT}`;
  ctx.fillText(L.criterion, PAD, plan.criterionY);

  // caso: narrativa em largura total, contexto em duas colunas e medidas em células.
  const caseTop = plan.caseTop;
  const caseBottom = plan.caseBottom;
  ctx.strokeStyle = LINE; ctx.strokeRect(PAD, caseTop, W - PAD * 2, caseBottom - caseTop);
  ctx.fillStyle = BLUE; ctx.fillRect(PAD, caseTop, W - PAD * 2, 48);
  // glifo "pessoa" (cabeça + ombros) à esquerda do título
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.fillStyle = 'transparent';
  ctx.beginPath(); ctx.arc(PAD + 27, caseTop + 20, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(PAD + 27, caseTop + 40, 11, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = '#ffffff'; ctx.font = `700 23px ${FONT}`;
  ctx.fillText('SEU CASO', PAD + 48, caseTop + 12);

  const bodyTop = caseTop + CASE_HEAD;
  let cy = bodyTop;

  const drawField = (item, x, top, width, height, valueSize = 21) => {
    ctx.fillStyle = BLUE; ctx.font = `700 15px ${FONT}`;
    ctx.fillText(item.row.label.toUpperCase(), x + 22, top + 10);
    ctx.fillStyle = INK; ctx.font = `400 ${valueSize}px ${FONT}`;
    item.lines.forEach((line, i) => ctx.fillText(line, x + 22, top + 31 + i * 22));
    ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(x, top + height); ctx.lineTo(x + width, top + height); ctx.stroke();
  };

  for (const item of plan.caseNarrative) {
    drawField(item, PAD, cy, W - PAD * 2, item.height, 21);
    cy += item.height;
  }
  const colWidth = (W - PAD * 2) / 2;
  for (const line of plan.caseContext) {
    // campo sozinho na linha ocupa a largura toda (a divisória não pode parar na metade)
    const fieldW = line.pair.length === 1 ? W - PAD * 2 : colWidth;
    line.pair.forEach((item, col) => drawField(item, PAD + col * colWidth, cy, fieldW, line.height, 20));
    if (line.pair.length > 1) {
      ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(PAD + colWidth, cy); ctx.lineTo(PAD + colWidth, cy + line.height); ctx.stroke();
    }
    cy += line.height;
  }

  const metrics = plan.caseMetrics;
  const metricHeight = plan.metricHeight;
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
  const disclaimerTop = plan.disclaimerTop;
  const disclaimerBottom = plan.disclaimerBottom;
  ctx.fillStyle = ICE; ctx.fillRect(PAD, disclaimerTop, W - PAD * 2, disclaimerBottom - disclaimerTop);
  ctx.strokeStyle = LINE; ctx.strokeRect(PAD, disclaimerTop, W - PAD * 2, disclaimerBottom - disclaimerTop);
  let dy = disclaimerTop + 20;
  ctx.fillStyle = INK; ctx.font = `400 20px ${FONT}`;
  for (const lines of plan.disclaimerLines) {
    for (const ln of lines) { ctx.fillText(ln, PAD + 24, dy); dy += 25; }
    dy += 9;
  }

  // Verificação: código, emissão, URL e QR real em um único módulo.
  const verifyTop = plan.verifyTop;
  const verifyBottom = plan.verifyBottom;
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
