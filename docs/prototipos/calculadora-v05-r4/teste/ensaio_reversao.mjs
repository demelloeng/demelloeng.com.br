// R07 — ensaio de REVERSÃO: o que cada combinação (site, Worker da prévia, página /verificar/) faz com os dois históricos.
// Base = o que está publicado hoje (site origin/main 598e8f0, engenharia origin/main ea26c6e, LOGICA_VERIFICAR_20261108);
// R4 = as worktrees atuais. Tudo em processo, sobre uma CÓPIA do SQLite de uma rodada do gate_b (registros R4 com e sem
// cupom); nada é implantado. Os registros de base são emitidos aqui pelo Worker de base com o site de base.
//
// Uso: node ensaio_reversao.mjs --db <run/.../comercial.sqlite> --out <pasta nova> [--eng <r4-eng>] [--site <r4-site>]
//      [--base-eng ea26c6e] [--base-site 598e8f0]
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const eng = path.resolve(arg('--eng', path.join(here, '..', '..', '..', '..', '..', 'r4-eng')));
const site = path.resolve(arg('--site', path.join(here, '..', '..', '..', '..')));
const baseEngRef = arg('--base-eng', 'ea26c6e'), baseSiteRef = arg('--base-site', '598e8f0');
const out = path.resolve(arg('--out', ''));
const srcDb = arg('--db', '');
if (!srcDb || !arg('--out', '')) { console.error('Informe --db e --out.'); process.exit(2); }
if (existsSync(out)) { console.error(`--out já existe: ${out}`); process.exit(2); }
mkdirSync(out, { recursive: true });

// --- versões de base extraídas do Git (sem checkout) ---------------------------------------------------------------------
const extract = (repo, ref, paths, dest) => {
  mkdirSync(dest, { recursive: true });
  const tar = path.join(out, `${path.basename(dest)}.tar`);
  execFileSync('git', ['-C', repo, 'archive', '--format=tar', '-o', tar, ref, ...paths]);
  execFileSync('tar', ['-xf', path.relative(dest, tar)], { cwd: dest });   // relativo: o tar do Git Bash lê "C:" como host
};
extract(eng, baseEngRef, ['integrations/cloudflare/preview-worker/src', 'schemas/crm/site-intake'], path.join(out, 'base-eng'));
extract(site, baseSiteRef, ['orcamento-src/src', 'verificar/index.html'], path.join(out, 'base-site'));
const rev = (repo, ref) => execFileSync('git', ['-C', repo, 'rev-parse', ref]).toString().trim();

const workerR4 = (await import(pathToFileURL(path.join(eng, 'integrations/cloudflare/preview-worker/src/index.mjs')).href)).default;
const workerBase = (await import(pathToFileURL(path.join(out, 'base-eng/integrations/cloudflare/preview-worker/src/index.mjs')).href)).default;
const logicOf = (html) => html.match(/<script>\n(\(function[\s\S]*?\n\}\)\(\);)\n<\/script>/)[1];
const verifyR4 = logicOf(readFileSync(path.join(site, 'verificar/index.html'), 'utf8'));
const verifyBase = logicOf(readFileSync(path.join(out, 'base-site/verificar/index.html'), 'utf8'));

