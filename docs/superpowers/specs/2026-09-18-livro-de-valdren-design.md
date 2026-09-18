---
title: "O Livro de Valdren — Romance e Editor no Site"
setting: "Valdren"
status: "Design aprovado (brainstorming feito com o autor)"
date: 2026-09-18
visibility: "Editorial + engenharia"
---

# Objetivo

Duas entregas que andam juntas:

1. **O manuscrito.** Um romance (novelização) da campanha de Valdren, em volume
   único, estilo *O Senhor dos Anéis*, com moldura de memória em primeira pessoa.
   Prosa em português, respeitando o guia de estilo e o cânone.
2. **O editor no site.** Espelho do padrão da wiki: o Mestre edita os capítulos
   num painel; o público lê os capítulos publicados numa página "O Livro". Feito
   com TDD, sob o token de admin existente.

O manuscrito vive em `livro/` (fonte durável). É **compilado** para
`DEFAULT_BOOK_CHAPTERS` em `shared`, que **semeia** o DynamoDB. O Mestre edita no
painel; um script **exporta** o DynamoDB de volta para `livro/`. O ciclo fecha.

```
livro/*.md ──(compile-book)──▶ shared/defaultBook.ts ──(seed)──▶ DynamoDB
     ▲                                                              │
     └──────────────────(export-book)◀─────────────(BookManager edita)
```

---

# Parte A — O romance

## Premissa e logline

Um jovem ferreiro-soldado de Ferrumor — nome de trabalho **Toren**, de linhagem
caladriana — é o único sobrevivente da hoste que marchou ao Norte. Pela boca dos
**Ulgar** ele descobre que o inverno sem fim, os mortos que caminham e o **Rei
Pálido** nascem de uma única fonte: a **Coroa** que fará de **Alic Valerius** rei.
Para salvar Valdren, Toren precisa chegar a Alic e destruir a Coroa. Ele é também
o autor da carta que trouxe a verdade sobre o Norte, e narra tudo já mais velho.

## Reinterpretações de cânone (o coração da adaptação)

- **A Coroa = Palius.** No cânone, Palius é o artefato branco (marfim/osso
  polido) pelo qual Alic fala com o Rei Branco. No romance, ele é reimaginado
  como **coroa**: coroar Alic consuma o poder do inimigo; a Coroa seduz e cobra
  preço. Destruí-la detém o Rei Pálido.
- **O inimigo = Rei Pálido.** O cânone usa **Rei Branco** e proíbe outro nome
  "sem confirmação editorial" (arquivo 15). O romance adota **Rei Pálido** como
  nome literário. **Decisão editorial pendente registrada** (ver Retcons abaixo):
  o nome final precisa da confirmação do autor; enquanto isso o texto usa "Rei
  Pálido" e o wiki público continua "Rei Branco".
- **A Companhia** forma-se no caminho, estilo os livros do Witcher: um anão de
  Khazdrun, um orc do Clã Mandíbula de Osso, um elfo, um draconato de linhagem
  de Krythos (dragões da Guerra dos Céus de Bronze) e um Ulgar. Todos à margem
  da política das Casas — é o que os deixa atravessar a guerra sem tomar lado.

## Adições de cânone assumidas (documentadas como decisões)

Estas preenchem lacunas. Onde o cânone é omisso, seguimos a regra do README:
não resolver em silêncio. Registradas aqui **e** no arquivo de retcons.

1. **A Marcha dos Vinte Mil.** Uma hoste da Coroa somada a levas das Casas marcha
   ao Norte. Sua queda **é** o "silêncio no Norte" do cânone (Rimewatch sem
   resposta, aldeias vazias). O número (~20.000) é literário e coerente com as
   capacidades de mobilização somadas das Casas no censo.
2. **Palius = a Coroa a destruir** (ver acima).
3. **Um ferreiro de Ferrumor na hoste terrestre.** Ferrumor é Casa marítima; a
   presença de Toren numa hoste de terra se justifica por uma **requisição de
   ferreiros de aço negro** feita pela Coroa (Ferrumor produz aço negro no
   cânone). A leva de artesãos é o gancho.
4. **Elenco de povos da Companhia** ancorado nas potências canônicas (Khazdrun,
   Mandíbula de Osso, Solarion/elfos, Drakorys/Krythos, Ulgar).

O metaplot do Mestre (arquivos 15 e 16) permanece **só do Mestre**: o romance
mostra a manipulação por consequência, sem expor a conspiração de Asterhall como
narração pública onisciente.

