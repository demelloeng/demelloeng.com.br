"""Contratos da frente #12. Executar: python -B -m unittest discover -s scripts -p test_pscip_glp.py."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import shutil
import unittest

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / 'docs/arquivo/paginas-servico-v02'
SLUG = 'projeto-prevencao-incendio'
COPY = 'COPY_PSCIP_GLP_V02_20261105.md'

class Frente(unittest.TestCase):
    def test_copy_completa_e_notas_condicionais(self):
        spec = importlib.util.spec_from_file_location('pscip_copy', ROOT / 'scripts/copy_pscip_glp.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        d = module.parse_copy((DOC / 'copy' / COPY).read_text(encoding='utf-8'), SLUG, COPY, 'Projeto de incêndio e gás/GLP')
        self.assertEqual(d['perfil'], 'pscip-glp')
        self.assertEqual(len(d['blocos_novos']['perguntas']['conteudo'][0]['itens']), 4)
        self.assertGreaterEqual(len(d['notas_editoriais']), 2)
        self.assertIn('12.879', json.dumps(d['blocos_novos']['prova'], ensure_ascii=False))
        self.assertIn('servico=gas-glp', d['cta_secundario']['href'])
        self.assertNotIn('PREFEITURA', json.dumps(d, ensure_ascii=False))
        self.assertIn('AVCB',d['notas_editoriais'][0]['pergunta'])
        self.assertIn('PPCI',d['notas_editoriais'][1]['pergunta'])
        self.assertGreater(len(d['blocos_novos']['perguntas']['conteudo'][0]['itens'][2]['paragrafos']), 4)

    def test_fontes_invalidas_falham(self):
        spec = importlib.util.spec_from_file_location('pscip_copy', ROOT / 'scripts/copy_pscip_glp.py')
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        with self.assertRaises(ValueError): module.parse_copy('TITULO: incompleta', SLUG, COPY, 'Incêndio')
        text=(DOC/'copy'/COPY).read_text(encoding='utf-8')
        with self.assertRaises(ValueError): module.parse_copy(text+'\nTITULO: repetido',SLUG,COPY,'Incêndio')
        with self.assertRaises(ValueError): module.parse_copy(text+'\nBLOCO DESCONHECIDO: não absorver',SLUG,COPY,'Incêndio')

    def test_conferidor_detecta_perda_de_copy_nova(self):
        with tempfile.TemporaryDirectory(prefix='pscip-test-',dir=ROOT) as tmp:
            target=Path(tmp)
            (target/'scripts').mkdir(); (target/'docs/arquivo').mkdir(parents=True)
            for script in ['conferir-paginas-servico-v02.py','copy_pscip_glp.py']: shutil.copyfile(ROOT/'scripts'/script,target/'scripts'/script)
            shutil.copytree(DOC,target/'docs/arquivo/paginas-servico-v02')
            page=target/f'servicos/{SLUG}/index.html';page.parent.mkdir(parents=True)
            original=(ROOT/f'servicos/{SLUG}/index.html').read_text(encoding='utf-8');page.write_text(original,encoding='utf-8')
            def run(): return subprocess.run([sys.executable,'-B','scripts/conferir-paginas-servico-v02.py'],cwd=target,capture_output=True)
            self.assertEqual(run().returncode,0)
            page.write_text(original.replace('Inclui projetos e consultoria em controle de fumaça.',''),encoding='utf-8')
            self.assertEqual(run().returncode,1)
            page.write_text(original.replace('servico=gas-glp','servico=incendio'),encoding='utf-8')
            self.assertEqual(run().returncode,1)

    def test_perfis_anteriores_reproduzem_html_versionado(self):
        with tempfile.TemporaryDirectory(prefix='pscip-test-',dir=ROOT) as tmp:
            target=Path(tmp);shutil.copytree(ROOT/'scripts',target/'scripts');shutil.copytree(DOC,target/'docs/arquivo/paginas-servico-v02')
            for slug in ['projeto-arquitetura','projeto-estrutural','projeto-hidrossanitario','projeto-terraplenagem']:
                page=target/f'servicos/{slug}/index.html';page.parent.mkdir(parents=True)
                subprocess.run([sys.executable,'-B','scripts/gerar-paginas-servico-v02.py','gerar',slug],cwd=target,check=True,capture_output=True)
                original=subprocess.run(['git','show',f'HEAD:servicos/{slug}/index.html'],cwd=ROOT,check=True,capture_output=True).stdout
                self.assertEqual(page.read_bytes(),original,slug)

    def test_pipeline_deterministico_e_perfis_preservados(self):
        protected = ['index.html', 'contato/index.html', 'construir-ou-ampliar/index.html'] + [f'servicos/{s}/index.html' for s in ['projeto-arquitetura','projeto-estrutural','projeto-hidrossanitario','projeto-terraplenagem']]
        before = {p: (ROOT / p).read_bytes() for p in protected}
        targets = [DOC / f'{SLUG}.copy.json'] + [ROOT / p for p in ['servicos/index.html', f'servicos/{SLUG}/index.html', 'servicos/projeto-gas-glp/index.html']]
        def generate():
            cmds = [['scripts/importar-copy-servico-v02.py',SLUG,COPY,'Projeto de incêndio e gás/GLP'], ['scripts/gerar-paginas-servico-v02.py','gerar',SLUG],['scripts/gerar-paginas-servico-v02.py','gerar','projeto-gas-glp'],['scripts/gerar-servicos-v02.py']]
            for cmd in cmds: subprocess.run([sys.executable, '-B', *cmd], cwd=ROOT, check=True, capture_output=True)
            return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in targets}
        self.assertEqual(generate(), generate())
        self.assertEqual(before, {p: (ROOT / p).read_bytes() for p in protected})

if __name__ == '__main__': unittest.main()
