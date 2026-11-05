"""Contrato editorial da página Regularização V02 (issue #16); não muda os perfis anteriores.

Lê a copy aprovada (COPY_REGULARIZACAO_V02_*.md), estrutura os blocos e recusa fonte incompleta.
Só estrutura: nenhuma palavra do texto é reescrita. Tira apenas o ponto final dos títulos de cartão
e de etapa, que a página mostra como título.
"""
import re

LABELS = ['TITULO', 'DESCRICAO', 'H1', 'CHAMADA', 'INTRODUCAO', 'SITUACOES', 'QUANDO A PENDENCIA APARECE',
          'DO PROBLEMA AO DOCUMENTO', 'O QUE A DEMELLO FAZ', 'EXPERIENCIA APLICADA', 'PERGUNTAS',
          'DETALHES DO ESCOPO', 'PROXIMO PASSO', 'CTA (rotulo)', 'CTA (micro, mantido)']

CTA_HREF = '../../orcamento/?situacao=regularize'
# Links internos da copy: só estes três destinos existem no Bloco 05.
LINKS_ESPERADOS = ['../projeto-arquitetura/', '../../construir-ou-ampliar/', '../../avaliar-um-problema/']
ORDEM_DETALHES = ['entregaveis', 'como_funciona', 'como_definido', 'escopo_limites']


def paragraphs(s):
    return [x.strip() for x in s.splitlines() if x.strip()]


def link(texto):
    """[rótulo](destino) -> <a href="destino">rótulo</a>, só para os destinos esperados."""
    def troca(m):
        if m[2] not in LINKS_ESPERADOS:
            raise ValueError(f'Link fora do contrato: {m[2]}')
        return f'<a href="{m[2]}">{m[1]}</a>'
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)', troca, texto)


def sem_ponto(titulo):
    return titulo[:-1] if titulo.endswith('.') else titulo