## Personagens da Companhia (nomes de trabalho)

- **Toren** — ferreiro-soldado de Ferrumor, linhagem caladriana. Narrador.
- **Brunn, filho de Doverin** — anão de Khazdrun (Povo do Primeiro Elo Quebrado).
- **Ghared** — orc do Clã Mandíbula de Osso; respeito histórico pelos anões.
- **Sariel** — elfo (Solarion / deserto de Sahr), batedor e leitor de rotas.
- **Vharos** — draconato de Krythos, linhagem da Guerra dos Céus de Bronze.
- **Umma-Tal** — Ulgar, sobrevivente de Nah'Korah, guarda a verdade sobre o Norte.

## Estrutura (17 capítulos + moldura)

**Título de trabalho:** "O Inverno Morto" (ecoa `WINTER_DEAD`) — alternativa "A
Coroa Pálida". Decisão final do autor registrada como pendência.

- **Prólogo — A mão que ainda lembra.** O velho Toren começa a escrever.
- **Parte I — O Norte Morto** (6 cap.)
  1. A forja e a leva (a requisição de aço negro tira Toren de Ferrum).
  2. A marcha dos vinte mil (a hoste sobe as Cinco Estradas rumo a Stonebridge).
  3. O primeiro morto que não fica.
  4. A queda sob o vórtice branco e o eclipse.
  5. O sobrevivente e a carta (Toren escreve a verdade do Norte).
  6. Os Ulgar: só destruir a Coroa detém o Rei Pálido.
- **Parte II — A Companhia** (6 cap.)
  7. Stonebridge e o anão (Brunn).
  8. A floresta de Na'usca e o orc (Ghared).
  9. As rotas do deserto e o elfo (Sariel).
  10. O estreito e o draconato (Vharos).
  11. A guerra das estradas, atravessada sem tomar lado.
  12. A Coroa sussurra de longe (a tentação chega antes de Asterhall).
- **Parte III — A Coroa** (5 cap.)
  13. O Vale da Coroa e a infiltração em Asterhall.
  14. O menino-rei (confronto com Alic).
  15. A sedução da Coroa (a tentação cobra o seu preço).
  16. A destruição e o preço (final agridoce).
  17. O rescaldo e o retorno à moldura (o velho Toren fecha o livro).

## Regras de estilo (do guia de estilo — obrigatórias)

- Parágrafos contínuos, poucos espaços vazios; falas curtas podem ficar no mesmo
  parágrafo da ação. Subtítulos só para organizar capítulos.
- Tom brasileiro natural, evocativo, sem excesso de adjetivos.
- Política **mostrada por consequência** (celeiros fechados, nomes apagados), não
  declarada.
- **Nunca** reduzir povos a analogias externas (Ulgar não são "taurens", etc.).
- Grafias canônicas do arquivo 17 (Asterhall, Rio Valen, Stonebridge, Khar-Durak,
  Rok'thar, Gor-Kirius, Na'usca, Ferrum, aço negro…).

## Escopo desta entrega (confirmado com o autor)

Primeira versão **completa mas enxuta**: os 17 capítulos + prólogo escritos do
início ao fim, prosa real, **~800–1.500 palavras cada**, prontos para o autor
expandir no editor. Não é esboço: cada capítulo tem começo, meio e fim.

---

# Parte B — Formato do manuscrito (`livro/`)

Uma pasta `livro/` na raiz do repo, com um arquivo por capítulo:

```
livro/
  00-prologo.md
  parte-1/01-a-forja-e-a-leva.md
  parte-1/02-a-marcha-dos-vinte-mil.md
  ...
  parte-3/17-o-rescaldo.md
```

Cada arquivo tem frontmatter YAML + corpo em Markdown:

```markdown
---
chapterId: p1-c01-a-forja-e-a-leva
part: parte-1
order: 1
title: "A forja e a leva"
status: publicado
---

Corpo do capítulo em Markdown, parágrafos contínuos…
```

- `chapterId` é estável e único (slug). É a identidade em todo o pipeline.
- `part` ∈ ids de `BOOK_PARTS` (ver abaixo).
- `order` é a posição **dentro da parte**.
- `status` ∈ `rascunho | publicado`. Nesta entrega, semeados como `publicado`
  (primeira versão completa), para a página pública funcionar de ponta a ponta.

---

# Parte C — Modelo de dados (`shared`)

Espelha `wiki.ts` / `defaultWiki.ts`.

## `shared/src/book.ts`

