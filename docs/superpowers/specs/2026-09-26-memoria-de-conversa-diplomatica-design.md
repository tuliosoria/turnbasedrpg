---
title: "Memória de conversa diplomática — foco, continuidade e autoridade"
setting: "Valdren"
status: "Design aprovado"
date: 2026-09-26
visibility: "Engenharia + Mestre"
---

# O problema

Solarion trocou 27 cartas com o Clã Mandíbula de Osso entre os turnos 8 e 10.
O dossiê atual conserva as 24 últimas cartas em prosa integral. Nesse caso real,
o material enviado ao modelo tem aproximadamente 4.289 palavras e repete
"Vau Negro" 26 vezes, "Miemar" 23 vezes e "tecido" 22 vezes.

O corte de 24 mensagens agrava o problema: ele remove justamente a proposta
inicial, o aceite de Solarion e a primeira confirmação, mas conserva as muitas
repetições posteriores do acordo. A Casa recebe muita prosa e pouco estado. O
resultado é uma resposta que recita logística já estabelecida, perde mudanças
de assunto e parece não compreender a intenção atual do jogador.

O fio também contém duas respostas antigas de IA que afirmam que Thorgul Crânio
Cinzento morreu. A afirmação nasceu de um falso positivo já corrigido no
detector de mortalidade: "os orcs de Thorgul que morriam" foi interpretado como
morte do próprio Thorgul. O código atual não produz novamente essa premissa,
mas as cartas antigas permanecem no banco e voltam ao prompt como memória.

Não é ausência de contexto nem insuficiência do modelo. É uma combinação de:

- histórico bruto demais e cortado por quantidade arbitrária;
- carta atual sem destaque suficiente dentro do fio;
- acordos, propostas e recusas misturados com prosa antiga;
- material gerado no passado tratado como se tivesse a mesma autoridade do
  registro público atual;
- dois erros antigos ainda persistidos e um acordo comercial duplicado.

---

# Objetivo

Fazer a Casa responder ao assunto que o jogador trouxe agora sem perder a
continuidade da relação, sem reabrir acordos encerrados e sem permitir que uma
afirmação antiga da própria IA prevaleça sobre fatos atuais da campanha.

O sucesso aparece na experiência do jogador:

1. uma pergunta estratégica recebe uma resposta estratégica, não a repetição
   integral de um escambo;
2. detalhes firmados continuam disponíveis no bloco de estado diplomático;
3. a origem e o tom da relação continuam reconhecíveis;
4. a carta atual aparece uma vez e é inequivocamente o texto a responder;
5. fatos atuais prevalecem sobre falas antigas contraditórias;
6. a correção do caso Solarion × Mandíbula é reversível e auditável.

---

# Abordagens consideradas

## 1. Acrescentar regras ao prompt

Mandar o modelo "não repetir acordos" ou "responder primeiro ao assunto atual"
é a mudança menor, mas conserva a causa: milhares de palavras de repetição e
nenhuma separação entre fala, obrigação e pergunta atual. O prompt já possui
revisor de foco, escambo fora de contexto e formulário. Somar instruções faria
o escritor disputar consigo mesmo em vez de melhorar o material.

**Rejeitada.** Regra não corrige memória mal montada.

## 2. Resumo acumulado produzido por IA

Cada par de Casas teria uma ficha narrativa atualizada por modelo depois de
cada carta. É flexível e pode capturar nuances, mas cria outra fonte derivada
que pode inventar, omitir ou envelhecer em silêncio. Também acrescenta chamada,
custo, timeout e recuperação de falha ao caminho de cada resposta.

**Rejeitada nesta etapa.** A campanha já possui fatos estruturados, relações e
memória viva suficientes para uma solução determinística.

## 3. Projeção determinística da conversa + reparo auditável

O banco conserva o fio completo. Uma função pura projeta dele apenas o que o
escritor precisa: origem, recência, estado diplomático e carta atual. Dados
antigos comprovadamente errados são corrigidos por script específico, em ensaio
por padrão, sem apagar autoria do jogador nem o histórico dos fatos.

