# Visibilidade das mudanças de pontos por turno

**Data:** 2026-08-11
**Status:** Aprovado

## Problema

Quando o GM resolve um turno, ele pode alterar os atributos de uma Casa
(ex.: "os anões perderam 1 de controle"). Esses deltas já são aplicados e
persistidos em `TurnResult.attributeDeltas[houseId]`, mas o jogador **não tem
como perceber** que a mudança aconteceu: o `GamePage` mostra apenas as barras
de atributos **atuais** (cumulativas) e o texto narrativo do turno. Logando
como Khaz (casa anã), não há indicação de que o Controle caiu.

## Objetivo

Mostrar ao jogador, **dentro de cada turno do histórico**, quais atributos da
sua Casa mudaram naquele turno e o quanto, preferencialmente com antes→depois.

## Descobertas relevantes (contexto do código)

- `shared/src/types.ts`: `TurnResult` já tem
  `attributeDeltas: Record<string, Partial<Attributes>>` (delta por casa).
  Atributos: `riqueza, recursos, soldados, controle` (`ATTRIBUTE_KEYS`).
- `backend/src/routes/adminRoutes.ts` (`applyResolution`): ao aplicar, faz
  **clamp** em 0–5: `next[k] = Math.max(0, Math.min(5, atual + d))`. Portanto o
  delta bruto pode diferir da mudança efetiva. Além disso, **projetos** também
  alteram atributos depois (`processProjectsForTurn`), fora de `attributeDeltas`.
  → Reconstruir "antes→depois" retroativamente a partir dos atributos atuais é
  impreciso (drift). É preciso capturar um snapshot no momento da resolução.
- `backend/src/routes/playerRoutes.ts` (`getGame`): monta `turnHistory` e
  **descarta** os deltas — só envia `publicResult`, `privateResult`,
  `discoveries`, `resultImageUrl`.
- `frontend/src/pages/GamePage.tsx`: renderiza o histórico por abas; cada turno
  mostra `publicResult`, `privateResult` e imagem. `AttributeBars` tem os
  rótulos PT dos atributos.
- `backend/src/db/turns.ts`: `result` é gravado/lido como está (sem
  re-validação que remova campos) → adicionar campo opcional persiste sem
  migração.

## Decisões (do brainstorming)

1. **Onde:** no histórico de turnos, dentro de cada turno.
2. **Quais atributos:** só os que mudaram naquele turno.
3. **Formato:** antes→depois, ex.: `Controle 3 → 2 (−1)`.
4. **Turnos já resolvidos** (sem snapshot): mostrar só a variação
   (`Controle −1`), a partir de `attributeDeltas`.

## Design

### 1. Shared (`shared/src/types.ts`)

Adicionar campo opcional em `TurnResult`:

```ts
export interface AttributeChange {
  key: AttributeKey;
  before: number;
  after: number;
}

export interface TurnResult {
  // ...campos existentes...
  attributeChanges?: Record<string, AttributeChange[]>;
}
```

- Preenchido **por casa** (`houseId`), contendo **apenas** os atributos cujo
  valor efetivamente mudou (`before !== after`) após o clamp.

### 2. Backend — `applyResolution` (`adminRoutes.ts`)

No laço que aplica os deltas, além de calcular `next`, capturar as mudanças:

```ts
const attributeChanges: Record<string, AttributeChange[]> = {};
for (const [houseId, delta] of Object.entries(body.attributeDeltas)) {
  const h = await getHouse(...);
  if (!h) continue;
  const next = { ...h.attributes };
  const changes: AttributeChange[] = [];
  for (const k of ATTRIBUTE_KEYS) {
    const d = delta[k];
    if (typeof d === "number") {
      const before = h.attributes[k];
      const after = Math.max(0, Math.min(5, before + d));
      next[k] = after;
      if (after !== before) changes.push({ key: k, before, after });
    }
  }
  if (changes.length > 0) attributeChanges[houseId] = changes;
  await updateHouseAttributes(...);
}
```

Passar `attributeChanges` ao `saveTurnResult` (campo omitido quando vazio).

**Nota:** o snapshot cobre exatamente a mudança feita pelo GM (deltas). Efeitos
de projetos continuam fora de escopo (não entram em `attributeChanges`).

### 3. Backend — `playerRoutes.ts` (`getGame`)

Para cada entrada de `turnHistory`, incluir as mudanças da casa do jogador,
com fallback para turnos antigos:

```ts
const changes = t.result!.attributeChanges?.[houseId];
const attributeChanges = changes
  ? changes.map((c) => ({ key: c.key, before: c.before, after: c.after, delta: c.after - c.before }))
  : Object.entries(t.result!.attributeDeltas?.[houseId] ?? {})
      .filter(([, d]) => typeof d === "number" && d !== 0)
      .map(([key, d]) => ({ key: key as AttributeKey, delta: d as number }));
```

Adicionar `attributeChanges` (array, possivelmente vazio) à entrada.

### 4. Frontend — tipos (`frontend/src/types/api.ts`)

```ts
export interface TurnHistoryAttributeChange {
  key: AttributeKey;
  delta: number;
  before?: number;
  after?: number;
}
export interface TurnHistoryEntry {
  // ...existentes...
  attributeChanges?: TurnHistoryAttributeChange[];
}
```

### 5. Frontend — `GamePage.tsx`

Dentro do render de cada turno, se `entry.attributeChanges?.length`, mostrar
uma seção "Mudanças na sua Casa" com um `Chip` por atributo:

- Com `before/after`: `Controle 3 → 2 (−1)`
- Sem (`before/after` ausentes): `Controle −1`
- Cor: verde (`success`) se `delta > 0`, vermelho (`error`) se `delta < 0`.
- Sinal explícito: `+1` / `−1` (usar `−` unicode para negativo).
- Rótulos PT reaproveitados (mesmo mapa do `AttributeBars`; extrair para um
  módulo compartilhável ou duplicar o mapa pequeno).

## Fora de escopo

- Deltas de casas rivais (continua privado por casa).
- Efeitos de projetos sobre atributos (não entram no snapshot).
- Favores, assets, estabilidade, descobertas (já exibidos separadamente).
- Backfill/reconstrução de turnos antigos além do fallback delta-only.

## Testes

- **Backend `applyResolution`:** gera `attributeChanges` só com atributos
  mudados; respeita clamp (delta que não muda o valor por já estar em 0/5 não
  entra); casa sem delta não aparece.
- **Backend `getGame`:** turno novo → `attributeChanges` com before/after;
  turno antigo (só `attributeDeltas`) → fallback delta-only; sem mudanças →
  array vazio.
- **Frontend `GamePage`:** renderiza chip com antes→depois quando disponível;
  renderiza delta-only para turnos antigos; cor correta por sinal; nada
  renderizado quando não há mudanças.
