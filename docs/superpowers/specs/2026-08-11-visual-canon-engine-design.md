# Enciclopédia unificada de Valdren e motor de cânone visual

**Data:** 2026-08-11
**Status:** Aprovado

## Problema

A página `/enciclopedia` ("Enciclopédia Visual") não comunica o que está sendo
construído, não permite criar entidades novas e emite avisos de cânone sem
explicar o motivo. Os três sintomas relatados:

1. **Não fica claro que é a biblioteca visual de Valdren.** A página são três
   abas planas (Galeria / Entidades / Estúdio) sem enquadramento nem noção de
   cobertura.
2. **Não é possível criar entidades novas.** Ao decidir desenhar a Ordem do
   Sino, não há caminho — nem na UI, nem na API.
3. **Aviso de divergência sem justificativa.** Ao gerar uma imagem, aparece
   "Divergência do cânone detectada" sem dizer o que divergiu.

A causa raiz do item 1 é estrutural: **existem duas enciclopédias**. `/valdren`
(`WikiPage`) tem 107 verbetes de lore em 16 seções; `/enciclopedia`
(`EnciclopediaPage`) tem 10 entidades visuais. As duas não se conhecem.

Além disso, o cânone visual hoje é vazio: as 10 entidades foram criadas por
`backend/src/visual/seed.ts` a partir de nomes de arquivo, e todas têm
`immutableTraits: []`. O "cânone" de cada uma é um nome e uma linha de
descrição.

## Objetivo

Transformar `/enciclopedia` na enciclopédia única de Valdren, onde qualquer
verbete de lore pode ser promovido a entidade visual, e onde **o ato de desenhar
enriquece o cânone**: detalhes que o gerador inventa e que o autor aprova viram
fatos permanentes, tanto no cânone visual quanto no texto de lore.

## Descobertas relevantes (contexto do código)

- `shared/src/visual/models.ts`: o vocabulário já existe — `VisualStyleBible`,
  `VisualEntity` com `immutableTraits`/`flexibleTraits`/`prohibitedChanges`,
  ciclo `DRAFT → CANDIDATE → CANONICAL → LOCKED`, `VisualAsset` com
  `referenceRoles`/`parentAssetIds`, `ConsistencyReport`. O que falta não é
  modelagem, é a UI e o pipeline consumirem o que já está modelado.
- `backend/src/ai/visual/contextCompiler.ts:26`: `compileVisualContext` recebe
  **uma** entidade. `VisualGeneration.entityId` é um único ID anulável. Cenas
  com dois personagens e um local são inexprimíveis.
- `backend/src/visual/canon.ts`: `buildCanonicalCanon` concatena apenas os três
  campos de texto da própria entidade. **Nenhum conteúdo do wiki ou de
  `valdren-context` chega ao prompt.**
- `backend/src/visual/worker.ts:48`: o asset de estilo é procurado dentro de
  `entityAssets`, mas referências da Bíblia Visual não pertencem à entidade —
  a busca resolve `null` em praticamente toda geração. **A referência de estilo
  provavelmente nunca foi enviada.**
- `backend/src/visual/worker.ts:51`: `continuityAsset` é fixo em `null`.
- `backend/src/visual/worker.ts:77`: `assetType` é fixo em `"SCENE"`; retratos e
  mapas são arquivados como cenas.
- `backend/src/visual/worker.ts:82`: `extractedVisualDescription` é sempre `""`
  — canonizar uma imagem não extrai nenhuma verdade estruturada.
- `backend/src/router.ts:85-98`: não há `POST`/`PUT` para entidades nem `PUT`
  para a Bíblia Visual. `seedVisual` é o único criador de entidades que já
  existiu.
- `backend/src/db/visual/entities.ts:5`: `putEntity` já existe — falta apenas a
  rota HTTP.
- `frontend/src/pages/enciclopedia/EntidadesTab.tsx`: somente leitura (lista +
  diálogo de imagens). Não exibe traços imutáveis nem status de cânone.
