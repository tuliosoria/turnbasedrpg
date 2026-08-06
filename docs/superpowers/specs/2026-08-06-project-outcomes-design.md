# Veredito de Projetos pela IA — Design

Data: 2026-08-06

## Problema

Hoje, os Projetos da Casa concluem de forma **100% determinística**: após
`durationTurns`, `applyCompletion` sempre concede todos os benefícios e o campo
`risks` da carta é apenas texto decorativo, sem efeito mecânico.

O usuário quer que:
1. A IA **sempre escreva riscos** concretos na carta (condições de fracasso).
2. Após X turnos, a IA **decida se o projeto deu certo ou falhou**, pesando os
   riscos declarados, os atributos da Casa e o que aconteceu na campanha.

## Decisões (aprovadas)

- **Granularidade:** binário — `SUCCESS` ou `FAILURE`.
- **Efeitos:** sucesso aplica todos os efeitos; falha não aplica nenhum e os
  custos já gastos ficam perdidos.
- **Base da decisão:** a IA julga narrativamente pesando riscos da carta +
  atributos da Casa + evento público do turno em que o projeto conclui.
- **Controle:** automático ao processar o turno; o resultado já aparece para a
  Casa (o mestre não precisa aprovar).

## Arquitetura

### 1. Riscos sempre presentes
Reforçar `buildProjectCardPrompt` e `buildEnhanceCardPrompt` para exigir pelo
menos um risco concreto. O parser já lê `risks: string[]`; nenhuma mudança de
schema é necessária, apenas instrução de prompt mais firme.

### 2. Modelo de dados (`shared/src/projects.ts`)
- Adicionar `"FAILED"` a `PROJECT_STATUSES`.
- Adicionar a `ProjectCard`:
  - `outcome?: "SUCCESS" | "FAILURE" | null`
  - `outcomeNarrative?: string | null`
  - `resolvedAt?: string | null`

### 3. Resolução por IA (`backend/src/ai/projectPrompts.ts`)
- `buildProjectResolutionPrompt(house, project, campaignEvent, canon)` →
  `{ system, user }`.
  - Sistema: "Você é o mestre. Decida se o projeto deu certo ou falhou, pesando
    os riscos declarados, os atributos da Casa e o que aconteceu na campanha.
    Retorne JSON `{ "success": boolean, "narrative": string }`." Narrativa curta,
    em português.
  - Usuário: título/descrição/riscos do projeto, atributos da Casa, evento
    público do turno e um cânone reduzido.
- `parseProjectResolution(raw)` → `{ success: boolean, narrative: string }`;
  lança `HttpError(502, "AI_PARSE", …)` em formato inválido.
- Chamada via `generateJson(chat, system, user, parseProjectResolution, 2, 500)`.

### 4. Fluxo de conclusão

**Engine (`shared/src/projectEngine.ts`)**
- `processProjectForTurn` continua avançando `turnsCompleted` e sinalizando
  `justCompleted`, mas **não** define mais o status final como `COMPLETED`. O
  status final passa a ser decidido pelo backend após o veredito.
- `applyCompletion` permanece igual e só é chamado no caso de sucesso.

**`backend/src/projects/processTurn.ts`**
- `ProcessTurnDeps` ganha:
  - `judgeOutcome(project, house) => Promise<{ success: boolean; narrative: string }>`
- Ao `justCompleted`:
  1. busca a Casa; se ausente, mantém comportamento seguro (sem efeitos).
  2. chama `judgeOutcome`.
  3. **sucesso:** `applyCompletion` (atributos/assets/favores), status
     `COMPLETED`, `outcome=SUCCESS`.
  4. **falha:** nenhum efeito, status `FAILED`, `outcome=FAILURE`.
  5. grava `outcomeNarrative` + `resolvedAt`; persiste o projeto.

**`backend/src/routes/adminRoutes.ts` (`applyResolution`)**
- Monta `judgeOutcome` usando `deps.chat` + `buildProjectResolutionPrompt` com
  `body.publicResult` como evento e `buildProjectCanon(wiki)` como cânone.
- **Fallback:** se `deps.chat` for indefinido (sem OpenAI), `judgeOutcome`
  retorna `{ success: true }` para preservar o comportamento atual e não travar
  o processamento de turno.

### 5. Frontend (`HouseProjectsPanel.tsx`)
- Cartas concluídas exibem selo verde "Concluído com êxito" (SUCCESS) ou
  vermelho "Fracassou" (FAILURE) e a narrativa da IA (`outcomeNarrative`).
- Tipos re-exportados via `types/api` conforme necessário.

## Testes
- `shared` engine: `processProjectForTurn` marca `justCompleted` na duração e
  deixa o status para o backend.
- `backend` processTurn: caminho de sucesso aplica efeitos + `COMPLETED`;
  caminho de falha não aplica nada + `FAILED` + narrativa; fallback sem juiz →
  sucesso.
- `backend` prompts: `parseProjectResolution` válido/ inválido; o prompt contém
  riscos, atributos e o evento.
- `frontend`: renderiza selo e narrativa para SUCCESS e FAILURE.

## Fora de escopo
- Resultados parciais ou multi-nível.
- Aprovação/edição do veredito pelo mestre.
- Riscos disparando eventos globais na campanha.
