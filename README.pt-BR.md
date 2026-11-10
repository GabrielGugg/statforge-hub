# StatForge Hub

[Read in English](README.md)

A coleção oficial de pacotes do [StatForge](https://github.com/GabrielGugg/statforge), a ficha de personagem para qualquer RPG de mesa. Sistemas, homebrews, temas e mesas num lugar só, verificados automaticamente e instaláveis com um toque.

## Para jogadores e mestres

No StatForge, abra **Pacotes › Hub**. Busque, filtre por tipo ou idioma e toque em **Instalar**. O app também avisa quando um pacote que você tem ganha versão nova.

Também dá para instalar um pacote só, por link: todo arquivo daqui funciona como link. Para testar, a mesa de exemplo do StatForge instala um sistema, um homebrew e um tema de uma vez:

```
https://raw.githubusercontent.com/GabrielGugg/statforge/main/examples/pt-BR/table.json
```

## Para criadores: envie seu pacote

Ainda não tem um pacote? O [construtor de pacotes](https://gabrielgugg.github.io/statforge-hub/builder/) permite criar um sistema, homebrew, tema ou mesa sem escrever código, confere com o validador do StatForge e exporta o `.json` (veja [builder/README.md](builder/README.md)).

Qualquer pessoa com conta no GitHub pode enviar um pacote. Não precisa instalar nada; tudo funciona no navegador.

1. Confira o arquivo com o validador do StatForge (`npm run validate -- seu-pacote.json` no repositório do StatForge), ou simplesmente envie: o hub confere por você.
2. Neste repositório, abra a pasta `packages`, clique em **Add file › Upload files** e arraste para a página uma pasta com o nome do seu pacote (com o .json dentro). Ou use **Add file › Create new file**, digite o caminho `packages/meu-sistema/meu-sistema.json` e cole o conteúdo do arquivo.
3. O GitHub cria uma cópia (fork) para você e oferece **abrir um pull request**. Abra, explicando o que é o pacote.
4. A verificação automática roda no pull request. Se algo estiver errado, ela diz o quê; corrija e envie de novo.
5. O GabrielGugg revisa e aceita. Um minuto depois o pacote aparece no Hub do app.

Não quer usar pull request? Abra uma issue com o formulário **Enviar um pacote** e anexe o .json.

As regras completas estão em [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md).

## O que é verificado automaticamente

- O arquivo é JSON válido e um pacote válido do StatForge (as mesmas regras do app).
- Tem `author`, `version` e `language`.
- O `id` não é usado por outro pacote do hub.
- Quando você muda um pacote, o `version` sobe (senão os jogadores nunca recebem a atualização).
- Pull requests só mexem em arquivos dentro de `packages/`.

## Como funciona

- `packages/<pasta>/*.json` são os pacotes. Uma pasta pode ter um sistema com seus temas e mesa.
- `index.json` é a lista que o app lê. Ela é refeita sozinha depois de cada merge; não edite à mão.
- `scripts/hub.mjs` confere os pacotes e monta o índice. Ele usa o validador do próprio StatForge, então os dois sempre concordam.

## Licença

Arquivos do hub: MIT © GabrielGugg. Cada pacote pertence ao seu autor e segue o próprio campo `license`.
