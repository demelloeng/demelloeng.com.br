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

async function main() {
  const envText = await readFile(path.join(appRoot, '.env.production'), 'utf8').catch(() => '');
  const intake = readEnv(envText, 'VITE_INTAKE_ENDPOINT');
  const preview = readEnv(envText, 'VITE_PREVIEW_ENDPOINT');

  let bundleText = '';
  try {
    const dir = path.join(appRoot, '..', 'orcamento', 'assets');
    for (const f of (await readdir(dir)).filter((n) => /^index-.*\.js$/.test(n))) {
      bundleText += await readFile(path.join(dir, f), 'utf8');
    }
  } catch {
    /* no build yet - endpoint check still applies */
  }

  const problems = [
    ...checkEndpoint('VITE_INTAKE_ENDPOINT', intake, bundleText),
    ...checkEndpoint('VITE_PREVIEW_ENDPOINT', preview, bundleText),
  ];
  if (problems.length) {
    console.error('PUBLISH BLOCKED:\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }
  console.log('publish-guard: OK (intake + preview endpoints configured, no placeholder in build)');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('publish-guard.mjs')) {
  main();
}
