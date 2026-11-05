"""Layout da página Regularização V02 (issue #16). O TEXTO vem da copy aprovada (regularizacao.copy.json);
aqui só se monta a marcação, com as funções do layout rico (hero, djalma, perguntas).
Usado por gerar-paginas-servico-v02.py quando a copy tem "perfil": "regularizacao".
"""
import layout_rico as L

# Composição estática: o que a página compara e o caminho até o documento. Os rótulos usam só palavras da copy.
VISUAL = '''<svg class="reg-fluxo" viewBox="0 0 440 280" role="img" aria-label="Matrícula, IPTU, projeto e o imóvel existente passam pelo levantamento, seguem para a prefeitura e chegam ao Habite-se">
<g class="entrada"><rect x="8" y="14" width="120" height="46" rx="4"/><text x="68" y="43" text-anchor="middle">Matrícula</text>
<rect x="8" y="80" width="120" height="46" rx="4"/><text x="68" y="109" text-anchor="middle">IPTU</text>
<rect x="8" y="146" width="120" height="46" rx="4"/><text x="68" y="175" text-anchor="middle">Projeto</text>
<rect x="8" y="212" width="120" height="46" rx="4"/><text x="68" y="241" text-anchor="middle">Imóvel</text></g>
<g class="fios"><path d="M128 37 C 146 37, 146 140, 164 140"/><path d="M128 103 C 146 103, 146 140, 164 140"/><path d="M128 169 C 146 169, 146 140, 164 140"/><path d="M128 235 C 146 235, 146 140, 164 140"/>
<path d="M292 140 C 308 140, 308 56, 324 56"/><path d="M378 84 L 378 196"/><path d="M378 196 l -6 -9 M378 196 l 6 -9"/></g>
<g class="centro"><rect x="164" y="96" width="128" height="88" rx="4"/><text x="228" y="146" text-anchor="middle">Levantamento</text></g>
<g class="saida"><rect x="324" y="28" width="108" height="56" rx="4"/><text x="378" y="62" text-anchor="middle">Prefeitura</text>
<rect x="324" y="196" width="108" height="56" rx="4"/><text x="378" y="230" text-anchor="middle">Habite-se</text></g>
</svg>'''


def _itens(bloco, tipo):
    return L._lista(bloco['conteudo'], tipo)['itens']


def _texto(bloco, indice=0):
    return [c['texto'] for c in bloco['conteudo'] if c['tipo'] in ('paragrafo', 'fecho')][indice]


def situacoes(bloco):
    """Bloco 02: as seis situações da calculadora, em cartões."""
    lis = ''.join(
        f'<li><svg viewBox="0 0 24 24" aria-hidden="true">{L.ICONES[i % 4]}</svg>'
        f'<div><h3>{c["titulo"]}</h3><p>{c["texto"]}</p></div></li>' for i, c in enumerate(_itens(bloco, 'cartoes')))
    return (f'<section class="rico-sec wrap" data-block="situations"><div class="rico-cab"><h2>{bloco["titulo"]}</h2><p>{_texto(bloco)}</p></div>'
            f'<ul class="rico-opcoes reg-situacoes">{lis}</ul></section>')


def contextos(bloco):
    """Bloco 03: venda, Caixa, Minha Casa Minha Vida e herança, com o fecho."""
    cartoes = ''.join(f'<article><h3>{c["titulo"]}</h3><p>{c["texto"]}</p></article>' for c in _itens(bloco, 'cartoes'))
    return (f'<section class="rico-sec wrap reg-contextos" data-block="contexts"><div class="rico-cab"><h2>{bloco["titulo"]}</h2><p>{_texto(bloco)}</p></div>'
            f'<div class="reg-grade">{cartoes}</div><p class="reg-fecho">{_texto(bloco, 1)}</p></section>')


def etapas(bloco):
    """Bloco 04: as cinco etapas, a averbação em destaque e o parágrafo do município."""
    lis = ''.join(f'<li><span class="ponto"></span><b>{e["titulo"]}</b><em>{e["texto"]}</em></li>' for e in _itens(bloco, 'passos'))
    averbacao, municipio = _texto(bloco, 0), _texto(bloco, 1)
    lead, _, resto = averbacao.partition('? ')
    return (f'<section class="rico-faixa" data-block="regularization-process"><div class="wrap"><h2>{bloco["titulo"]}</h2>'
            f'<ol class="rico-etapas reg-etapas" aria-label="{bloco["titulo"]}">{lis}</ol>'
            f'<div class="rico-duas"><div class="rico-cartao destaque"><p><strong>{lead}?</strong> {resto}</p></div>'
            f'<div class="rico-corrido"><p>{municipio}</p></div></div></div></section>')


def faz(bloco):
    """Bloco 05: o que a DEMELLO entrega e conduz; os links internos ficam no cartão."""
    p = [c['texto'] for c in bloco['conteudo']]
    return (f'<section class="rico-sec wrap" data-block="regularization-service"><h2>{bloco["titulo"]}</h2>'
            f'<div class="rico-duas"><div class="rico-corrido"><p>{p[0]}</p><p>{p[1]}</p></div>'
            f'<div class="rico-cartao reg-links"><p>{p[2]}</p></div></div></section>')


def frente(copia, d, detalhes_html):
    """Página inteira, na ordem da copy: hero, 02 a 07 e o grupo recolhível do Bloco 08."""
    nv = copia['blocos_novos']
    return '\n'.join([L.hero(copia, d, VISUAL), situacoes(nv['situacoes']), contextos(nv['contextos']), etapas(nv['etapas']),
                      faz(nv['faz']), L.djalma(nv['experiencia'], ''), L.perguntas(nv['perguntas']), detalhes_html])
