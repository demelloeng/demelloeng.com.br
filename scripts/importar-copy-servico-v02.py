#!/usr/bin/env python3
"""Converte a copy aprovada de uma página de serviço (texto com rótulos) em <slug>.copy.json,
que o gerador usa no lugar do texto antigo.

Entrada : docs/arquivo/paginas-servico-v02/copy/<arquivo>.txt   (formato dos rascunhos COPY_*_Vnn)
Saída   : docs/arquivo/paginas-servico-v02/<slug>.copy.json
Uso     : python scripts/importar-copy-servico-v02.py projeto-arquitetura COPY_ARQUITETURA_V05_20261029.md "Projeto de arquitetura"

Regras: nada é reescrito; só se estrutura. Links internos entram por LINKS (palavra -> href), uma vez por página.
"""
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# imagens por bloco (arquivos em assets/images/). Legenda: o render é o modelo do projeto tratado por IA (declarado por Marcos em 29/10/2026).
REMOVIDOS = {'projeto-arquitetura': ['O dado pertence à trajetória profissional do responsável técnico e não exclusivamente ao atual CNPJ.', 'A DEMELLO não executa a obra.'],
             'projeto-hidrossanitario': ['Os quantitativos pertencem à trajetória profissional do responsável técnico, e não exclusivamente ao atual CNPJ.',
                                         'A DEMELLO projeta as instalações. Não executa fisicamente as redes.'],
             'projeto-estrutural': ['Os quantitativos pertencem à trajetória profissional do responsável técnico e não correspondem exclusivamente ao acervo operacional do atual CNPJ.', 'A DEMELLO não executa a obra.']}
IMPRENSA = {
    'projeto-arquitetura': [
        {'veiculo': 'Instagram, @roni.miranda', 'titulo': 'Secretário de Estado da Educação assina a ordem de serviço da ampliação e reforma do colégio',
         'url': 'https://www.instagram.com/reel/DZpkXZBOcjA/', 'data': '16/06/2026'},
        {'veiculo': 'Bem Paraná, com a Agência Estadual de Notícias', 'titulo': 'Colégio cívico-militar da Grande Curitiba cria 528 novas vagas após obra de ampliação',
         'url': 'https://www.bemparana.com.br/noticias/parana/colegio-civico-militar-da-grande-curitiba-cria-528-novas-vagas-apos-obra-de-ampliacao/', 'data': '16/06/2026'},
        {'veiculo': 'Folha de Campo Largo', 'titulo': 'CCM Djalma Marinho recebe investimento histórico de R$ 8,3 milhões e ampliará atendimento',
         'url': 'https://www.folhadecampolargo.com.br/noticia/56187/ccm-djalma-marinho-recebe-investimento-historico-de-r-83-mil', 'data': '16/06/2026'},
    ],
}
LAYOUTS = {'projeto-arquitetura': 'rico', 'projeto-estrutural': 'rico', 'projeto-hidrossanitario': 'rico'}
PERFIS = {'projeto-estrutural': 'estrutura', 'projeto-hidrossanitario': 'hidro'}   # layout próprio: maquete estrutural e bloco "Da fundação à laje"   # as demais páginas ficam no layout simples até terem copy aprovada
FIGURAS = {
    'projeto-arquitetura': {
        'Experiência aplicada — CECM Djalma Marinho': [{
            'base': 'djalma-render-entardecer', 'larguras': [800, 1600], 'altura_1600': 857,
            'alt': 'Vista aérea ao entardecer do Colégio Cívico Militar Djalma Marinho, em Campo Largo/PR: blocos de ensino, ginásio de cobertura azul em arco e pátios em terreno em declive.',
            'legenda': 'Render do modelo em BIM do projeto, ao entardecer.',
        }, {
            'base': 'djalma-render-dia', 'larguras': [800, 1600], 'altura_1600': 857,
            'alt': 'Vista aérea à luz do dia do Colégio Cívico Militar Djalma Marinho, em Campo Largo/PR: blocos de ensino, ginásio de cobertura azul em arco, reservatório e ruas ao redor.',
            'legenda': 'O mesmo render, à luz do dia.',
        }],
    },
}
DOCS = REPO / 'docs/arquivo/paginas-servico-v02'

