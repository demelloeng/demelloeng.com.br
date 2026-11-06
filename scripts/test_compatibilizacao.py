"""Contratos da frente #15 (Compatibilização BIM V02). Executar: python -B -m unittest discover -s scripts -p test_compatibilizacao.py."""
import html as html_lib
import importlib.util
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / 'docs/arquivo/paginas-servico-v02'
SLUG = 'compatibilizacao-bim'
COPY = 'COPY_COMPATIBILIZACAO_BIM_V02_20261106.md'
NOME = 'Compatibilização BIM'
PAGINA = ROOT / f'servicos/{SLUG}/index.html'


def modulo():
    spec = importlib.util.spec_from_file_location('copy_compatibilizacao', ROOT / 'scripts/copy_compatibilizacao.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def visivel(html):
    """Texto visível do <main>, sem SVG, com as entidades resolvidas e os espaços normalizados."""
    principal = re.search(r'<main id="conteudo">(.*?)</main>', html, re.S).group(1)
    sem_svg = re.sub(r'<svg.*?</svg>', ' ', principal, flags=re.S)
    return ' '.join(html_lib.unescape(re.sub(r'<[^>]+>', ' ', sem_svg)).split())


def frases_da_copy():
    """Todas as frases do corpo da copy aprovada, sem os rótulos e marcadores estruturais
    (rótulo de campo, "- ", número de etapa, sintaxe de link, "Nota:" e as linhas de destino do CTA)."""
    texto = (DOC / 'copy' / COPY).read_text(encoding='utf-8')
    frases = []
    for linha in texto.splitlines():
        linha = linha.strip()
        if not linha or linha.startswith('CTA (destino)'):
            continue
        linha = re.sub(r'^(TITULO|DESCRICAO|H1|CHAMADA|INTRODUCAO|SITUACOES|O QUE MUDA|O QUE A DEMELLO FAZ|INTERFACES|'
                       r'EXPERIENCIA APLICADA|PERGUNTAS|DETALHES DO ESCOPO|PROXIMO PASSO|CTA \(rotulo\)|CTA \(micro\)):\s*', '', linha)
        linha = re.sub(r'^(- |\d+\.\s+|Nota: )', '', linha)
        linha = re.sub(r'\[([^\]→]+?) → [^\]]+\]', r'\1', linha)
        if linha:
            frases += [f.strip() for f in re.split(r'(?<=[.?:;])\s+', linha) if f.strip()]
    return frases


class Compatibilizacao(unittest.TestCase):
    def test_copy_completa_e_contagens(self):
        d = modulo().parse_copy((DOC / 'copy' / COPY).read_text(encoding='utf-8'), SLUG, COPY, NOME)
        nv = d['blocos_novos']
        self.assertEqual(d['perfil'], 'compatibilizacao')
        self.assertEqual(d['cta']['href'], '../../orcamento/?situacao=known&amp;servico=compatibilizacao')
        self.assertEqual(d['cta']['rotulo'], 'Calcular a estimativa da compatibilização')
        self.assertEqual(d['cta']['micro'], 'Sem compromisso · contato somente no final')
        self.assertEqual(len(d['introducao']), 2)
        self.assertEqual(len(nv['situacoes']['conteudo'][1]['itens']), 5)
        self.assertEqual(len(nv['muda']['conteudo'][0]['itens']), 3)
        self.assertEqual(len(nv['faz']['conteudo'][1]['itens']), 5)
        self.assertEqual([c['titulo'] for c in nv['faz']['conteudo'][2]['itens']],
                         ['Projeto de outro profissional:', 'Projeto sob responsabilidade técnica da DEMELLO:'])
        self.assertEqual(len(nv['etapas']['conteudo'][0]['itens']), 4)
        self.assertEqual(len(nv['perguntas']['conteudo'][0]['itens']), 5)
        self.assertEqual(len(nv['escopo']['conteudo'][1]['itens']), 6)
        self.assertLessEqual(len(d['titulo_pagina']), 60)
        self.assertTrue(70 <= len(d['descricao']) <= 160)
        self.assertEqual(d['notas_editoriais'], [])

    def test_fontes_invalidas_falham(self):
        m = modulo()
        texto = (DOC / 'copy' / COPY).read_text(encoding='utf-8')
        casos = [
            'TITULO: incompleta',
            texto + '\nTITULO: repetido',
            texto + '\nBLOCO DESCONHECIDO: não absorver',
            texto.replace('servico=compatibilizacao', 'servico=estrutural'),                 # o destino da calculadora não muda
            texto.replace('/metodologia/', '/outra-pagina/'),                                # só os links do contrato
            texto.replace('As decisões técnicas continuam', 'BIM é a ferramenta. As decisões técnicas continuam'),
            texto.replace('- uma reforma exige integrar novas instalações à arquitetura e à estrutura existentes.\n', ''),
            texto.replace('Projeto sob responsabilidade técnica da DEMELLO:', 'Projeto próprio:'),
        ]
        for fonte in casos:
            with self.assertRaises(ValueError):
                m.parse_copy(fonte, SLUG, COPY, NOME)

    def test_sem_perda_de_texto_da_copy(self):
        # A marcação de link deixa um espaço antes da pontuação seguinte; a comparação o ignora.
        texto = re.sub(r'\s+([.,;:?])', r'\1', visivel(PAGINA.read_text(encoding='utf-8')))
        bruto = PAGINA.read_text(encoding='utf-8')
        cabeca = html_lib.unescape(re.search(r'<head>(.*?)</head>', bruto, re.S).group(1))
        frases = frases_da_copy()
        self.assertGreater(len(frases), 80)

        def presente(f):
            # títulos curtos de cartão e de etapa aparecem sem o ponto final (só estrutura, como na Orçamento e cronograma)
            return f in texto or f in cabeca or (len(f.split()) <= 6 and f.endswith('.') and f'>{f[:-1]}<' in bruto)
        faltam = [f for f in frases if not presente(f)]
        self.assertEqual(faltam, [], 'toda frase da Copy V02 está na página (corpo ou metadados)')

    def test_nove_secoes_ajustes_e_limites(self):
        html = PAGINA.read_text(encoding='utf-8')
        texto = visivel(html)
        self.assertEqual(len(re.findall(r'<h1\b', html)), 1)
        self.assertEqual(re.findall(r'<h2>([^<]+)</h2>', re.search(r'<main id="conteudo">(.*?)</main>', html, re.S).group(1)),
                         ['Quando vale compatibilizar', 'O que muda para você', 'O que a DEMELLO faz', 'Das interfaces às decisões coordenadas',
                          'Experiência aplicada: Colégio Djalma Marinho', 'Perguntas frequentes', 'Detalhes do escopo', 'Próximo passo'],
                         'hero mais oito seções, na ordem aprovada')
        # os oito ajustes aprovados por Marcos
        for trecho in ['Tubulação encontra uma viga. Na reforma, novas instalações precisam caber num espaço que já existe.',
                       'BIM é uma metodologia de trabalho baseada na integração de modelos e informações.',
                       'uma reforma exige integrar novas instalações à arquitetura e à estrutura existentes.',
                       'ajuda a encontrar incompatibilidades enquanto ainda é possível discutir os ajustes no projeto.',
                       'reduz o risco de quebra, atraso e retrabalho no canteiro.',
                       'a eventual necessidade de modelagem dependem das condições do material e do escopo contratado.',
                       'Quanto antes as incompatibilidades são identificadas, mais cedo é possível discutir as soluções.',
                       'A compatibilização vai além: analisa os conflitos, coordena as soluções entre disciplinas e verifica os ajustes.']:
            self.assertIn(trecho, texto, trecho)
        self.assertIn('<a href="../../metodologia/">Conheça como a DEMELLO trabalha com BIM</a>', html)
        self.assertIn('<a href="../orcamento-tecnico/">Orçamento e cronograma</a>', html)
        # fatos do Djalma, como nas copies aprovadas, e a nota de acervo do profissional
        for fato in ['cerca de 16 metros de desnível', 'Eram nove blocos já construídos.', 'A ampliação levaria o conjunto a dez.',
                     'como único responsável técnico', 'doze rampas', 'Tudo compatibilizado em BIM.']:
            self.assertIn(fato, texto, fato)
        self.assertIn('<p class="nota">Colégio Estadual Cívico Militar Djalma Marinho, Campo Largo/PR. Acervo profissional de Marcos de Mello Silva.</p>', html)
        # o que saiu e não volta
        for proibido in ['BIM é a ferramenta', 'terraplenagem', 'constituição', 'salvo quando', '9.451', 'CECM', 'BCF', 'planilha de interferências', 'NOTA EDITORIAL']:
            self.assertNotIn(proibido, texto, proibido)
        self.assertEqual(sorted(set(re.findall(r'\d[\d.]*', texto))), ['16'], 'o único número visível é o desnível do Djalma')
        svg = re.search(r'<svg class="bim-interfaces".*?</svg>', html, re.S).group(0)
        self.assertNotRegex(re.sub(r'<[^>]+>', ' ', svg), r'\d', 'a composição da abertura não traz números')

    def test_conferidor_detecta_perda_de_copy(self):
        with tempfile.TemporaryDirectory(prefix='bim-test-', dir=ROOT) as tmp:
            target = Path(tmp)
            (target / 'scripts').mkdir()
            (target / 'docs/arquivo').mkdir(parents=True)
            for script in ['conferir-paginas-servico-v02.py', 'copy_pscip_glp.py']:
                shutil.copyfile(ROOT / 'scripts' / script, target / 'scripts' / script)
            shutil.copytree(DOC, target / 'docs/arquivo/paginas-servico-v02')
            page = target / f'servicos/{SLUG}/index.html'
            page.parent.mkdir(parents=True)
            original = PAGINA.read_text(encoding='utf-8')
            page.write_text(original, encoding='utf-8')

            def run():
                return subprocess.run([sys.executable, '-B', 'scripts/conferir-paginas-servico-v02.py'], cwd=target, capture_output=True)
            self.assertEqual(run().returncode, 0)
            page.write_text(original.replace('Quem altera é o responsável técnico daquela disciplina.', ''), encoding='utf-8')
            self.assertEqual(run().returncode, 1)
            page.write_text(original.replace('servico=compatibilizacao', 'servico=estrutural'), encoding='utf-8')
            self.assertEqual(run().returncode, 1)

    def test_pipeline_deterministico_e_outras_paginas_intactas(self):
        protegidas = ['index.html', 'contato/index.html', 'construir-ou-ampliar/index.html', 'servicos/index.html'] + [
            f'servicos/{s}/index.html' for s in ['projeto-arquitetura', 'projeto-estrutural', 'projeto-hidrossanitario', 'projeto-terraplenagem',
                                                  'projeto-prevencao-incendio', 'projeto-gas-glp', 'regularizacao', 'orcamento-tecnico']]
        antes = {p: (ROOT / p).read_bytes() for p in protegidas}
        alvos = [f'servicos/{SLUG}/index.html', f'docs/arquivo/paginas-servico-v02/{SLUG}.copy.json']
        versionado = {p: (ROOT / p).read_bytes() for p in alvos}
        with tempfile.TemporaryDirectory(prefix='bim-test-', dir=ROOT) as tmp:
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
