# Handoff para ChatGPT — diagnóstico da home arquivada

## Missão e fonte

Retomar a conversa “Diagnóstico da home arquivada” a partir das capturas reais já produzidas pelo Codex. Repositório `demelloeng/demelloeng.com.br`, branch do pacote `diag/home-20261028-captura`, pasta `docs/diagnosticos/home-arquivada-20261028/`.

Fonte visual: `arquivo/home-20261028`, commit `cca24fffa6720ad5ac97a882957df7e73057657c`. Index SHA-256 `73b5794b623eb118555beb04c1d8b77a8f924c906dc2fa2d1f892dbfef973573`; H1 “Projeto estrutural e projetos complementares.”

## O que foi feito

- Extração por git archive em diretório isolado, preservando os checkouts existentes.
- Após aprovação específica de Marcos, renderização do HTML original em HTTP local com scripts locais, navegador instalado, requisições externas bloqueadas, sem preencher/enviar formulários ou acionar contatos.
- Desktop viewport 1440×900, captura integral 1440×9947; mobile viewport 390×844, captura integral 390×14950.
- H1/hash, duas folhas CSS, quatro pesos Source Sans 3, 15 imagens por viewport, ausência de overflow horizontal e de erros JavaScript verificados. Os 33 arquivos servidos conferem byte a byte com o git archive.
- Menu mobile e abertura do FAQ testados. CTA principal alcançou `/orcamento/?situacao=build`, primeira pergunta “O que você vai fazer?”. Não foi testado o funil completo, cálculo, envio, CRM ou integração externa.
- Capturas integrais e recortes dos 11 blocos, faixa e rodapé abertos e examinados. Recortes finais derivam dos pixels das capturas integrais, sem retoque.
- Plugin Management: consulta real; Superpowers: continuidade/verificação e leitura documental delegada; Product Design: preflight, capturas, fluxo e riscos; UI UX Designer: hierarquia, alinhamento, ritmo, responsividade e prioridades.
- Governança consultada na main canônica da engenharia em `30eaff64c3fdd2b4c69ea7e3239290289bc41ee6`: Doc01 V02, Doc02 V08, Doc03 V83, leitura integral (principal e leitores delegados). Não transferir regras do portal/masterplanner para a home. Conferir vigência novamente se houver retomada material posterior.

## Abrir primeiro

1. [RELATORIO.md](RELATORIO.md) — achados, propostas por impacto/esforço e cinco respostas conclusivas.
2. [Desktop integral](capturas/desktop-full.png) e [mobile integral](capturas/mobile-full.png).
3. [Verificação da captura](capturas/verificacao.json) e [manifesto do pacote](MANIFESTO.json).
4. Recortes `capturas/desktop-section-01.png` a `11.png` e equivalentes mobile; `desktop-hero.png`, `mobile-hero.png`, menu e entrada da estimativa.

## Leitura do resultado

FATO: terraplanagem apresenta painel tipográfico provisório, não imagem quebrada; clientes têm formatos de exposição diferentes; existem intervalos grandes no bloco do proprietário; arquitetura não tem destaque ilustrado equivalente. O README da branch já registra imagem de terraplanagem e presença de arquitetura como pendências.

AVALIAÇÃO ESTÉTICA: identidade grafite/azul/branco, hero, BIM e Djalma são aproveitáveis; o problema principal identificado é a hierarquia e o ritmo do percurso, com sequência extensa de catálogo na segunda metade, sobretudo mobile. Isso é um parecer, não decisão humana consolidada. Não atribuir o problema central ao grafite por pressuposto.

HIPÓTESE: o percurso pode aumentar esforço de leitura. NÃO CONFIRMADO: conversão, abandono, resultados de negócio, acessibilidade completa, demais aparelhos/navegadores e correção técnica das imagens conceituais. Os avisos de CSP de Simple Analytics e Meta são bloqueios deliberados da captura, não prova de bug de produção.

Propostas: concluir direção de terraplanagem; ajustar espaçamentos/hierarquia localmente; equilibrar clientes; deliberar sobre destaque de arquitetura. Nenhuma foi implementada. Redesign integral não está demonstrado como necessário.

## Autoridade, estado e próxima ação

Marcos autorizou agora apenas inserir os arquivos no repositório e fazer este handoff. Isso permite o commit/push documental desta entrega na branch diagnóstica; não altera main, branch arquivada, site, copy, SEO, orçamento, CRM ou decisões canônicas. Sem merge, PR ou deploy.

O relatório descreve a auditoria anterior, que não fez commits. Esta gravação documental posterior é uma ação distinta, expressamente solicitada. Revisão técnica e de design realizadas; aceite humano pendente. A Etapa 2 continua aberta.

Próxima ação do ChatGPT: ler o pacote e abrir as capturas, apresentar sua leitura a Marcos e consolidar somente as decisões que ele efetivamente aprovar. Não implementar propostas, regenerar imagens, repetir auditoria sem fato novo, substituir a fonte por produção nem declarar aceite. A aprovação de navegador foi específica para a captura local do Codex; não presume autorização para novas navegações ou outros escopos.

Se os binários não puderem ser abertos pelo conector, declarar a limitação: ler texto/hash não equivale a ver as imagens. Não substituir evidência visual por descrição.
