import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITEMAP_NS = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}


def structured_data(path):
    return [
        json.loads(source)
        for source in re.findall(r'<script type="application/ld\+json">(.*?)</script>',
                                 path.read_text(encoding='utf-8'), re.S)
    ]


def text_of(fragment):
    text = ' '.join(html.unescape(re.sub('<[^>]*>', ' ', fragment)).split())
    return re.sub(r' ([,.;:!?])', r'\1', text)


class SeoContracts(unittest.TestCase):
    def test_sitemap_matches_git(self):
        subprocess.run([sys.executable, 'scripts/gerar-sitemap.py', '--check'],
                       cwd=ROOT, check=True)
        urls = ET.parse(ROOT / 'sitemap.xml').findall('s:url', SITEMAP_NS)
        self.assertEqual(len(urls), 20)
        self.assertIn('https://demelloeng.com.br/servicos/projeto-terraplanagem/',
                      [entry.findtext('s:loc', namespaces=SITEMAP_NS) for entry in urls])

    def test_person_and_organization_are_connected(self):
        person, = structured_data(ROOT / 'empresa/trajetoria-do-fundador.html')
        org = next(node for graph in structured_data(ROOT / 'index.html')
                   for node in graph['@graph'] if node['@type'] == 'ProfessionalService')
        self.assertEqual({'@id': person['@id']}, org['founder'])
        self.assertEqual({'@id': org['@id']}, person['worksFor'])
        self.assertEqual('CREA-PR 146906/D', person['hasCredential']['identifier'])
        self.assertEqual(9, len(set(person['knowsAbout'])))
        self.assertEqual(['https://www.linkedin.com/in/engmarcosmello'], person['sameAs'])
        self.assertEqual([('City', 'Curitiba'), ('State', 'Paraná'), ('Country', 'Brasil')],
                         [(item['@type'], item['name']) for item in org['areaServed']])

    def test_bridge_targets_only_the_canonical_service(self):
        new_slug = 'projeto-terraplanagem'
        old_slug = new_slug.replace('planagem', 'plenagem')
        bridge = (ROOT / 'servicos' / old_slug / 'index.html').read_text(encoding='utf-8')
        current = (ROOT / 'servicos' / new_slug / 'index.html').read_text(encoding='utf-8')
        target = f'../{new_slug}/'
        canonical = f'<link rel="canonical" href="https://demelloeng.com.br/servicos/{new_slug}/">'
        self.assertIn(canonical, bridge)
        self.assertIn(canonical, current)
        self.assertIn(f'<noscript><meta http-equiv="refresh" content="0; url={target}"></noscript>', bridge)
        self.assertIn(f'location.replace("{target}" + location.search + location.hash)', bridge)
        self.assertIn(f'<a href="{target}">', bridge)
        self.assertNotIn('noindex', bridge)

    def test_faq_schema_matches_public_questions_and_answers(self):
        local_slugs = {'projeto-prevencao-incendio', 'regularizacao'}
        count = 0
        for path in (ROOT / 'servicos').glob('*/index.html'):
            source = path.read_text(encoding='utf-8')
            if 'servico-pagina-v02' not in source:
                continue
            visible = [(text_of(q), text_of(a)) for q, a in
                       re.findall(r'<details class="rico-pergunta"[^>]*><summary>(.*?)</summary>(.*?)</details>',
                                  source, re.S)]
            count += 1
            with self.subTest(page=path.parent.name):
                nodes = [node for graph in structured_data(path) for node in graph['@graph']]
                faq, = [node for node in nodes if node['@type'] == 'FAQPage']
                service, = [node for node in nodes if node['@type'] == 'Service']
                self.assertEqual(visible, [(item['name'], item['acceptedAnswer']['text'])
                                           for item in faq['mainEntity']])
                actual_area = service['areaServed']
                if path.parent.name in local_slugs:
                    self.assertEqual(['Curitiba', 'Paraná', 'Brasil'], [item['name'] for item in actual_area])
                else:
                    self.assertEqual({'@type': 'Country', 'name': 'Brasil'}, actual_area)
        self.assertEqual(count, 9)

    def test_faq_schema_has_no_space_before_punctuation(self):
        for path in (ROOT / 'servicos').glob('*/index.html'):
            for node in (n for graph in structured_data(path) for n in graph.get('@graph', [])):
                if node.get('@type') != 'FAQPage':
                    continue
                for item in node['mainEntity']:
                    with self.subTest(page=path.parent.name, question=item['name']):
                        self.assertNotRegex(item['acceptedAnswer']['text'], r'\s[,.;:!?]')

    def test_structural_price_is_the_two_storey_case(self):
        prices = json.loads(subprocess.check_output(['node', 'scripts/precos-servicos.mjs'],
                                                   cwd=ROOT, encoding='utf-8'))
        structural = prices['projeto-estrutural']
        self.assertEqual('12.25', structural['valor'])
        self.assertEqual(structural['cenarios']['sobrado']['entrada'], structural['entrada'])
        self.assertNotIn('piso_motor', structural['cenarios'])

    def test_prices_come_from_the_current_engine_at_the_floor(self):
        prices = json.loads(subprocess.check_output(['node', 'scripts/precos-servicos.mjs'],
                                                   cwd=ROOT, encoding='utf-8'))
        self.assertEqual(len(prices), 9)
        for slug, data in prices.items():
            with self.subTest(page=slug):
                self.assertEqual('0.60', data['fator'])
                self.assertEqual('CASA', data['entrada']['typology'])
                path = ROOT / 'servicos' / slug / 'index.html'
                expected = f"A partir de R$ {data['valor'].replace('.', ',')} por m² de {data['base_m2']}."
                source = path.read_text(encoding='utf-8')
                self.assertIn(expected, source)
                self.assertNotIn('Não é proposta, contrato nem garantia de preço', source)
                faq = next(node for graph in structured_data(path) for node in graph['@graph']
                           if node['@type'] == 'FAQPage')
                self.assertTrue(any(expected in item['acceptedAnswer']['text'] for item in faq['mainEntity']))

    def test_service_generator_checks_the_pricing_source(self):
        subprocess.run([sys.executable, 'scripts/gerar-paginas-servico-v02.py', '--check'],
                       cwd=ROOT, check=True)

    def test_table_drift_requires_regeneration_even_without_a_price_change(self):
        with tempfile.TemporaryDirectory(prefix='seo-tabela-') as temp:
            root = Path(temp)
            path = 'orcamento-src/src/pricing'
            for folder in ('scripts', 'docs/arquivo/paginas-servico-v02', 'servicos', path):
                shutil.copytree(ROOT / folder, root / folder)
            command = [sys.executable, '-B', 'scripts/gerar-paginas-servico-v02.py']
            table = root / path / 'pricing-table.v2.json'
            data = json.loads(table.read_text(encoding='utf-8'))
            data['note'] += ' Mudança de teste sem impacto nos preços.'
            table.write_bytes(json.dumps(data, ensure_ascii=False).encode('utf-8'))
            drift = subprocess.run([*command, '--check'], cwd=root, capture_output=True)
            self.assertNotEqual(drift.returncode, 0)
            self.assertIn(b'desatualizado', drift.stderr)
            subprocess.run([*command, 'gerar', '--todas'], cwd=root, capture_output=True, check=True)
            subprocess.run([*command, '--check'], cwd=root, capture_output=True, check=True)

    def test_service_visual_uses_the_shared_layers_and_preserves_cta_target(self):
        for path in (ROOT / 'servicos').glob('*/index.html'):
            source = path.read_text(encoding='utf-8')
            if 'servico-pagina-v02' not in source:
                continue
            with self.subTest(service=path.parent.name):
                self.assertRegex(source, r'<body class="[^"]+ gvl">')
                self.assertIn('home-grafite-vidro-luz.css', source)
                self.assertIn('home-grafite-vidro-luz.js', source)
                self.assertIn('servicos-pagina-gvl.css', source)
                self.assertIn('class="gvl-aurora" aria-hidden="true"', source)
                hero = re.search(r'class="cta" href="([^"]+)">([^<]+) →', source)
                final = re.search(r'<a class="cta gvl-neon" href="([^"]+)">'
                                  r'<span class="gvl-neon-t">([^<]+)</span>'
                                  r'<span class="gvl-neon-s">([^<]+)</span>', source)
                self.assertIsNotNone(final)
                self.assertEqual(hero.groups(), final.groups()[:2])
                self.assertNotIn('style=', final.group())

    def test_indexnow_runs_after_live_smoke_with_the_published_key(self):
        workflow = (ROOT / '.github/workflows/pages.yml').read_text(encoding='utf-8')
        job = re.search(r'\n  indexnow:\n(.*?)(?=\n  \S|\Z)', workflow, re.S)
        self.assertIsNotNone(job, 'pages.yml precisa do job indexnow')
        self.assertIn('needs: smoke-live', job.group(1))
        self.assertIn('fetch-depth: 0', job.group(1))
        key = re.search(r'indexnow\.py "\$\{\{ github\.event\.before \}\}" ([0-9a-f]{32})',
                        job.group(1)).group(1)
        self.assertEqual((ROOT / f'{key}.txt').read_text(encoding='utf-8').strip(), key)
        self.assertIn(f'{key}.txt', (ROOT / '.github/pages/allowlist.txt').read_text(encoding='utf-8'))

    def test_indexnow_sends_only_changed_urls(self):
        sys.path.insert(0, str(ROOT / '.github/pages'))
        try:
            import indexnow
        finally:
            sys.path.pop(0)
        base = 'https://demelloeng.com.br/'
        data = indexnow.payload({base: '2026-11-27', base + 'a/': '2026-11-01', base + 'b/': '2026-11-27'},
                                {base: '2026-11-20', base + 'a/': '2026-11-01'}, 'k')
        self.assertEqual(data['urlList'], [base, base + 'b/'])
        self.assertEqual(data['keyLocation'], 'https://demelloeng.com.br/k.txt')
        self.assertEqual(indexnow.previous_dates(''), {})