- `frontend/src/pages/enciclopedia/EstudioTab.tsx:183`: renderiza o aviso e o
  score, mas descarta `resultAsset.consistencyReport.violations[]` — que já vem
  no payload com `{severity, category, description}` e
  `correctionInstructions`. **O motivo existe; a UI joga fora.**
- `shared/src/wiki.ts:41`: `WikiEntry` tem `imageUrl`/`imageUrls` — URLs soltas
  sem cânone. É um terceiro conceito de imagem no app.
- `VisualGeneration.sceneThreadId` existe, mas não há modelo, tabela nem
  escritor de `SceneThread`.
- Dados vivos (`CAMPAIGN#WINTER_DEAD`): 107 verbetes de wiki, 10 entidades
  visuais, **todas com `immutableTraits` vazio**.

## Decisões (do brainstorming)

1. **Uma enciclopédia só**, com imagens dentro. `/enciclopedia` passa a navegar
   os verbetes de lore; qualquer verbete pode virar entidade visual.
2. **Registros ligados, não fundidos.** `WIKI#` e `VENTITY#` continuam
   separados, unidos por `wikiEntryId`. O wiki é público e voltado ao jogador; a
   entidade visual carrega maquinário de geração restrito ao admin. Fundir
   forçaria toda edição de lore pelo schema visual.
3. **Duas fases.** Fase 1 torna a ferramenta legível e editável; Fase 2 fecha o
   laço de cânone. A Fase 2 depende da tela de edição criada na Fase 1.
4. **Escrita de volta automática mediante aprovação.** Uma descoberta aprovada
   vira traço imutável **e** é anexada ao texto do verbete, sem revisão de
   redação separada.
5. **Fora de escopo:** scene threads e o sistema de recortes do mapa travado.

## Design

### 1. Shared — `shared/src/visual/models.ts`

`immutableTraits` muda de forma para carregar procedência. Sem procedência não
há como distinguir um traço escrito à mão de um detalhe que uma imagem
estabeleceu, nem voltar à imagem de origem.

```ts
export const TRAIT_SOURCES = ["AUTHORED", "DISCOVERED", "LORE"] as const;
export type TraitSource = (typeof TRAIT_SOURCES)[number];

export interface CanonTrait {
  id: string;
  text: string;
  source: TraitSource;
  originAssetId: string | null;  // imagem que estabeleceu o traço
  createdAt: string;
}

export interface VisualEntity {
  // ...campos existentes...
  immutableTraits: CanonTrait[];   // era string[]
  wikiEntryId: string | null;      // novo
}
```

**Migração:** as 10 entidades vivas têm `immutableTraits: []`, então não há dado
a converter. Ainda assim, a leitura coage `string[]` legado para `CanonTrait[]`
(`source: "AUTHORED"`, `originAssetId: null`) por segurança.

Novo modelo de descoberta:

```ts
export const DISCOVERY_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number];

export interface VisualDiscovery {
  id: string;
  campaignId: string;
  entityId: string;
  assetId: string;              // imagem que originou
  text: string;                 // "O mar em Krythos é verde-escuro, quase opaco."
  category: string;             // paleta | material | arquitetura | vestuário | ...
  proposedLoreSentence: string; // frase a anexar ao verbete
  status: DiscoveryStatus;
  createdAt: string;
  resolvedAt: string | null;
}
```

### 2. Chaves — `backend/src/keys.ts`