def parse_copy(text, slug, filename, name):
    matches = list(re.finditer(r'^(' + '|'.join(map(re.escape, LABELS)) + r'):[ \t]*(.*)$', text, re.M))
    keys = [m[1] for m in matches]
    if set(keys) != set(LABELS) or len(keys) != len(LABELS):
        raise ValueError('Copy Regularização incompleta ou rótulo repetido')
    s = {m[1]: (m[2] + '\n' + text[m.end():matches[i + 1].start() if i + 1 < len(matches) else len(text)]).strip()
         for i, m in enumerate(matches)}
    # Recusa rótulos desconhecidos em caixa alta em vez de absorver outra seção.
    for value in s.values():
        if re.search(r'^[A-ZÀ-Ú][A-ZÀ-Ú ()0-9/]+:', value, re.M):
            raise ValueError('Rótulo desconhecido na copy')

    # Bloco 02: título, linha de apoio e seis situações ("- Título. Texto.").
    sit = paragraphs(s['SITUACOES'])
    cartoes = []
    for linha in sit[2:]:
        m = re.fullmatch(r'- (.+?\.) (.+)', linha)
        if not m:
            raise ValueError(f'Situação fora do contrato: {linha[:50]}')
        cartoes.append({'titulo': sem_ponto(m[1]), 'texto': m[2]})
    if len(cartoes) != 6:
        raise ValueError('O Bloco 02 exige seis situações')

    # Bloco 03: título, abertura, quatro contextos ("- Título: texto") e o fecho (última linha).
    ctx = paragraphs(s['QUANDO A PENDENCIA APARECE'])
    contextos = []
    for linha in ctx[2:]:
        if not linha.startswith('- '):
            continue
        titulo, _, corpo = linha[2:].partition(': ')
        if not corpo:
            raise ValueError(f'Contexto fora do contrato: {linha[:50]}')
        contextos.append({'titulo': titulo, 'texto': corpo})
    fecho = ctx[-1]
    if len(contextos) != 4 or fecho.startswith('- '):
        raise ValueError('O Bloco 03 exige quatro contextos e um fecho')

    # Bloco 04: título, cinco etapas numeradas e dois parágrafos.
    cam = paragraphs(s['DO PROBLEMA AO DOCUMENTO'])
    etapas = []
    for linha in cam[1:]:
        m = re.fullmatch(r'\d+\.\s+(.+?\.)\s+(.+)', linha)
        if m:
            etapas.append({'titulo': sem_ponto(m[1]), 'texto': m[2]})
    resto = [x for x in cam[1:] if not re.match(r'\d+\.\s', x)]
    if len(etapas) != 5 or len(resto) != 2 or not resto[0].startswith('E a averbação?'):
        raise ValueError('O Bloco 04 exige cinco etapas, a averbação e o parágrafo do município')

    # Bloco 05: três parágrafos; o último leva os três links internos.
    faz = [link(x) for x in paragraphs(s['O QUE A DEMELLO FAZ'])]
    if len(faz) != 3 or faz[2].count('<a href=') != 3:
        raise ValueError('O Bloco 05 exige três parágrafos e três links')

    # Bloco 06: título e parágrafos.
    exp = paragraphs(s['EXPERIENCIA APLICADA'])

    # Bloco 07: pergunta termina em "?", a resposta vem na(s) linha(s) seguinte(s).
    perguntas = []
    for linha in paragraphs(s['PERGUNTAS']):
        if linha.endswith('?'):
            perguntas.append({'pergunta': linha, 'paragrafos': []})
        else:
            if not perguntas:
                raise ValueError('Resposta sem pergunta')
            perguntas[-1]['paragrafos'].append(linha)
    if len(perguntas) != 8 or any(not q['paragrafos'] for q in perguntas):
        raise ValueError('O FAQ exige oito perguntas com resposta')
    for q in perguntas:
        q['resposta'] = '</p><p>'.join(q['paragrafos'])

    # Bloco 08: resumo e quatro itens ("- Título: texto").
    det = paragraphs(s['DETALHES DO ESCOPO'])
    itens = []
    for linha in det[1:]:
        titulo, _, corpo = linha[2:].partition(': ')
        if not linha.startswith('- ') or not corpo:
            raise ValueError(f'Detalhe fora do contrato: {linha[:50]}')
        itens.append({'titulo': titulo, 'texto': corpo})
    if len(itens) != 4:
        raise ValueError('O Bloco 08 exige quatro itens')

    prox = paragraphs(s['PROXIMO PASSO'])
    if len(prox) != 2:
        raise ValueError('O Bloco 09 exige a linha de abertura e o parágrafo')

    def para(texto):
        return {'tipo': 'paragrafo', 'texto': texto}

    blocos = {
        'situacoes': {'titulo': sit[0], 'conteudo': [para(sit[1]), {'tipo': 'cartoes', 'itens': cartoes}]},
        'contextos': {'titulo': ctx[0], 'conteudo': [para(ctx[1]), {'tipo': 'cartoes', 'itens': contextos}, {'tipo': 'fecho', 'texto': fecho}]},
        'etapas': {'titulo': cam[0], 'conteudo': [{'tipo': 'passos', 'itens': etapas}, para(resto[0]), para(resto[1])]},
        'faz': {'titulo': 'O que a DEMELLO faz', 'conteudo': [para(x) for x in faz]},
        'experiencia': {'titulo': exp[0], 'conteudo': [para(x) for x in exp[1:]]},
        'perguntas': {'titulo': 'Perguntas frequentes', 'conteudo': [{'tipo': 'perguntas', 'itens': perguntas}]},
    }
    for chave, item in zip(ORDEM_DETALHES, itens):
        blocos[chave] = {'titulo': item['titulo'], 'conteudo': [para(item['texto'])]}

    return {
        'slug': slug, 'nome_servico': name, 'fonte_copy': filename, 'layout': 'rico', 'perfil': 'regularizacao',
        'titulo_pagina': s['TITULO'], 'descricao': s['DESCRICAO'], 'h1': s['H1'], 'chamada': s['CHAMADA'],
        'introducao': [s['INTRODUCAO']],
        'cta': {'rotulo': s['CTA (rotulo)'], 'micro': s['CTA (micro, mantido)'], 'href': CTA_HREF},
        'blocos_novos': blocos,
        # A página é montada por layout_regularizacao; a ordem só informa o grupo recolhível ao gerador comum.
        'ordem': [{'detalhes': {'titulo': 'Detalhes do escopo', 'resumo': det[0], 'blocos': ORDEM_DETALHES}}],
        'proximo_passo': {'titulo': 'Próximo passo', 'paragrafos': prox},
        'notas_editoriais': [], 'removidos': [],
    }
