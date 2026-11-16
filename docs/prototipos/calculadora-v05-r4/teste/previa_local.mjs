// R07 — serviço de PRÉVIA do perfil de teste LOCAL. Não fala com a nuvem e não grava nada em produção.
//
// Roda o MESMO código do Worker ma-demello-preview do repositório de engenharia (importado da worktree, sem cópia:
// integrations/cloudflare/preview-worker/src/index.mjs). No lugar do D1 há o SQLite em arquivo que o Portal usa em
// modo fake (<run_root>/fake_d1/comercial.sqlite), criado pelo MESMO schema.sql: o fator e os cupons que você altera
// no Portal local são os que esta prévia lê a cada emissão. Os códigos emitidos aqui só existem neste computador.
//
// Uso: node previa_local.mjs --db <arquivo.sqlite> [--eng <worktree r4-eng>] [--port 8797] [--origin http://127.0.0.1:8796]
// Só escuta em 127.0.0.1.
import http from 'node:http';
import path from 'node:path';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const eng = path.resolve(arg('--eng', path.join(here, '..', '..', '..', '..', '..', 'r4-eng')));
const dbFile = arg('--db', '');
const port = Number(arg('--port', '8797'));
const origin = arg('--origin', 'http://127.0.0.1:8796');
if (!dbFile) { console.error('Informe --db <arquivo.sqlite> (o mesmo do Portal em modo fake).'); process.exit(2); }

const workerDir = path.join(eng, 'integrations', 'cloudflare', 'preview-worker');
const { default: worker } = await import(pathToFileURL(path.join(workerDir, 'src', 'index.mjs')).href);

mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });
const db = new DatabaseSync(path.resolve(dbFile));
db.exec('PRAGMA busy_timeout = 5000');
db.exec(readFileSync(path.join(workerDir, 'schema.sql'), 'utf8'));   // idempotente: CREATE IF NOT EXISTS / INSERT OR IGNORE

// Adaptador D1 sobre node:sqlite: as mesmas operações dos testes do Worker (prepare/bind/run/first/all e batch atômico).
const DB = {
  prepare(sql) {
    const s = sql.replace(/\s+/g, ' ').trim();
    let bound = [];
    return {
      sql: s,
      bind(...args) { bound = args; return this; },
      _bound() { return bound; },
      async run() { const r = db.prepare(s).run(...bound); return { meta: { changes: Number(r.changes) } }; },
      async first() { return db.prepare(s).get(...bound) ?? null; },
      async all() { return { results: db.prepare(s).all(...bound) }; },
    };
  },
  async batch(list) {
    db.exec('BEGIN');
    try {
      for (const st of list) db.prepare(st.sql).run(...st._bound());
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return list.map(() => ({ success: true }));
  },
};
const env = { DB, PREVIEW_ALLOWED_ORIGIN: origin, PREVIEW_MAX_BYTES: '65536' };   // sem RATE_LIMITER (opcional no Worker)

http.createServer(async (req, res) => {
  try {
    const parts = [];
    for await (const p of req) parts.push(p);
    const body = Buffer.concat(parts);
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && body.length > 0;
    const request = new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers: req.headers, body: hasBody ? body : undefined });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    if (req.method !== 'OPTIONS') console.log(`previa: ${req.method} ${req.url.split('?')[0]} -> ${response.status}`);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'TESTE_LOCAL_FAILURE', detail: String(err && err.message) }));
  }
}).listen(port, '127.0.0.1', () => console.log(`Prévia local (Worker de ${eng}): http://127.0.0.1:${port}/api/previews/v1  origem aceita: ${origin}  banco: ${path.resolve(dbFile)}`));
