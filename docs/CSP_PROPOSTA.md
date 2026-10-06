# Proposta de Content-Security-Policy (NÃO IMPLEMENTADA)

Status: **proposta, fora da entrega do visual V2.** Motivo: uma CSP errada quebra o envio do estimador ou a medição em silêncio, e os hosts exatos que o Simple Analytics usa só podem ser confirmados com a conta ativa e a publicação. O GitHub Pages também não deixa configurar cabeçalhos; só dá para usar `<meta http-equiv="Content-Security-Policy">`, que **não cobre** `frame-ancestors`, HSTS nem `X-Frame-Options`.

Recursos que o site de fato carrega (conferidos por `privacy_and_sink.test.mjs` e pelo código):

| Diretiva | Origens necessárias |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self'`; `https://scripts.simpleanalyticscdn.com`; `https://unpkg.com` (só `/experiencia-tecnica/`, módulos do three.js) |
| `connect-src` | `'self'`; `https://ma-demello-site-intake.ma-demello.workers.dev`; `https://ma-demello-preview.ma-demello.workers.dev`; **hosts de coleta do Simple Analytics (a confirmar na conta)** |
| `img-src` | `'self'`; `data:`; `blob:` (resumo em PNG e QR no estimador); host de coleta do Simple Analytics, se usar imagem |
| `style-src` | `'self'`; `'unsafe-inline'` (há atributos `style` nas páginas e no estimador) |
| `font-src` | `'self'` |
| `media-src` | `'self'` |
| `frame-src` / `object-src` | `'none'` |
| `base-uri` / `form-action` | `'self'` |

Pontos de atenção:
- A página `/experiencia-tecnica/` usa um `importmap` inline; exige `'unsafe-inline'` em `script-src` ou um hash do bloco. Autohospedar o three.js resolveria os dois problemas.
- Testar a CSP em modo `Content-Security-Policy-Report-Only` (por meta não há relatório; usar o console do navegador) em todas as páginas e em todo o fluxo do estimador (resultado, download do resumo, envio e erro) antes de ativar.
- Alternativa que resolve cabeçalhos de verdade: colocar o domínio atrás de um proxy (por exemplo, Cloudflare) e definir CSP, HSTS e `X-Frame-Options` lá.