```ts
export function discoveryKey(id: string): string { return `VDISC#${id}`; }
export function discoveryPrefix(): string { return "VDISC#"; }
```

Descobertas persistem (em vez de viver só num modal) para permitir canonizar
agora e revisar depois. `REJECTED` é guardado para nunca ser reproposto.

---

## Fase 1 — Tornar legível e editável

### 3. Backend — rotas novas

| Método | Rota | Função |
|---|---|---|
| `POST` | `/api/visual/entities` | cria entidade (admin) |
| `PUT` | `/api/visual/entities/:id` | atualiza cânone da entidade (admin) |
| `PUT` | `/api/visual/style-bible` | edita a Bíblia Visual (admin) |
| `GET` | `/api/visual/coverage` | verbetes × entidades, para o indicador e a reconciliação |

`POST /api/visual/entities` aceita `wikiEntryId` opcional; quando presente,
pré-preenche `canonicalName` e `publicDescription` a partir do verbete.

Validação em `backend/src/validation/visualSchemas.ts`, seguindo o padrão dos
schemas existentes. `putEntity` já existe em `backend/src/db/visual/entities.ts`.

### 4. Frontend — `/enciclopedia` reestruturada

`EnciclopediaPage` passa a ter navegação por seções do wiki (`WIKI_SECTIONS`),
espelhando `/valdren`, com Estúdio, Bíblia Visual e Revisão abaixo:

```
Valdren — Enciclopédia          10 de 107 verbetes com cânone visual
┌──────────────┬──────────────────────────────────────────────┐
│ Casas     14 │  Ordem do Sino              lore ✓  visual ✗ │
│ Cidades   17 │  Khar-Durak       [thumb]   lore ✓  visual ✓ │
│ Povos      5 │                                              │
│ …            │  ── Entidades sem verbete ──                 │
│ Estúdio      │  Mapa Oficial de Valdren     [vincular]      │
│ Bíblia Visual│                                              │
│ Revisão   3  │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

A linha de cobertura ("10 de 107 verbetes com cânone visual") é o elemento que
responde "o que estou construindo aqui?".

**Promoção.** O verbete aberto mostra o texto de lore e uma ação primária
**Criar entidade visual**, que cria o `VENTITY#` já ligado e pré-preenchido.

**Reconciliação.** As 10 entidades existentes não têm `wikiEntryId`. Uma tela
propõe correspondências por similaridade de título (entidade *Khar-Durak* →
verbete *Khar-Durak*) para confirmar ou rejeitar. As não correspondidas ficam em
*Entidades sem verbete* com ação de vincular.

### 5. Frontend — ficha de cânone (editor de entidade)

Substitui o diálogo somente-leitura de `EntidadesTab`. Expõe o que o schema já
modela e nenhuma UI mostrava: traços imutáveis (cada um com selo de origem e
link para a imagem que o estabeleceu), traços flexíveis, mudanças proibidas,
palavras-chave visuais, escala, contexto cultural, e a lista de imagens com os
controles de ciclo `DRAFT → CANDIDATE → CANONICAL → LOCKED`.

### 6. Frontend — transparência das violações

Em `EstudioTab`, o bloco de resultado passa a renderizar o relatório que já é
pago e recebido:

- cada violação como chip de severidade + categoria + descrição;
- os quatro sub-scores (estilo, identidade, arquitetura, paleta);
- `correctionInstructions`;
- **quais referências foram efetivamente anexadas** (de
  `generation.referenceAssetIds`), tornando o pipeline inspecionável.

### 7. Backend — correções de bugs

- `worker.ts:48`: carregar o asset de estilo por ID a partir da Bíblia Visual,
  não de `entityAssets`.
- `worker.ts:77`: `assetType` vem do pedido, não fixo em `"SCENE"`.

---

## Fase 2 — Fechar o laço de cânone

### 8. Resolução de entidades (determinística)

Antes de qualquer chamada de IA, o texto do pedido é casado contra
`canonicalName` e `aliases` das entidades da campanha. Os casamentos aparecem
como chips removíveis, e o autor pode adicionar entidades que o matcher perdeu.
Nenhum modelo adivinha quais entidades foram citadas.

Esse mesmo conjunto resolvido alimenta a verificação de lore **e** a montagem de
contexto — razão pela qual as duas entram na mesma fase.

### 9. Verificação de lore pré-geração

Com as entidades resolvidas, reúnem-se seus traços imutáveis e os corpos dos
verbetes ligados, e faz-se **uma chamada de texto** (barata): o pedido
contradiz algum desses fatos? As contradições voltam com a linha de cânone
específica que cada uma viola:

