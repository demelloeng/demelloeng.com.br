"""Contratos de Verificar e 404 no visual V02: fontes versionadas, lógica intacta, metadados e --check sem escrita."""
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
SCRIPT = ROOT / 'scripts/gerar-verificar-404-v02.py'
# Hash do bloco <script> do verificador na main 3788281, antes da migração visual.
LOGICA_ORIGINAL_SHA256 = '80389746b3dbaad411fd586247fbdbda2fe355c5918d0a9e73e7a4a6b725412e'
NOTAS = ['Uma prévia verificada confirma apenas que este registro foi emitido pela DEMELLO Engenharia com os valores '
         'e as informações abaixo, na data indicada.',
         'Não significa proposta aceita, contrato, escopo confirmado, conferência documental nem preço atual garantido. '
         'As informações do caso foram fornecidas pelo usuário.']
SCRIPTS = ['{b}assets/js/nav.js', '{b}assets/js/analytics-sink.js', '{b}assets/js/meta-pixel.js', '{b}assets/js/site-analytics.mjs']


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
        if tag in ('p', 'h1', 'h2', 'li', 'nav', 'div', 'section', 'footer', 'a'):
            self.text.append(' ')


def visivel(page):
    parser = Page()
    parser.feed(page)
    return parser, ' '.join(''.join(parser.text).split())


