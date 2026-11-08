// Contrato funcional de /verificar/: executa a lógica da página num sandbox, com fetch SIMULADO.
// Nenhuma chamada de rede real: o Worker nunca é contatado; cada cenário devolve uma resposta fabricada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENDPOINT = 'https://ma-demello-preview.ma-demello.workers.dev/api/previews/v1/';
const CODE = 'k3m7q4r2t5w6x4z6'; // alfabeto aceito pela página: a-z e 2-7 (base32)

const html = await readFile(path.join(siteRoot, 'verificar', 'index.html'), 'utf8');
const logic = html.match(/<script>\n(\(function[\s\S]*?\n\}\)\(\);)\n<\/script>/)[1];

const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

async function run(search, fetchImpl) {
  const out = { innerHTML: 'inicial' };
  const calls = [];
  const sandbox = {
    document: { getElementById: (id) => (id === 'vf-out' ? out : null) },
    location: { search },
    URLSearchParams,
    encodeURIComponent,
    fetch: (url, options) => { calls.push({ url, options }); return fetchImpl(url, options); },
  };
  vm.runInNewContext(logic, sandbox);
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { out: out.innerHTML, calls };
}

const record = (over = {}) => ({
  schema: 'PUBLIC_PREVIEW_V1',
  integrity: { status: 'VERIFIED' },
  verification_code: CODE,
  issued_at: '2026-11-07T12:34:56Z',
  status: 'ISSUED',
  preview: {
    methodology: { table_version: 'DEMELLO_V2' },
    pricing: {
      status: 'CALCULATED',
      total_demello: '12345.5',
      services: [
        { status: 'CALCULATED', service: 'Projeto <b>x</b>', references: { secid_pr: { total: '1000' }, mercado: { total: '2000.5' } }, total_demello: '800' },
        { status: 'CALCULATED', service: 'ELETRICA', references: { secid_pr: { total: '3707.50' }, fundepar: { total: '1560.00' }, altoqi: { total: '2150.00' } }, total_demello: '1248.00' },
      ],
    },
    case_summary: { necessidade: 'Casa <script>alert(1)</script>', servicos: ['Estrutural', 'Hidro'], area_total: '120 m²' },
    disclaimers: ['Aviso <i>importante</i>'],
  },
  ...over,
});

test('verificar: código ausente ou inválido nunca chama o Worker', async () => {
  for (const search of ['', '?codigo=', '?codigo=ABC123', '?codigo=abc12', '?codigo=<x>', '?codigo=abc!def9', '?codigo=a1b2c3', '?outro=k3m7q9r2t5w8x4z6']) {
    const { out, calls } = await run(search, () => { throw new Error('fetch não deveria ser chamado'); });
    assert.equal(calls.length, 0, search);
    assert.match(out, /Código ausente ou inválido/, search);
    assert.match(out, /class="vf-status bad"/);
  }
});

test('verificar: código válido consulta exatamente o endpoint vigente, uma vez, pedindo JSON', async () => {
  const { calls } = await run(`?codigo=${CODE}`, async () => response(404, {}));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENDPOINT + CODE);
  assert.equal(JSON.stringify(calls[0].options), '{"headers":{"Accept":"application/json"}}');
});

test('verificar: estados de erro mantêm título e mensagem vigentes', async () => {
  const casos = [
    [async () => response(404, {}), /Código não encontrado[\s\S]*Nenhuma prévia DEMELLO corresponde a este código\./],
    [async () => response(409, {}), /Integridade não confere[\s\S]*Não confie nesta prévia\./],
    [async () => response(500, {}), /Serviço temporariamente indisponível[\s\S]*Não foi possível verificar a prévia agora\./],
    [async () => { throw new Error('rede bloqueada'); }, /Serviço temporariamente indisponível[\s\S]*Não foi possível contatar o serviço de verificação\./],
    [async () => response(200, record({ schema: 'OUTRO' })), /Registro inválido/],
    [async () => response(200, record({ integrity: { status: 'FAILED' } })), /Registro inválido/],
    [async () => response(200, record({ integrity: undefined })), /Registro inválido/],
    [async () => response(200, record({ preview: undefined })), /Registro inválido/],
  ];
  for (const [impl, re] of casos) {
    const { out } = await run(`?codigo=${CODE}`, impl);
    assert.match(out, re);
    assert.match(out, /class="vf-status bad"/);
    assert.doesNotMatch(out, /Prévia DEMELLO verificada/);
  }
});

