# Campanha D&D — guia do jogador para Valdren em 5.5e

Data: 2026-08-13

## O problema

Valdren tem 107 verbetes de lore e nenhuma palavra sobre como jogá-lo. Um
jogador que chega no site sabe quem governa Asterhall e não sabe se pode ser
um Wizard, o que a Ordem dos Três faz com ele, nem em que nível a campanha
começa.

O guia responde isso sem virar um segundo sistema. A regra fundamental do
cenário é **magia rara, não magia fraca**: nada de spell slots, dano,
progressão ou funcionamento de classe muda. O que muda é o que a magia
significa dentro do mundo.

## Decisões

**O conteúdo vive no DynamoDB, como verbetes de wiki**, numa seção nova
`campanha-dnd`. Foi escolha do autor, contra a alternativa de conteúdo
estático. O guia fica editável ao vivo pelo Acervo, como qualquer verbete.

**Mas é autorado em git.** Os verbetes nascem em `shared/src/lore/dnd/` como
dados tipados `DefaultWikiEntry`, revisáveis em diff, e um script os grava.
Isso recupera a revisibilidade que a escolha do DynamoDB custaria.

`seedWiki` não serve: ele desiste se a campanha já tem verbetes, e esta tem
107. Daí `backend/scripts/seed-campaign-guide.mjs`, idempotente por
seção+título, dry-run por padrão.

**Sete povos, todos já no canon**: Solarion, Khazdrun, Mandíbula de Osso,
Ulgar, Drakorys, Euralune e os povos humanos das Casas. Nenhum inventado para
fechar cota.

**Nenhuma espécie é inventada mecanicamente.** Os sete mapeiam em espécies do
SRD 5.2.1, reinterpretadas culturalmente:

| Povo | Espécie SRD | Por que encaixa |
|---|---|---|
| Solarion | Elf | Trance e Keen Senses servem a astrônomos que leem o céu |
| Khazdrun | Dwarf | Stonecunning é literalmente "a pedra lembra" |
| Mandíbula de Osso | Orc | Relentless Endurance num povo que sobreviveu à escravidão |
| Ulgar | Goliath | 7–8 pés, Powerful Build, Large Form — o chassi do gigante bovino |
| Drakorys | Dragonborn | Draconic Ancestry como herança de dragões que não existem mais |
| Euralune | Gnome | Small, e Gnomish Cunning para um povo de grandes altitudes |
| Povos humanos | Human | — |

Goliath estar no SRD 5.2.1 é o que evita inventar os Ulgar do zero e assumir
risco de balanceamento. A reinterpretação troca os nomes das linhagens
(Giant Ancestry vira as linhagens de Nah'Korah), não os efeitos.

**Faixa recomendada 1–10**, sem proibir 11–20. A partir de 11 o personagem
deixa de ser aventureiro e passa a ser figura capaz de alterar o equilíbrio
político do reino — o que é material de campanha, não um problema.

**Manifestação de Poder** é regra de mundo, não de combate: magia
extraordinária usada em público aumenta a atenção sobre o personagem. Sem
penalidade mecânica.

**Não existem povos malignos.** Existem povos inimigos, e isso é diferente.

## Dois consertos que a escolha do DynamoDB exige

**Tabelas no markdown.** `WikiMarkdown` usa `react-markdown` puro, que é
CommonMark e não renderiza tabelas — a tabela de classes sairia como um
parágrafo de pipes. Entra `remark-gfm` e o mapeamento de
`table/thead/tbody/tr/th/td` para componentes MUI, com scroll horizontal no
wrapper. Vale para a wiki inteira.

**Isolar regras do motor de canon visual.** `visualWorkerHandler` passa todos
os verbetes para `resolveCanonReferences` e `buildCanonicalCanon`, e
`findCanonMatches` casa contra todos. Sem filtro, um pedido de imagem que
mencione fogo pode puxar o verbete de Fireball como canon do mundo. Entra
`NON_CANON_WIKI_SECTIONS` em shared, aplicada nos dois call sites.

## Atribuição

A `WikiPage` renderiza um rodapé fixo quando a seção é `campanha-dnd`, com a
declaração exigida pelo SRD 5.2.1, palavra por palavra. Fixo e não editável:
atribuição CC-BY é obrigação de licença e não pode sumir numa edição pelo
Acervo.

A página legal do SRD diz "Please do not include any other attribution to
Wizards or its parent or affiliates other than that provided above". Por isso
o rodapé **não** traz linha de "não afiliado" — ela violaria a instrução da
própria licença. A licença permite dizer "compatible with fifth edition".

Usar "D&D" no rótulo da aba é uso de marca, que a CC-BY não licencia. Foi
decisão consciente do autor, para um site de campanha e não um produto à
venda.

## Os verbetes

Seção `campanha-dnd`, em ordem:

0. Magia rara, não magia fraca — a regra fundamental e os quatro princípios
1. Faixa recomendada: níveis 1 a 10
2. Manifestação de Poder
3. Classes em Valdren — a tabela e as classes que mudam de peso
4. Os Vinte e Sete e a questão do vigésimo oitavo
5. Povo e Espécie — como ler a ficha
6. Solarion, os povos de Sahr
7. Khazdrun, a montanha e a maré
8. Mandíbula de Osso, o nome é seu
9. Ulgar, os exilados de Nah'Korah
10. Drakorys, a sombra da era dourada
11. Euralune, os senhores do céu
12. Povos humanos de Valdren

## Navegação

`WIKI_SECTIONS` ganha `{ id: "campanha-dnd", label: "Campanha D&D" }` no fim
da lista: as 21 seções atuais falam de dentro do mundo e esta fala com o
jogador na mesa. Os chips da `WikiPage` e o drawer do `Layout` derivam de
`WIKI_SECTIONS` filtrado por seções povoadas, então a aba aparece sozinha
depois do seed. Um botão no topo, ao lado de Casas/Galeria/Enciclopédia,
aponta para `/valdren/campanha-dnd`.

## Testes

- `shared`: os verbetes do guia têm seção válida, ordens únicas e títulos
  únicos; todo povo aponta para uma espécie do SRD.
- `WikiMarkdown`: uma tabela markdown vira `<table>` com as células certas.
- `WikiPage`: o rodapé de atribuição aparece em `campanha-dnd` e em nenhuma
  outra seção.
- `visual/canon`: um pedido mencionando "Fireball" não traz verbete de regras
  como fonte de canon.
- `Layout`: o botão de navegação existe e aponta para a seção.
