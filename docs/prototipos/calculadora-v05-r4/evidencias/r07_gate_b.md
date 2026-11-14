# R07 · Gate B local · 14/11/2026

Ambiente: perfil de teste local (`teste/`), tudo em 127.0.0.1. Contatos fictícios (`.invalid`). Nada foi implantado nem enviado à nuvem.
Os códigos de verificação emitidos neste ensaio existem só nos bancos das rodadas locais (`teste/run/`, ignorado pelo Git).

## 1. Testes técnicos

### Roteiro automático

Comando: `python gate_b.py`. Resultado: 49 verificações, 0 falhas.

| Grupo | O que confere |
|---|---|
| G0 | Rodada nova: fator 60% (revisão 1), nenhum cupom cadastrado |
| G1 | Prévia sem cupom (sobrado 320/160, 4 serviços) = R$ 12.509,76; `/verificar/` local aponta para a prévia local e confere código e valor |
| G2 | Cupom criado no Portal nasce inativo e não vale; ativado, vale; código digitado em minúsculas e com espaços é normalizado |
| G3 | 10% → R$ 11.258,78; `/verificar/` mostra total com cupom, valor-base, cupom e desconto |
| G4 | R$ 500 → R$ 12.009,76; 100% → R$ 0,00; desconto fixo acima do saldo fica limitado ao saldo |
| G5 | O mesmo código em duas sessões gera duas prévias distintas; o uso por código conta as emissões |
| G6 | Retentativa com a mesma chave devolve o mesmo registro e não conta uso; mesma chave com pedido diferente dá 409 `EMISSION_KEY_REUSED` |
| G7 | Cupom desativado: deixa de valer; já aplicado na tela, dá 409 sem emissão automática; a prévia histórica continua verificável |
| G8 | Cupom reativado: a revisão mudou, a tela recebe o aviso de cupom alterado; reconsultado, volta a emitir |
| G9 | Validade no passado: o cupom expira; a prévia histórica continua verificável |
| G10 | Cupom inexistente ou malformado; código de verificação inexistente ou malformado |
| G11 | Fator 62% no Portal: a calculadora e o Worker concordam com a revisão 2; a prévia antiga mantém o valor; volta a 60% (revisão 3) = R$ 12.509,76 |
| G12 | Pedido com cupom: capturado, passa no validador de intake e aparece na revisão de entrada do Portal com o valor com cupom; pedido sem cupom fica como antes |
| G13 | Prévia fora do ar: a consulta do cupom informa indisponibilidade, a emissão falha sem lançar, `/verificar/` informa a falha; de volta, os registros estão preservados |

### Isolamento dos perfis

O teste `tests/r07_perfis.test.mjs` (5 casos) também roda no CI.

| Compilação | `publish-guard` |
|---|---|
| `orcamento/` versionado | passa |
| Produção nova, compilada em pasta temporária | passa |
| Compilação de teste | bloqueada: endereço local, `http://` e endereços de produção ausentes |

### Ensaio de reversão

Comando: `ensaio_reversao.mjs`. Resultado em `r07_reversao.json`.

| Registro | Worker R4 + verificar R4 | Qualquer combinação com Worker ou verificar de base |
|---|---|---|
| R4 com cupom (a peça diz R$ 11.258,78) | R$ 11.258,78 com cupom | R$ 12.509,76 (sem o cupom) |
| R4 sem cupom | R$ 12.509,76 | R$ 12.509,76 |
| De base (site `598e8f0` + Worker `ea26c6e`) | R$ 8.321,28 | R$ 8.321,28 |

- A integridade dá `VERIFIED` em todas as combinações.
- O site de base contra o Worker R4 recebe 409 `PRICING_VERSION_MISMATCH` e não emite prévia.

## 2. Revisão da interface real

Navegador local, conforme a decisão de Marcos no R01 ("capturas DevTools locais"). Compilação `--mode teste`, Chrome em contexto isolado.

- **Jornada.** "Já sei o serviço → Arquitetura", casa, 320 m², Curitiba/PR. Resultado: R$ 6.268,80.
- **Achado e corrigido.** O cupom era um formulário dentro do formulário da jornada. "Aplicar cupom" enviava a página, que recarregava e perdia as respostas. O cupom passou a ser um grupo com botão `type="button"`, e o Enter no campo aplica o cupom. Um teste no `r15_cupom_site` reprova formulário aninhado e botão sem `type="button"` no resultado. Conferido de novo no navegador: o Enter aplicou o cupom sem recarregar.
- **Cupom `teste-10` (criado e ativado pelas rotas do Portal).**
  - "ESTIMATIVA INICIAL DEMELLO COM CUPOM": R$ 5.641,92, com valor-base R$ 6.268,80 e desconto − R$ 626,88.
  - O aviso de que o desconto é registrado na prévia aparece.
- **Prévia gerada pela tela.**
  - PNG 1080×1350 (`r07_previa_cupom_local.png`), com o bloco do cupom à direita do total e sem sobreposição.
  - QR decodificado pelo OpenCV, independente do `qr.mjs`: `http://127.0.0.1:8796/verificar/?codigo=…`, o destino deste ambiente.
  - O código do QR é igual ao da tela e ao do nome do arquivo.
  - `/verificar/` mostra R$ 5.641,92 com cupom, o valor-base, o cupom e o desconto.
- **Recursos carregados.**
  - Só 127.0.0.1:8796 (site) e 127.0.0.1:8797 (prévia).
  - Nenhuma resposta 4xx/5xx; console sem erros nem avisos.
  - Duas dicas de qualidade do Chrome, origem não investigada: imagem com carregamento preguiçoso sem dimensões; campo de formulário sem `id`/`name`.
  - Scripts: bundle, cena e three/addons hospedados no próprio site; coletores remotos substituídos por 204.
- **Fallback sem WebGL.** `getContext('webgl'/'webgl2')` devolvendo nulo: nenhum canvas, a maquete cai na ilustração SVG com Conjunto/Camadas/Corte/Planta, o painel de valores segue funcionando, console sem erros.
- **Licenças do que vai para o pacote.**
  - three: `assets/vendor/three/LICENSE` + `ORIGEM.txt`.
  - React e react-dom (MIT): aviso `@license` preservado no bundle.
  - @phosphor-icons/react (MIT).
  - Fonte Montserrat: `assets/fonts/Montserrat-OFL.txt`.
  - Archivo e Source Sans 3 constam no `package.json`, mas não entram no pacote atual.

## 3. Aceite humano

Pendente: percurso de Marcos no Portal e na calculadora locais (`python iniciar.py`).
