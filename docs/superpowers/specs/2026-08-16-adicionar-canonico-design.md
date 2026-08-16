# Adicionar Canônico — Design

Data: 2026-08-16

## Problema

Hoje o cânone de Valdren só cresce por três caminhos, todos fechados ao jogador
e caros para o Mestre:

- verbetes de wiki e da bíblia do Mestre, por formulário de admin
  (`backend/src/routes/adminRoutes.ts:289-340`, `frontend/src/components/WikiManager.tsx`);
- personagens, por script que reescreve um arquivo versionado
  (`backend/scripts/seed-house-characters.mjs` → `shared/src/lore/characters.ts`);
- entidades e imagens, pelo Estúdio Visual
  (`backend/src/routes/visualRoutes.ts:92-220`).

Quem joga não tem por onde dizer "existe um ferreiro chamado Aldric em Droskar,
e ele é assim". A ficção que nasce na mesa morre no chat.

"Adicionar Canônico" abre uma porta única: texto livre, imagem opcional, e o
mundo passa a saber daquilo.

## Premissas

O usuário não estava disponível durante o brainstorming. As decisões abaixo
foram tomadas de forma autônoma e devem ser contestadas na revisão.

1. **Jogador propõe, Mestre aprova.** O cânone alimenta todos os prompts de IA e
   a Enciclopédia pública; escrita direta pelo jogador contaminaria o mundo sem
   controle editorial. O repositório já usa esse padrão em projetos
   (`PENDING_GM` em `backend/src/routes/projectRoutes.ts`).
2. **"Atualiza história e contexto" significa virar `WikiEntry`.** É o que os
   montadores de prompt já leem. Nenhum wiring novo de prompt é necessário.
3. **A IA normaliza e critica, nunca publica.** Ela transforma texto solto em
   proposta estruturada e aponta conflitos com o cânone existente; a decisão é
   sempre humana.

## O que a feature faz

Uma pessoa escreve um texto livre e, se quiser, anexa uma imagem. O sistema:

1. **normaliza** — a IA converte o texto em uma proposta estruturada: título,
   seção da wiki, corpo em markdown, tipo de entidade, palavras-chave visuais e
   traços imutáveis;
2. **critica** — a IA compara a proposta com todo o cânone existente e devolve
   contradições e duplicatas;
3. **enfileira** — a proposta vira uma submissão pendente;
4. **publica, sob aprovação do Mestre** — a submissão aprovada vira um verbete
   de wiki, e opcionalmente uma entidade visual e um asset canônico com a imagem
   enviada.

A partir daí o mundo enxerga: a Enciclopédia mostra o verbete, o motor
narrativo o inclui no contexto do turno, o motor de projetos o usa como cânone e
o compilador visual pode citá-lo ao gerar imagens.

## Por que isso é barato

O contexto que a IA lê já se monta a partir da wiki:

- `buildPublicEventContext` recebe os verbetes (`backend/src/ai/prompts.ts:176-214`);
- `buildProjectCanon(await listWikiEntries(...))` alimenta projetos
  (`backend/src/routes/adminRoutes.ts:500`);
- `compileVisualContext` casa o pedido de imagem contra os verbetes canônicos
  (`backend/src/ai/visual/contextCompiler.ts`);
- `GET /api/wiki` já publica na Enciclopédia (`backend/src/router.ts`).

Publicar como `WikiEntry` é, portanto, o único ponto de integração. A feature não
inventa um segundo cânone paralelo — ela alimenta o que já existe.

## Modelo de dados

Um agregado novo, `CanonSubmission`, guardado na partição da campanha sob o
prefixo `CANONSUB#`, no mesmo padrão de `WIKI#` e `GM#`.

```ts
// shared/src/canon/models.ts
export const CANON_SUBMISSION_STATUSES = ["PENDING_GM", "APPROVED", "REJECTED"] as const;
export type CanonSubmissionStatus = (typeof CANON_SUBMISSION_STATUSES)[number];

export interface CanonProposal {
  title: string;
  section: string;                      // id de WIKI_SECTIONS, sempre canônico
  body: string;                         // markdown
  summary: string;                      // uma ou duas frases
  entityType: VisualEntityType | null;  // null = só verbete, sem entidade visual
  visualKeywords: string[];
  immutableTraits: string[];
}

export interface CanonConflict {
  entryId: string;
  title: string;
  explanation: string;
}

export interface CanonReview {
  verdict: "OK" | "ATENCAO" | "CONFLITO";
  conflicts: CanonConflict[];
  duplicates: CanonConflict[];
  notes: string;
}

export interface CanonSubmission {
  submissionId: string;
  status: CanonSubmissionStatus;
  authorType: "PLAYER" | "GM";
  authorHouseId: string | null;
  rawText: string;                      // o que a pessoa escreveu, nunca reescrito
  rawImageUrl: string | null;
  proposal: CanonProposal;              // editável pelo Mestre antes de aprovar
  review: CanonReview | null;
  gmNote: string | null;
  wikiEntryId: string | null;           // preenchidos na aprovação
  visualEntityId: string | null;
  visualAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}
```

