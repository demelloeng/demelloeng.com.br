// Pre-publish gate for the /orcamento build (E8).
//
//   pnpm publish-guard        # from orcamento-src/
//
// Exits non-zero (blocks publish) when a public endpoint is not really
// configured: a REPLACE-SUBDOMAIN placeholder still in .env.production or baked
// into the built bundle, an empty endpoint, or a non-https URL. E8 MUST run this
// and see exit 0 before deploying orcamento/ to production.
//
// Two endpoints are guarded:
//   VITE_INTAKE_ENDPOINT   - CAPTURE-FIRST (site-intake Worker)
//   VITE_PREVIEW_ENDPOINT  - PRÉVIA DEMELLO VERIFICÁVEL V1 (ma-demello-preview Worker)
//
// This does not change any behavior - it only makes a silent publish of a
// placeholder / missing endpoint impossible.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLACEHOLDER = 'REPLACE-SUBDOMAIN';
const appRoot = path.dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '');

function checkEndpoint(name, endpoint, bundleText, { requireInBundle = false } = {}) {
  const problems = [];
  if (!endpoint) {
    problems.push(`${name} is empty`);
  } else {
    if (endpoint.includes(PLACEHOLDER)) {
      problems.push(`${name} still has the ${PLACEHOLDER} placeholder`);
    }
    if (!/^https:\/\//.test(endpoint)) {
      problems.push(`${name} is not https`);
    }
    if (requireInBundle && bundleText && !bundleText.includes(endpoint)) {
      problems.push(`${name} is not baked into the built bundle`);
    }
  }
  if (bundleText && bundleText.includes(PLACEHOLDER)) {
    problems.push(`${PLACEHOLDER} is baked into the built bundle`);
  }
  return problems;
}

// Compat: assinatura histórica (site-intake). integration.test.mjs depende dela.
export function check(endpoint, bundleText) {
  return checkEndpoint('VITE_INTAKE_ENDPOINT', endpoint, bundleText);
}

export function checkPreview(endpoint, bundleText) {
  return checkEndpoint('VITE_PREVIEW_ENDPOINT', endpoint, bundleText);
}

function readEnv(text, key) {
  const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm'));
  return m ? m[1].trim() : '';
}

// R07: endereço de verificação de produção (o mesmo padrão de preview.mjs/VERIFY_BASE).
export const PRODUCTION_VERIFY_BASE = 'https://demelloeng.com.br/verificar/';
// R07: nada do perfil de teste pode chegar ao pacote publicado. `http://` só é aceito nos namespaces XML/SVG do W3C
// (React e three os trazem); qualquer outro endereço sem TLS ou deste computador bloqueia a publicação.
const LOCAL_HOST_RE = /\b(?:127\.0\.0\.1|0\.0\.0\.0|localhost)\b/;
const PLAIN_HTTP_RE = /http:\/\/(?!www\.w3\.org\/)[a-z0-9.-]+/gi;

export function bundleProblems(bundleText, { intake, preview, verifyBase = PRODUCTION_VERIFY_BASE } = {}) {
  const problems = [];
  if (!bundleText) return ['no built bundle found (orcamento/assets/*.js)'];
  const local = bundleText.match(LOCAL_HOST_RE);
  if (local) problems.push(`local address baked into the bundle: ${local[0]}`);
  const plain = [...new Set(bundleText.match(PLAIN_HTTP_RE) || [])];
  if (plain.length) problems.push(`non-https address baked into the bundle: ${plain.join(', ')}`);
  for (const [name, value] of [['VITE_INTAKE_ENDPOINT', intake], ['VITE_PREVIEW_ENDPOINT', preview], ['VERIFY_BASE', verifyBase]]) {
    if (value && !bundleText.includes(value)) problems.push(`${name} (${value}) is not baked into the built bundle`);
  }
  return problems;
}

export async function readBundle(dir) {
  let bundleText = '';
  try {
    for (const f of (await readdir(dir)).filter((n) => /\.js$/.test(n)).sort()) {
      bundleText += await readFile(path.join(dir, f), 'utf8');
    }
  } catch {
    /* no build yet */
  }
  return bundleText;
}

export async function guard({ envText, assetsDir }) {
  const intake = readEnv(envText, 'VITE_INTAKE_ENDPOINT');
  const preview = readEnv(envText, 'VITE_PREVIEW_ENDPOINT');
  const verify = readEnv(envText, 'VITE_VERIFY_BASE');
  const bundleText = await readBundle(assetsDir);
  const problems = [
    ...checkEndpoint('VITE_INTAKE_ENDPOINT', intake, bundleText),
    ...checkEndpoint('VITE_PREVIEW_ENDPOINT', preview, bundleText),
  ];
  // Produção não redefine o destino do QR: se alguém o definir, só o domínio do site é aceito.
  if (verify && verify !== PRODUCTION_VERIFY_BASE) problems.push(`VITE_VERIFY_BASE must be ${PRODUCTION_VERIFY_BASE} in production (got ${verify})`);
  problems.push(...bundleProblems(bundleText, { intake, preview, verifyBase: verify || PRODUCTION_VERIFY_BASE }));
  return problems;
}

async function main() {
  // --dir <pasta compilada> confere outra compilação (padrão: ../orcamento, a publicada pela allowlist do Pages).
  const i = process.argv.indexOf('--dir');
  const outDir = i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : path.join(appRoot, '..', 'orcamento');
  const envText = await readFile(path.join(appRoot, '.env.production'), 'utf8').catch(() => '');
  const problems = await guard({ envText, assetsDir: path.join(outDir, 'assets') });
  if (problems.length) {
    console.error('PUBLISH BLOCKED:\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }
  console.log('publish-guard: OK (production endpoints baked in; no placeholder, local or plain-http address in the build)');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('publish-guard.mjs')) {
  main();
}
