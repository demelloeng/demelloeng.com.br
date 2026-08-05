# DEMELLO Engenharia

Site institucional estático em HTML5 e CSS3, com JavaScript apenas para o menu responsivo.

## Estrutura

* `index.html`: página inicial
* `empresa/`: empresa e trajetória do fundador
* `servicos/`: serviços
* `metodologia/`: metodologia
* `experiencia-tecnica/`: experiência técnica
* `contato/`: contato
* `assets/css/styles.min.css`: estilos
* `assets/js/menu.js`: menu responsivo
* `assets/images/LOGO.png`: logotipo

## Publicar no GitHub Pages

1. Crie um repositório público no GitHub.
2. Envie todo o conteúdo deste pacote para a raiz do repositório.
3. Abra **Settings > Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch de origem, normalmente `main`, e a pasta `/ (root)`.
6. Clique em **Save** e aguarde a publicação.

## Domínio customizado

1. Em **Settings > Pages > Custom domain**, informe o domínio desejado.
2. Configure no provedor de DNS os registros indicados pelo GitHub.
3. Após a validação, ative **Enforce HTTPS**.
4. Se necessário, crie um arquivo `CNAME` na raiz contendo somente o domínio, por exemplo `demelloeng.com.br`.

## Desenvolvimento local

O site funciona ao abrir `index.html` diretamente. Para testar rotas de modo mais fiel, execute um servidor HTTP local na raiz do projeto.

## Privacidade

O site não utiliza cookies, ferramentas de analytics, pixels de terceiros ou formulário de contato.

