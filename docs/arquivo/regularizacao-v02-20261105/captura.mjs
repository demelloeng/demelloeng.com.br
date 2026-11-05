// Capturas e medições da Regularização V02 com Chrome real (CDP). Uso: node captura.mjs <saida> <url>
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [saida, url] = process.argv.slice(2);
mkdirSync(saida, { recursive: true });
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const porta = 9333;
const perfil = mkdtempSync(join(tmpdir(), 'cdp-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let alvo;
for (let i = 0; i < 50; i++) {
  try { const lista = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json(); alvo = lista.find((t) => t.type === 'page'); if (alvo) break; } catch {}
  await espera(200);
}
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const eventos = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method) eventos.push(d); };
const cdp = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pend.set(n, (d) => (d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const avalia = async (expressao) => (await cdp('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true })).result.value;
for (const d of ['Page', 'Runtime', 'Log', 'Network']) await cdp(`${d}.enable`);

const telas = [{ nome: '1440x900', w: 1440, h: 900, mobile: false }, { nome: '390x844', w: 390, h: 844, mobile: true }];
const relatorio = {};
for (const t of telas) {
  eventos.length = 0;
  await cdp('Emulation.setDeviceMetricsOverride', { width: t.w, height: t.h, deviceScaleFactor: 1, mobile: t.mobile });
  await cdp('Page.navigate', { url });
  await espera(2500);
  const consolas = eventos.filter((e) => (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(e.params.type)) || e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level)))
    .map((e) => e.method === 'Log.entryAdded' ? `${e.params.entry.level}: ${e.params.entry.text} ${e.params.entry.url ?? ''}` : JSON.stringify(e.params).slice(0, 300));
  const respostas = eventos.filter((e) => e.method === 'Network.responseReceived').map((e) => ({ url: e.params.response.url, status: e.params.response.status }));
  const falhas = eventos.filter((e) => e.method === 'Network.loadingFailed').map((e) => e.params.errorText);
  const hosts = [...new Set(respostas.map((r) => new URL(r.url).host))];
  const medidas = await avalia(`(() => { const d = document.documentElement; const main = document.querySelector('main');
    const links = [...main.querySelectorAll('a[href]')].map((a) => a.href);
    const peq = [...main.querySelectorAll('p,li,em,summary,span,h3')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 15 && e.textContent.trim()).length;
    return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, overflowHorizontal: d.scrollWidth > d.clientWidth, h1: document.querySelectorAll('h1').length, h2: document.querySelectorAll('main h2').length, h3: document.querySelectorAll('main h3').length,
      situacoes: document.querySelectorAll('.reg-situacoes li').length, contextos: document.querySelectorAll('.reg-grade article').length, etapas: document.querySelectorAll('.reg-etapas li').length, perguntas: document.querySelectorAll('details.rico-pergunta').length,
      detalhes: document.querySelectorAll('.detalhes details').length, ctas: [...document.querySelectorAll('a.cta')].map((a) => a.getAttribute('href')), links, textosMenoresQue15px: peq, altura: Math.max(d.scrollHeight, document.body.scrollHeight) }; })()`);
  const verif = await avalia(`Promise.all([...new Set(${JSON.stringify(medidas.links)})].map((u) => fetch(u, { method: 'GET' }).then((r) => [u, r.status]).catch(() => [u, 0])))`);
  await cdp('Page.bringToFront');
  const dobra = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(saida, `regularizacao-${t.nome}-primeira-dobra.png`), Buffer.from(dobra.data, 'base64'));
  const completa = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: t.w, height: medidas.altura, scale: 1 } });
  writeFileSync(join(saida, `regularizacao-${t.nome}-pagina-completa.png`), Buffer.from(completa.data, 'base64'));
  // FAQ e detalhes abertos
  await avalia(`document.querySelectorAll('main details').forEach((d) => d.open = true); true`);
  await espera(400);
  const alturaAberta = await avalia('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
  const aberta = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: t.w, height: alturaAberta, scale: 1 } });
  writeFileSync(join(saida, `regularizacao-${t.nome}-faq-e-detalhes-abertos.png`), Buffer.from(aberta.data, 'base64'));
  const { links, ...resto } = medidas;
  relatorio[t.nome] = { ...resto, linksVerificados: verif.length, linksComErro: verif.filter(([, s]) => s !== 200), consoleErrosEAvisos: consolas, respostasHttpComErro: respostas.filter((r) => r.status >= 400), falhasDeRede: falhas, hostsConsultados: hosts, alturaComDetalhesAbertos: alturaAberta };
}
writeFileSync(join(saida, 'verificacao-visual.json'), JSON.stringify(relatorio, null, 2) + '\n');
console.log(JSON.stringify(relatorio, null, 2));
ws.close(); proc.kill();
