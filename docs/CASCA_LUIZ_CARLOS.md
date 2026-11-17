# Casca do Colégio Luiz Carlos (maquete de incêndio V03)

`assets/models/hidrantes-luiz-carlos-casca.glb` é a casca arquitetônica da maquete de hidrantes da página de incêndio. É gerada por `scripts/gerar-casca-luiz-carlos.py` a partir de uma prancha do projeto hidrossanitário do colégio. **A prancha é dado de cliente e não entra no repositório**; aqui ficam só o GLB derivado (paredes, sem texto, carimbo, cota, louça ou nome de ambiente), o script e o SHA-256 da prancha usada.

## Fontes

| Fonte | O que dá | Onde está |
|---|---|---|
| Prancha `HID.ESGOTO P01`, planta "SAN 1 - Térreo", escala 1:75 (vetorial) | paredes do térreo em planta | fora do repositório; SHA-256 `d512be32…6039fd5` gravado no script |
| IFC do colégio (AltoQi Builder, IFC2X3, só instalações) | cotas dos pavimentos e posição das redes | fora do repositório; SHA-256 `1358092a…9e9c`, o mesmo `fonte_sha256` de `hidrantes-luiz-carlos-v02.json` |
| `hidrantes-luiz-carlos-v02.glb` e `.json` | o sistema de hidrantes publicado | no repositório, **intactos** (decisão 103) |

`casa-exemplo.glb` (casca da hidrossanitária) não tem relação com o colégio e não foi usada.

## Registro (medido em 17/11/2026)

1. **IFC → GLB de hidrantes:** translação pura, `x = X − 41,2613`, `y = Z + 2,25`, `z = −Y + 22,8845`. Conferida em 156 peças de geometria IFC: desvio abaixo de 0,1 mm. O 0 do GLB é o tubo mais fundo; o Térreo do IFC fica em `y = 2,25`.
2. **Planta 1:75 → IFC:** translação pura, sem giro nem espelho, `X = xp + 21,501`, `Y = yp + 50,324` (metros na folha, y para cima). Casamento por distância: das 119 peças do IFC que encostam em parede (condutores verticais, abrigos e terminais de água fria), 82 ficam a menos de 8 cm de uma linha da planta. As 8 orientações possíveis foram testadas; a segunda melhor fica bem abaixo. Prova independente: os terminais de água fria caem sobre as pias e a fileira de louças desenhadas.
3. **Conferência no próprio GLB** (teste `incêndio: casca nas cotas do IFC…` em `orcamento-src/tests/maquetes_v03.test.mjs`): os abrigos H050 e H051 ficam a 4–5 cm da parede, e o H049 a 34 cm. Os demais estão fora do térreo desenhado: o H052 fica além do topo da planta, o recalque fica na rua e o H056 na Cobertura.

## O que é comprovado e o que é simplificado

| Elemento | Situação |
|---|---|
| Posição e espessura das paredes do térreo | **comprovado** (planta 1:75, registrada no IFC) |
| Blocos (onde há prédio) | três janelas na folha dizem onde procurar; o contorno sai das paredes desenhadas |
| Altura das paredes: Térreo 0,00 até 5,53 m | **simplificado**. 5,53 m é o "Pavimento 1" do IFC, onde chegam os condutores pluviais (calha); as ventilações de esgoto passam acima (5,82 → 7,53) |
| Cobertura | face plana a 5,53 m sobre cada bloco; forma e inclinação reais não documentadas |
| Cobertura do IFC a 8,83 m (bombas e reservatórios) | só como **nível**: a extensão da plataforma não está desenhada |
| Portas e janelas | não modeladas (janela aparece como parede) |
| Muro, meio-fio, calçada, arquibancada | só como contorno no chão (6 cm), sem altura |
| Pavimento superior, fora do térreo desenhado | não representado |

## Gerar de novo

```sh
python scripts/gerar-casca-luiz-carlos.py "<HID.ESGOTO P01.pdf>" assets/models/hidrantes-luiz-carlos-casca.glb
```

O script recusa outra prancha (SHA-256 diferente) e gera o mesmo arquivo, byte a byte. Depois de gerar, o `?v` do `data-glb-casca` em `docs/arquivo/paginas-servico-v02/maquete-incendio-v03-markup.html` passa a ser o início do SHA-256 novo, e a página é regenerada com `python scripts/gerar-paginas-servico-v02.py gerar projeto-prevencao-incendio`.
