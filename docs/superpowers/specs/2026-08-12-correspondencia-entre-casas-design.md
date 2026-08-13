# Correspondência entre Casas — Fase A

**Data:** 2026-08-12
**Status:** Aprovado

## Problema

Entre um turno e outro os jogadores não têm como conversar com as outras Casas. Toda diplomacia precisa caber na ação única do turno, o que empobrece o jogo político — que é o coração do cenário — e concentra no GM o trabalho de interpretar treze Casas NPC.

## Objetivo

Permitir que um jogador escreva para outra Casa entre turnos e receba resposta da IA no papel daquela Casa, com quantidade de mensagens limitada pela distância geográfica, tudo visível ao GM e registrado como história desta partida.

## Descobertas relevantes

- `valdren-context/PUBLICO/02_ATLAS_GEOGRAFICO_CANONICO.md` §1.18 tem tempos de viagem **a partir de Asterhall** — uma tabela radial, não pareada. Não existe Solarion↔Karasoy direto, então o orçamento por par precisa de um modelo próprio.
- `valdren-context/PUBLICO/10_RELACOES_RIVALIDADES_E_FERIDAS_HISTORICAS.md` define mágoas concretas entre Casas (o Tempo sem Nomes entre Mandíbula de Osso e Solarion; a Marcha dos Cascos Vazios entre Karasoy e Auremont; os celeiros fechados entre Vargen e Auremont). Sem isso no prompt, toda Casa responde igualmente cordial e o sistema perde o sentido.
- A campanha viva tem **3 Casas com jogador** (Casa do Ouro, Khazdrun, Solarion) e 13 NPC.
- `valdren-context/MESTRE/` contém a conspiração de Alic, a sabotagem da Asteria e os arcos de revelação. Nada disso pode alcançar uma resposta de IA.
- O DynamoDB já particiona tudo por `CAMPAIGN#<id>`, então partidas diferentes já são isoladas por construção.

## Decisões

1. **Fase A não inclui jogador-a-jogador.** Mensagens para Casas com jogador ficam fora de escopo; a Fase A cobre apenas Casas NPC.
2. **Distância vem de coordenadas no mapa canônico**, validadas contra a tabela radial do atlas.
3. **Extração de fatos é automática**, sem porta de aprovação — mas cada fato guarda a mensagem de origem e é editável e removível no admin.
4. **Cânone e partida são camadas separadas.** O wiki descreve o mundo e vale para qualquer campanha; correspondência e acordos são desta partida.

## Design

### 1. Distância e orçamento

Cada sede recebe uma coordenada `(x, y)` no mapa canônico de 1536×1024. A distância entre duas Casas é a euclidiana entre suas sedes, convertida para quilômetros pela escala do atlas (a ilha tem ~560 km no eixo norte-sul).

```ts
export interface SeatPosition {
  houseKey: string;   // "casa-karasoy"
  seat: string;       // "Ordu-Yildiz"
  x: number;
  y: number;
}
```

**Validação obrigatória contra o cânone.** As coordenadas não podem ser chute: um teste ordena todas as sedes por distância até Asterhall e compara com a ordem da tabela §1.18 do atlas. Se Rimewatch não sair como a mais distante e Abadia Branca entre as mais próximas, as coordenadas estão erradas — a tabela é a fonte de verdade, não elas.

Distância vira faixa, e faixa vira orçamento de **envios por turno, por par de Casas**:

| Faixa | km | Envios por turno |
|---|---:|---:|
| Vizinha | ≤ 120 | 2 |
| Próxima | ≤ 260 | 2 |
| Distante | ≤ 420 | 1 |
| Extrema | > 420 | 1 |

Cada envio recebe exatamente uma resposta, então "2 envios" produz as 4 mensagens da troca. Ordu-Yildiz é uma cidade móvel; sua coordenada usa o centro das Planícies da Estrela, que é o que o atlas trata como sua posição nominal.

### 2. Modelo de dados

Três registros novos, todos sob a partição da campanha.

```ts
export interface DiplomaticMessage {
  id: string;
  campaignId: string;
  turnNumber: number;
  fromHouseId: string;      // Casa do jogador
  toHouseKey: string;       // Casa destinatária, chave canônica
  author: "PLAYER" | "AI";
  body: string;
  replyToId: string | null;
  createdAt: string;
}

export interface CampaignFact {
  id: string;
  campaignId: string;
  turnNumber: number;
  kind: "ALIANCA" | "ACORDO" | "PROMESSA" | "AMEACA" | "RECUSA" | "PEDIDO";
  betweenA: string;
  betweenB: string;
  summary: string;
  /** De qual mensagem este fato foi extraído. Sem isto não há como auditar. */
  sourceMessageId: string;
  status: "ATIVO" | "REVOGADO";
  createdAt: string;
}
```

