"""Contratos locais: fonte versionada, fidelidade, navegação e CLI sem escrita."""
import hashlib
from html.parser import HTMLParser
import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / 'scripts/gerar-privacidade-v02.py'
COPY = ROOT / 'docs/arquivo/privacidade-v02-20261107/COPY_PRIVACIDADE_V04_20261107.md'


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.text = []
        self.hidden = False

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))
        if tag in ('script', 'style'):
            self.hidden = True

    def handle_data(self, data):
        if not self.hidden:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden = False
        if tag in ('p', 'h1', 'h2', 'li', 'nav', 'div', 'section', 'footer'):
            self.text.append(' ')


class PrivacyTests(unittest.TestCase):
    def module(self):
        self.assertTrue(SCRIPT.is_file(), 'Privacidade precisa de gerador próprio antes de ser entregue')
        spec = importlib.util.spec_from_file_location('privacidade', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def page(self):
        module = self.module()
        return module, module.montar(COPY.read_text(encoding='utf-8'))

    def test_source_is_rendered_in_full_without_javascript(self):
        module, page = self.page()
        parser = Page()
        parser.feed(page)
        visible = ' '.join(''.join(parser.text).split())
        for paragraph in re.split(r'\n\s*\n', COPY.read_text(encoding='utf-8').strip()):
            if paragraph.startswith(('TITULO SEO:', 'DESCRICAO SEO:')):
                continue
            text = re.sub(r'^##? ', '', paragraph)
            self.assertIn(' '.join(text.split()), visible)
        self.assertNotIn('<noscript>', page)
        self.assertEqual(page.count('mailto:marcos@demelloeng.com.br'), 2)
        self.assertIn(hashlib.sha256(COPY.read_bytes()).hexdigest(), page)
        self.assertEqual(page.encode('utf-8'), module.SAIDA.read_bytes())
        self.assertEqual(page, module.montar(COPY.read_text(encoding='utf-8')))

    def test_modified_source_is_rejected_without_rewriting_output(self):
        module = self.module()
        source = COPY.read_text(encoding='utf-8')
        before = module.SAIDA.read_bytes()
        for altered in [source + '\nTexto extra.\n', source.replace('## ', '# ', 1),
                        source.replace('Cloudflare', 'Outra empresa', 1)]:
            with self.subTest(altered=altered[-20:]), self.assertRaises(ValueError):
                module.montar(altered)
        self.assertEqual(before, module.SAIDA.read_bytes())

    def test_six_sections_named_and_all_links_and_assets_resolve_locally(self):
        _, page = self.page()
        parser = Page()
        parser.feed(page)
        ids = [attrs['id'] for _, attrs in parser.tags if 'id' in attrs]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(sum(tag == 'h1' for tag, _ in parser.tags), 1)
        self.assertEqual(sum(tag == 'h2' for tag, _ in parser.tags), 6)
        sections = [attrs for tag, attrs in parser.tags if tag == 'section']
        self.assertEqual(len(sections), 6)
        for section in sections:
            self.assertIn(section['aria-labelledby'], ids)
        for tag, attrs in parser.tags:
            for key in ('href', 'src'):
                target = attrs.get(key, '')
                url = urlsplit(target)
                if url.scheme or url.netloc:
                    continue
                if not url.path:
                    if url.fragment:
                        self.assertIn(url.fragment, ids)
                    continue
                path = ROOT / url.path.lstrip('/') if url.path.startswith('/') else ROOT / 'privacidade' / url.path
                if path.is_dir():
                    path /= 'index.html'
                self.assertTrue(path.is_file(), f'{tag}: destino local ausente {target}')
        self.assertNotIn('<form', page)
        self.assertIn('body class="servicos-v02 privacidade-v02"', page)
        self.assertIn('@media(max-width:760px)', page)

    def test_metadata_and_existing_scripts_preserved_and_no_new_executable_script(self):
        _, page = self.page()
        parser = Page()
        parser.feed(page)
        self.assertIn('<title>Privacidade | DEMELLO Engenharia</title>', page)
        self.assertIn('rel="canonical" href="https://demelloeng.com.br/privacidade/"', page)
        self.assertIn('property="og:url" content="https://demelloeng.com.br/privacidade/"', page)
        self.assertIn('property="og:image" content="https://demelloeng.com.br/assets/images/logo.png"', page)
        self.assertIn('"name":"Privacidade","item":"https://demelloeng.com.br/privacidade/"', page)
        scripts = [attrs for tag, attrs in parser.tags if tag == 'script']
        self.assertEqual([attrs.get('src') for attrs in scripts], [None, '../assets/js/nav.js',
                         '../assets/js/analytics-sink.js', '../assets/js/contato-flutuante.js', '../assets/js/meta-pixel.js',
                         '../assets/js/site-analytics.mjs'])
        self.assertEqual(scripts[0].get('type'), 'application/ld+json')
        self.assertIn('source-sans-3-latin-400-normal.woff2', page)
        self.assertIn('CNPJ 65.613.230/0001-71', page)
        self.assertNotIn('unpkg', page.lower())

    def _componentes_globais(self, page, base):
        # WhatsApp: exatamente um script, no caminho da página, depois do coletor e antes do pixel.
        fab = base + 'assets/js/contato-flutuante.js'
        self.assertEqual(page.count('contato-flutuante.js'), 1, 'WhatsApp ausente ou duplicado')
        self.assertEqual(page.count('<script src="' + fab + '" defer></script>'), 1, 'caminho do WhatsApp incorreto')
        self.assertLess(page.index('analytics-sink.js'), page.index('contato-flutuante.js'))
        self.assertLess(page.index('contato-flutuante.js'), page.index('meta-pixel.js'))
        self.assertTrue((ROOT / 'assets/js/contato-flutuante.js').is_file())
        # Badge oficial do Simple Analytics: uma vez, no rodape, com a imagem local, o link e o alt vigentes.
        badge = '<a class="sa-badge" href="https://www.simpleanalytics.com?utm_source=demelloeng.com.br&amp;utm_content=badge" referrerpolicy="origin" target="_blank"><img src="/assets/images/simple-analytics-badge.svg" width="126" height="30" alt="Simple Analytics" loading="lazy"></a>'
        self.assertEqual(page.count('simple-analytics-badge.svg'), 1, 'badge ausente ou duplicada')
        self.assertEqual(page.count(badge), 1, 'marcacao da badge divergente')
        self.assertLess(page.index('<footer'), page.index(badge))
        self.assertLess(page.index(badge), page.index('</footer>'))
        self.assertTrue((ROOT / 'assets/images/simple-analytics-badge.svg').is_file())

    def test_componentes_globais_v04_whatsapp_e_badge_uma_unica_vez(self):
        _, page = self.page()
        self._componentes_globais(page, '../')

    def test_institutional_header_menu_and_footer_reused(self):
        _, page = self.page()
        precedent = (ROOT / 'metodologia/index.html').read_text(encoding='utf-8')
        for tag in ('header', 'footer'):
            pattern = rf'<{tag}\b.*?</{tag}>'
            expected = re.search(pattern, precedent, re.S).group().replace(' aria-current="page"', '')
            actual = re.search(pattern, page, re.S).group()
            self.assertEqual(actual, expected)
        self.assertIn('class="skip" href="#conteudo"', page)

    def test_check_refuses_stale_missing_and_crlf_output_without_writing(self):
        module, page = self.page()
        source = COPY.read_text(encoding='utf-8')
        with tempfile.TemporaryDirectory(prefix='privacidade-test-', dir=ROOT.parent) as tmp:
            module.SAIDA = Path(tmp) / 'index.html'
            self.assertEqual(module.verificar_ou_gravar(source, check=True), 1)
            self.assertFalse(module.SAIDA.exists())
            for content in (b'stale\r\n', page.replace('\n', '\r\n').encode()):
                module.SAIDA.write_bytes(content)
                before = (content, module.SAIDA.stat().st_mtime_ns)
                self.assertEqual(module.verificar_ou_gravar(source, check=True), 1)
                self.assertEqual(before, (module.SAIDA.read_bytes(), module.SAIDA.stat().st_mtime_ns))
            self.assertEqual(module.verificar_ou_gravar(source), 0)
            self.assertEqual(module.SAIDA.read_bytes(), page.encode())
            self.assertEqual(module.verificar_ou_gravar(source, check=True), 0)

    def test_cli_check_never_writes_any_page(self):
        self.module()
        pages = list(ROOT.glob('**/*.html'))
        before = {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in pages}
        result = subprocess.run([sys.executable, '-B', str(SCRIPT), '--check'], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(before, {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in pages})


if __name__ == '__main__':
    unittest.main()
