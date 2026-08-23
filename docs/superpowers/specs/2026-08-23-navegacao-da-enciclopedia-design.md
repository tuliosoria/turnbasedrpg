# Navegação da Enciclopédia

## 0. De onde veio

O Mestre:

> "Melhorar navegacao da enciclopedia. Muito texto, audios, personagensm etc. mas navegacao dificil de achar. Fragmentada"

E, apontando o caso concreto:

> "Essa navegacao /valdren/visao-geral nao conversa com essa /personagens por exemplo. E tambem parece que o site pioderia usar mais espaco"

São dois problemas distintos, e este documento trata os dois: as seções do mundo não se ligam, e a tela é estreita demais.

## 1. O diagnóstico

O mundo está repartido em cinco destinos que **já compartilham chaves nos dados e nunca as usam**.

| Página | Liga para | Não liga |
|---|---|---|
| `/valdren/:section` — 23 seções, 130 verbetes, 256 mil caracteres | só o índice da crônica | **nada mais** |
| `/casa/:chave` | personagens da Casa | a crônica |
| `/personagens/:id` | a crônica, quando há verbete | **a Casa: hoje é uma etiqueta morta** |
| `/historias` | a seção da crônica que o áudio narra | — |
| `/galeria` | — | — |

A crônica é ao mesmo tempo o maior volume de texto e o único beco sem saída. É exatamente o que o Mestre notou.

Três exemplos de ligação que o código já teria como fazer hoje:

1. **`/valdren/visao-geral` é narrada por 23 minutos de áudio** — "Valdren, Introdução para um Novo Jogador". O dado `HistoriaContada.section` já aponta para ela. A ligação só existe no sentido Histórias → crônica; quem está lendo nunca fica sabendo que o áudio existe.
2. **A ficha do personagem já calcula a Casa dele** (`seatKeyForAffiliation`, `PersonagemPage.tsx:38`) e desenha o resultado como `Chip` sem link, com a chave na mão.
3. **A crônica já tem barra lateral própria** (`WikiNav`), mas as outras quatro seções não têm nenhuma.

E a largura: `Layout` usa `maxWidth="md"` — **900px para o site inteiro**, grades incluídas. A crônica gasta 232px desses 900 com a barra lateral, sobrando ~620px para o texto. A grade de personagens mostra 3 cartões por linha num monitor onde caberiam 5.

## 2. O que esta feature faz

Quatro partes, da mais estrutural para a mais fina.

### 2.1 A casca compartilhada de "O Mundo"

A barra lateral deixa de ser exclusiva da crônica e passa a existir nas cinco seções, sempre mostrando onde você está e para onde dá para ir. Dentro da crônica, a lista das seções aparece aninhada sob "A crônica" — a `WikiNav` de hoje é reaproveitada, não duplicada.

Isso sozinho já mata o beco sem saída: de qualquer verbete dá para saltar para Personagens.

No celular a barra não aparece — a gaveta que o `Layout` já tem cobre esse caso, e repetir a navegação em duas formas na mesma tela estreita só rouba espaço.

### 2.2 A largura

`Layout` ganha um modo largo **opcional**. As páginas do mundo pedem; o resto do site continua exatamente como está, porque formulário e ficha não melhoram esticando.

A ressalva que importa: **alargar tudo pioraria a leitura**. Linha longa demais cansa a vista. Então a coluna de prosa da crônica para de crescer numa medida legível (~72 caracteres) mesmo dentro da casca larga, e o espaço que sobra vai para a barra lateral e para o painel de ligações. Grades (Personagens, Casas, Galeria) ganham colunas nos tamanhos grandes, que é onde o espaço realmente ajuda.

### 2.3 As ligações que faltam

Todas usando dado que já existe, sem inventar campo novo:

- **Verbete → áudio.** Quando alguma `HistoriaContada` aponta para a seção aberta, o topo da seção oferece a narração, com a duração. `/historias` ganha âncora por id para o link cair no lugar certo.
- **Personagem → Casa.** A etiqueta vira link para `/casa/:chave` quando a chave é conhecida.
- **Casa → crônica.** A página da Casa liga para o verbete `casas`.

### 2.4 O painel "Neste verbete"

No pé de cada verbete, as Casas e os personagens citados naquele texto, cada um levando à sua página.

**Ancorado no verbete, não na seção.** A seção `casas` inteira cita 70 personagens — um painel assim é uma parede, não navegação. Por verbete o número cai para 11 no pior caso, com mediana zero. Ainda assim há um teto de 8 por lista, com "e mais N" levando ao índice: o verbete "Os Vinte e Sete Magos" não deve virar um tapete de etiquetas.

