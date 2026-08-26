# O Escriba — autoria de cânone sem imagem

Data: 2026-08-26

## 1. O pedido

> "Há algum lugar onde o jogador pode adicionar história, personagens, etc. no
> Canônico sem ter que criar imagem? O Estúdio sempre cria imagem parece.
> Podemos implementar um Studio sem imagem, talvez chamemos de Escriba."

## 2. O que a exploração encontrou

A pergunta mistura duas telas, e a resposta é diferente para cada uma.

**O jogador já pode.** `/canonico` aceita texto puro desde que existe: a imagem
sempre foi opcional. `parseCanonSubmitBody` devolve `rawImageUrl: null` quando o
campo falta, e há teste no backend guardando esse caso
(`backend/src/validation/schemas.test.ts:262`). `publishCanonSubmission` só monta
o `VisualAsset` quando há `rawImageKey` — sem imagem, ele publica verbete e
entidade e encerra. **O que falta ali é uma palavra:** o botão diz "Anexar
imagem", sem dizer que dá para pular.

**Quem não pode é o Mestre.** Para escrever um personagem novo hoje, são três
paradas em três seções do painel:

1. **Mundo → Bíblia** → `WikiManager` cria o verbete (texto puro, funciona).
2. **Mundo → Acervo** → achar o verbete → botão **"Criar entidade visual"**, que
   é o que de fato transforma o verbete em personagem.
3. **Mundo → Estúdio** → só então a imagem.

Nenhuma das três se chama "adicionar" nada, e o passo que cria o personagem mora
atrás de um botão chamado *visual* — justamente o que ele não quer. O Estúdio
parece a única porta porque é a única com nome de ferramenta de autoria.

**Conclusão:** o maquinário do Escriba já existe — é o pipeline do `/canonico`.
O que falta é a porta da frente para o Mestre.

## 3. Decisões tomadas na ausência do Mestre

Ele delegou. Registro o que decidi e por quê, para ele reverter se discordar.

| Decisão | Motivo |
|---|---|
| O Escriba é ferramenta de Mestre, no painel, e **publica direto** | Ele é a autoridade; não há a quem submeter. |
| **Também** corrijo o rótulo no formulário do jogador | Ele perguntou "onde o jogador pode"; a resposta é "já pode, mas ninguém sabe". Deixar isso de pé seria não responder. |
| O Escriba **não** cria `CanonSubmission` | Ver §4. |
| A barreira de ficção (`isCanonWikiSection`) **vale também para o Mestre** | O Escriba é a porta do cânone; regras de mesa continuam na Bíblia. |
| A Casa vem de um **seletor**, não da IA | Ver §5. |

## 4. Por que o Escriba não cria uma submissão

O caminho preguiçoso seria criar um `CanonSubmission` já aprovado e chamar
`publishCanonSubmission`. Recusado por dois motivos:

- **`CanonSubmission` modela um pedido aguardando julgamento.** O Mestre é o
  juiz. Uma fila com um item que nunca esperou na fila é mentira no dado.
- **`CanonSubmission.houseId` é `string`, não anulável, e `canonListMine`
  filtra por ele.** Um texto do Mestre arquivado sob uma Casa jogadora
  apareceria em "minhas propostas" daquele jogador — texto que ele não escreveu,
  na tela dele.

Em vez disso, extraio o miolo: `escreverCanone` grava o verbete e, se houver
tipo, a entidade. `publishCanonSubmission` continua como está, dono da parte que
é só dele (o asset e a contabilidade da submissão).

**Recuperação de falha parcial:** se o verbete gravar e a entidade falhar, o
Escriba devolve o `wikiEntryId` e diz ao Mestre que o verbete existe e o
personagem não, apontando para o botão "Criar entidade visual" do Acervo — que é
exatamente o conserto e já está construído. Nenhuma máquina de retomada nova.

## 5. A Casa vem de um seletor

`publishCanonSubmission` tem um comentário explicando que ignora
`proposal.houseId` de propósito: aquele campo é texto livre da IA, que devolve
`"Solarion"` onde se espera `"solarion-k0hc"`. No fluxo do jogador isso se
resolve usando a Casa da sessão dele.

O Mestre não tem Casa. Então o Escriba mostra um seletor com as Casas reais do
`dashboard.houses` mais a opção **"Nenhuma"** — porque muito do que o Mestre
escreve (um lugar, uma figura do Norte, um deus) não pertence a Casa alguma.
`VisualEntity.houseId` já é `string | null`.

