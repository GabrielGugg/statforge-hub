# Manutenção do hub

[Read in English](MAINTAINING.md)

Notas para o dono do hub (GabrielGugg).

## Configuração (uma vez só)

1. Crie o repositório público `GabrielGugg/statforge-hub` e suba estes arquivos na `main`.
2. **Settings › Actions › General › Workflow permissions**: escolha **Read and write permissions**. O workflow "Build index" precisa disso para gravar o `index.json`.
3. Na mesma página, mantenha **Require approval for first-time contributors** para pull requests de forks, assim ninguém roda workflow aqui sem você ver antes.
4. Rode **Actions › Build index › Run workflow** uma vez para criar o `index.json`.

Proteger a branch é opcional: só você consegue dar push na `main`; os outros só conseguem mandar pull request. Se criar uma regra (ruleset), não exija pull request na `main`, senão o workflow do índice não consegue gravar.

## Revisar um pull request

1. Espere o **Check packages** passar. Quando falha, ele diz exatamente o que está errado.
2. Olhe **Files changed**: só `packages/`, conteúdo que o autor pode compartilhar, ids e nomes que façam sentido.
3. Se alguém atualizar um pacote que não criou, pergunte antes ao autor original.
4. **Merge**. O índice é refeito e o pacote aparece no app.

## Envios por issue

Baixe o arquivo anexado, coloque em `packages/<pasta>/`, faça o commit e feche a issue agradecendo.

## Remover um pacote

Apague o arquivo e faça o commit. Quem já instalou continua com a cópia; ele só some da lista do Hub.
