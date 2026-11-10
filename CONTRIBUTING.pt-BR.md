# Como contribuir com o StatForge Hub

[Read in English](CONTRIBUTING.md)

Obrigado por compartilhar seu trabalho! Estas regras deixam o hub fácil de usar e seguro para todos.

## O que você pode enviar

- Pacotes `system`, `extension` (homebrew, suplemento, errata), `theme` e `table` no [formato do StatForge](https://github.com/GabrielGugg/statforge/blob/main/FORMAT.pt-BR.md).
- Só conteúdo que você tem direito de compartilhar. Texto de regras copiado ou traduzido de um livro publicado normalmente pertence à editora: confira a política de conteúdo de fãs dela, ou envie só o que você mesmo escreveu (números, fórmulas, resumos curtos).
- Nada de dados pessoais, propaganda ou conteúdo ofensivo.

## Como organizar

- Uma pasta por projeto: `packages/<pasta>/`. Se quiser, junte um sistema com seus temas e mesa.
- Nomes de arquivo em minúsculas, com `-` no lugar de espaços: `meu-sistema.json`.
- Todo pacote precisa de `author` (seu nome ou usuário do GitHub), `version` e `language`. Coloque `license` (por exemplo `CC-BY-4.0`, `CC-BY-NC-SA-4.0`, `MIT` ou `Todos os direitos reservados`) para os jogadores saberem como podem reutilizar. Se o seu pacote for baseado no jogo de outra pessoa, siga os termos desse jogo.
- O `id` precisa ser único no hub e nunca mudar depois de publicado: as fichas se referem aos pacotes pelo id. Uma tradução é um pacote novo com id próprio (`meu-sistema-en`, `meu-sistema-pt`).
- Links relativos numa mesa (`"url": "meu-sistema.json"`) funcionam, já que os arquivos da mesma pasta ficam lado a lado.

## Atualizar seu pacote

Mude o arquivo e aumente o `version` (1.0.0 → 1.0.1 para correções, 1.1.0 para conteúdo novo, 2.0.0 para mudanças que quebram fichas antigas). Só o autor original, ou alguém com o acordo dele, deve atualizar um pacote; quem revisa confere isso.

## Revisão

A verificação automática precisa passar. Depois o GabrielGugg revisa o pull request e pode pedir mudanças. Pacotes aceitos aparecem no Hub do app em um ou dois minutos.

Ao enviar um pacote, você concorda que ele seja distribuído por este hub e pelo app StatForge.
