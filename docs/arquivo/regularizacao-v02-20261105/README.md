# Regularização V02: evidências da candidata (issue #16)

Branch `claude/regularizacao-v02`, base `main` `dcd385f4115da60595f1707e90677a25a9fb09f5`. Candidata para auditoria independente: **não é aceite, não foi mesclada e não foi publicada.**

A fonte do texto é `docs/arquivo/paginas-servico-v02/copy/COPY_REGULARIZACAO_V02_20261105.md` (Copy V02 aprovada por Marcos na sessão de 05/11/2026), materializada sem reescrita. As marcações editoriais da conversa (`alterado, item 0N`) não entram no arquivo.

## Capturas (`capturas/`)

Feitas no Chrome real (headless, protocolo DevTools), sobre a página gerada, a partir de um servidor local em `127.0.0.1`. Nada foi publicado e o texto da página não é mock-up.

| Arquivo | Conteúdo |
|---|---|
| `regularizacao-1440x900-primeira-dobra.png` | primeira dobra, desktop 1440 × 900 |
| `regularizacao-1440x900-pagina-completa.png` | página inteira, desktop |
| `regularizacao-1440x900-faq-e-detalhes-abertos.png` | página inteira com as 8 perguntas e os "Detalhes do escopo" abertos |
| `regularizacao-390x844-primeira-dobra.png` | primeira dobra, celular 390 × 844 (emulação móvel) |
| `regularizacao-390x844-pagina-completa.png` | página inteira, celular |
| `regularizacao-390x844-faq-e-detalhes-abertos.png` | página inteira com as perguntas e os detalhes abertos |
| `verificacao-visual.json` | medições: overflow horizontal, contagens, links, console, rede, hosts consultados |

## Como foram geradas

1. Cópia dos arquivos do site (sem `.git`, `node_modules`, `orcamento-src` e `docs`) para uma pasta fora do repositório.
2. Nessa cópia, `assets/js/analytics-sink.js` (Simple Analytics) e `assets/js/meta-pixel.js` (Pixel da Meta) foram trocados por arquivos vazios. **Nenhuma visita de teste foi registrada** nos dois serviços; o único host consultado foi `127.0.0.1`.
3. `python -m http.server` na porta 8731 e `captura.mjs` (neste diretório): abre a página nas duas telas, mede, captura e grava os arquivos acima.

## Limites da inspeção

- Só Chrome (Windows, headless). Safari e Firefox não foram abertos.
- Celular por emulação de tela e de agente; não houve aparelho físico (a pendência 169 do Doc03 segue com Marcos).
- Contraste foi avaliado a olho nas capturas e pelas cores do design V02; não houve medição automática.