# palavra exata no texto -> destino (relativo à página /servicos/<slug>/); aplicado na 1ª ocorrência de cada bloco indicado
LINKS = {
    'projeto-arquitetura': [('pode ser necessária regularização', 'regularização', '../regularizacao/')],
    'projeto-estrutural': [('serviço de Orçamento e cronograma', 'Orçamento e cronograma', '../orcamento-tecnico/')],
    'projeto-hidrossanitario': [('serviço de Orçamento e cronograma', 'Orçamento e cronograma', '../orcamento-tecnico/')],
}

ROTULOS = ['TITULO', 'DESCRICAO', 'H1', 'CHAMADA', 'INTRODUCAO 1', 'INTRODUCAO 2', 'PARA QUEM E', 'O QUE MUDA PARA VOCE',
           'PREFEITURA, APROVACAO E HABITE-SE', 'O QUE A DEMELLO FAZ', 'PERGUNTAS', 'PROXIMO PASSO',
           'CTA (rotulo)', 'CTA (micro, mantido)']


def rotulos_de(slug):
    perfil = PERFIS.get(slug)
    meio = {'estrutura': 'DA FUNDACAO A LAJE', 'hidro': "DA CAIXA D'AGUA AO COLETOR"}.get(perfil)
    novos = [(meio if (r.startswith('PREFEITURA') and meio) else r) for r in ROTULOS]
    return novos + {'estrutura': ['EXPERIENCIA APLICADA', 'MEZANINO'], 'hidro': ['EXPERIENCIA APLICADA']}.get(perfil, [])


def secoes(texto, rotulos=ROTULOS):
    padrao = re.compile(r'^(' + '|'.join(re.escape(r) for r in rotulos) + r'):[ \t]*(.*)$', re.M)
    achados = list(padrao.finditer(texto))
    saida = {}
    for i, m in enumerate(achados):
        fim = achados[i + 1].start() if i + 1 < len(achados) else len(texto)
        corpo = (m.group(2) + '\n' + texto[m.end():fim]).strip('\n')
        saida[m.group(1)] = corpo.strip()
    faltam = [r for r in rotulos if r not in saida]
    assert not faltam, f'rótulos ausentes: {faltam}'
    return saida


def paragrafos(corpo):
    return [p.strip() for p in re.split(r'\n+', corpo) if p.strip()]


