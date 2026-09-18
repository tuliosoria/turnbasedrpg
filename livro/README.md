# O Livro de Valdren — manuscrito

Esta pasta guarda o romance de Valdren como manuscrito durável: um arquivo
Markdown por capítulo. É a **fonte de verdade** da prosa.

## Fluxo

```
livro/*.md ──(compile-book)──▶ shared/src/defaultBook.ts ──(seed)──▶ DynamoDB
     ▲                                                                  │
     └────────────────(export-book)◀──────────────(Mestre edita no painel)
```

- `backend/scripts/compile-book.mjs` lê estes arquivos e gera
  `shared/src/defaultBook.ts` (`DEFAULT_BOOK_CHAPTERS`).
- O backend semeia o DynamoDB a partir desse default quando o livro está vazio.
- O Mestre edita os capítulos no painel (`/admin`, grupo Mundo → Livro).
- `backend/scripts/export-book.mjs` reescreve estes arquivos a partir do banco.

## Formato de cada arquivo

Frontmatter YAML simples (uma chave por linha) + corpo em Markdown:

```markdown
---
chapterId: p1-c01-a-forja-e-a-leva
part: parte-1
order: 1
title: "A forja e a leva"
status: publicado
---

Corpo do capítulo em Markdown, em parágrafos contínuos…
```

- `chapterId` — identidade estável e única em todo o pipeline.
- `part` — um de: `prologo`, `parte-1`, `parte-2`, `parte-3`.
- `order` — posição do capítulo **dentro da parte**.
- `status` — `rascunho` ou `publicado`. Só `publicado` aparece na página pública.

## Estilo

Ver `valdren-context/17_GUIA_DE_ESTILO_GLOSSARIO_E_CONVENCOES.md`: parágrafos
contínuos, tom brasileiro natural, política mostrada por consequência, povos
nunca reduzidos a analogias externas, grafias canônicas.
