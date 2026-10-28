# Auditoria visual — home arquivada — 28/10/2026

Pacote documental de evidências produzido pelo Codex, adicionado por solicitação de Marcos. Não é uma nova home, aprovação visual ou publicação do site.

**Comece por [HANDOFF_CHATGPT.md](HANDOFF_CHATGPT.md) e [RELATORIO.md](RELATORIO.md).**

- [Desktop integral](capturas/desktop-full.png), viewport 1440×900.
- [Mobile integral](capturas/mobile-full.png), viewport 390×844.
- [Verificação técnica e hashes das capturas](capturas/verificacao.json).
- [Manifesto SHA-256 deste pacote](MANIFESTO.json).

`capturas/` reúne 35 PNGs: integrais, primeiras dobras, recortes exatos das 11 seções, faixas, rodapés, menu mobile, entrada da estimativa e duas visões gerais reduzidas. Imagens reduzidas são apenas auxiliares; usar os originais para examinar detalhes.

`evidencias/` preserva os scripts temporários exatos usados e a verificação estática anterior. São evidência do procedimento, não scripts portáveis prontos para executar: contêm caminhos do ambiente Windows e pressupõem fonte extraída/Playwright/navegador. Qualquer nova execução requer conferir paths, fonte, escopo e autorização aplicável. Não executar automaticamente.

Fonte: branch `arquivo/home-20261028`, commit `cca24fffa6720ad5ac97a882957df7e73057657c`. O script auxiliar original continua em `scripts/diagnosticos/DEMELLO_RENDER_HOME_ARQUIVADA_DIAG.py`; a captura real preferiu servir o HTML original e bloquear rede externa, mantendo os scripts locais.

O relatório preserva o estado da auditoria no momento em que foi concluída; a afirmação de ausência de commit refere-se àquela fase. A inclusão documental posterior foi autorizada separadamente pelo usuário. Nenhum delta no site, main ou branch arquivada é parte desta entrega. Etapa 2 e aceite humano permanecem abertos.