def main(slug, arquivo, nome_servico):
    texto = (DOCS / 'copy' / arquivo).read_text(encoding='utf-8')
    s = secoes(texto, rotulos_de(slug))

    quem = paragrafos(s['PARA QUEM E'])
    lead = [q for q in quem if not q.startswith('- ')]
    itens = [q[2:] for q in quem if q.startswith('- ')]

    muda = []
    for linha in paragrafos(s['O QUE MUDA PARA VOCE']):
        m = re.match(r'\d+\.\s+(.*?)\.\s+(.*)$', linha)
        assert m, f'item de "o que muda" fora do padrão: {linha[:60]}'
        muda.append({'titulo': m.group(1), 'texto': m.group(2)})

    perg_linhas = paragrafos(s['PERGUNTAS'])
    assert len(perg_linhas) % 2 == 0, 'perguntas e respostas devem vir em pares'
    perguntas = [{'pergunta': perg_linhas[i], 'resposta': perg_linhas[i + 1]} for i in range(0, len(perg_linhas), 2)]

    exp = None
    if PERFIS.get(slug) in ('estrutura', 'hidro'):
        linhas_exp = s['EXPERIENCIA APLICADA'].split('\n', 1)
        exp = {'titulo': linhas_exp[0].strip(), 'conteudo': [{'tipo': 'paragrafo', 'texto': t} for t in paragrafos(linhas_exp[1])]}

    mez = None
    if PERFIS.get(slug) == 'estrutura':
        linhas_mez = s['MEZANINO'].split('\n', 1)
        mez = {'titulo': linhas_mez[0].strip(), 'conteudo': [{'tipo': 'paragrafo', 'texto': t} for t in paragrafos(linhas_mez[1])]}

    dados = {
        'slug': slug,
        'nome_servico': nome_servico,
        'fonte_copy': arquivo,
        'titulo_pagina': s['TITULO'],
        'descricao': s['DESCRICAO'],
        'h1': s['H1'],
        'chamada': s['CHAMADA'],
        'introducao': [s['INTRODUCAO 1'], s['INTRODUCAO 2']],
        'cta': {'rotulo': s['CTA (rotulo)'], 'micro': s['CTA (micro, mantido)']},
        'blocos_novos': {
            'para_quem': {'titulo': 'Para quem é', 'conteudo': [{'tipo': 'paragrafo', 'texto': t} for t in lead] + [{'tipo': 'lista', 'itens': itens}]},
            'muda': {'titulo': 'O que muda para você', 'conteudo': [{'tipo': 'beneficios', 'itens': muda}]},
            **({'estrutura': {'titulo': 'Da fundação à laje', 'conteudo': [{'tipo': 'paragrafo', 'texto': t} for t in paragrafos(s['DA FUNDACAO A LAJE'])]}}
               if PERFIS.get(slug) == 'estrutura' else
               {'estrutura': {'titulo': "Da caixa d'água ao coletor", 'conteudo': [{'tipo': 'paragrafo', 'texto': t} for t in paragrafos(s["DA CAIXA D'AGUA AO COLETOR"])]}}
               if PERFIS.get(slug) == 'hidro' else
               {'prefeitura': {'titulo': 'Prefeitura, aprovação e habite-se', 'conteudo': [{'tipo': 'paragrafo', 'texto': t} for t in paragrafos(s['PREFEITURA, APROVACAO E HABITE-SE'])]}}),
            **({'experiencia': exp} if exp else {}),
            **({'mezanino': mez} if mez else {}),
            'faz': {'titulo': 'O que a DEMELLO faz', 'conteudo': [{'tipo': 'paragrafo', 'texto': t} for t in paragrafos(s['O QUE A DEMELLO FAZ'])]},
            'perguntas': {'titulo': 'Perguntas', 'conteudo': [{'tipo': 'perguntas', 'itens': perguntas}]},
        },
        # ordem da página; chaves de blocos_novos ou títulos dos blocos antigos (mantidos sem alteração)
        # Vitrine: o que o leitor de busca precisa. "Detalhes do escopo": texto antigo intacto, fechado por padrão.
        'ordem': ['para_quem', 'muda', ('estrutura' if PERFIS.get(slug) in ('estrutura', 'hidro') else 'prefeitura'), 'faz', 'perguntas', 'Prova técnica',
                  ('experiencia' if exp else 'Experiência aplicada — CECM Djalma Marinho'),
                  {'detalhes': {'titulo': 'Detalhes do escopo',
                                'resumo': 'Entregáveis, como funciona, como o escopo é definido e limites',
                                'blocos': ['Entregáveis', 'Como funciona', 'Como o escopo é definido', 'Escopo e limites']}}],
        'proximo_passo': {'titulo': 'Próximo passo', 'paragrafos': paragrafos(s['PROXIMO PASSO'])},
        'figuras': FIGURAS.get(slug, {}),
        'layout': LAYOUTS.get(slug, 'simples'),
        'perfil': PERFIS.get(slug, 'casa'),
        'imprensa': IMPRENSA.get(slug, []),
        # trechos do texto antigo que Marcos mandou tirar da página (29/10/2026); a conferência de texto os ignora
        'removidos': REMOVIDOS.get(slug, []),
    }

    # links internos: troca a 1ª ocorrência do trecho por <a>, uma vez na página inteira
    for trecho, palavra, href in LINKS.get(slug, []):
        novo = trecho.replace(palavra, f'<a href="{href}">{palavra}</a>', 1)
        feito = []

        def troca(obj):
            if isinstance(obj, str):
                if trecho in obj and not feito:
                    feito.append(1)
                    return obj.replace(trecho, novo, 1)
                return obj
            if isinstance(obj, list):
                return [troca(x) for x in obj]
            if isinstance(obj, dict):
                return {k: troca(v) for k, v in obj.items()}
            return obj

        dados = troca(dados)
        assert feito, f'trecho do link não encontrado: {trecho}'

    (DOCS / f'{slug}.copy.json').write_text(json.dumps(dados, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'{slug}: copy.json gerado a partir de {arquivo}')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
