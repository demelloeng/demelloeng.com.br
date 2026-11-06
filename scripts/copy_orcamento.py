"""Contrato editorial da página Orçamento e cronograma V02 (issue #15); não muda os perfis anteriores.

Lê a copy aprovada (COPY_ORCAMENTO_CRONOGRAMA_V*_*.md; vigente: V02), estrutura os blocos e recusa fonte incompleta.
Só estrutura: nenhuma palavra do texto é reescrita. Tira apenas o ponto final dos títulos de cartão
e de etapa, que a página mostra como título. A URL histórica /servicos/orcamento-tecnico/ e o
identificador da calculadora (servico=orcamento-tecnico) não mudam.
"""
import re

LABELS = ['TITULO', 'DESCRICAO', 'H1', 'CHAMADA', 'INTRODUCAO', 'SITUACOES', 'O QUE VOCE PRECISA TER',
          'O QUE VOCE RECEBE', 'DO PROJETO A PLANILHA', 'ORCAMENTO OU ESTIMATIVA', 'PROVA TECNICA',
          'EXPERIENCIA APLICADA', 'PERGUNTAS', 'DETALHES DO ESCOPO', 'PROXIMO PASSO',
          'CTA (rotulo)', 'CTA (destino)', 'CTA (micro)']

# Destino da calculadora: o mesmo da página antiga (identificador técnico preservado).
CTA_DESTINO = '../../orcamento/?situacao=known&servico=orcamento-tecnico'
# Único link interno da copy: a página de Compatibilização BIM, em caminho relativo a /servicos/orcamento-tecnico/.
LINKS = {'/servicos/compatibilizacao-bim/': '../compatibilizacao-bim/'}
ORDEM_DETALHES = ['entregaveis', 'como_funciona', 'como_definido', 'escopo_limites']


def paragraphs(s):
    return [x.strip() for x in s.splitlines() if x.strip()]


def link(texto):
    """[rótulo → /caminho/] -> <a href="relativo">rótulo</a>, só para os destinos do contrato."""
    def troca(m):
        if m[2] not in LINKS:
            raise ValueError(f'Link fora do contrato: {m[2]}')
        return f'<a href="{LINKS[m[2]]}">{m[1]}</a>'
    return re.sub(r'\[([^\]→]+?) → ([^\]]+)\]', troca, texto)


def sem_ponto(titulo):
    return titulo[:-1] if titulo.endswith('.') else titulo


def cartoes(linhas, quantidade, bloco):
    """Linhas "- Título. Texto." viram cartões; a quantidade é fixa na copy aprovada."""
    itens = []
    for linha in linhas:
        m = re.fullmatch(r'- (.+?\.) (.+)', linha)
        if not m:
            raise ValueError(f'{bloco}: item fora do contrato: {linha[:50]}')
        itens.append({'titulo': sem_ponto(m[1]), 'texto': m[2]})
    if len(itens) != quantidade:
        raise ValueError(f'{bloco}: exige {quantidade} itens')
    return itens


