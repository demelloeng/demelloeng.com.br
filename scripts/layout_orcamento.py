"""Layout da página Orçamento e cronograma V02 (issue #15). O TEXTO vem da copy aprovada (orcamento-tecnico.copy.json);
aqui só se monta a marcação, com as funções do layout rico (hero, djalma, perguntas).
Usado por gerar-paginas-servico-v02.py quando a copy tem "perfil": "orcamento".
"""
import layout_rico as L

# Composição esquemática da abertura: projeto, planilha e cronograma. Só os três rótulos, todos palavras da copy;
# linhas e barras são genéricas (sem número, data, quantidade ou valor).
VISUAL = '''<svg class="orc-fluxo" viewBox="0 0 440 280" role="img" aria-label="O projeto vira planilha orçamentária e, quando contratado, cronograma com as etapas da obra em barras">
<g class="caixa-orc"><rect x="6" y="40" width="124" height="176" rx="4"/><rect x="164" y="40" width="124" height="176" rx="4"/><rect x="310" y="40" width="124" height="176" rx="4"/></g>
<g class="desenho"><path d="M30 72 h48 l14 14 v86 h-62 z"/><path d="M78 72 v14 h14"/><path d="M42 112 h38 M42 128 h38 M42 144 h26"/></g>
<g class="tabela"><path d="M184 70 h84 M184 92 h84 M184 114 h84 M184 136 h84 M184 158 h84 M184 180 h84"/><path d="M184 70 v110 M240 70 v110 M268 70 v110"/></g>
<g class="barras"><rect x="328" y="74" width="34" height="12" rx="2"/><rect x="344" y="98" width="40" height="12" rx="2"/><rect x="362" y="122" width="36" height="12" rx="2"/><rect x="380" y="146" width="36" height="12" rx="2"/><rect x="392" y="170" width="26" height="12" rx="2"/></g>
<g class="fios"><path d="M132 128 L 158 128"/><path d="M152 122 l7 6 l-7 6"/><path d="M290 128 L 304 128"/><path d="M298 122 l7 6 l-7 6"/></g>
<g class="rotulos"><text x="68" y="244" text-anchor="middle">Projeto</text><text x="226" y="244" text-anchor="middle">Planilha</text><text x="372" y="244" text-anchor="middle">Cronograma</text></g>
</svg>'''


def _itens(bloco, tipo):
    return L._lista(bloco['conteudo'], tipo)['itens']


def _textos(bloco):
    return [c['texto'] for c in bloco['conteudo'] if c['tipo'] in ('paragrafo', 'fecho')]


def situacoes(bloco):
    """As quatro situações de contratação, em cartões."""
    lis = ''.join(
        f'<li><svg viewBox="0 0 24 24" aria-hidden="true">{L.ICONES[i % 4]}</svg>'
        f'<div><h3>{c["titulo"]}</h3><p>{c["texto"]}</p></div></li>' for i, c in enumerate(_itens(bloco, 'cartoes')))
    return (f'<section class="rico-sec wrap" data-block="situations"><div class="rico-cab"><h2>{bloco["titulo"]}</h2><p>{_textos(bloco)[0]}</p></div>'
            f'<ul class="rico-opcoes orc-situacoes">{lis}</ul></section>')


def precisa(bloco):
    """O que o cliente precisa ter: um parágrafo curto."""
    return (f'<section class="rico-sec wrap orc-precisa" data-block="inputs"><h2>{bloco["titulo"]}</h2>'
            f'<div class="rico-corrido rico-estreito"><p>{_textos(bloco)[0]}</p></div></section>')


def recebe(bloco):
    """Os três entregáveis em colunas e o fecho."""
    cols = ''.join(f'<div><h3>{c["titulo"]}</h3><p>{c["texto"]}</p></div>' for c in _itens(bloco, 'cartoes'))
    return (f'<section class="rico-sec rico-muda wrap" data-block="deliverables"><h2>{bloco["titulo"]}</h2>'
            f'<div class="rico-tres">{cols}</div><p class="orc-fecho">{_textos(bloco)[0]}</p></section>')


def etapas(bloco):
    """As cinco etapas, do projeto à decisão. A numeração vem do próprio <ol>, sem algarismo no texto."""
    lis = ''.join(f'<li><span class="ponto"></span><b>{e["titulo"]}</b><em>{e["texto"]}</em></li>' for e in _itens(bloco, 'passos'))
    return (f'<section class="rico-faixa" data-block="budget-process"><div class="wrap"><h2>{bloco["titulo"]}</h2>'
            f'<ol class="rico-etapas orc-etapas" aria-label="{bloco["titulo"]}">{lis}</ol></div></section>')


def distincao(bloco):
    """Orçamento técnico × estimativa do site: dois parágrafos e o par curto em destaque."""
    p = _textos(bloco)
    return (f'<section class="rico-sec wrap" data-block="budget-vs-estimate"><h2>{bloco["titulo"]}</h2>'
            f'<div class="rico-duas"><div class="rico-corrido"><p>{p[0]}</p><p>{p[1]}</p></div>'
            f'<div class="rico-cartao destaque"><p><strong>{p[2]}</strong></p></div></div></section>')


def prova(bloco):
    """Prova técnica: a metragem do acervo só no destaque; a atribuição e a nota da área ficam no texto ao lado."""
    n = L._lista(bloco['conteudo'], 'numero')
    numero = f'<div class="rico-numero orc-numero"><b>{n["valor"]}</b><span>{n["texto"]}</span></div>'
    corpo = ''.join(f'<p>{t}</p>' for t in _textos(bloco))
    return f'<section class="rico-sec wrap" data-block="proof"><h2>{bloco["titulo"]}</h2><div class="rico-duas rico-prova">{numero}<div class="rico-corrido">{corpo}</div></div></section>'


def frente(copia, d, detalhes_html):
    """Página inteira, na ordem da copy aprovada."""
    nv = copia['blocos_novos']
    return '\n'.join([L.hero(copia, d, VISUAL), situacoes(nv['situacoes']), precisa(nv['precisa']), recebe(nv['recebe']),
                      etapas(nv['etapas']), distincao(nv['distincao']), prova(nv['prova']), L.djalma(nv['experiencia'], ''),
                      L.perguntas(nv['perguntas']), detalhes_html])