Chaves: `DIPLMSG#<turno>#<par>#<id>` e `CFACT#<id>`.

**Por que `CampaignFact` não é wiki.** O wiki é cânone reutilizável; um acordo é o que aconteceu nesta partida. Se fossem o mesmo registro, uma promessa quebrada no turno 3 viraria verdade permanente do mundo, e uma campanha nova nasceria contaminada.

### 3. Envio e orçamento

`POST /api/player/messages` recebe `{ toHouseKey, body }`, autenticado com token de jogador.

Antes de gastar qualquer chamada de IA:
1. Rejeita se o turno não estiver `OPEN`.
2. Rejeita se o destinatário for uma Casa com jogador (fora de escopo na Fase A), com mensagem explicando.
3. Conta os envios já feitos por este par neste turno e rejeita se o orçamento acabou, dizendo quantos restam e por quê ("Rimewatch fica a 15 dias de viagem").

### 4. Resposta da IA

Só para Casas NPC. O prompt recebe:

- verbete público da Casa destinatária;
- as relações históricas entre destinatária e remetente, extraídas de `10_RELACOES`;
- o evento público do turno corrente;
- o histórico da conversa neste turno.

E **nada de `MESTRE/`**. A regra é explícita no prompt e verificada por teste: uma mensagem que pergunte diretamente sobre a Asteria, sobre Palius ou sobre o Rei Branco deve receber a resposta de quem não sabe — não uma negativa evasiva que confirme a existência do segredo.

A resposta é escrita na voz da Casa: um chanceler de Solarion não fala como um capitão de Vargen, e uma Casa com mágoa histórica responde com essa mágoa.

### 5. Extração de fatos

Depois de cada resposta, uma chamada de texto extrai os compromissos da troca e grava `CampaignFact` com o `sourceMessageId`. Sem porta de aprovação, por decisão do autor.

A mitigação é procedência e reversibilidade: o admin lista os fatos, vê de qual mensagem cada um veio, e pode editar ou marcar `REVOGADO`. Extração que falha não bloqueia a correspondência — a mensagem já foi entregue.

### 6. Visão do admin

Nova aba no admin: as conversas do turno, por par de Casas, com o registro de fatos ao lado e ações de editar e revogar.

### 7. Pasta do repositório

`campaign-context/inverno-dos-mortos/` para qualquer material de partida exportado ou escrito à mão. `valdren-context/` permanece exclusivamente cânone do mundo. Um `README.md` na pasta nova declara a regra, para nem um humano nem uma IA futura confundirem as camadas.

## Fora de escopo

- **Jogador-a-jogador.** Mensagens entre duas Casas com jogador, incluindo notificação e espera por resposta humana.
- **Injeção no contexto de resolução.** Os fatos ficam gravados e visíveis, mas o `applyResolution` não os consome ainda.
- **Rascunho de cartas e turnos por IA** a partir do registro. É o consumidor futuro que motiva guardar os fatos, não parte desta fase.
- Anexos, imagens ou mensagens para múltiplos destinatários.

## Testes

**Distância**
- A ordem das sedes por distância até Asterhall concorda com a tabela §1.18 do atlas; Rimewatch é a mais distante.
- Solarion↔Karasoy cai em faixa de 2 envios; Solarion↔Rimewatch em 1.
- Distância é simétrica.

**Orçamento**
- O segundo envio para uma Casa vizinha é aceito; o terceiro é rejeitado.
- O segundo envio para Rimewatch é rejeitado no mesmo turno e aceito no turno seguinte.
- Orçamento é por par: gastar com Karasoy não consome o de Vargen.
- Envio é rejeitado quando o turno não está `OPEN`.
- Envio para Casa com jogador é rejeitado com mensagem própria, não com erro genérico.

**Resposta da IA**
- O prompt contém o verbete da destinatária e a relação histórica com a remetente.
- O prompt não contém nenhum material de `MESTRE/`.
- Uma pergunta sobre a sabotagem da Asteria não produz resposta que confirme o segredo.
- Falha da IA não perde a mensagem do jogador: a mensagem fica gravada e a resposta pode ser gerada de novo.

**Fatos**
- Uma troca com oferta de aliança gera um `CampaignFact` com `kind: "ALIANCA"` e o `sourceMessageId` correto.
- Falha na extração não impede a entrega da resposta.
- Revogar um fato o mantém no registro com `status: "REVOGADO"`, sem apagá-lo.

**Isolamento entre partidas**
- Fatos e mensagens são lidos apenas da campanha corrente.