**Escolhida.** Ataca as causas sem criar nova fonte de verdade nem nova chamada
de modelo.

---

# Parte A — O dossiê conserva o fio completo

`montarDossie` deixa de aplicar `.slice(-24)`. `Dossie.fio` volta a cumprir o
contrato que o comentário já declara: toda a correspondência do par, em ordem.

O fio completo não entra inteiro no prompt. Ele serve a três necessidades:

- contar corretamente desde quando e quantas vezes as Casas se escreveram;
- derivar irritação por cartas sem resposta e evolução da relação;
- fornecer matéria-prima para a projeção de memória adequada a cada uso.

O volume atual da campanha cabe na leitura do DynamoDB e já era carregado antes
do corte. A mudança não adiciona consulta nem chamada externa.

---

# Parte B — A memória enviada ao modelo é uma projeção

Uma função pura em `responseMemory.ts` seleciona mensagens inteiras, nunca
recorta o corpo no meio.

## Histórico de turnos anteriores

Entram, sem duplicação e em ordem cronológica:

1. as duas primeiras mensagens da relação, que preservam como ela começou;
2. as seis mensagens mais recentes anteriores ao turno corrente;
3. no máximo 12.000 caracteres no total.

As duas mensagens de origem têm lugar reservado. Depois delas, mensagens
recentes entram da mais nova para a mais antiga enquanto couberem no orçamento;
ao final, tudo volta à ordem cronológica. Se origem e recência se sobrepõem, a
mensagem aparece uma vez.

O orçamento é por caracteres e mensagens inteiras. Não se trunca uma cláusula,
um número ou uma assinatura no meio. Cada corpo novo já é limitado a 3.000
caracteres por `MESSAGE_MAX`, portanto as duas mensagens reservadas cabem juntas
na metade do orçamento. Se houver mensagem legada acima desse limite, a origem
continua inteira e o orçamento deixa de admitir mensagens recentes até voltar a
caber; nunca se fatia o legado para forçar o número.

## Conversa anterior do turno atual

A carta que disparou a resposta é retirada do fio corrente e passada em campo
próprio. Das mensagens anteriores a ela no mesmo turno, entram as seis mais
recentes, em ordem cronológica.

Mensagens posteriores não entram. Em uma repetição de evento assíncrono, a
idempotência existente continua impedindo uma segunda resposta à mesma carta.

## Carta atual

O prompt ganha um bloco final e único:

```text
CARTA QUE CHEGOU AGORA — RESPONDA A ISTO:
<texto integral do jogador>
```

Ela não é repetida dentro de "Correspondência deste turno". O escritor e o
revisor recebem exatamente essa mesma projeção.

## Carta proativa

Uma carta proativa não possui texto atual. `descreverFio` usa a mesma seleção de
origem + recência para não despejar a conversa inteira no prompt. A contagem e
o histórico relacional continuam usando `Dossie.fio` completo.

---

# Parte C — O estado diplomático deixa de ser um bloco único

`Dossie` passa a conservar os `CampaignFact` relevantes do par, e a renderização
os separa em três grupos:

1. **Obrigações em vigor:** `ALIANCA`, `ACORDO` e `PROMESSA` ativos.
2. **Propostas abertas:** `PEDIDO` ativo. Não é acordo e não deve ser tratado
   como aceito.
3. **Decisões recentes:** `RECUSA` e `AMEACA` ativas dos dois turnos mais
   recentes presentes no registro do par.

Isso permite lembrar uma recusa sem declarar que ela é obrigação e lembrar uma
oferta sem transformá-la em pacto.

Antes de renderizar, fatos textualmente equivalentes são deduplicados por uma
chave composta de tipo e resumo normalizado: caixa, acento, espaço e pontuação
não diferenciam dois registros. O registro mais novo vence. Não haverá tentativa
de equivalência semântica em código; dois acordos diferentes com palavras
parecidas não podem ser fundidos por heurística. `createdAt` decide qual é o
mais novo; o `id` desempata para que a saída seja determinística.

