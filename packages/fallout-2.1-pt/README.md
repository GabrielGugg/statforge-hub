# Fallout TTRPG 2.1 (BR)

Fallout TTRPG 2.1 (Arcane Arcade) traduzido para o português, como no livro original, sem regras da casa. Onde o livro se contradiz e isso muda a ficha, o jogador escolhe uma das opções (explicadas na ficha) ou o campo fica manual. Por GabrielGugg.

| Arquivo | Tipo |
| --- | --- |
| `fallout-2.1-pt.json` | sistema |
| `fallout-2.1-gugg-pt.json` | extensão: Fallout TTRPG 2.1 - Revisão por Gugg |
| `fallout-2.1-fuse-pt.json` | extensão: Fallout TTRPG 2.1 - Rewrite do Fuse |

Os temas Pip-Boy e Vault-Tec ficam em [`packages/themes`](../themes/README.md).

## Revisão por Gugg

As regras da casa de GabrielGugg, que antes formavam o pacote "Fallout TTRPG 2.2", agora são uma extensão do 2.1 (BR). Com a extensão ativa, a ficha fica igual à antiga 2.2. Ela muda, entre outras coisas:

- perícias de dois atributos (Sabotagem, Intimidação, Medicina) usam o maior modificador;
- Sorte negativa tira só 1 de todas as perícias (sem a escolha de regra);
- Iniciativa calculada pela Percepção e Fator de Cura arredondado;
- Sintéticos Gen 2 não usam Stimpak; Mãozinha com três ferramentas;
- a regra dos níveis de melhoria de armadura e armadura potente: valor maior substitui o anterior, valor igual se soma;
- a condição Desequilibrado, preços e textos corrigidos (Traje Hazmat, T-45, Estrepes, Lutador de Arena, Morador do Refúgio e outros).

Para usar: instale o sistema e a extensão, e ative a extensão na ficha. Ela pode ser combinada com outras extensões do 2.1 (BR), como a revisão de outro fã: o app aplica as extensões na ordem da tela Pacotes, e quando duas mexem na mesma coisa vale a de baixo (o app avisa). A Revisão por Gugg muda o passo a passo da criação e o layout inteiros, então, se outra extensão também mudar esses dois, vale a que estiver mais abaixo.

## Rewrite do Fuse

**As regras e os textos são de Fuse.** O [Rewrite do Fuse](https://docs.google.com/document/d/1JPzu6L7PE_9pYxQ6pinsrD6LV1RozM6nuyUFrhZAu8A/edit) (em inglês) é uma reescrita feita por fã do Fallout TTRPG 2.1; GabrielGugg só traduziu para o português e transformou em extensão do StatForge. Todo o crédito pelas regras é do Fuse. Fuse, se quiser mudar algo ou tirar o pacote do ar, abra uma issue neste repositório que será feito.

Ela cobre as regras básicas, raças e variantes (com Níveis Ferais), antecedentes, traços, talentos, armas, explosivos, munição, armaduras, armadura potente, consumíveis, vícios, equipamentos, materiais e itens de sucata. Ficam de fora os statblocks e os documentos "Experimental". Entre outras coisas:

- Iniciativa pela Percepção, Fator de Cura de no mínimo 1, Sorte negativa sempre −1;
- Pontos de Talento em todo nível, menos nos níveis 5, 9, 13, 17, 21, 25 e 29 (a subida de nível segue essa regra, por isso precisa do StatForge 1.25.0 ou mais novo);
- Níveis Ferais para Necróticos (diminuem os testes de perícia); 7 variantes, 3 antecedentes, traços (com as versões Ermo Selvagem) e mais de 60 talentos novos;
- as tabelas novas de armas, munição, armaduras e armadura potente (com PA de Operação), vícios como condições e a lista de Itens de Sucata, que conta na carga.

Para usar: instale o sistema e a extensão, e ative a extensão na ficha. Dá para combinar com a Revisão por Gugg: as duas mudam muitas coisas iguais, então onde elas se sobrepõem vale a que estiver mais abaixo na tela Pacotes (o app avisa). Também existe a versão em inglês, `fallout-2.1-fuse-en`.

## Versão

Este pacote começa na 1.0.0. Ele foi montado a partir do antigo `fallout-2.2-pt` 1.24.0, desfazendo as regras da casa, e usa os mesmos ids de perícias, itens e talentos. Quem já tem o `fallout-2.2-pt` instalado continua com ele e com as suas fichas; ele só não recebe mais atualizações pelo Hub.

## Licença

Rewrite do Fuse (`fallout-2.1-fuse-pt.json`): as regras e os textos são de Fuse, que não definiu uma licença; peça ao Fuse antes de reaproveitar. A tradução é de GabrielGugg.

Os outros pacotes: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.pt-br) (dar crédito, uso não comercial, compartilhar igual).

Todos são feitos por fãs, com base no Fallout TTRPG da Arcane Arcade; Fallout é marca dos seus donos, e estes pacotes não têm ligação com eles.