```ts
export interface BookPart { id: string; label: string; }

export const BOOK_PARTS: BookPart[] = [
  { id: "prologo", label: "Prólogo" },
  { id: "parte-1", label: "Parte I — O Norte Morto" },
  { id: "parte-2", label: "Parte II — A Companhia" },
  { id: "parte-3", label: "Parte III — A Coroa" },
];

export const BOOK_PART_IDS: string[] = BOOK_PARTS.map((p) => p.id);

export function bookPartLabel(id: string): string {
  return BOOK_PARTS.find((p) => p.id === id)?.label ?? id;
}

export type BookStatus = "rascunho" | "publicado";

export interface BookChapter {
  chapterId: string;
  part: string;      // BOOK_PART_IDS
  order: number;     // dentro da parte
  title: string;
  body: string;      // Markdown
  status: BookStatus;
  updatedAt: string; // ISO
}
```

## `shared/src/defaultBook.ts`

`export const DEFAULT_BOOK_CHAPTERS: DefaultBookChapter[]` — **gerado** por
`compile-book.mjs` a partir de `livro/`. `DefaultBookChapter` = `BookChapter` sem
`updatedAt` (o seed carimba a data). Cabeçalho do arquivo marca que é gerado.

## Exports

`shared/src/index.ts` re-exporta `./book.js` e `./defaultBook.js` (igual ao
`wiki`/`defaultWiki`). Assim `@ravenloft/content` expõe `BookChapter`,
`BOOK_PARTS`, `BOOK_PART_IDS`, `bookPartLabel`, `DEFAULT_BOOK_CHAPTERS`.

> **Lembrete:** mudou `shared`? Rode `npm run build:shared` antes de o backend
> enxergar o símbolo. Rode `tsc --noEmit` nos três pacotes.

---

# Parte D — Backend

## `keys.ts`