`rawText` e `rawImageUrl` guardam o pedido original intacto. O Mestre sempre
consegue ver o que a pessoa realmente pediu, e não só o que a IA entendeu.

Chaves novas em `backend/src/keys.ts`:

```ts
export function canonSubmissionSk(submissionId: string): string {
  return `CANONSUB#${submissionId}`;
}
export function canonSubmissionPrefix(): string {
  return "CANONSUB#";
}
```

## Fluxo

### Jogador

1. Abre `/canonico`, escreve o texto e, se quiser, anexa uma imagem.
2. A imagem sobe primeiro por `POST /api/player/canonico/imagem`, que devolve a
   URL pública. O corpo é binário, como em `uploadTurnImage`
   (`backend/src/routes/adminRoutes.ts:567-579`). A rota gera o id da imagem no
   servidor, sem confiar em nada vindo do cliente, e grava em
   `canon/{imageId}/original.{ext}`. A imagem existe antes da submissão; imagem
   enviada e nunca submetida fica órfã no bucket, custo aceitável frente a
   inventar rascunho persistido só para isso.
3. `POST /api/player/canonico/preview` devolve `{ proposal, review }` sem gravar
   nada. A pessoa lê a crítica, ajusta o texto e pede outra prévia se quiser.
4. `POST /api/player/canonico` grava a submissão com status `PENDING_GM`.
5. `GET /api/player/canonico` lista as próprias submissões e o que foi feito com
   elas.

### Mestre

1. Nova aba "Canônico" no `/admin` lista as submissões pendentes.
2. Para cada uma, o Mestre vê o texto cru, a imagem, a proposta normalizada e a
   crítica da IA. Todos os campos da proposta são editáveis ali mesmo.
3. `POST /api/admin/canonico/approve` publica. `POST /api/admin/canonico/reject`
   recusa com uma nota que volta para o jogador.
4. O Mestre também escreve cânone próprio pela mesma tela: o front encadeia
   prévia, envio e aprovação, gravando com `authorType: "GM"`. O backend não
   ganha caminho especial para isso.

### Publicação

`backend/src/canon/publish.ts` concentra o efeito da aprovação, isolado das
rotas para poder ser testado sozinho:

1. cria o `WikiEntry` com `generateWikiId()` e `putWikiEntry`, usando
   `imageUrl`/`imageUrls` quando houve imagem;
2. se `proposal.entityType` não for nulo, cria a `VisualEntity` com
   `wikiEntryId` já apontando para o verbete — o vínculo que hoje só se obtém
   rodando `backend/scripts/reconcile-entities.mjs`;
3. se houve imagem e entidade, cria o `VisualAsset` com
   `canonicalLevel: "CANONICAL"` ligado à entidade.

A publicação é sequencial e sem transação, mas **retomável**: `publish` recebe a
submissão e pula todo passo cujo id já esteja gravado nela. A rota grava a
submissão depois de cada passo bem-sucedido, então uma falha no meio deixa
`wikiEntryId` preenchido e `status` ainda em `PENDING_GM`. O Mestre aprova de
novo e o fluxo continua de onde parou, sem duplicar o verbete. Só quando os três
passos terminam a submissão vira `APPROVED` com `resolvedAt`.

Isso troca transação distribuída — cara e desnecessária para um fluxo com um
único operador humano — por um agregado que carrega o próprio progresso.

## Prompts

`backend/src/ai/canonPrompts.ts`, no formato dos prompts existentes
(`buildEnhanceCardPrompt` em `backend/src/ai/projectPrompts.ts`):

- `buildCanonProposalPrompt(rawText, sections, houseContext)` — recebe o texto e
  a lista de seções canônicas, devolve JSON com os campos de `CanonProposal`.
  Instrui a escrever de dentro do mundo, sem termos de mesa, respeitando o guia
  de estilo de Valdren.
- `buildCanonReviewPrompt(proposal, canonEntries)` — recebe a proposta e os
  verbetes canônicos, devolve JSON com `CanonReview`.

Os dois usam `generateJson` com parser dedicado e retry, como o resto do código.
Só seções canônicas entram, filtradas por `isCanonWikiSection`, para que regra de
D&D não vaze para dentro da ficção — a mesma razão documentada em
`backend/src/db/wiki.ts:66-73`.

## Rotas

| Método | Caminho | Quem | Papel |
| --- | --- | --- | --- |
| POST | `/api/player/canonico/preview` | jogador | normaliza e critica, sem gravar |
| POST | `/api/player/canonico/imagem` | jogador | sobe a imagem, devolve a URL |
| POST | `/api/player/canonico` | jogador | grava a submissão |
| GET | `/api/player/canonico` | jogador | lista as próprias submissões |
| GET | `/api/admin/canonico` | Mestre | fila de revisão |
| POST | `/api/admin/canonico/approve` | Mestre | publica |
| POST | `/api/admin/canonico/reject` | Mestre | recusa com nota |

Registradas em `backend/src/router.ts`, handlers em
`backend/src/routes/canonRoutes.ts`, autenticação por `requirePlayer` e
`requireAdmin`.

## Erros

| Situação | Resposta |
| --- | --- |
| IA não configurada | 503 `AI_DISABLED` |
| armazenamento de imagem não configurado | 503 `IMAGE_DISABLED` |
| prévia acima do limite | 429 `RATE_LIMITED`, 10 por hora por jogador, via `hitRateLimit` |
| seção inexistente ou não canônica | 400 `BAD_REQUEST` |
| texto vazio ou acima do limite | 400 `BAD_REQUEST` |
| submissão já resolvida | 409 `BAD_STATUS` |
| submissão inexistente | 404 `NOT_FOUND` |
| jogador lendo submissão de outra Casa | 404 `NOT_FOUND` |

Limites: `rawText` até 4000 caracteres, `title` até 120, `body` até 8000,
`summary` até 400. Aplicados por `clampCanonText` em `shared/`, para que backend
e frontend concordem.

## Arquivos

Novos:

- `shared/src/canon/models.ts` — tipos, limites, validação de seção e status
- `backend/src/db/canonSubmissions.ts` — leitura e escrita do agregado
- `backend/src/ai/canonPrompts.ts` — prompts e parsers
- `backend/src/canon/publish.ts` — submissão aprovada → verbete, entidade, asset
- `backend/src/routes/canonRoutes.ts` — handlers de jogador e Mestre
- `frontend/src/components/CanonSubmitForm.tsx` — formulário, usado nas duas telas
- `frontend/src/pages/CanonicoPage.tsx` — página do jogador
- `frontend/src/components/admin/AdminCanonTab.tsx` — fila do Mestre

Alterados:

- `backend/src/keys.ts` — `canonSubmissionSk`, `canonSubmissionPrefix`
- `backend/src/storage/images.ts` — `uploadCanonImage`, gravando em `canon/{id}/original.{ext}`
- `backend/src/router.ts` — as sete rotas
- `shared/src/index.ts` — exporta o módulo novo
- `frontend/src/App.tsx` — rota `/canonico`
- `frontend/src/components/navigation.ts` — item de menu
- `frontend/src/api/client.ts`, `httpClient.ts`, `mockClient.ts` — os métodos novos
- `frontend/src/pages/AdminPage.tsx` — a aba nova

Cada arquivo novo tem um propósito só: `models.ts` define a forma,
`canonSubmissions.ts` guarda, `canonPrompts.ts` conversa com a IA,
`publish.ts` decide o efeito da aprovação, `canonRoutes.ts` costura. Dá para
testar `publish.ts` sem IA e `canonPrompts.ts` sem banco.

## Testes

- `shared/src/canon/models.test.ts` — limites, seções não canônicas recusadas,
  transições de status válidas
- `backend/src/ai/canonPrompts.test.ts` — o prompt de crítica só recebe verbete
  canônico; parsers rejeitam JSON malformado
- `backend/src/canon/publish.test.ts` — verbete criado; entidade criada só quando
  há `entityType`; asset criado só quando há imagem e entidade; `wikiEntryId`
  ligado na entidade; republicar submissão com `wikiEntryId` já gravado não cria
  verbete duplicado
- `backend/src/routes/canonRoutes.test.ts` — autenticação, rate limit, jogador
  não enxerga submissão alheia, aprovar duas vezes dá 409
- `frontend/src/components/CanonSubmitForm.test.tsx` — prévia exibe conflitos;
  envio bloqueado com texto vazio
- `frontend/src/components/admin/AdminCanonTab.test.tsx` — edição da proposta
  antes de aprovar; rejeição exige nota

Rodando com `npm test` na raiz, que já encadeia os três pacotes.

## Fora de escopo

- **Não mexer em `shared/src/lore/characters.ts`.** É arquivo gerado por script e
  compilado no bundle. Personagem novo entra como verbete de wiki mais entidade
  visual do tipo `CHARACTER`; a página `/personagens` continuar lendo o codex
  estático é uma limitação conhecida, tratada depois.
- **Não gerar imagem por IA neste fluxo.** O Estúdio Visual já faz isso, melhor.
  Aqui só se anexa imagem pronta.
- **Sem histórico ou versionamento de submissão.** A submissão registra um
  estado final; correção posterior se faz no `WikiManager`, que já existe.
- **Sem edição depois de aprovada.** Aprovou, virou verbete; dali em diante o
  dono é o `WikiManager`.
- **Sem escrita na bíblia do Mestre.** Segredo de Mestre não nasce de proposta de
  jogador.

## Questões para a revisão

1. O jogador deve poder propor cânone sobre outras Casas, ou só sobre a própria e
   sobre o mundo em geral? O desenho atual não restringe — a aprovação do Mestre
   é o filtro.
2. Submissão aprovada deve aparecer com crédito ao jogador na Enciclopédia?
   O desenho atual não credita.
3. Dez prévias por hora é generoso ou apertado demais?
