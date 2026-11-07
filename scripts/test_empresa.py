"""Contratos da Copy V01 aprovada da Empresa: fidelidade, links, SEO, medição e --check sem escrita."""
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
SCRIPT = ROOT / 'scripts/gerar-empresa-v02.py'
COPY = ROOT / 'docs/arquivo/empresa-v02-20261107/COPY_EMPRESA_V01_20261107.md'
# JSON-LD vigente antes da migração: precisa permanecer idêntico.
JSONLD = ('{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":['
          '{"@type":"ListItem","position":1,"name":"Início","item":"https://demelloeng.com.br/"},'
          '{"@type":"ListItem","position":2,"name":"Empresa","item":"https://demelloeng.com.br/empresa/"}]}]}')
DESCRIPTION = ('Conheça a DEMELLO Engenharia: projetos e serviços técnicos de engenharia civil, '
               'responsabilidade técnica, sede em Curitiba e atendimento em todo o Brasil.')
# Botões aprovados por bloco: (rótulo, destino relativo à página, principal?).
BOTOES = {
    'company-hero': [('Conhecer nossos serviços', '../servicos/', False), ('Calcular estimativa', '../orcamento/', True)],
    'founder': [('Conhecer a trajetória do fundador', '../empresa/trajetoria-do-fundador.html', False)],
    'final-cta': [('Calcular estimativa', '../orcamento/', True), ('Falar com a DEMELLO', '../contato/', False)],
}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.text = []
        self.hidden = False
        self.stack = []
        self.blocks = {}
        self.buttons = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if tag in ('script', 'style'):
            self.hidden = True
        if tag == 'section':
            self.stack.append(attrs.get('data-block'))
        if tag == 'a' and self.stack and 'acao' in attrs.get('class', '').split():
            self.buttons.setdefault(self.stack[-1], []).append([None, attrs['href'], 'acao-principal' in attrs['class'].split()])
            self.current = self.buttons[self.stack[-1]][-1]
        else:
            self.current = None if tag == 'a' else getattr(self, 'current', None)

    def handle_data(self, data):
        if not self.hidden:
            self.text.append(data)
            if getattr(self, 'current', None) is not None and self.current[0] is None:
                self.current[0] = data

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden = False
        if tag == 'section':
            self.stack.pop()
        if tag == 'a':
            self.current = None
        if tag in ('p', 'h1', 'h2', 'h3', 'li', 'dt', 'dd', 'nav', 'div', 'section', 'footer', 'span'):
            self.text.append(' ')


def flat(text):
    return ' '.join(text.split())


