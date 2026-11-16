# Regressão R10 — somente local

Na raiz do site: `python -B docs/prototipos/calculadora-v05-r4/teste/r10/server.py`.
Com autorização de navegador local, abrir `http://127.0.0.1:4192/verify.html`.
O servidor só escuta em 127.0.0.1. Não emite prévias, não envia pedidos nem consulta produção.
O diretório teste não integra a allowlist pública do Pages.

Baseline fixo: `64689dff81f0b9dd1971019a250c3b8fd52b36c4` (antes do R10).
O servidor extrai via git show os três módulos originais para teste/run (ignorado).
Os módulos depois são os fontes atuais da worktree. Não usa snapshot escolhido arbitrariamente.

Rotas e critérios:

| Rota | Casos | Critério |
|---|---:|---|
| `/verify.html` | 15 | <=60 chamadas, <=150.000 triângulos, imagem idêntica |
| `/verify.html?extras` | 10 | Disciplinas/Pavimentos, imagem e contagens coerentes |
| `/verify.html?interactions` | 18 | isolamento, cortes, andares, montagem, troca de serviços, zoom |
| `/verify.html?mobile` | 15 | perfil móvel, mesmos limites e imagem idêntica |
| `/verify.html?mobile&extras` | 10 | Disciplinas/Pavimentos móveis |
| `/cena.html` | 29 | checks de cena derivados do verificador R3, usando módulos R4 |

As cinco configurações principais usam seis disciplinas, padrão Alto, palco 640x420,
quadros estabilizados e AO ligado no desktop. O perfil móvel preserva o AO desligado
e a sombra configurados pelo produto. A emulação da interface estreita é uma revisão
complementar; não equivale a ensaio em telefone físico.

Cada página mostra o resumo e o JSON completo. O gate principal precisa de 15/15 PASSAM;
qualquer FALHA ou erro de carregamento reprova o ensaio. Fechar a aba antes de terminar
pode interromper o teste. Interromper o servidor com Ctrl+C.

## Comparação visual funcional

A cena baseline roda separadamente para conferir contagens. A comparação pixel a pixel
usa o MESMO contexto GPU e as mesmas texturas de ruído de AO: no objeto debug da cena
atual, restaura temporariamente o caminho original de sombras por bucket, captura o
frame, reativa o lote consolidado e captura novamente. Exige zero canais RGBA diferentes
e count=0 do proxy fora da sombra. Exige também que as contagens do caminho restaurado
sejam iguais às da baseline independente. Não modifica renderer.info nem seus contadores.
Não comparar ruído de AO entre contextos independentes como se fosse regressão visual.

Este teste altera apenas o estado debug das instâncias locais de ensaio; não altera o
código de produção. O material, a geometria e as matrizes originais permanecem observáveis.
As capturas antes/depois e o JSON são evidência complementar à inspeção visual humana.