```
⚠ Você pediu "Khar-Durak numa planície aberta".
  Cânone: "cidade escavada no interior de uma montanha à beira-mar"
          — verbete Khar-Durak, traço imutável.
  [Corrigir pedido]  [Gerar mesmo assim]
```

**Avisa, nunca bloqueia** — às vezes quebrar o cânone é intencional (uma cidade
depois de um incêndio). Roda antes da geração de imagem, então o erro custa uma
chamada de texto em vez de uma imagem.

### 10. Montagem de contexto multi-entidade

`compileVisualContext` passa de uma entidade para uma lista de sujeitos mais um
local opcional:

```ts
export interface EntityContext {
  entity: VisualEntity;
  role: "PRIMARY_SUBJECT" | "SECONDARY_SUBJECT" | "LOCATION";
  loreExcerpt: string;   // do verbete ligado
}

export interface VisualContextPackage {
  styleBible: VisualStyleBible;
  subjects: EntityContext[];
  location: EntityContext | null;
  userRequest: string;
  isLocked: boolean;
  // ...negativos agregados...
}
```

`compilePrompt` renderiza um bloco por entidade em vez da linha única
"Entidade principal".

`selectReferences` passa a ser consciente de papel, com ordem de prioridade
explícita sob um orçamento de referências (padrão 6, configurável):

```
estilo → identidade do sujeito primário → arquitetura do local
       → sujeitos secundários → continuidade
```

Acima do orçamento as referências se diluem entre si; a ordem é o que protege o
rosto do sujeito primário.

Isso torna exprimível *"Aylin no salão do trono de Asterhall falando com Alic"*
— caso que o pipeline atual não consegue representar.

### 11. Extração de descobertas na canonização

Ao **aprovar** uma imagem (não a cada geração — uma chamada de visão por
canonização, não por tentativa), uma passagem de visão compara a imagem com tudo
o que o cânone já afirma e relata apenas o que a imagem **acrescentou**:

```
Esta imagem estabeleceu fatos que o cânone não especificava:
 ☑ O mar em Krythos é verde-escuro, quase opaco.        (paleta)
 ☑ As muralhas de Akrathos usam pedra vulcânica escura.  (material)
 ☐ Céu nublado ao entardecer.                            (variável)
```

- **Marcado** → `CanonTrait{source: "DISCOVERED", originAssetId}` na entidade
  **e** anexa `proposedLoreSentence` ao verbete.
- **Desmarcado** → gravado como `REJECTED`, nunca mais proposto (senão toda
  imagem futura de Krythos sugeriria o céu nublado de novo).

O terceiro item mostra o julgamento necessário: clima é flexível, cor do mar é
cânone. A passagem propõe; o autor decide quais invenções se tornam permanentes.

**Gatilho e atribuição.** A extração é disparada por
`POST /api/visual/assets/:id/canonize`, de forma assíncrona (mesmo caminho de
worker da geração), para não bloquear a resposta da canonização. As descobertas
ficam `PENDING` e aparecem em *Revisão*.

Numa cena multi-entidade a passagem recebe **a lista de entidades resolvidas
daquela geração** e precisa atribuir cada descoberta a exatamente uma delas —
"o mar em Krythos é verde-escuro" pertence à entidade Krythos, não ao
personagem em primeiro plano. Descobertas que a passagem não conseguir atribuir
a uma entidade da lista são descartadas, não adivinhadas.

**Entidades `LOCKED`:** travar impede *alterar* traços estabelecidos;
descobertas apenas *acrescentam* fatos que o cânone nunca especificou, então
continuam permitidas. Uma "descoberta" que contradiz um traço existente não é
descoberta — aparece como violação de consistência.

### 12. Escrita de volta no verbete

A frase aprovada é anexada ao corpo do `WikiEntry` sob um bloco delimitado no
fim do texto:

```markdown
## Detalhes visuais canônicos

O mar em Krythos é verde-escuro, quase opaco.
As muralhas de Akrathos usam pedra vulcânica escura.
```