def parse_copy(text, slug, filename, name):
    matches = list(re.finditer(r'^(' + '|'.join(map(re.escape, LABELS)) + r'):[ \t]*(.*)$', text, re.M))
    keys = [m[1] for m in matches]
    if set(keys) != set(LABELS) or len(keys) != len(LABELS):
        raise ValueError('Copy Orçamento e cronograma incompleta ou rótulo repetido')
    s = {m[1]: (m[2] + '\n' + text[m.end():matches[i + 1].start() if i + 1 < len(matches) else len(text)]).strip()
         for i, m in enumerate(matches)}
    # Recusa rótulos desconhecidos em caixa alta em vez de absorver outra seção.
    for value in s.values():
        if re.search(r'^[A-ZÀ-Ú][A-ZÀ-Ú ()0-9/]+:', value, re.M):
            raise ValueError('Rótulo desconhecido na copy')
    if s['CTA (destino)'] != CTA_DESTINO:
        raise ValueError('O CTA precisa manter o destino da calculadora')

    # Situações: título, linha de apoio e quatro cartões.
    sit = paragraphs(s['SITUACOES'])
    situacoes = cartoes(sit[2:], 4, 'Situações')

    # O que você precisa ter: título e um parágrafo.
    precisa = paragraphs(s['O QUE VOCE PRECISA TER'])
    if len(precisa) != 2:
        raise ValueError('"O que você precisa ter" exige título e um parágrafo')

    # O que você recebe: título, três entregáveis e o fecho.
    rec = paragraphs(s['O QUE VOCE RECEBE'])
    if len(rec) != 5 or rec[-1].startswith('- '):
        raise ValueError('"O que você recebe" exige três itens e o fecho')
    recebe = cartoes(rec[1:4], 3, 'O que você recebe')

    # Do projeto à planilha: título e cinco etapas numeradas.
    cam = paragraphs(s['DO PROJETO A PLANILHA'])
    etapas = []
    for linha in cam[1:]:
        m = re.fullmatch(r'\d+\.\s+(.+?\.)\s+(.+)', linha)
        if not m:
            raise ValueError(f'Etapa fora do contrato: {linha[:50]}')
        etapas.append({'titulo': sem_ponto(m[1]), 'texto': m[2]})
    if len(etapas) != 5:
        raise ValueError('"Do projeto à planilha" exige cinco etapas')

    # Orçamento ou estimativa: título e três parágrafos.
    dist = paragraphs(s['ORCAMENTO OU ESTIMATIVA'])
    if len(dist) != 4:
        raise ValueError('"Orçamento ou estimativa?" exige título e três parágrafos')

    # Prova técnica: título, a linha da metragem (vira o destaque), a atribuição do acervo e a nota da área.
    # A metragem aparece uma vez só na página (Copy V02).
    prova = paragraphs(s['PROVA TECNICA'])
    metragem = re.fullmatch(r'([\d\.]+ m²) (.+)\.', prova[1]) if len(prova) == 4 else None
    if not metragem or re.search(r'\d', prova[2] + prova[3]):
        raise ValueError('A prova técnica exige título, a linha da metragem, a atribuição do acervo e a nota, sem repetir número')

    exp = paragraphs(s['EXPERIENCIA APLICADA'])
    if len(exp) < 2:
        raise ValueError('A experiência aplicada exige título e texto')

    # Perguntas: a pergunta termina em "?", a resposta vem na(s) linha(s) seguinte(s).
    perguntas = []
    for linha in paragraphs(s['PERGUNTAS']):
        if linha.endswith('?'):
            perguntas.append({'pergunta': linha, 'paragrafos': []})
        else:
            if not perguntas:
                raise ValueError('Resposta sem pergunta')
            perguntas[-1]['paragrafos'].append(linha)
    if len(perguntas) != 4 or any(not q['paragrafos'] for q in perguntas):
        raise ValueError('As perguntas exigem quatro itens com resposta')
    for q in perguntas:
        q['resposta'] = '</p><p>'.join(q['paragrafos'])

    # Detalhes do escopo: resumo e quatro itens ("- Título: texto").
    det = paragraphs(s['DETALHES DO ESCOPO'])
    itens = []
    for linha in det[1:]:
        titulo, _, corpo = linha[2:].partition(': ')
        if not linha.startswith('- ') or not corpo:
            raise ValueError(f'Detalhe fora do contrato: {linha[:50]}')
        itens.append({'titulo': titulo, 'texto': corpo})
    if len(itens) != 4:
        raise ValueError('Os detalhes do escopo exigem quatro itens')

    # Próximo passo: abertura, parágrafo e a linha com o link para Compatibilização BIM.
    prox = [link(x) for x in paragraphs(s['PROXIMO PASSO'])]
    if len(prox) != 3 or prox[2].count('<a href=') != 1:
        raise ValueError('O próximo passo exige três linhas e o link para Compatibilização BIM')

    def para(texto):
        return {'tipo': 'paragrafo', 'texto': texto}

    blocos = {
        'situacoes': {'titulo': sit[0], 'conteudo': [para(sit[1]), {'tipo': 'cartoes', 'itens': situacoes}]},
        'precisa': {'titulo': precisa[0], 'conteudo': [para(precisa[1])]},
        'recebe': {'titulo': rec[0], 'conteudo': [{'tipo': 'cartoes', 'itens': recebe}, {'tipo': 'fecho', 'texto': rec[-1]}]},
        'etapas': {'titulo': cam[0], 'conteudo': [{'tipo': 'passos', 'itens': etapas}]},
        'distincao': {'titulo': dist[0], 'conteudo': [para(x) for x in dist[1:]]},
        'prova': {'titulo': prova[0], 'conteudo': [{'tipo': 'numero', 'valor': metragem[1], 'texto': metragem[2]}, para(prova[2]), para(prova[3])]},
        'experiencia': {'titulo': exp[0], 'conteudo': [para(x) for x in exp[1:]]},
        'perguntas': {'titulo': 'Perguntas frequentes', 'conteudo': [{'tipo': 'perguntas', 'itens': perguntas}]},
    }
    for chave, item in zip(ORDEM_DETALHES, itens):
        blocos[chave] = {'titulo': item['titulo'], 'conteudo': [para(item['texto'])]}

    return {
        'slug': slug, 'nome_servico': name, 'fonte_copy': filename, 'layout': 'rico', 'perfil': 'orcamento',
        'titulo_pagina': s['TITULO'], 'descricao': s['DESCRICAO'], 'h1': s['H1'], 'chamada': s['CHAMADA'],
        'introducao': [s['INTRODUCAO']],
        # O HTML guarda o "&" escapado, como a página antiga.
        'cta': {'rotulo': s['CTA (rotulo)'], 'micro': s['CTA (micro)'], 'href': CTA_DESTINO.replace('&', '&amp;')},
        'blocos_novos': blocos,
        # A página é montada por layout_orcamento; a ordem só informa o grupo recolhível ao gerador comum.
        'ordem': [{'detalhes': {'titulo': 'Detalhes do escopo', 'resumo': det[0], 'blocos': ORDEM_DETALHES}}],
        'proximo_passo': {'titulo': 'Próximo passo', 'paragrafos': prox},
        'notas_editoriais': [], 'removidos': [],
    }
