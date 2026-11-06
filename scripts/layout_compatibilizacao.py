"""Layout da página Compatibilização BIM V02 (issue #15). O TEXTO vem da copy aprovada (compatibilizacao-bim.copy.json);
aqui só se monta a marcação, com as funções do layout rico (hero, para_quem, muda, perguntas).
Usado por gerar-paginas-servico-v02.py quando a copy tem "perfil": "compatibilizacao".
"""
import layout_rico as L

# Composição esquemática da abertura: as três disciplinas da copy (arquitetura, estrutura e instalações) se sobrepõem,
# e o que fica na sobreposição são as interfaces. Só quatro rótulos, todos palavras da copy; sem número, software,
# modelo único ou entrega presumida.
VISUAL = '''<svg class="bim-interfaces" viewBox="0 0 440 320" role="img" aria-label="Arquitetura, estrutura e instalações dividem o mesmo espaço; onde elas se cruzam ficam as interfaces">
<g class="disciplinas"><circle cx="220" cy="118" r="92"/><circle cx="160" cy="214" r="92"/><circle cx="280" cy="214" r="92"/></g>
<g class="centro"><circle cx="220" cy="182" r="30"/></g>
<g class="rotulos"><text x="220" y="62" text-anchor="middle">Arquitetura</text><text x="112" y="260" text-anchor="middle">Estrutura</text><text x="328" y="260" text-anchor="middle">Instalações</text></g>
<text class="t-centro" x="220" y="188" text-anchor="middle">Interfaces</text>
</svg>'''


def _item(bloco, tipo):
    return L._lista(bloco['conteudo'], tipo)


def faz(bloco):
    """A atuação: abertura e as cinco atividades; ao lado, os dois casos de responsabilidade técnica; o fecho embaixo."""
    abertura = _item(bloco, 'paragrafo')['texto']
    lis = ''.join(f'<li>{x}</li>' for x in _item(bloco, 'lista')['itens'])
    casos = _item(bloco, 'casos')['itens']
    cartoes = ''.join(f'<div class="rico-cartao{" destaque" if i else ""}"><p><strong>{c["titulo"]}</strong> {c["texto"]}</p></div>'
                      for i, c in enumerate(casos))
    return (f'<section class="rico-sec wrap" data-block="coordination"><h2>{bloco["titulo"]}</h2>'
            f'<div class="rico-duas"><div class="rico-corrido"><p>{abertura}</p><ul class="lista bim-atividades">{lis}</ul></div>'
            f'<div class="rico-cartoes bim-casos">{cartoes}</div></div>'
            f'<p class="bim-fecho">{_item(bloco, "fecho")["texto"]}</p></section>')


def etapas(bloco):
    """As quatro etapas de referência. A numeração vem do próprio <ol>, sem algarismo no texto."""
    lis = ''.join(f'<li><span class="ponto"></span><b>{e["titulo"]}</b><em>{e["texto"]}</em></li>' for e in _item(bloco, 'passos')['itens'])
    return (f'<section class="rico-faixa" data-block="coordination-process"><div class="wrap"><h2>{bloco["titulo"]}</h2>'
            f'<ol class="rico-etapas bim-etapas" aria-label="{bloco["titulo"]}">{lis}</ol>'
            f'<p class="bim-nota-etapas">{_item(bloco, "fecho")["texto"]}</p></div></section>')


def experiencia(bloco):
    """Experiência aplicada: os três parágrafos e a nota de acervo, como na página Construir ou ampliar."""
    ps = ''.join(f'<p>{c["texto"]}</p>' for c in bloco['conteudo'] if c['tipo'] == 'paragrafo')
    nota = _item(bloco, 'nota')['texto']
    return (f'<section class="rico-sec wrap" data-block="applied-experience"><h2>{bloco["titulo"]}</h2>'
            f'<div class="rico-corrido rico-estreito">{ps}<p class="nota">{nota}</p></div></section>')


def escopo(bloco):
    """Detalhes do escopo, visíveis: o que define o escopo e, ao lado, como funciona a estimativa."""
    abertura = _item(bloco, 'paragrafo')['texto']
    lis = ''.join(f'<li>{x}</li>' for x in _item(bloco, 'lista')['itens'])
    est = _item(bloco, 'estimativa')
    return (f'<section class="rico-sec wrap" data-block="scope-details"><h2>{bloco["titulo"]}</h2>'
            f'<div class="rico-duas"><div class="rico-corrido"><p>{abertura}</p><ul class="lista">{lis}</ul></div>'
            f'<div class="rico-cartao bim-estimativa"><p><strong>{est["titulo"]}</strong> {est["texto"]}</p></div></div></section>')


def frente(copia, d):
    """Página inteira, na ordem das nove seções da copy aprovada (a nona, Próximo passo, é o fechamento comum)."""
    nv = copia['blocos_novos']
    return '\n'.join([L.hero(copia, d, VISUAL), L.para_quem(nv['situacoes']), L.muda(nv['muda']), faz(nv['faz']),
                      etapas(nv['etapas']), experiencia(nv['experiencia']), L.perguntas(nv['perguntas']), escopo(nv['escopo'])])