test('verificar: resposta verificada mostra só dados públicos e escapa todo conteúdo', async () => {
  const { out } = await run(`?codigo=${CODE}`, async () => response(200, record()));
  assert.match(out, /class="vf-status ok"[\s\S]*Prévia DEMELLO verificada/);
  assert.match(out, /Este registro foi emitido pela DEMELLO Engenharia e não foi alterado desde a emissão\./);
  assert.match(out, new RegExp(`<dd class="vf-code">${CODE}</dd>`));
  assert.match(out, /<dd>07\/11\/2026 12:34 UTC<\/dd>/);
  assert.match(out, /<dd>Emitida<\/dd>/);
  assert.doesNotMatch(out, /ISSUED/, 'a situação aparece em português');
  assert.match(out, /<dd>Tabela DEMELLO V2<\/dd>/);
  assert.match(out, /<p class="vf-total">R\$ 12\.345,50<\/p>/);
  // um item por serviço: nome, preço DEMELLO do serviço e as referências DAQUELE serviço
  assert.match(out, /<span class="vf-svc-name">Projeto &lt;b&gt;x&lt;\/b&gt;<\/span><strong class="vf-svc-price">R\$ 800,00<\/strong>/);
  assert.match(out, /Referências públicas consultadas: SECID\/PR R\$ 1\.000,00 · AltoQi \+ SECID\/PR R\$ 2\.000,50/);
  assert.match(out, /<span class="vf-svc-name">Projeto Elétrico<\/span><strong class="vf-svc-price">R\$ 1\.248,00<\/strong>/);
  assert.match(out, /SECID\/PR R\$ 3\.707,50 · FUNDEPAR R\$ 1\.560,00 · AltoQi R\$ 2\.150,00/);
  assert.doesNotMatch(out, /ELETRICA|Referência de mercado/, 'sem código interno nem rótulo genérico');
  assert.match(out, /<dt>Serviços<\/dt><dd>Estrutural, Hidro<\/dd>/);
  assert.match(out, /<dt>Área total<\/dt><dd>120 m²<\/dd>/);
  assert.match(out, /Informações do caso \(fornecidas pelo usuário\)/);
  assert.match(out, /<div class="vf-note"><p>Aviso &lt;i&gt;importante&lt;\/i&gt;<\/p><\/div>/);
  // nada do conteúdo do registro vira HTML ativo
  assert.doesNotMatch(out, /<script|<b>|<i>|alert\(1\)<\/script>/);
  // nenhum dado interno: o contrato público não traz fator, fingerprint nem assinatura
  assert.doesNotMatch(out, /fator|fingerprint|signature|assinatura/i);
});

test('verificar: sem total calculado, a página pede avaliação humana e a versão da tabela é a gravada', async () => {
  const rec = record();
  rec.preview.pricing = { status: 'HELD' };
  rec.preview.methodology = { table_version: 'DEMELLO_V1' };
  const { out } = await run(`?codigo=${CODE}`, async () => response(200, rec));
  assert.match(out, /<p class="vf-total">Avaliação humana necessária<\/p>/);
  assert.match(out, /<dd>Tabela DEMELLO V1<\/dd>/);
  rec.preview.methodology = {};
  assert.match((await run(`?codigo=${CODE}`, async () => response(200, rec))).out, /<dd>Tabela DEMELLO<\/dd>/);
});

test('verificar: registro legado sem preço por serviço mostra o serviço e as referências, sem inventar valor', async () => {
  const rec = record();
  rec.preview.pricing.services = [{ status: 'CALCULATED', service: 'ESTRUTURAL', references: { secid_pr: { total: '1000' } } }];
  const { out } = await run(`?codigo=${CODE}`, async () => response(200, rec));
  assert.match(out, /<span class="vf-svc-name">Estrutural<\/span><\/div>/);
  assert.doesNotMatch(out, /vf-svc-price/);
  assert.match(out, /<p class="vf-total">R\$ 12\.345,50<\/p>/);
});
