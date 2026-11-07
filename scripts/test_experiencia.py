"""Contratos de publicação do portfólio aprovado, sem dependências externas."""
import hashlib
import importlib.util
from pathlib import Path
import unittest
import re
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parent.parent


class ExperienciaTests(unittest.TestCase):
    def module(self):
        spec = importlib.util.spec_from_file_location('experiencia', ROOT / 'scripts/gerar-experiencia-v02.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_geracao_fiel_e_deterministica(self):
        m = self.module()
        source = m.COPY.read_bytes()
        self.assertEqual(hashlib.sha256(source).hexdigest(), m.COPY_SHA256)
        page = m.montar(source.decode())
        self.assertEqual(page, m.montar(source.decode()))
        self.assertEqual(page.encode(), (ROOT / 'experiencia-tecnica/index.html').read_bytes())

    def test_recusa_alteracao_na_fonte_aprovada(self):
        m = self.module()
        with self.assertRaises(ValueError):
            m.montar(m.COPY.read_text(encoding='utf-8') + 'Texto não aprovado.')

    def test_portfolio_e_exclusoes(self):
        page = (ROOT / 'experiencia-tecnica/index.html').read_text(encoding='utf-8')
        self.assertEqual(page.count('data-block='), 7)
        self.assertEqual(page.count('class="projeto-principal"'), 4)
        self.assertEqual(page.count('class="projeto-complementar"'), 7)
        self.assertEqual(page.count('data-hidrantes-widget'), 1)
        self.assertNotIn('Modelo 3D.IFC', page)
        self.assertNotIn('modelo estrutural original', page)
        self.assertNotIn('three-d-stage.js', page)
        self.assertNotIn('unpkg.com', page)
        self.assertNotIn('1720261245965', page)
        source=self.module().COPY.read_text(encoding='utf-8').split('## B. METADADOS SEO CONSOLIDADOS',1)[0]
        self.assertEqual(set(re.findall(r'\b(?:17\d{11}|201\d{8})\b',source)),set(re.findall(r'\b(?:17\d{11}|201\d{8})\b',page)))
        for value in ['67.761,78','42.789,24','12.879,17','4.980,61','9.451,06','4.486,65','26,00','2.447,14','2.511,56','4.856,55']:
            self.assertIn(value,page)
        self.assertIn('1720261281228', page)
        self.assertIn('4.856,55 m²', page)


    def test_paragrafos_publicos_preservados(self):
        m = self.module()
        class Text(HTMLParser):
            def __init__(self): super().__init__(); self.parts=[]
            def handle_data(self, value): self.parts.append(value)
            def handle_endtag(self, tag): self.parts.append(' ')
        parsed = Text(); parsed.feed(m.montar(m.COPY.read_bytes().decode()))
        visible = ' '.join(' '.join(parsed.parts).split())
        public = m.COPY.read_text(encoding='utf-8').split('### BLOCO 01 — HERO',1)[1].split('## B. METADADOS SEO CONSOLIDADOS',1)[0]
        for paragraph in re.split(r'\n\s*\n', public):
            paragraph=paragraph.strip()
            if not paragraph or paragraph.startswith(('#','**','|','- ')) or paragraph=='---': continue
            self.assertIn(' '.join(paragraph.split()), visible)

    def test_check_nao_escreve(self):
        m=self.module()
        self.assertIn("if args.check:", (ROOT/'scripts/gerar-experiencia-v02.py').read_text(encoding='utf-8'))
        before=m.OUT.read_bytes()
        import subprocess,sys
        result=subprocess.run([sys.executable,'-B',str(ROOT/'scripts/gerar-experiencia-v02.py'),'--check'],capture_output=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual(before,m.OUT.read_bytes())


if __name__ == '__main__':
    unittest.main()
