# Governança de capacidades no site

Regra: `integrations/agents/CONDUTA_AGENTES.md` §4 e §5 do repositório canônico (privado). Este repositório é público e não depende dele: o manifesto `capacidades.site.json` e o executor `scripts/capacidades.py` são gerados lá (`python scripts/capacidades.py gerar-site <site>`) e versionados aqui, sem caminho local nem dado privado. Não se editam aqui.

## Antes de alterar frontend (HTML, CSS, JS/MJS, JSX, shader, geradores e layouts)

Na raiz desta worktree:

```sh
python scripts/capacidades.py usar mwg "light dismiss dialog"      # busca (2 a 5 palavras, uma capacidade)
python scripts/capacidades.py usar mwg --retrieve <id>,<id>        # lê os guias: grava a evidência
python scripts/capacidades.py usar frontend-design N1              # N1, N2 ou N3: perfil DEMELLO + evidência
python scripts/capacidades.py checar servicos/x/index.html         # confere se pode editar
```

As **duas** skills são obrigatórias; o nível (N1 manutenção, N2 interação nova, N3 visual novo só por ordem de Marcos) define a profundidade. Perfil: [PERFIL_FRONTEND_DESIGN_DEMELLO.md](PERFIL_FRONTEND_DESIGN_DEMELLO.md). Nenhum nível autoriza redesenhar o aprovado, mudar copy ou ampliar escopo.

A evidência vale nesta worktree, nesta branch, por 12 horas, numa revisão descendente da registrada e na versão aprovada ou acima. Ela comprova **consulta**, não aplicação: a aplicação se confere pelos testes headless e pela revisão.

## O que confere

| Camada | Onde | Efeito |
|---|---|---|
| Hook do Claude Code | `~/.claude/hooks/capacidades/` (nível do usuário, filtra pelo caminho do arquivo) | bloqueia a edição sem evidência, inclusive numa sessão aberta no canônico, e o MWG do Claude abaixo do aprovado |
| Hook do Codex | `~/.codex/hooks/capacidades/` | a mesma decisão para `apply_patch` e shell (vale depois de Marcos confiar na hook no app) |
| Git hooks | `.githooks/` (`git config core.hooksPath .githooks`, uma vez por clone) | `pre-commit` recusa commit frontend sem evidência; `commit-msg` acrescenta o trailer `Capacidades:` |
| Gate do PR | `.github/workflows/pr-gate.yml` | mesmos testes do `pages.yml` e a deriva da lista; trailers e versões; mapa atualizado na mudança estrutural; headless (acessibilidade, maquetes V03, regressão visual contra a base) |
| Proteção da `main` | configuração do GitHub | torna o gate obrigatório; ativa só depois de o gate passar num PR |

Hooks locais são preventivas e o shell é visto por heurística; o gate do PR é a barreira independente. Isenção: `python scripts/capacidades.py isentar --motivo "<ordem de Marcos>"`, que aparece no trailer e no resumo do PR.

## Mapa do código (Cartographer)

`python scripts/capacidades.py mapa` lista as mudanças estruturais desde a âncora `commit:` do `docs/CODEBASE_MAP.md`: arquivo novo ou removido, arquivo estrutural alterado (allowlist, workflows, package.json, manifesto) e mudança de import/export/def/script/link no conteúdo (troca de `?v=` não conta). O gate reprova o PR estrutural que não toca o mapa. Atualizar com o Cartographer em modo de atualização e acertar a âncora.

## Testes headless (CONDUTA §5)

`tests/visual` (Playwright), servidos por `tests/visual/servidor.py` em 127.0.0.1, com todo domínio externo bloqueado (analytics incluído):

```sh
cd tests/visual && npm ci && npx playwright install chromium
npx playwright test a11y.spec.mjs maquete-sem-webgl.spec.mjs   # lang, um h1, sem rolagem lateral a 390 px, alt, nome acessível, console limpo
npx playwright test maquete.spec.mjs --workers=1               # maquetes V03: teclado, foco preso, Escape, foco de volta
SITE_ROOT=<base> npx playwright test regressao.spec.mjs --update-snapshots && npx playwright test regressao.spec.mjs
```

`tests/visual/conhecidos.json` lista a conformidade atual (problema que já existia na `main` quando o teste entrou): aparece no relatório e não reprova. Diferença visual num PR só passa com o rótulo `visual-autorizado`, posto por Marcos.
