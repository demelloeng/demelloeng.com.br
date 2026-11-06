"""Contrato editorial da página Compatibilização BIM V02 (issue #15); não muda os perfis anteriores.

Lê a copy aprovada (COPY_COMPATIBILIZACAO_BIM_V*_*.md; vigente: V02), estrutura os blocos e recusa fonte incompleta.
Só estrutura: nenhuma palavra do texto é reescrita. Tira apenas o ponto final dos títulos de cartão e de etapa
e o algarismo das etapas, que a página mostra pela própria lista numerada. A URL /servicos/compatibilizacao-bim/
e o identificador da calculadora (servico=compatibilizacao) não mudam.
"""
import re

LABELS = ['TITULO', 'DESCRICAO', 'H1', 'CHAMADA', 'INTRODUCAO', 'SITUACOES', 'O QUE MUDA', 'O QUE A DEMELLO FAZ',
          'INTERFACES', 'EXPERIENCIA APLICADA', 'PERGUNTAS', 'DETALHES DO ESCOPO', 'PROXIMO PASSO',
          'CTA (rotulo)', 'CTA (destino)', 'CTA (micro)']

# Destino da calculadora: o mesmo da página antiga (identificador técnico preservado).
CTA_DESTINO = '../../orcamento/?situacao=known&servico=compatibilizacao'
# Links internos da copy, em caminho relativo a /servicos/compatibilizacao-bim/.
LINKS = {'/metodologia/': '../../metodologia/', '/servicos/orcamento-tecnico/': '../orcamento-tecnico/'}
# Os dois casos de responsabilidade técnica da seção "O que a DEMELLO faz" (texto aprovado, intacto).
CASOS = ('Projeto de outro profissional:', 'Projeto sob responsabilidade técnica da DEMELLO:')


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


def lista(linhas, quantidade, bloco):
    """Linhas "- item" viram a lista; a quantidade é fixa na copy aprovada."""
    if len(linhas) != quantidade or any(not x.startswith('- ') for x in linhas):
        raise ValueError(f'{bloco}: exige {quantidade} itens')
    return [x[2:] for x in linhas]


