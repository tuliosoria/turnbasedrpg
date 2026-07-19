# Design: Imagens de turno com OpenAI (evento + resultado)

Data: 2026-07-19

## Objetivo

Toda vez que o admin compõe um **evento de turno** e resolve um **resultado de turno**,
ele pode gerar sob demanda uma imagem (dark fantasy / Ravenloft) que acompanha aquele
momento. Jogadores veem a imagem do evento na tela do turno e a do resultado ao resolver.
Uma página de **Galeria** mostra a crônica ilustrada em ordem cronológica.

## Decisões (confirmadas pelo usuário)

1. Geração **sob demanda** via botão no painel do admin (não automática).
2. Escopo: **apenas** imagem de evento e de resultado por turno + galeria cronológica.
3. Visibilidade: jogadores veem inline (turno/resultado) **e** na Galeria pública.
4. Modelo: **gpt-image-1**, qualidade **média**, paisagem **1536x1024**, ~US$0,04/imagem.
5. Prompt: montado automaticamente (Diretrizes Visuais + texto do evento/resultado),
   **editável pelo admin** antes de gerar.

## Restrição técnica

API Gateway HTTP API tem timeout rígido de 30s (não aumentável). gpt-image-1 médio
costuma responder em ~15s, então a geração síncrona funciona na maioria das vezes.
Se estourar, o admin simplesmente tenta de novo. (Async fica para uma versão futura.)

## Arquitetura

### Armazenamento
- Novo bucket S3 com leitura pública (`RavenloftImagesBucket`).
- Lambda ganha permissão `s3:PutObject` no bucket.
- Env `IMAGES_BUCKET`; base URL derivada: `https://<bucket>.s3.<region>.amazonaws.com`.
- Chave do objeto: `turns/<nnn>/event.png` e `turns/<nnn>/result.png`.
- URL salva inclui cache-buster `?v=<timestamp>` para refletir regeração.

### Dados (DynamoDB, tabela existente)
- Item `TURN#<nnn>` ganha dois campos opcionais: `eventImageUrl`, `resultImageUrl`.
- `toTurn` passa a ler esses campos. Nenhum item novo.

### Backend
- `ai/images.ts`: `ImageFn = (prompt) => Promise<Buffer>`; `makeImageFn(apiKey)` usa
  `images.generate({ model: "gpt-image-1", size: "1536x1024", quality: "medium" })`,
  decodifica `b64_json`. Erros mapeados por `mapOpenAiError`.
- `storage/images.ts`: `ImageStore.uploadTurnImage(kind, turnId, buffer) => url` (S3 PutObject).
- `db/turns.ts`: `setTurnImage(kind, turnId, url)`.
- `routes/adminRoutes.ts`:
  - `POST /api/admin/turn/image` `{ kind, prompt }` → gera, sobe ao S3, salva no turno,
    retorna `{ imageUrl }`. Se imagem/armazenamento não configurados → 503 `IMAGE_DISABLED`.
  - `POST /api/admin/turn/image/delete` `{ kind }` → limpa a URL no turno.
- `routes/publicRoutes.ts`: `GET /api/gallery` → turnos com pelo menos uma imagem,
  `{ turnId, publicEvent, eventImageUrl, publicResult, resultImageUrl }`, ordem crescente.
- `routes/playerRoutes.ts`: `getGame` inclui `eventImageUrl` (turno atual) e
  `previousResult.resultImageUrl`.
- `Deps` ganha `image?`, `imageStore?`; `handler.ts` injeta a partir do config.

### Frontend
- `types/api.ts`: campos de imagem nos tipos de turno/resultado; `GalleryEntry`;
  métodos `adminGenerateTurnImage`, `adminDeleteTurnImage`, `getGallery`.
- `client.ts` / `httpClient.ts` / `mockClient.ts`: implementar os três métodos.
- `AdminPage`: nos cards de evento e de resultado, campo de prompt editável (pré-preenchido
  com Diretrizes Visuais + texto), botão **Gerar imagem**, preview e botão **Remover**.
- Tela do jogador: imagem do evento acima do texto; imagem do resultado no resultado anterior.
- Nova página **Galeria** (`/gallery`) + link na navegação: cronologia ilustrada.

## Tratamento de erros
- Sem chave OpenAI ou sem bucket → 503 `IMAGE_DISABLED`, admin escreve/segue sem imagem.
- Erros da OpenAI (cota/auth/timeout) reusam `mapOpenAiError` → mensagem amigável, admin tenta de novo.
- Falha de upload S3 → 502 `IMAGE_ERROR`.

## Testes
- Backend: rota de geração (image+store mockados) salva URL e retorna; `IMAGE_DISABLED`
  quando não configurado; delete limpa URL; `getGallery` filtra/ordena; `toTurn` lê campos.
- Frontend: AdminPage mostra botão e chama `adminGenerateTurnImage` com prompt; Galeria
  renderiza entradas; mockClient cobre os métodos.

## Fora de escopo
Imagens-base permanentes (mapa, Casas, castelos, NPCs), edição/continuidade de imagens,
geração automática e infra assíncrona.
