"""Contratos da entrada por situação: fidelidade, segurança e geração sem efeitos colaterais."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / 'scripts/gerar-avaliar-um-problema-v02.py'


class EntradaTests(unittest.TestCase):
    def test_page_has_its_own_generator(self):
        self.assertTrue(SCRIPT.is_file(), 'a entrada problem precisa de gerador próprio')


class AvaliarTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SCRIPT.exists():
            raise unittest.SkipTest('gerador ainda não implementado')
        spec = importlib.util.spec_from_file_location('avaliar', SCRIPT)
        cls.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.m)
        cls.copy = cls.m.COPY.read_text(encoding='utf-8')

    def test_generation_matches_published_candidate_and_is_deterministic(self):
        actual = self.m.montar(self.copy)
        self.assertEqual(actual, self.m.montar(self.copy))
        self.assertEqual(actual, self.m.SAIDA.read_text(encoding='utf-8'))

    def test_missing_duplicate_unknown_and_empty_fields_are_rejected(self):
        first = self.copy.splitlines()[0]
        for text in [self.copy.replace(first, '', 1), self.copy + '\n' + first,
                     self.copy + '\nDESCONHECIDO: valor', self.copy.replace(first, 'TITULO SEO:')]:
            with self.subTest(text=text[:50]), self.assertRaises(ValueError):
                self.m.montar(text)

    def test_protected_safety_cannot_be_changed(self):
        for old, new in [('(193)', '(190)'), ('(199)', '(198)'),
                         ('não confirmam a segurança do imóvel', 'confirmam a segurança do imóvel')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                self.m.montar(self.copy.replace(old, new))

    def test_seven_blocks_cta_and_photograph_contracts(self):
        page = self.m.montar(self.copy)
        import re
        self.assertEqual(re.findall('data-block="([^"]+)"', page),
                         ['landing-hero', 'safety', 'situations', 'framing', 'technical-care', 'faq', 'final-cta'])
        self.assertEqual(page.count('href="../orcamento/?situacao=problem">Descrever meu caso</a>'), 2)
        self.assertEqual(page.count('<details class="pergunta">'), 7)
        self.assertIn('as fotos adicionadas ao formulário não são enviadas à DEMELLO', page)
        self.assertNotIn('"@type":"Service"', page)

    def test_check_fails_on_stale_html_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'index.html'
            target.write_text('desatualizado', encoding='utf-8')
            original = self.m.SAIDA
            self.m.SAIDA = target
            try:
                self.assertEqual(self.m.verificar_ou_gravar(self.copy, check=True), 1)
                self.assertEqual(target.read_text(encoding='utf-8'), 'desatualizado')
            finally:
                self.m.SAIDA = original

    def test_cli_check_succeeds(self):
        result = subprocess.run([sys.executable, '-B', str(SCRIPT), '--check'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