def parse_copy(text, slug, filename, name):
    matches = list(re.finditer(r'^(' + '|'.join(map(re.escape, LABELS)) + r'):[ \t]*(.*)$', text, re.M))
    keys = [m[1] for m in matches]
    if set(keys) != set(LABELS) or len(keys) != len(LABELS):
        raise ValueError('Copy Compatibilização BIM incompleta ou rótulo repetido')
    s = {m[1]: (m[2] + '\n' + text[m.end():matches[i + 1].start() if i + 1 < len(matches) else len(text)]).strip()
         for i, m in enumerate(matches)}
    # Recusa rótulos desconhecidos em caixa alta em vez de absorver outra seção.
    for value in s.values():
        if re.search(r'^[A-ZÀ-Ú][A-ZÀ-Ú ()0-9/]+:', value, re.M):
            raise ValueError('Rótulo desconhecido na copy')
    if s['CTA (destino)'] != CTA_DESTINO:
        raise ValueError('O CTA precisa manter o destino da calculadora')
    if 'BIM é a ferramenta' in text:
        raise ValueError('"BIM é a ferramenta" saiu da copy aprovada (BIM é metodologia)')

    intro = paragraphs(s['INTRODUCAO'])
    if len(intro) != 2:
        raise ValueError('A introdução exige dois parágrafos')

    # 2. Quando vale compatibilizar: título, linha de apoio e cinco situações.
    sit = paragraphs(s['SITUACOES'])
    situacoes = lista(sit[2:], 5, 'Situações')

    # 3. O que muda para você: título e três cartões "- Título. Texto."
    mud = paragraphs(s['O QUE MUDA'])
    muda = []
    for linha in mud[1:]:
        m = re.fullmatch(r'- (.+?\.) (.+)', linha)
        if not m:
            raise ValueError(f'O que muda: item fora do contrato: {linha[:50]}')
        muda.append({'titulo': sem_ponto(m[1]), 'texto': m[2]})
    if len(muda) != 3:
        raise ValueError('"O que muda para você" exige três itens')

    # 4. O que a DEMELLO faz: título, abertura, cinco atividades, os dois casos e o fecho.
    faz = paragraphs(s['O QUE A DEMELLO FAZ'])
    if len(faz) != 10:
        raise ValueError('"O que a DEMELLO faz" exige título, abertura, cinco itens, dois casos e o fecho')
    atividades = lista(faz[2:7], 5, 'O que a DEMELLO faz')
    casos = []
    for linha, rotulo in zip(faz[7:9], CASOS):
        if not linha.startswith(rotulo + ' '):
            raise ValueError(f'Caso de responsabilidade técnica fora do contrato: {linha[:50]}')
        casos.append({'titulo': rotulo, 'texto': linha[len(rotulo) + 1:]})

    # 5. Das interfaces às decisões coordenadas: título, quatro etapas numeradas e o fecho.
    cam = paragraphs(s['INTERFACES'])
    etapas = []
    for linha in cam[1:-1]:
        m = re.fullmatch(r'\d+\.\s+(.+?\.)\s+(.+)', linha)
        if not m:
            raise ValueError(f'Etapa fora do contrato: {linha[:50]}')
        etapas.append({'titulo': sem_ponto(m[1]), 'texto': m[2]})
    if len(etapas) != 4 or re.match(r'\d+\.', cam[-1]):
        raise ValueError('"Das interfaces às decisões coordenadas" exige quatro etapas e o fecho')

    # 6. Experiência aplicada: título, três parágrafos e a nota de acervo.
    exp = paragraphs(s['EXPERIENCIA APLICADA'])
    if len(exp) != 5 or not exp[4].startswith('Nota: '):
        raise ValueError('A experiência aplicada exige título, três parágrafos e a nota')

    # 7. Perguntas: a pergunta termina em "?", a resposta vem na(s) linha(s) seguinte(s).
    perguntas = []
    for linha in paragraphs(s['PERGUNTAS']):
        if linha.endswith('?'):
            perguntas.append({'pergunta': linha, 'paragrafos': []})
        else:
            if not perguntas:
                raise ValueError('Resposta sem pergunta')
            perguntas[-1]['paragrafos'].append(link(linha))
    if len(perguntas) != 5 or any(not q['paragrafos'] for q in perguntas):
        raise ValueError('As perguntas exigem cinco itens com resposta')
    links = [h for q in perguntas for p in q['paragrafos'] for h in re.findall(r'<a href="([^"]+)"', p)]
    if sorted(links) != sorted(LINKS.values()):
        raise ValueError('As perguntas levam os dois links do contrato, uma vez cada')
    for q in perguntas:
        q['resposta'] = '</p><p>'.join(q['paragrafos'])

    # 8. Detalhes do escopo: título, abertura, seis itens e o parágrafo da estimativa.
    det = paragraphs(s['DETALHES DO ESCOPO'])
    if len(det) != 9 or not det[8].startswith('Como funciona a estimativa: '):
        raise ValueError('Os detalhes do escopo exigem título, abertura, seis itens e a estimativa')
    escopo = lista(det[2:8], 6, 'Detalhes do escopo')
    estimativa_rotulo = 'Como funciona a estimativa:'
    estimativa = det[8][len(estimativa_rotulo) + 1:]

    # 9. Próximo passo: uma linha.
    prox = paragraphs(s['PROXIMO PASSO'])
    if len(prox) != 1:
        raise ValueError('O próximo passo exige uma linha')

    def para(texto):
        return {'tipo': 'paragrafo', 'texto': texto}

    blocos = {
        'situacoes': {'titulo': sit[0], 'conteudo': [para(sit[1]), {'tipo': 'lista', 'itens': situacoes}]},
        'muda': {'titulo': mud[0], 'conteudo': [{'tipo': 'beneficios', 'itens': muda}]},
        'faz': {'titulo': faz[0], 'conteudo': [para(faz[1]), {'tipo': 'lista', 'itens': atividades},
                                               {'tipo': 'casos', 'itens': casos}, {'tipo': 'fecho', 'texto': faz[9]}]},
        'etapas': {'titulo': cam[0], 'conteudo': [{'tipo': 'passos', 'itens': etapas}, {'tipo': 'fecho', 'texto': cam[-1]}]},
        'experiencia': {'titulo': exp[0], 'conteudo': [para(x) for x in exp[1:4]] + [{'tipo': 'nota', 'texto': exp[4][len('Nota: '):]}]},
        'perguntas': {'titulo': 'Perguntas frequentes', 'conteudo': [{'tipo': 'perguntas', 'itens': perguntas}]},
        'escopo': {'titulo': det[0], 'conteudo': [para(det[1]), {'tipo': 'lista', 'itens': escopo},
                                                  {'tipo': 'estimativa', 'titulo': estimativa_rotulo, 'texto': estimativa}]},
    }

    return {
        'slug': slug, 'nome_servico': name, 'fonte_copy': filename, 'layout': 'rico', 'perfil': 'compatibilizacao',
        'titulo_pagina': s['TITULO'], 'descricao': s['DESCRICAO'], 'h1': s['H1'], 'chamada': s['CHAMADA'],
        'introducao': intro,
        # O HTML guarda o "&" escapado, como a página antiga.
        'cta': {'rotulo': s['CTA (rotulo)'], 'micro': s['CTA (micro)'], 'href': CTA_DESTINO.replace('&', '&amp;')},
        'blocos_novos': blocos,
        # A página é montada por layout_compatibilizacao; sem grupo recolhível (os detalhes ficam visíveis).
        'ordem': [],
        'proximo_passo': {'titulo': 'Próximo passo', 'paragrafos': prox},
        'notas_editoriais': [], 'removidos': [],
    }