**Medido no texto real da campanha: 110 dos 130 verbetes (85%) ganham pelo menos uma ligação.** As Casas carregam o resultado (107 verbetes), os personagens somam 31.

Nada é escrito no texto do Mestre. Se a detecção errar, ela erra num painel contido no rodapé, não no meio da prosa dele. Foi por isso que descartei transformar menções em link dentro do próprio parágrafo.

## 3. O detector, e por que ele não usa lista feita à mão

Módulo novo em `shared/src/lore/mencoes.ts`, com uma responsabilidade só: dado o corpus de verbetes, dizer quem é citado em cada um.

O caminho ingênuo — quebrar o nome do personagem em palavras e procurar cada uma — **foi testado contra o texto real e reprovado**. Nomes com epíteto produzem termos comuns: "Nima Olhos de Cinza" gera `olhos`, "Rokan Pedra Oca" gera `pedra`, "Irmã Tessa do Último Sino" gera `último` e `sino`. Em `/valdren/visao-geral` isso produzia 4 personagens, dos quais 3 eram falso positivo.

A correção não é uma lista de títulos e palavras proibidas mantida à mão — ela envelhece e some com o autor. **O próprio corpus decide**: uma palavra que o texto de Valdren escreve em minúscula no meio de uma frase é palavra comum, não nome próprio, e está fora. Rodando isso, o filtro descartou sozinho exatamente o lixo esperado — `farao`, `cinzento`, `ferro`, `capitao`, `irmao`, `cinzas`, `bronze`, `almirante`, `mestre`, `ultimo`, `sino`, `chifre`, `pedra`, `olhos`, `primeira` — e manteve `gloriandur`, `kael`, `elira`, `isolde`, `venn`, `vhal`, `arct`. Em `visao-geral` sobrou 1 personagem, o certo.

Duas regras completam:

- **Termo disputado por dois personagens é descartado.** Sem isso, um sobrenome mandaria o leitor para a pessoa errada.
- **Sobrenome que também é nome de Casa fica com a Casa.** "Auremont" no texto é a Casa; o link do personagem sai pelo primeiro nome.

Casas usam o `mentionsHouse` que já existe em `shared/src/lore/houseAssets.ts`, que já cobre nome da Casa e nomes das cidades-sede.

**Interface:** `construirDetector(verbetes)` percorre o corpus uma vez, monta o vocabulário e devolve `mencoesEm(verbete)`. O corpus inteiro é necessário para decidir o que é palavra comum, então a construção é separada da consulta. No frontend a construção é memoizada por lista de verbetes.

## 4. Testes

**No detector** (`shared`), com corpus sintético pequeno, um comportamento por teste:

- Nome próprio citado é encontrado.
- Palavra que o corpus usa em minúscula é descartada, mesmo fazendo parte de um nome.
- Termo que serve a dois personagens não aparece para nenhum.
- Trecho de palavra não conta: "Kaelen" não casa "Kael".
- Verbete sem citação devolve listas vazias.

**No frontend:**

- O verbete mostra as Casas e os personagens citados, com link.
- Lista acima do teto mostra "e mais N".
- Seção narrada em áudio oferece a narração; seção sem áudio não oferece.
- A etiqueta da Casa na ficha do personagem é link.
- A casca do mundo aparece nas cinco seções.

## 5. O que fica de fora

- **Busca.** Um campo que varre tudo resolve procurar o que você já sabe que existe; o problema aqui é esbarrar no que não se sabe. É feature própria.
- **Menção virando link dentro do parágrafo.** Descartado por risco ao texto do Mestre, como explicado na §2.4.
- **Galeria não entra na detecção.** As imagens têm entidade, não texto corrido; ligar imagem a verbete é outro trabalho.
- **Nada muda no backend.** Verbetes, codex e histórias já chegam ao frontend.

## 6. O que o Mestre pode querer mudar

- **O painel fica no pé do verbete.** Se ele preferir no alto, é mover.
- **O teto é 8 por lista.** Número escolhido olhando a distribuição real, não medido com leitor.
- **A Casa liga para o verbete `casas`, genérico.** Não existe verbete por Casa na crônica; se passar a existir, o link melhora sozinho.
- **A detecção não sabe de sinônimo nem apelido.** Quem for citado só por um apelido que não está no nome cadastrado não é encontrado.
