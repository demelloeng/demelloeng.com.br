// Pre-publish gate for the /orcamento build (E8).
//
//   pnpm publish-guard        # from orcamento-src/
//
// Exits non-zero (blocks publish) when the capture endpoint is not really
// configured: a REPLACE-SUBDOMAIN placeholder still in .env.production or baked
// into the built bundle, an empty endpoint, or a non-https URL. E8 MUST run this
// and see exit 0 before deploying orcamento/ to production.
//
// This does not change any behavior - it only makes a silent publish of the
// placeholder impossible.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLACEHOLDER = 'REPLACE-SUBDOMAIN';
const appRoot = path.dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '');

export function check(endpoint, bundleText) {
  const problems = [];
  if (!endpoint) {
    problems.push('VITE_INTAKE_ENDPOINT is empty');
  } else {
    if (endpoint.includes(PLACEHOLDER)) {
      problems.push(`VITE_INTAKE_ENDPOINT still has the ${PLACEHOLDER} placeholder`);
    }
    if (!/^https:\/\//.test(endpoint)) {
      problems.push('VITE_INTAKE_ENDPOINT is not https');
    }
  }
  if (bundleText && bundleText.includes(PLACEHOLDER)) {
    problems.push(`${PLACEHOLDER} is baked into the built bundle`);
  }
  return problems;
}

async function main() {
  const envText = await readFile(path.join(appRoot, '.env.production'), 'utf8').catch(() => '');
  const m = envText.match(/^\s*VITE_INTAKE_ENDPOINT\s*=\s*(.+?)\s*$/m);
  const endpoint = m ? m[1].trim() : '';

  let bundleText = '';
  try {
    const dir = path.join(appRoot, '..', 'orcamento', 'assets');
    for (const f of (await readdir(dir)).filter((n) => /^index-.*\.js$/.test(n))) {
      bundleText += await readFile(path.join(dir, f), 'utf8');
    }
  } catch {
    /* no build yet - endpoint check still applies */
  }

  const problems = check(endpoint, bundleText);
  if (problems.length) {
    console.error('PUBLISH BLOCKED:\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }
  console.log('publish-guard: OK (endpoint configured, no placeholder in build)');
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('publish-guard.mjs')) {
  main();
}
