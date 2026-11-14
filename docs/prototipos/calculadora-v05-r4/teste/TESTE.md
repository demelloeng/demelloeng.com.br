# Perfil de teste local · calculadora R4

Tudo roda neste computador, em 127.0.0.1. Nada vai à nuvem, e os contatos usados são fictícios (`.invalid`).

## Preparar

1. Na pasta `orcamento-src`, compile o perfil de teste:
   `node node_modules/vite/bin/vite.js build --config vite.config.mjs --mode teste`
2. A compilação vai para `teste/app/orcamento/`. Essa pasta fica fora da allowlist do Pages e é ignorada pelo Git.
3. A compilação de produção (`vite build` sem `--mode`) é a única que escreve em `orcamento/`.

## Usar à mão

Rode `python iniciar.py`. Cada execução abre uma rodada nova em `teste/run/<carimbo>/`. A rodada começa com o fator a 60% (revisão 1) e sem nenhum cupom. Apagar a pasta da rodada descarta todos os dados de teste.

| Serviço | Endereço |
|---|---|
| Calculadora | http://127.0.0.1:8796/orcamento/ |
| Verificação | http://127.0.0.1:8796/verificar/?codigo=CODIGO (a mesma página publicada, apontada para a prévia local) |
| Prévia | http://127.0.0.1:8797 (código real do Worker R4 da worktree `r4-eng`, sobre o SQLite da rodada) |
| Pedido | http://127.0.0.1:8788 (harness de intake do `r4-eng`; grava onde o Portal lê) |
| Portal | porta 8766, com CRM, D1 e preparo falsos. O endereço de entrada (bootstrap) aparece na saída do Portal. |

O fator e os cupons alterados no Portal local são os que a prévia local lê a cada emissão.

## Roteiro técnico automático

Rode `python gate_b.py`. Ele sobe uma rodada nova e percorre a cadeia comercial:

- cupons de 10%, R$ 500, 100% e acima do saldo;
- o mesmo código em duas sessões;
- retentativa idempotente e chave repetida com pedido diferente;
- desativação, reativação e validade;
- códigos inválidos;
- fator 62% e volta a 60%;
- pedido capturado e validado, visto na revisão de entrada do Portal;
- prévia fora do ar.

O resultado (esperado x obtido) fica em `run/<rodada>/gate_b.md`. A revisão da interface real e o aceite humano são registrados à parte.
