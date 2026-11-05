"""Contratos da frente #16 (Regularização V02). Executar: python -B -m unittest discover -s scripts -p test_regularizacao.py."""
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / 'docs/arquivo/paginas-servico-v02'
SLUG = 'regularizacao'
COPY = 'COPY_REGULARIZACAO_V02_20261105.md'
NOME = 'Regularização de imóvel'


def modulo():
    spec = importlib.util.spec_from_file_location('copy_regularizacao', ROOT / 'scripts/copy_regularizacao.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


class Regularizacao(unittest.TestCase):
    def test_copy_completa_e_contagens(self):
        d = modulo().parse_copy((DOC / 'copy' / COPY).read_text(encoding='utf-8'), SLUG, COPY, NOME)
        nv = d['blocos_novos']
        self.assertEqual(d['perfil'], 'regularizacao')
        self.assertEqual(d['cta']['href'], '../../orcamento/?situacao=regularize')
        self.assertEqual(d['cta']['rotulo'], 'Entender o que meu imóvel precisa')
        self.assertEqual(d['cta']['micro'], 'Sem compromisso · contato somente no final')
        self.assertEqual(len(nv['situacoes']['conteudo'][1]['itens']), 6)
        self.assertEqual(len(nv['contextos']['conteudo'][1]['itens']), 4)
        self.assertEqual(len(nv['etapas']['conteudo'][0]['itens']), 5)
        self.assertEqual(len(nv['perguntas']['conteudo'][0]['itens']), 8)
        self.assertEqual(d['ordem'][0]['detalhes']['blocos'], ['entregaveis', 'como_funciona', 'como_definido', 'escopo_limites'])
        self.assertLessEqual(len(d['titulo_pagina']), 60)
        self.assertTrue(70 <= len(d['descricao']) <= 160)
        self.assertEqual(d['notas_editoriais'], [])

    def test_fontes_invalidas_falham(self):
        m = modulo()
        texto = (DOC / 'copy' / COPY).read_text(encoding='utf-8')
        with self.assertRaises(ValueError):
            m.parse_copy('TITULO: incompleta', SLUG, COPY, NOME)
        with self.assertRaises(ValueError):
            m.parse_copy(texto + '\nTITULO: repetido', SLUG, COPY, NOME)
        with self.assertRaises(ValueError):
            m.parse_copy(texto + '\nBLOCO DESCONHECIDO: não absorver', SLUG, COPY, NOME)
        with self.assertRaises(ValueError):   # seis situações exatas
            m.parse_copy(texto.replace('- Não sei exatamente o que está irregular. Comece pelo que você sabe. Uma frase é suficiente.\n', ''), SLUG, COPY, NOME)
        with self.assertRaises(ValueError):   # só os três links internos do Bloco 05
            m.parse_copy(texto.replace('../../avaliar-um-problema/', '../../outra-pagina/'), SLUG, COPY, NOME)

    def test_pagina_sem_marcas_de_revisao_nem_negativas_superadas(self):
        html = (ROOT / 'servicos/regularizacao/index.html').read_text(encoding='utf-8')
        for marca in ['(alterado', 'item 0', 'NOTA EDITORIAL', 'pacote universal', 'solução pronta', 'anteriormente à DEMELLO', 'modelo universal']:
            self.assertNotIn(marca, html, marca)
        self.assertEqual(len(re.findall(r'<h1\b', html)), 1)
        principal = re.search(r'<main id="conteudo">(.*?)</main>', html, re.S).group(1)
        visivel = re.sub(r'<[^>]+>', ' ', re.sub(r'<svg.*?</svg>', '', principal, flags=re.S))
        self.assertNotRegex(visivel, r'\d', 'o texto visível da copy não traz algarismos')

    def test_conferidor_detecta_perda_de_copy(self):
        with tempfile.TemporaryDirectory(prefix='reg-test-', dir=ROOT) as tmp:
            target = Path(tmp)
            (target / 'scripts').mkdir()
            (target / 'docs/arquivo').mkdir(parents=True)
            for script in ['conferir-paginas-servico-v02.py', 'copy_pscip_glp.py']:
                shutil.copyfile(ROOT / 'scripts' / script, target / 'scripts' / script)
            shutil.copytree(DOC, target / 'docs/arquivo/paginas-servico-v02')
            page = target / f'servicos/{SLUG}/index.html'
            page.parent.mkdir(parents=True)
            original = (ROOT / f'servicos/{SLUG}/index.html').read_text(encoding='utf-8')
            page.write_text(original, encoding='utf-8')

            def run():
                return subprocess.run([sys.executable, '-B', 'scripts/conferir-paginas-servico-v02.py'], cwd=target, capture_output=True)
            self.assertEqual(run().returncode, 0)
            page.write_text(original.replace('Uma frase é suficiente.', ''), encoding='utf-8')
            self.assertEqual(run().returncode, 1)
            page.write_text(original.replace('situacao=regularize', 'situacao=build'), encoding='utf-8')
            self.assertEqual(run().returncode, 1)

    def test_pipeline_deterministico_e_outras_paginas_intactas(self):
        protegidas = ['index.html', 'contato/index.html', 'construir-ou-ampliar/index.html', 'servicos/index.html'] + [
            f'servicos/{s}/index.html' for s in ['projeto-arquitetura', 'projeto-estrutural', 'projeto-hidrossanitario', 'projeto-terraplenagem',
                                                  'projeto-prevencao-incendio', 'projeto-gas-glp']]
        antes = {p: (ROOT / p).read_bytes() for p in protegidas}
        alvos = [f'servicos/{SLUG}/index.html', f'docs/arquivo/paginas-servico-v02/{SLUG}.copy.json']
        versionado = {p: (ROOT / p).read_bytes() for p in alvos}
        with tempfile.TemporaryDirectory(prefix='reg-test-', dir=ROOT) as tmp:
            target = Path(tmp)
            shutil.copytree(ROOT / 'scripts', target / 'scripts')
            shutil.copytree(DOC, target / 'docs/arquivo/paginas-servico-v02')
            (target / f'servicos/{SLUG}').mkdir(parents=True)

            def gerar():
                for cmd in [['scripts/importar-copy-servico-v02.py', SLUG, COPY, NOME], ['scripts/gerar-paginas-servico-v02.py', 'gerar', SLUG]]:
                    subprocess.run([sys.executable, '-B', *cmd], cwd=target, check=True, capture_output=True)
                return {p: (target / p).read_bytes() for p in alvos}
            primeira = gerar()
            for p in alvos:
                self.assertEqual(primeira[p], versionado[p], f'{p}: saída gerada difere do arquivo versionado')
            self.assertEqual(primeira, gerar(), 'segunda geração difere da primeira')
        self.assertEqual(antes, {p: (ROOT / p).read_bytes() for p in protegidas})


if __name__ == '__main__':
    unittest.main()