O texto de memória declara uma hierarquia, substituindo o cabeçalho atual em
vez de somar nova regra ao system prompt:

1. fatos públicos atuais, crônica e estado vivo são autoridade;
2. fatos diplomáticos estruturados descrevem o estado da negociação;
3. cartas antigas são falas lembradas e podem conter crença, erro ou informação
   já superada.

---

# Parte D — Reparo de Solarion × Mandíbula de Osso

Um script específico em `backend/scripts/` corrige apenas os registros
identificados durante o diagnóstico. Ele roda em ensaio por padrão e só grava
com `--confirm`.

## Cartas

Somente duas mensagens com `author: "AI"` são elegíveis:

- `mu7bh7vm-ryesl2`;
- `mua8jyze-4ykmgk`.

O script exige simultaneamente o id, o par Solarion × Mandíbula, o turno 10, o
autor IA e o fragmento antigo esperado. Um alvo já no texto novo é reconhecido
como inalterado, permitindo segunda execução segura. Qualquer terceiro estado
aborta antes da primeira escrita.

As alterações são mínimas:

- "Thorgul Crânio Cinzento caiu" vira uma frase sobre os mortos do Clã terem
  engrossado a fileira inimiga;
- "Depois de Thorgul cair" vira "Depois de vermos nossos mortos se levantarem".

Nenhuma carta do jogador é alterada. Os demais parágrafos, acordos, perguntas e
assinaturas permanecem byte a byte iguais.

## Fato duplicado

O acordo `mu7bh7vv-ywo3lm`, primeira versão do escambo do turno 10, passa a
`REVOGADO`. O acordo posterior `mua8uzjq-buoc2p`, mais completo e confirmado
depois, permanece `ATIVO`.

Revogar preserva procedência e auditoria. O registro não é apagado e não se
acrescenta `supersededBy`, pois `CampaignFact` não possui esse campo.

## Segurança operacional

- ensaio por padrão, sem qualquer escrita;
- plano completo impresso antes de gravar;
- leitura e validação de todos os alvos antes da primeira escrita;
- `UpdateCommand` com condição sobre o valor anterior;
- marca `rewrittenAt` nas cartas corrigidas;
- segunda execução reconhece cartas corrigidas e fato revogado, sem nova
  alteração;
- teste das transformações puras sem acesso à AWS.

Implementar o script não autoriza executar `--confirm` em produção. A execução
confirmada é uma decisão operacional separada do Mestre.

---

# Parte E — O que não muda

- O modelo de diplomacia continua `gpt-5.5` com `reasoning_effort: high`.
- O system prompt não ganha nova regra.
- O revisor continua recebendo o mesmo material do escritor.
- A crônica pública, fatos do mundo, cânone, biografia, situação da Casa,
  relação e memória viva continuam entrando.
- Cartas de jogadores nunca são apagadas nem reescritas.
- Não haverá resumo persistido por IA nem nova tabela.
- O reparo não inventa memória privada para Garok nem altera manualmente seu
  humor, objetivo ou relações.
- Não haverá deploy nem execução confirmada da migração como parte da mudança
  de código.

---

# Parte F — Arquivos e responsabilidades

