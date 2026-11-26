import html
import json
import re
import subprocess
import sys
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
    return ' '.join(html.unescape(re.sub('<[^>]*>', ' ', fragment)).split())


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
        self.assertIn(f'<meta http-equiv="refresh" content="0; url={target}">', bridge)
        self.assertIn(f'location.replace("{target}")', bridge)
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
