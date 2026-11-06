"""Contratos da Copy V01 aprovada: geração fiel, entradas rejeitadas e --check sem escrita."""
import hashlib
import html
from html.parser import HTMLParser
import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / 'scripts/gerar-metodologia-v02.py'
COPY = ROOT / 'docs/arquivo/metodologia-v02-20261106/COPY_METODOLOGIA_V01_20261106.md'


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, data):
        self.parts.append(data)
    def handle_endtag(self, tag):
        self.parts.append(' ')


class MetodologiaTests(unittest.TestCase):
    def module(self):
        self.assertTrue(SCRIPT.is_file(), 'a página institucional precisa de gerador próprio')
        spec = importlib.util.spec_from_file_location('metodologia', SCRIPT)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        return m

    def test_fidelidade_integral_da_fonte_aprovada_e_determinismo(self):
        m = self.module()
        source = COPY.read_text(encoding='utf-8')
        page = m.montar(source)
        parser = Text()
        parser.feed(page)
        visible = ' '.join(' '.join(parser.parts).split())
        # Oráculo independente: cada parágrafo aprovado precisa aparecer no HTML.
        for part in re.split(r'\n\s*\n', source):
            if part.startswith(('TITULO SEO:', '## BLOCO')) or part.strip() == '---' or part.startswith('**Fechamento'):
                continue
            value = re.sub(r'^\*\*[^*]+:\*\*\s*', '', part)
            value = re.sub(r'^### (?:\d+\. )?', '', value)
            if not value or part.startswith('**Destino:'):
                continue
            self.assertIn(' '.join(value.split()), visible)
        self.assertIn(hashlib.sha256(COPY.read_bytes()).hexdigest(), page)
        self.assertEqual(page, m.montar(source))
        self.assertEqual(page.encode(), m.SAIDA.read_bytes(), 'HTML em LF e fiel à fonte')

    def test_alteracao_omissao_duplicacao_e_link_nao_aprovado_falham_fechado(self):
        m = self.module()
        source = COPY.read_text(encoding='utf-8')
        variants = [source.replace('A ordem acompanha o caso.', ''), source + '\nTexto inventado.\n',
                    source.replace('/orcamento/', '/contato/', 1),
                    source.replace('## BLOCO 02', '## BLOCO 01', 1),
                    source.replace('Você recebe as entregas e orientações previstas na contratação.', 'Você recebe os produtos contratados.'),
                    source.replace('**H1:**', '**H2:**', 1)]
        for value in variants:
            with self.subTest(value=value[-50:]), self.assertRaises(ValueError):
                m.montar(value)

    def test_seis_blocos_cinco_momentos_e_responsabilidade_fora_da_sequencia(self):
        m = self.module()
        page = m.montar(COPY.read_text(encoding='utf-8'))
        self.assertEqual(re.findall(r'data-block="([^"]+)"', page), ['method-hero', 'service-process',
                         'service-differences', 'bim-method', 'scope-responsibility', 'final-cta'])
        process = re.search(r'data-block="service-process"(.*?)</section>', page, re.S).group(1)
        self.assertEqual(re.findall(r'<li class="momento"><h3>([^<]+)</h3>', process), [
            'Entendimento da necessidade', 'Definição do escopo e da proposta', 'Realização do trabalho técnico',
            'Verificação e coordenação', 'Entrega e orientações'])
        self.assertNotIn('<h3>Responsabilidade técnica', process)
        self.assertEqual(len(re.findall(r'<h1\b', page)), 1)
        self.assertNotIn('"@type":"Service"', page)

    def test_check_nao_escreve_mesmo_quando_html_esta_desatualizado(self):
        m = self.module()
        with tempfile.TemporaryDirectory(prefix='metodologia-test-', dir=ROOT.parent) as tmp:
            target = Path(tmp) / 'index.html'
            target.write_bytes(b'HTML desatualizado\r\n')
            m.SAIDA = target
            before = (target.read_bytes(), target.stat().st_mtime_ns)
            self.assertEqual(m.verificar_ou_gravar(COPY.read_text(encoding='utf-8'), check=True), 1)
            self.assertEqual(before, (target.read_bytes(), target.stat().st_mtime_ns))

    def test_cli_check_sem_escrita_e_falha_com_saida_ausente(self):
        m = self.module()
        before = {p: (ROOT / p).read_bytes() for p in ['metodologia/index.html', 'index.html', 'servicos/index.html']}
        r = subprocess.run([sys.executable, '-B', str(SCRIPT), '--check'], capture_output=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(before, {p: (ROOT / p).read_bytes() for p in before})
        with tempfile.TemporaryDirectory(prefix='metodologia-test-', dir=ROOT.parent) as tmp:
            m.SAIDA = Path(tmp) / 'absent.html'
            self.assertEqual(m.verificar_ou_gravar(COPY.read_text(encoding='utf-8'), check=True), 1)
            self.assertFalse(m.SAIDA.exists())


if __name__ == '__main__':
    unittest.main()