class EmpresaTests(unittest.TestCase):
    def module(self):
        self.assertTrue(SCRIPT.is_file(), 'a página institucional precisa de gerador próprio')
        spec = importlib.util.spec_from_file_location('empresa', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def page(self):
        module = self.module()
        page = module.montar(COPY.read_text(encoding='utf-8'))
        parser = Page()
        parser.feed(page)
        return module, page, parser

    def test_fonte_aprovada_integral_deterministica_e_html_fiel(self):
        module, page, parser = self.page()
        source = COPY.read_text(encoding='utf-8')
        visible = flat(''.join(parser.text))
        for part in re.split(r'\n\s*\n', source):
            if part.startswith(('TITULO SEO:', 'DESCRICAO SEO:', '## BLOCO', '**Destino:')) or part.strip() == '---':
                continue
            part = re.sub(r'^\*\*[^*]+:\*\*\s*', '', part)
            part = re.sub(r'^### ', '', part)
            for piece in part.split(' — ', 1) if re.match(r'^0\d — ', part) else [part]:
                self.assertIn(flat(piece), visible, piece)
        for label in module.IDENTITY:
            self.assertIn(label, visible)
        self.assertIn(hashlib.sha256(COPY.read_bytes()).hexdigest(), page)
        self.assertEqual(hashlib.sha256(COPY.read_bytes()).hexdigest(), module.COPY_SHA256)
        self.assertEqual(page, module.montar(COPY.read_text(encoding='utf-8')))
        self.assertEqual(page.encode('utf-8'), module.SAIDA.read_bytes(), 'HTML em LF e fiel à fonte')
        self.assertNotIn('\r', page)

    def test_correcao_gramatical_aprovada_e_remocoes_editoriais(self):
        _, page, parser = self.page()
        visible = flat(''.join(parser.text))
        self.assertIn('Essas experiências em diferentes setores contribuíram para uma maneira de trabalhar '
                      'orientada por planejamento, análise técnica e atenção à execução prática das decisões.', visible)
        self.assertNotIn('Experiências em diferentes setores que contribuíram', visible)
        for removed in ('010/2026', 'A DEMELLO é nova', 'Processo nº', 'autos abertos', 'situação regular', 'Missão'):
            self.assertNotIn(removed, visible)

    def test_alteracao_omissao_e_link_nao_aprovado_falham_fechado_sem_reescrever(self):
        module = self.module()
        source = COPY.read_text(encoding='utf-8')
        before = module.SAIDA.read_bytes()
        variants = [source + '\nTexto inventado.\n', source.replace('Menos promessa.', 'Mais promessa.'),
                    source.replace('/orcamento/', '/contato/', 1), source.replace('## BLOCO 06', '## BLOCO 07'),
                    source.replace('Calcular estimativa', 'Fazer orçamento', 1), source.replace('**CNPJ:**', '**Cnpj:**')]
        for altered in variants:
            with self.subTest(altered=altered[-24:]), self.assertRaises(ValueError):
                module.montar(altered)
        self.assertEqual(before, module.SAIDA.read_bytes())

    def test_estrutura_seis_blocos_botoes_aprovados_e_identidade(self):
        _, page, parser = self.page()
        ids = [attrs['id'] for _, attrs in parser.tags if 'id' in attrs]
        self.assertEqual(len(ids), len(set(ids)))
        tags = [tag for tag, _ in parser.tags]
        self.assertEqual((tags.count('h1'), tags.count('h2'), tags.count('h3')), (1, 5, 3))
        sections = [attrs for tag, attrs in parser.tags if tag == 'section']
        self.assertEqual([s['data-block'] for s in sections], ['company-hero', 'way-of-thinking', 'commitments',
                         'institutional-identity', 'founder', 'final-cta'])
        for section in sections:
            self.assertIn(section['aria-labelledby'], ids)
        self.assertEqual(parser.buttons, {k: [list(b) for b in v] for k, v in BOTOES.items()})
        # Uma só rota para a trajetória do fundador dentro de main.
        main = re.search(r'<main.*?</main>', page, re.S).group()
        self.assertEqual(main.count('trajetoria-do-fundador.html'), 1)
        self.assertEqual((tags.count('dl'), tags.count('dt'), tags.count('dd'), tags.count('ol')), (1, 9, 9, 1))
        for needle in ('Marcos de Mello Silva Engenharia LTDA', '65.613.230/0001-71', 'CREA-PR PJ nº 92585', 'CREA-PR nº 146906/D'):
            self.assertIn(needle, main)
        # Medição de contato fica no menu e no rodapé: o corpo não traz wa.me, tel: nem mailto:.
        for scheme in ('wa.me', 'tel:', 'mailto:'):
            self.assertNotIn(scheme, main)
        self.assertNotIn('<form', page)
        # Logo oficial colorida: uma só vez, no Bloco 04, sobre fundo claro; a branca fica no cabeçalho e no rodapé.
        images = re.findall(r'<img\b[^>]*>', main)
        self.assertEqual(len(images), 1)
        self.assertIn('src="../assets/images/logo.png"', images[0])
        self.assertIn('alt="Logo da DEMELLO Engenharia"', images[0])
        identity = re.search(r'<section class="identidade".*?</section>', main, re.S).group()
        self.assertIn(images[0], identity)
        self.assertEqual(page.count('assets/images/logo.png"'), 2, 'logo.png: og:image e o corpo')
        self.assertEqual(page.count('assets/images/logo-branca.png'), 2, 'logo branca: cabeçalho e rodapé')
        self.assertNotIn('logo-oficial', page)
        self.assertIn('.identidade{background:var(--pale)', page)

    def test_links_e_recursos_locais_resolvem_e_sem_overflow_declarado(self):
        _, page, parser = self.page()
        ids = [attrs['id'] for _, attrs in parser.tags if 'id' in attrs]
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
                path = ROOT / 'empresa' / url.path
                if path.is_dir():
                    path /= 'index.html'
                self.assertTrue(path.is_file(), f'{tag}: destino local ausente {target}')
        self.assertIn('body class="servicos-v02 empresa-v02"', page)
        self.assertIn('@media(max-width:760px)', page)
        self.assertIn('overflow-wrap:break-word', page)

    def test_metadados_seo_e_scripts_de_medicao_preservados(self):
        _, page, parser = self.page()
        self.assertIn('<title>Empresa | DEMELLO Engenharia</title>', page)
        self.assertIn(f'<meta name="description" content="{DESCRIPTION}">', page)
        self.assertIn(f'property="og:description" content="{DESCRIPTION}"', page)
        self.assertIn('rel="canonical" href="https://demelloeng.com.br/empresa/"', page)
        self.assertEqual(page.count('property="og:url" content="https://demelloeng.com.br/empresa/"'), 1)
        self.assertIn('property="og:image" content="https://demelloeng.com.br/assets/images/logo.png"', page)
        self.assertIn(f'<script type="application/ld+json">{JSONLD}</script>', page)
        scripts = [attrs for tag, attrs in parser.tags if tag == 'script']
        self.assertEqual([attrs.get('src') for attrs in scripts], [None, '../assets/js/nav.js',
                         '../assets/js/analytics-sink.js', '../assets/js/meta-pixel.js', '../assets/js/site-analytics.mjs'])
        self.assertEqual(scripts[0].get('type'), 'application/ld+json')
        self.assertEqual(scripts[4].get('type'), 'module')
        self.assertNotIn('unpkg', page.lower())

    def test_cabecalho_menu_e_rodape_v02_reutilizados(self):
        _, page, _ = self.page()
        precedent = (ROOT / 'metodologia/index.html').read_text(encoding='utf-8')
        for tag in ('header', 'footer'):
            pattern = rf'<{tag}\b.*?</{tag}>'
            expected = re.search(pattern, precedent, re.S).group().replace(' aria-current="page"', '')
            self.assertEqual(re.search(pattern, page, re.S).group(), expected)
        self.assertIn('class="skip" href="#conteudo"', page)
        self.assertIn('href="../empresa/">Empresa</a>', page)

    def test_check_recusa_saida_antiga_ausente_e_crlf_sem_escrever(self):
        module, page, _ = self.page()
        source = COPY.read_text(encoding='utf-8')
        with tempfile.TemporaryDirectory(prefix='empresa-test-', dir=ROOT.parent) as tmp:
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

    def test_cli_check_nunca_escreve_em_nenhuma_pagina(self):
        self.module()
        pages = list(ROOT.glob('**/*.html'))
        before = {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in pages}
        result = subprocess.run([sys.executable, '-B', str(SCRIPT), '--check'], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(before, {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in pages})


if __name__ == '__main__':
    unittest.main()