// --- D1 sobre uma CÓPIA do SQLite da rodada ---------------------------------------------------------------------------------
const dbFile = path.join(out, 'ensaio.sqlite');
copyFileSync(srcDb, dbFile);
const db = new DatabaseSync(dbFile);
const DB = {
  prepare(sql) {
    const s = sql.replace(/\s+/g, ' ').trim(); let b = [];
    return { sql: s, bind(...a) { b = a; return this; }, _bound() { return b; },
      async run() { return { meta: { changes: Number(db.prepare(s).run(...b).changes) } }; },
      async first() { return db.prepare(s).get(...b) ?? null; },
      async all() { return { results: db.prepare(s).all(...b) }; } };
  },
  async batch(list) { db.exec('BEGIN'); try { for (const st of list) db.prepare(st.sql).run(...st._bound()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return list.map(() => ({ success: true })); },
};
const ORIGIN = 'http://127.0.0.1:8796';
const env = { DB, PREVIEW_ALLOWED_ORIGIN: ORIGIN, PREVIEW_MAX_BYTES: '65536' };
const API = 'http://127.0.0.1:8797/api/previews/v1';
const fetchVia = (worker) => (url, opts = {}) => worker.fetch(new Request(url, { ...opts, headers: { ...(opts.headers || {}), Origin: ORIGIN } }), env);

async function getRecord(worker, code) {
  const res = await fetchVia(worker)(`${API}/${code}`);
  let body = null; try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}
async function pageText(logic, worker, code) {
  const o = { innerHTML: '' };
  vm.runInNewContext(logic, { document: { getElementById: () => o }, location: { search: `?codigo=${code}` }, URLSearchParams, encodeURIComponent,
    fetch: (url) => fetchVia(worker)(url) });
  for (let i = 0; i < 50 && !/R\$|não|inválid|indispon/i.test(o.innerHTML); i += 1) await new Promise((r) => setTimeout(r, 20));
  return o.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
const shown = (t) => { const m = t.match(/Previsão DEMELLO( com cupom)?\s+(R\$\s[\d.,]+)/); return m ? `${m[2]}${m[1] ? ' (com cupom)' : ''}` : (t.slice(0, 80) || '(vazio)'); };

// --- registros R4 da rodada (com e sem cupom) ---------------------------------------------------------------------------------
const rows = db.prepare('SELECT verification_code, canonical_json FROM preview_records ORDER BY issued_at').all();
const r4Coupon = rows.find((r) => /"commercial"/.test(r.canonical_json) && /"final_total":"11258.78"/.test(r.canonical_json));
const r4Plain = rows.find((r) => !/"commercial"/.test(r.canonical_json) && /"total_demello":"12509.76"/.test(r.canonical_json));

// --- registro de BASE: site de base + Worker de base ---------------------------------------------------------------------------
const baseSrc = path.join(out, 'base-site/orcamento-src/src');
const loadBase = (m) => import(pathToFileURL(path.join(baseSrc, m)).href);
const { packageForCRMv2: basePayload } = await loadBase('payload_v2.mjs');
const { issuePreview: baseIssue, caseSummaryFromRows: baseCs } = await loadBase('preview.mjs');
const LOC = { city: 'Curitiba', uf: 'PR', ibge_id: '4106902' };
const sobrado = { route: 'build', CA1: 'Construir do zero', CA_AREA: { value: '320' }, property: 'Casa/sobrado', location: LOC, phase: 'Só uma ideia / estudo',
  CA5: { value: '2' }, CA6: 'Alto', services: ['Estrutural', 'Hidrossanitário', 'Elétrica'], area_fundacao: { value: '160' }, deadline: 'Ainda sem prazo' };
const bp = basePayload(sobrado);
const bcs = baseCs(bp.summary, []);
const baseOnBase = await baseIssue(bp.pricing_inputs, bcs, { endpoint: API, fetchImpl: fetchVia(workerBase), presented: bp.pricing_preview });
const baseOnR4 = await baseIssue(bp.pricing_inputs, bcs, { endpoint: API, fetchImpl: fetchVia(workerR4), presented: bp.pricing_preview });
const baseCode = baseOnBase.ok ? baseOnBase.record.verification_code : null;

// --- matriz ---------------------------------------------------------------------------------------------------------------------
const casos = [['registro R4 com cupom (R$ 11.258,78)', r4Coupon && r4Coupon.verification_code],
  ['registro R4 sem cupom (R$ 12.509,76)', r4Plain && r4Plain.verification_code],
  [`registro de base (site ${baseSiteRef} + Worker ${baseEngRef})`, baseCode]];
const combos = [['Worker R4 + verificar R4', workerR4, verifyR4], ['Worker R4 + verificar base', workerR4, verifyBase],
  ['Worker base + verificar R4', workerBase, verifyR4], ['Worker base + verificar base', workerBase, verifyBase]];
const matriz = [];
for (const [rotulo, code] of casos) {
  if (!code) { matriz.push({ registro: rotulo, erro: 'registro não encontrado na rodada' }); continue; }
  const linha = { registro: rotulo };
  for (const [nome, w, logic] of combos) {
    const g = await getRecord(w, code);
    linha[nome] = { status: g.status, integridade: g.body && g.body.integrity && g.body.integrity.status,
      commercial_na_resposta: !!(g.body && g.body.preview && g.body.preview.commercial), pagina: shown(await pageText(logic, w, code)) };
  }
  matriz.push(linha);
}
const emissao = {
  'site base -> Worker base': { ok: baseOnBase.ok, status: baseOnBase.status, error: baseOnBase.error || null,
    total: baseOnBase.ok ? baseOnBase.record.preview.pricing.total_demello : null },
  'site base -> Worker R4': { ok: baseOnR4.ok, status: baseOnR4.status, error: baseOnR4.error || null, outdated: !!baseOnR4.outdated },
};
const resultado = { revisoes: { eng_base: rev(eng, baseEngRef), site_base: rev(site, baseSiteRef), eng_r4: rev(eng, 'HEAD'), site_r4: rev(site, 'HEAD') },
  emissao, matriz };
writeFileSync(path.join(out, 'reversao.json'), JSON.stringify(resultado, null, 2));
console.log(JSON.stringify(resultado, null, 2));