## 6. Desenho

### Backend

**`backend/src/canon/escriba.ts`** — novo.

```
escreverCanone(deps, { proposal, houseId }) -> { wikiEntryId, visualEntityId }
```

- Rejeita seção fora do cânone com a mesma checagem de `publish.ts`.
- Grava o `WikiEntry` (`generateWikiId`, `WIKI_APPEND_ORDER`, sem imagem).
- Se `proposal.entityType !== null`, grava o `VisualEntity` com
  `status: "CANONICAL"`, resolvendo colisão de slug do mesmo jeito que
  `publish.ts` (sufixo de 4 caracteres).
- Se a entidade falhar, propaga um erro que **carrega o `wikiEntryId`**, para a
  tela poder dizer o que sobreviveu.

**`backend/src/routes/escribaRoutes.ts`** — novo.

- `POST /api/admin/escriba/preview` — `requireAdmin`, roda o mesmo normalizador
  de IA e devolve `{ proposal, review }`. Sem limite de taxa: é uma pessoa e é
  quem paga a conta.
- `POST /api/admin/escriba` — `requireAdmin`, valida corpo, chama
  `escreverCanone`, devolve os ids.

**Reuso da IA:** o miolo de `canonPreview` (montar contexto, gerar proposta,
gerar parecer best-effort) vira `gerarPropostaCanonica(deps, autorNome, rawText)`
em `backend/src/ai/canonPrompts.ts` ou módulo vizinho. A rota do jogador mantém
o limite de taxa e passa a chamar o helper; a do Mestre chama direto. Um prompt,
um parser, dois donos.

### Frontend

**`frontend/src/pages/enciclopedia/EscribaTab.tsx`** — novo.

Um caminho, dois modos, sem alternância explícita:

1. Campo grande de texto livre.
2. Botão **"Consultar o Escriba"** → chama a prévia, preenche os campos abaixo.
3. Campos **sempre editáveis e sempre visíveis**: título, seção, nome canônico,
   resumo, tipo de entidade (incluindo "nenhum"), traços imutáveis, Casa, corpo.
   Quem quiser escrever à mão simplesmente não aperta o botão da IA — o modo
   manual sai de graça, sem código extra.
4. Botão **"Publicar no cânone"**.
5. Depois de publicar: link para o verbete e, se houve entidade, para o
   personagem — mais a oferta de "gerar imagem no Estúdio", que é o único lugar
   onde imagem aparece nesta tela.

O parecer da IA (`review`), quando vier, é mostrado como aviso — ele é conselho,
não porteiro, e o Mestre publica por cima dele.

**`frontend/src/pages/AdminPage.tsx`** — nova seção **Escriba** no grupo Mundo,
posicionada **antes** de Estúdio: escrever vem antes de ilustrar.

**`frontend/src/components/CanonSubmitForm.tsx`** — o rótulo vira
**"Anexar imagem (opcional)"** e ganha uma linha dizendo que o texto sozinho
basta. Três palavras que respondem à pergunta original.

## 7. Testes

- `backend/src/canon/escriba.test.ts` — publica só verbete quando
  `entityType` é null; publica verbete + entidade quando não é; recusa seção
  fora do cânone; resolve colisão de slug; erro na entidade carrega o
  `wikiEntryId`; `houseId` null chega null na entidade.
- `backend/src/routes/escribaRoutes.test.ts` — exige token de Mestre nas duas
  rotas; a prévia devolve proposta e parecer; publicar devolve os ids.
- Teste de regressão na rota do jogador: o limite de taxa continua valendo
  depois da extração do helper.
- `frontend/src/pages/enciclopedia/EscribaTab.test.tsx` — publicar sem tocar na
  IA funciona; a prévia preenche os campos; campo obrigatório vazio barra o
  envio; a falha parcial mostra o recado do verbete órfão.
- `frontend/src/components/CanonSubmitForm.test.tsx` — o texto "opcional"
  aparece.

## 8. Fora de escopo

- Editar cânone já publicado pelo Escriba (a Bíblia e o Acervo já editam).
- Apagar.
- Imagem em qualquer forma — é o ponto da feature.
- Escriba para o jogador: ele já tem `/canonico`.