class VerificarE404Tests(unittest.TestCase):
    def module(self):
        self.assertTrue(SCRIPT.is_file(), 'as páginas utilitárias precisam de gerador próprio')
        spec = importlib.util.spec_from_file_location('verificar404', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def pages(self):
        module = self.module()
        saidas = module.montar_tudo()
        return module, saidas[module.SAIDA_VF].decode('utf-8'), saidas[module.SAIDA_404].decode('utf-8')

    def test_fontes_integras_html_fiel_deterministico_e_lf(self):
        module, vf, nf = self.pages()
        for path, sha in module.SHA.items():
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), sha, path.name)
        self.assertEqual(vf.encode(), module.SAIDA_VF.read_bytes())
        self.assertEqual(nf.encode(), module.SAIDA_404.read_bytes())
        self.assertEqual(module.montar_tudo(), module.montar_tudo())
        self.assertNotIn('\r', vf + nf)

    def test_logica_do_verificador_identica_a_original_byte_a_byte(self):
        module, vf, _ = self.pages()
        block = re.search(r'<script>\n(\(function.*?\n\}\)\(\);)\n</script>', vf, re.S).group(1)
        self.assertEqual(hashlib.sha256(block.encode()).hexdigest(), LOGICA_ORIGINAL_SHA256)
        self.assertEqual(block + '\n', module.LOGICA.read_text(encoding='utf-8'))
        self.assertEqual(vf.count('<script>'), 1, 'um único script inline: a lógica original')
        for contrato in ('PUBLIC_PREVIEW_V1', 'res.status === 409', 'res.status === 404', 'URLSearchParams(location.search).get("codigo")',
                         'https://ma-demello-preview.ma-demello.workers.dev/api/previews/v1/', '/^[a-z2-7]{6,64}$/'):
            self.assertIn(contrato, vf)
        for proibido in ('crypto.subtle', 'fingerprint', 'canonicalize'):
            self.assertNotIn(proibido, vf)

    def test_fontes_alteradas_sao_recusadas_sem_reescrever_saidas(self):
        module = self.module()
        antes = (module.SAIDA_VF.read_bytes(), module.SAIDA_404.read_bytes())
        alvos = [(module.COPY_VF, 'Carregando', 'Aguarde'), (module.COPY_404, 'Essa página', 'Esta página'),
                 (module.COPY_VF, 'noindex, follow', 'index, follow'), (module.LOGICA, 'Accept', 'Accepts'),
                 (module.LOGICA, 'res.status === 409', 'res.status === 410')]
        original = module.ler
        for path, velho, novo in alvos:
            texto = path.read_text(encoding='utf-8')
            self.assertIn(velho, texto)
            with self.subTest(path=path.name, velho=velho):
                altered = texto.replace(velho, novo, 1)
                with tempfile.TemporaryDirectory(prefix='vf404-test-', dir=ROOT.parent) as tmp:
                    copia = Path(tmp) / path.name
                    copia.write_text(altered, encoding='utf-8')
                    module.SHA[copia] = module.SHA[path]
                    with self.assertRaises(ValueError):
                        original(copia)
        self.assertEqual(antes, (module.SAIDA_VF.read_bytes(), module.SAIDA_404.read_bytes()))

    def test_textos_e_estrutura_preservados(self):
        _, vf, nf = self.pages()
        _, visible_vf = visivel(vf)
        _, visible_nf = visivel(nf)
        for text in ['Verificação', 'Prévia inicial DEMELLO', 'Carregando…', *NOTAS]:
            self.assertIn(text, visible_vf)
        self.assertIn('<strong>este registro foi emitido pela DEMELLO Engenharia</strong>', vf)
        self.assertIn('<div id="vf-out" aria-live="polite">', vf)
        self.assertEqual(vf.count('<h1>'), 1)
        for text in ['Erro 404', 'Essa página não existe.', 'O endereço pode ter mudado ou ter sido digitado errado. '
                     'Volte ao início ou vá direto à estimativa.', 'Voltar ao início', 'Calcular estimativa']:
            self.assertIn(text, visible_nf)
        self.assertIn('<a class="acao acao-principal" href="/">Voltar ao início</a>', nf)
        self.assertIn('<a class="acao" href="/orcamento/">Calcular estimativa</a>', nf)
        self.assertEqual(nf.count('<h1>'), 1)

    def test_metadados_verificar_noindex_follow_canonical_sem_og_nem_jsonld(self):
        _, vf, _ = self.pages()
        self.assertIn('<title>Verificar prévia | DEMELLO Engenharia</title>', vf)
        self.assertIn('<meta name="description" content="Verificação de uma prévia inicial DEMELLO emitida pela DEMELLO Engenharia.">', vf)
        self.assertIn('<meta name="robots" content="noindex, follow">', vf)
        self.assertEqual(vf.count('rel="canonical"'), 1)
        self.assertIn('<link rel="canonical" href="https://demelloeng.com.br/verificar/">', vf)
        self.assertNotIn('og:', vf)
        self.assertNotIn('application/ld+json', vf)

    def test_metadados_404_noindex_sem_canonical_e_caminhos_absolutos(self):
        _, _, nf = self.pages()
        self.assertIn('<title>Página não encontrada | DEMELLO</title>', nf)
        self.assertIn('<meta name="robots" content="noindex">', nf)
        self.assertNotIn('rel="canonical"', nf)
        self.assertNotIn('og:', nf)
        parser, _ = visivel(nf)
        for tag, attrs in parser.tags:
            for key in ('href', 'src'):
                target = attrs.get(key)
                if target is None:
                    continue
                url = urlsplit(target)
                self.assertTrue(target.startswith(('/', '#')) or url.scheme in ('https', 'mailto', 'tel'), f'{tag} {key}={target}')
                if target.startswith('/'):
                    path = ROOT / url.path.lstrip('/')
                    if path.is_dir():
                        path /= 'index.html'
                    self.assertTrue(path.is_file(), f'recurso ausente: {target}')

    def test_links_de_verificar_resolvem_localmente_e_scripts_na_ordem_vigente(self):
        _, vf, nf = self.pages()
        for page, base, folder in ((vf, '../', 'verificar'), (nf, '/', '')):
            parser, _ = visivel(page)
            sources = [attrs.get('src') for tag, attrs in parser.tags if tag == 'script']
            esperado = [s.format(b=base) for s in SCRIPTS]
            self.assertEqual(sources[:4], esperado)
            self.assertEqual(sources[4:], [None] if folder else [])
            self.assertEqual([a.get('type') for t, a in parser.tags if t == 'script'][3], 'module')
            if folder:
                for tag, attrs in parser.tags:
                    for key in ('href', 'src'):
                        url = urlsplit(attrs.get(key, ''))
                        if url.scheme or url.netloc or not url.path:
                            continue
                        path = ROOT / folder / url.path
                        if path.is_dir():
                            path /= 'index.html'
                        self.assertTrue(path.is_file(), f'{tag}: destino local ausente {attrs.get(key)}')
            self.assertNotIn('unpkg', page.lower())
            self.assertNotIn('<form', page)

    def test_cabecalho_menu_e_rodape_v02_reutilizados(self):
        _, vf, nf = self.pages()
        precedent = (ROOT / 'metodologia/index.html').read_text(encoding='utf-8')
        for tag in ('header', 'footer'):
            pattern = rf'<{tag}\b.*?</{tag}>'
            expected = re.search(pattern, precedent, re.S).group().replace(' aria-current="page"', '')
            self.assertEqual(re.search(pattern, vf, re.S).group(), expected)
            self.assertEqual(re.search(pattern, nf, re.S).group(), expected.replace('"../', '"/'))
        for page, klass in ((vf, 'servicos-v02 verificar-v02'), (nf, 'servicos-v02 erro-v02')):
            self.assertIn(f'<body class="{klass}">', page)
            self.assertIn('class="skip" href="#conteudo"', page)
            self.assertIn('aria-expanded="false" aria-controls="site-nav"', page)
            self.assertIn('assets/css/servicos-v02.css', page)
            self.assertIn('assets/css/rodape-v02.css', page)
            self.assertNotIn('assets/css/style.css', page)

    def test_check_recusa_saida_antiga_ausente_e_crlf_sem_escrever(self):
        module = self.module()
        saidas = module.montar_tudo()
        with tempfile.TemporaryDirectory(prefix='vf404-test-', dir=ROOT.parent) as tmp:
            destino = {Path(tmp) / 'verificar.html': saidas[module.SAIDA_VF], Path(tmp) / '404.html': saidas[module.SAIDA_404]}
            self.assertEqual(module.verificar_ou_gravar(destino, check=True), 1)
            self.assertFalse(any(p.exists() for p in destino))
            for content in (b'stale\r\n', None):
                for p, c in destino.items():
                    p.write_bytes(content if content else c.replace(b'\n', b'\r\n'))
                antes = {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in destino}
                self.assertEqual(module.verificar_ou_gravar(destino, check=True), 1)
                self.assertEqual(antes, {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in destino})
            self.assertEqual(module.verificar_ou_gravar(destino), 0)
            self.assertEqual({p: p.read_bytes() for p in destino}, destino)
            self.assertEqual(module.verificar_ou_gravar(destino, check=True), 0)

    def test_cli_check_nunca_escreve_em_nenhuma_pagina(self):
        self.module()
        pages = list(ROOT.glob('**/*.html'))
        before = {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in pages}
        result = subprocess.run([sys.executable, '-B', str(SCRIPT), '--check'], capture_output=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(before, {path: (path.read_bytes(), path.stat().st_mtime_ns) for path in pages})


if __name__ == '__main__':
    unittest.main()