Nunca intercalada na prosa autoral. O guia de estilo
(`valdren-context/17_GUIA_DE_ESTILO_GLOSSARIO_E_CONVENCOES.md`) pede parágrafos
contínuos; frases anexadas por máquina não podem corromper essa voz. O bloco é
editável e podável como qualquer outro texto do verbete.

A escrita usa o caminho existente de atualização de wiki
(`POST /api/admin/wiki/update`). A inserção é **idempotente**: anexar duas vezes
não pode produzir dois blocos `## Detalhes visuais canônicos`.

## Fora de escopo

- **Scene threads.** `sceneThreadId` permanece campo declarado e não usado.
- **Recortes regionais do mapa travado.** `mapAssetId` continua sem consumidor.
- **Unificar `WikiEntry.imageUrl`/`imageUrls`** com `VisualAsset` — as URLs
  soltas continuam funcionando; a migração fica para depois.
- **Revisão de redação separada** para a escrita de volta (decidido: automática
  mediante aprovação da descoberta).
- **Geração multi-imagem** (variações por pedido).
- **Backfill de traços imutáveis** para as 10 entidades existentes a partir do
  lore — possível depois via a mesma passagem de extração, mas não nesta entrega.

## Testes

Toda a lógica acima fica atrás de dependências injetadas, seguindo o padrão
`WorkerDeps` de `backend/src/visual/worker.ts`, então testa sem rede. As
chamadas de IA são falsificadas como em `backend/src/ai/visual/evaluator.test.ts`.

**Shared**
- Coerção de `immutableTraits` legado (`string[]` → `CanonTrait[]`).
- `newVisualEntity` produz `immutableTraits: []` e `wikiEntryId: null`.

**Backend — Fase 1**
- `POST /api/visual/entities`: cria; com `wikiEntryId` pré-preenche nome e
  descrição; rejeita sem admin; rejeita slug duplicado.
- `PUT /api/visual/entities/:id`: atualiza traços; preserva procedência de
  traços `DISCOVERED`; 404 em entidade inexistente.
- `PUT /api/visual/style-bible`: incrementa `version`; arquiva a anterior.
- `GET /api/visual/coverage`: conta verbetes e entidades ligadas corretamente.
- `worker`: o asset de estilo é resolvido a partir da Bíblia Visual (regressão
  do bug de `worker.ts:48`); `assetType` reflete o pedido.

**Backend — Fase 2**
- Resolução: casa por `canonicalName` e por `aliases`; ignora acento e caixa;
  não casa substring espúria; retorna vazio sem entidades.
- Verificação de lore: monta o pacote com traços + corpos de verbete; ausência
  de contradição não bloqueia; contradição retorna a linha de cânone citada.
- Orçamento de referências: respeita o teto; mantém a ordem de prioridade;
  sujeito primário nunca é cortado antes de secundários.
- `compilePrompt` multi-entidade: um bloco por entidade; local renderizado
  separadamente; pedido sem entidades ainda gera prompt válido.
- Descobertas: aceita → vira `CanonTrait` com `originAssetId`; rejeita → status
  `REJECTED` e não é reproposto na extração seguinte; descoberta que contradiz
  traço existente não vira descoberta; em cena multi-entidade cada descoberta é
  atribuída à entidade correta, e a não atribuível é descartada.
- Escrita de volta: cria o bloco quando ausente; **anexa dentro do bloco
  existente sem duplicá-lo**; preserva a prosa anterior intacta.

**Frontend**
- `EnciclopediaPage`: renderiza seções e a linha de cobertura; verbete sem
  entidade mostra `visual ✗` e o botão de promoção.
- Ficha de cânone: exibe selo de origem por traço; link para a imagem de origem
  quando `originAssetId` existe.
- `EstudioTab`: renderiza cada violação com severidade, categoria e descrição;
  renderiza as referências anexadas; sem violações mostra o estado de sucesso.
- Painel de descobertas: marcar/desmarcar; confirma só as marcadas.
