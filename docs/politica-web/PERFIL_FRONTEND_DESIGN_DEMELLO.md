# Perfil DEMELLO para o frontend-design

Como aplicar a skill oficial `frontend-design` (Anthropic, cópia rastreável em `.agents/skills/frontend-design/`) neste site.
Regra geral: `integrations/agents/CONDUTA_AGENTES.md` §4 do canônico. `python scripts/capacidades.py usar frontend-design <nível>` mostra o bloco do nível e grava a evidência.

**A skill é obrigatória em toda alteração frontend; o que varia é a profundidade.** Ela foi escrita para criar identidades novas ("tome risco estético"). Aqui ela trabalha **dentro** de uma identidade já aprovada: o que a skill ensina sobre tipografia, hierarquia, espaçamento, estados e composição vira critério de **auditoria** nos níveis N1 e N2. Só o N3 compõe, e só por ordem de Marcos.

## O que nenhum nível autoriza

- Redesenhar página aprovada, trocar a paleta ou a tipografia, mudar a copy (o texto sai da copy central e do gerador, nunca do HTML) ou ampliar o escopo pedido.
- Trocar fonte ou cor fora do design system: fontes `Montserrat` (`--font`) e `Source Sans 3` (`--fonte`); cores pelas variáveis existentes (`--ink #0A2D55`, `--navy #0B345C`, `--navy-900 #071F3A`, `--steel #0D65C2`, `--primary-700 #0A54A2`, `--body #405C78`, `--muted #5B7086`, `--line #D2E1EF`, `--paper #F7FBFF`, `--sky #C9E7FF`, `--carimbo #B42318`).
- Mexer em modelos `.glb`/`.json` das maquetes (decisão 103) ou em página que não está no pedido.

Achado fora do escopo vira lista para Marcos, separando **regressão** (piorou com a mudança) de **conformidade atual** (já era assim).

## N1 manutenção (ajuste de CSS, defeito em JS existente, gerador)

Auditoria de consistência, sem compor nada novo:
1. O trecho alterado usa as variáveis de cor e fonte do design system, sem valor solto.
2. Espaçamento, raio, sombra e tamanho de fonte repetem o que a própria página já usa no mesmo tipo de elemento.
3. Estados (hover, foco visível, desabilitado, carregando) existem e seguem os vizinhos.
4. Nada fora do trecho mudou: conferir `git diff` e a regressão visual (`tests/visual`).

## N2 componente ou interação nova (modal, foco, animação, WebGL)

Tudo do N1, mais:
1. Hierarquia: o componente não compete com o título nem com a chamada principal da página.
2. Movimento com propósito e respeito a `prefers-reduced-motion`; sem animação decorativa nova.
3. Interação por teclado e leitor de tela: abrir, navegar, fechar com Escape, foco que volta para quem abriu.
4. Teste headless da interação em `tests/visual` (CONDUTA §5, exceção em 127.0.0.1).

## N3 página ou visual novo (só por ordem de Marcos)

1. Composição com os princípios da skill, **dentro** do design system DEMELLO (fonte e cores acima).
2. Uma tela por vez, com aceite de Marcos antes da seguinte.
3. Imagens antes e depois (390 px e 1280 px) para o aceite; a regressão visual das demais páginas fica em zero.