```ts
export function bookSk(chapterId: string): string { return `BOOK#${chapterId}`; }
export function bookPrefix(): string { return "BOOK#"; }
```

## `db/book.ts`

Espelha `db/wiki.ts`:

- `listBookChapters(doc, table, campaignId): Promise<BookChapter[]>` — Query
  `begins_with(SK, "BOOK#")`, ordenado por índice da parte em `BOOK_PART_IDS`,
  depois `order`, depois `title`.
- `putBookChapter(doc, table, campaignId, chapter): Promise<BookChapter>`.
- `deleteBookChapter(doc, table, campaignId, chapterId): Promise<void>`.
- `seedDefaultBook(doc, table, campaignId): Promise<{ seeded: number }>` — só
  semeia quando **vazio** (idempotente); carimba `updatedAt`. Falha para o lado
  seguro: não sobrescreve capítulos existentes.
- `generateBookId(title)` deriva `chapterId` do título via slug + sufixo curto
  para criação manual no painel (garante unicidade).

## Rotas (`routes/adminRoutes.ts` + `routes/publicRoutes.ts` + `router.ts`)

Público:
- `GET /api/livro` → `getBook`: devolve **só capítulos publicados**, ordenados.

Admin (todas sob `requireAdmin`):
- `GET  /api/admin/livro` → `listBook` (todos, rascunho e publicado).
- `POST /api/admin/livro/create` → `createBookChapter`.
- `POST /api/admin/livro/update` → `updateBookChapter`.
- `POST /api/admin/livro/delete` → `removeBookChapter`.
- `POST /api/admin/livro/reorder` → `reorderBook` (`{ part, chapterIds[] }`,
  regrava `order = índice` de cada capítulo da parte).
- `POST /api/admin/livro/seed` → `seedBook`.

## Validação (`validation/schemas.ts`)

- `parseBookCreateBody` → `{ part, order, title, body, status }` (+ `chapterId`
  derivado no route).
- `parseBookUpdateBody` → `{ chapterId, part, order, title, body, status }`.
- `parseBookDeleteBody` → `{ chapterId }`.
- `parseBookReorderBody` → `{ part, chapterIds: string[] }`.
- `parseBookPart` valida contra `BOOK_PART_IDS`; `parseBookStatus` valida o enum;
  `body` até 60000 chars (capítulos são maiores que verbetes); `title` até 200.

---

# Parte E — Frontend

## Camada de API

- `types/api.ts` / client: re-exporta `BookChapter`, define `BookChapterInput`.
- `httpClient.ts`: `getBook`, `adminListBook`, `adminCreateBookChapter`,
  `adminUpdateBookChapter`, `adminDeleteBookChapter`, `adminReorderBook`,
  `adminSeedBook` (espelho exato dos métodos `...Wiki`).
- `mockClient.ts` + testes: estado em memória, seed idempotente de
  `DEFAULT_BOOK_CHAPTERS`, `getBook` filtra publicados. Espelha os testes de wiki.

## `components/BookManager.tsx` (Mestre)

Espelho de `WikiManager`: formulário com **título**, **parte** (select de
`BOOK_PARTS`), **ordem** (number), **status** (select rascunho/publicado),
**corpo** (multiline Markdown). Ações: salvar (criar/editar), excluir, e
**reordenar** dentro da parte (setas cima/baixo que chamam `adminReorderBook`).
Lista agrupada por parte. Botão "Carregar o livro" quando vazio (chama seed).

Colocação: nova seção **"Livro"** no grupo **"Mundo"** do painel
(`adminNav.ts` + `AdminPage.tsx`), renderizando `BookManager`. É conteúdo de
mundo, editado fora do turno — mesmo lugar da Bíblia e do Canônico.

## Página pública "O Livro"

- `/livro` (`LivroIndexPage`): lista por parte, só capítulos **publicados**, com
  título e ordem; espelha `/valdren` (`WikiIndexPage`) usando `BOOK_PARTS`.
- `/livro/:chapterId` (`LivroCapituloPage`): leitor com Markdown renderizado
  (`WikiMarkdown`), navegação anterior/próximo dentro da sequência publicada.
  Capítulo inexistente ou em rascunho → redireciona para `/livro`.
- Rotas em `App.tsx`.

## Navegação

Adiciona `{ label: "O Livro", to: "/livro", hint: "O romance de Valdren, capítulo
a capítulo" }` a `WORLD_LINKS` em `components/navigation.ts`.

---

# Parte F — Scripts (`backend/scripts`)

## `compile-book.mjs` (+ teste)

Lê `livro/**/*.md`, parseia frontmatter + corpo, valida (`part` em
`BOOK_PART_IDS`, `status` no enum, `chapterId` único), ordena e **gera**
`shared/src/defaultBook.ts` com `DEFAULT_BOOK_CHAPTERS`. Funções puras
(parse/validação/render) testáveis. É a "compilação" do manuscrito.

## `export-book.mjs` (+ teste)

Espelha `restore-wiki.mjs`. Query `begins_with(SK, "BOOK#")` no DynamoDB e
escreve cada capítulo de volta em `livro/<part>/<order>-<slug>.md` com frontmatter.
`--confirm` para escrever; dry-run por padrão. Fecha o round-trip
DynamoDB → manuscrito.

---

# Convenções obrigatórias (CLAUDE.md)

- `vitest` **não** faz typecheck: rodar `tsc --noEmit` em `shared`, `backend`,
  `frontend` sempre.
- Mudou `shared`? `npm run build:shared` antes do backend/scripts enxergarem.
- **Sem deploy** nesta tarefa (deploy é manual, dois passos, skill `deploy`).
- Segredos nunca em arquivo/commit.
- DynamoDB single-table, PK `CAMPAIGN#WINTER_DEAD`, SK prefixo `BOOK#`.
- TDD na feature do site; a prosa do manuscrito é trabalho editorial.

# Retcons e pendências a confirmar com o autor

Registrar em `valdren-context/18_RETCONS...` (ou anexar nota):

1. **Nome do inimigo:** "Rei Pálido" (literário) vs. "Rei Branco" (cânone atual).
2. **Título do livro:** "O Inverno Morto" vs. "A Coroa Pálida".
3. **Palius como Coroa:** confirmar a reinterpretação como canônica ou só
   literária (o wiki público não muda por ora).
4. **Nomes próprios da Companhia** (Toren, Brunn, Ghared, Sariel, Vharos,
   Umma-Tal): nomes de trabalho, ajustáveis.

# Critérios de aceitação

- `livro/` contém prólogo + 17 capítulos em Markdown com frontmatter válido.
- `compile-book.mjs` gera `shared/src/defaultBook.ts`; `tsc --noEmit` passa nos 3
  pacotes; `npm run build:shared` ok.
- Backend: seed idempotente; `GET /api/livro` só publicados; CRUD + reorder sob
  admin; validação rejeita parte/status inválidos.
- Frontend: `BookManager` cria/edita/exclui/reordena; `/livro` lista publicados;
  `/livro/:chapterId` lê Markdown; rascunho não aparece no público; link na nav.
- `export-book.mjs` reescreve `livro/` a partir do DynamoDB (dry-run + confirm).
- Testes novos passam; suíte existente continua verde.