| Arquivo | Responsabilidade |
|---|---|
| `backend/src/ai/diplomacy/dossie.ts` | Carregar fio completo e fatos do par; classificar estado diplomático. |
| `backend/src/ai/diplomacy/dossie.test.ts` | Seleção do par, grupos de fatos e deduplicação textual. |
| `backend/src/ai/diplomacy/responseMemory.ts` | Projetar origem, recência, turno atual e carta recebida. |
| `backend/src/ai/diplomacy/responseMemory.test.ts` | Orçamento, ordem, ausência de duplicação e caso Solarion. |
| `backend/src/ai/diplomacy/housePrompt.ts` | Renderizar histórico subordinado e carta atual isolada. |
| `backend/src/ai/diplomacy/housePrompt.test.ts` | Hierarquia de autoridade e foco na carta atual. |
| `backend/src/ai/diplomacy/outreachPrompt.ts` | Usar a projeção histórica em cartas proativas. |
| `backend/src/ai/diplomacy/outreachPrompt.test.ts` | Garantir que proativa não receba todo o fio bruto. |
| `backend/src/diplomacy/gerarResposta.ts` | Passar o id da carta atual para a projeção. |
| `backend/scripts/reparar-solarion-mandibula.mjs` | Ensaio e reparo condicionado dos três registros. |
| `backend/scripts/reparar-solarion-mandibula.test.mjs` | Transformações, abortos, idempotência e preservação de autoria. |

Se a decomposição mostrar que seleção histórica e renderização de fatos deixam
`dossie.ts` com responsabilidades misturadas, a seleção pura pode morar em
`conversationMemory.ts`. Isso não altera o contrato nem o comportamento desta
especificação.

---

# Parte G — Testes e verificação

## Regressões determinísticas

- Fio com 27 mensagens conserva contagem 27, mas o prompt não recebe 24 corpos.
- A proposta e o aceite iniciais permanecem como origem.
- As seis mensagens anteriores mais recentes permanecem em ordem.
- O limite de 12.000 caracteres remove mensagens inteiras, nunca fatias.
- A carta recebida aparece uma vez, no bloco final próprio.
- Mensagem posterior ao alvo não entra.
- Um acordo e uma proposta aparecem em grupos distintos.
- Uma recusa recente aparece como decisão, não obrigação.
- Duplicata normalizada é renderizada uma vez, mantendo o registro mais novo.
- O cabeçalho diz que estado atual prevalece sobre fala antiga.
- A carta proativa usa memória selecionada, não o fio completo.

## Reparo

- Apenas as duas cartas de IA alvo são transformadas.
- A frase falsa sobre a morte desaparece e o restante do corpo não muda.
- Carta de jogador com texto parecido é recusada.
- O acordo antigo muda para `REVOGADO`; o posterior não muda.
- Alvo ausente, duplicado ou divergente aborta antes de escrever.
- Segunda aplicação é operação vazia.
- O modo padrão não chama comando de escrita.

## Suíte

Depois dos ciclos vermelho–verde de cada unidade:

- testes dos arquivos modificados;
- suíte completa de `shared`, `backend` e `frontend`;
- `npm run typecheck`;
- `git diff --check`;
- execução do script sem `--confirm`, conferindo os três alvos e nenhuma escrita.

---

# Critérios de aceitação

- O fio completo permanece disponível para relação e auditoria, sem ser
  despejado integralmente no prompt.
- Uma resposta recebe origem, recência, estado diplomático e a carta atual em
  blocos distintos.
- A carta atual aparece exatamente uma vez e depois do histórico.
- O caso condensado Solarion × Mandíbula produz contexto menor e sem perda do
  começo da relação.
- Acordos, propostas, recusas e ameaças não são confundidos entre si.
- Nenhuma regra é adicionada ao system prompt do escritor.
- O reparo é ensaiável, condicionado, idempotente e não altera texto de jogador.
- Os dois falsos relatos sobre Thorgul e o acordo duplicado têm correção pronta,
  mas produção permanece inalterada até uma execução explícita de `--confirm`.
- Toda a suíte e o typecheck passam antes de a mudança ser considerada pronta.

---

# Fora de escopo

- Reescrever outras cartas consideradas apenas fracas ou repetitivas.
- Alterar o modelo, temperatura ou orçamento de tokens.
- Criar memória resumida por IA.
- Enriquecer manualmente a ficha dinâmica de Garok.
- Fazer equivalência semântica geral entre acordos.
- Mudar a interface de administração.
- Publicar, fazer deploy ou modificar produção automaticamente.
