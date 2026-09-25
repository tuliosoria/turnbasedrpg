# Energia e cartas como jogo — design

**Data:** 25/09/2026
**Escopo:** o painel de cartas de projeto do jogador (`HouseProjectsPanel`, abas Projetos e Espiões de `/game`).
**Não muda:** as regras. Três de Energia por turno, passo grátis, teto por carta e juiz de desfecho continuam como estão em `shared/src/energia.ts` e `backend/src/projects/processTurn.ts`. A única mudança no backend é a checagem de vaga no "Tentar de novo" (seção 6).

## O problema

Os jogadores não entendem:

1. se **precisam** pôr Energia nas cartas;
2. se a carta **anda sem** Energia;
3. **quanta** Energia têm por turno;
4. como **tentar de novo** uma carta que fracassou.

A tela de hoje causa as quatro dúvidas:

- A Energia é um slider escondido dentro de cada carta, e o saldo aparece num chip pequeno.
- Gravar exige apertar "Distribuir Energia" à parte. Quem esquece perde a escolha sem perceber.
- O passo grátis aparece só numa legenda cinza.
- Carta com teto 0 (por exemplo, 0 de 1 turno) simplesmente não mostra slider. O jogador lê "não consigo" em vez de "não precisa". Foi a dúvida de Solarion sobre o Obelisco.
- O "Tentar de novo" mora no fundo da lista, em "Projetos concluídos".
- Nenhuma carta diz o que acontece com ela no fechamento do turno.

## Critérios de sucesso

Um jogador que abre a aba sem ler nada consegue responder, olhando a tela:

- quanta Energia tem livre agora e que ela se perde no fechamento;
- que toda carta anda sozinha 1 passo por turno;
- onde cada carta vai estar depois do fechamento;
- por que uma carta não aceita Energia;
- o que fazer com uma carta que fracassou.

Além disso:

- Nenhuma escolha de Energia se perde por falta de um clique.
- O fechamento do turno vira um momento que o jogador vê acontecer: a revelação.
- O painel funciona bem com o polegar numa tela de 390px.

## Decisões tomadas com o Mestre

| Pergunta | Decisão |
|---|---|
| Aparelho principal | Celular. Toque primeiro, alvos de 48px, sem depender de arrastar. |
| Gravação da Energia | A cada toque, sem botão "Distribuir". |
| Conclusões do fechamento | Revelação ao voltar, uma carta por vez. |
| Como animar | Nativo: CSS keyframes via Emotion e Web Animations API, sem biblioteca nova. |

## 1. O cofre de Energia

Fica no topo do painel e gruda no topo ao rolar (`position: sticky`) no celular.

- Três orbes grandes, um por ponto de `energiaDoTurno`. Aceso é disponível, apagado é gasto.
- Abaixo: "3 de Energia por turno · o que sobrar se perde no fechamento."
- Link "Como funciona?" abre uma folha (bottom sheet no celular, diálogo no desktop) com três regras e ícones:
  1. Toda carta ativa anda 1 passo por turno, de graça.
  2. Cada ponto de Energia é 1 passo a mais.
  3. Carta que fracassa pode tentar de novo: 1 turno, de graça, sucesso garantido.
- Todo número vem de `ENERGIA_POR_TURNO`, `PASSO_POR_TURNO` e `energiaMaximaPara`. Nenhum é digitado na tela.
- O cofre só aparece quando a Casa tem ao menos uma carta ativa.

## 2. A carta ativa

**Trilha de passos** no lugar da barra fina. Uma casinha por turno de `durationTurns`:

| Casinha | Significado |
|---|---|
| cheia (■) | turno já andado |
| grátis (◇) | o passo livre deste turno |
| Energia (◆, turquesa) | passo comprado com Energia neste turno |
| vazia (▢) | ainda por andar |

- Linha de prévia: "Fim do turno: → 3 de 5". Quando conclui neste turno: selo "Conclui neste turno".
- "Ao concluir: +1 Riqueza" continua, com o texto de `resumoDoGanho`.
- Controles **− / +** de 48px com o número entre eles, no lugar do slider. O "+" desativa no teto e mostra "Esta carta já recebe o máximo".
- **Teto 0**, carta ativa: no lugar dos controles, o selo "✓ Conclui sozinha no fim do turno. Não precisa de Energia."
- Carta refeita: selo "Sucesso garantido". O parágrafo longo de hoje sai; a explicação vai para o "Como funciona?".
- "Reescrever" (só refeita) e "Cancelar" vão para um menu "⋯".
- Carta pausada: selo "Pausada", sem controles.

## 3. Gravar a cada toque

- Um hook `useEnergiaAutoSave` guarda a distribuição local e a atualiza na hora do toque.
- Depois de 400ms sem toque, grava a distribuição inteira com o `setEnergia` que já existe.
- Se a gravação falhar, a tela volta à última distribuição gravada e mostra o erro.
- O botão "Distribuir Energia" sai. O aviso atual de alocação recortada (`energia.ajustes`) continua, em forma curta.
- Sem o botão, desaparece a situação "distribuiu nada e congelou tudo". O passo grátis vale de qualquer jeito, e zero de Energia é uma distribuição válida.

## 4. Animações

Nativas. Os efeitos ficam dentro do painel de cartas; o resto do site segue a regra do tema, "movimento é acento".

| Momento | Efeito | Duração |
|---|---|---|
| + Energia | o orbe sai do cofre e voa até a carta (WAAPI, trajetória em arco), e a casinha acende com brilho turquesa | ~450ms |
| − Energia | o orbe volta ao cofre | ~350ms |
| carta com Energia | borda turquesa com pulso sutil | contínuo, lento |
| sucesso (revelação) | a carta vira, brilha dourado e o prêmio sobe | ~1,2s |
| fracasso (revelação) | a carta racha em cinza e vermelho | ~1s |

Com `prefers-reduced-motion`, nada voa, pulsa ou vira: o estado troca com um fade de 120ms.

## 5. Revelação ao voltar

**O que revela:** cartas `COMPLETED` ou `FAILED` com `resolvedAt` posterior ao `vistoEm` guardado.

- `vistoEm` fica em localStorage, chave `valdren.revelacao.<houseId>.<projetos|espioes>`, por aparelho e por aba: cartas do mesmo fechamento saem segundos umas das outras, e uma marca só por Casa escondia a revelação da outra aba. Leitura e escrita dentro de try/catch; sem storage, a revelação simplesmente não aparece.
- **Sem `vistoEm`** (primeiro acesso no aparelho): revela só as cartas do `resolvedAt` mais recente, e não a campanha inteira.
- Função pura `cartasParaRevelar(cartas, vistoEm)` decide isso e tem teste.

**Como mostra:**

- Faixa "✦ N novidades do fechamento" no topo do painel. Tocar abre a revelação.
- A revelação é tela cheia no celular e diálogo no desktop, uma carta por vez: "1 de 2" e botão "Próxima".
  - **Sucesso:** a carta vira, brilha, mostra `outcomeNarrative` e o prêmio.
  - **Fracasso:** a carta racha, mostra a narrativa e o botão grande "Tentar de novo — grátis, sucesso garantido", que chama `refazerProjeto` ali mesmo.
- Fechar ou chegar ao fim grava `vistoEm` com o `resolvedAt` mais recente revelado.
- As abas Projetos e Espiões de `/game` ganham um selo com o número de novidades não vistas daquela aba, para puxar o jogador que abre na aba Turnos.

## 6. Cartas que fracassaram

- Saem do fundo da lista e sobem para uma faixa "Pode tentar de novo", logo abaixo do cofre.
- Cada uma mostra o título, a narrativa recolhida e o botão "Tentar de novo — grátis".
- **Correção no backend:** `refazerProjeto` passa a conferir `projectSlotLimit`. Hoje não confere, e poderia deixar a Casa acima do teto, como Khazdrun ficou em 4/3. Sem vaga, responde 409, e a tela mostra o botão desativado com "Libere uma vaga primeiro".
- A lista de concluídas com êxito vai para o fim, recolhida em "Concluídas (N) ▸".

## 7. Visual

**Cor de Energia:** turquesa `#4fd1c5`, contraste ~10:1 sobre `#0e1013`. Usada **só** para Energia: orbes, casinhas ◆, borda de carta energizada. O ouro `#c8a24b` continua reservado aos três usos do tema e ao brilho do sucesso na revelação. Nova entrada em `brand`: `energia`.

**Carta:**

- Superfície `brand.raised`, borda `brand.line`, cantos de 12px.
- Faixa de 4px à esquerda com a cor da categoria. Paleta nova `CATEGORY_COLORS`, oito tons dessaturados e distintos do turquesa e do ouro.
- Título no estilo rótulo do tema: caixa alta, peso 700, espacejado.

**Números:** o saldo e o progresso em tamanho grande, com `font-variant-numeric: tabular-nums`.

**Ordem da tela (celular):**

1. cofre;
2. faixa de novidades;
3. "Pode tentar de novo";
4. "Em andamento", com as vagas N/3;
5. "Esperando sua decisão";
6. botão "+ Nova carta", que abre a Biblioteca;
7. "Concluídas (N) ▸".

A aba Biblioteca continua como está.

**Texto:** frases curtas e no presente ("Conclui neste turno", "Sem vaga", "Energia sobrando: 1"). O que é regra mora no "Como funciona?", não em parágrafos dentro das cartas.

## 8. Estrutura do código

`HouseProjectsPanel.tsx` (638 linhas) fica como orquestrador fino: busca dados, recorte por categoria e abas. As peças vão para `frontend/src/components/projetos/`:

| Arquivo | Papel |
|---|---|
| `CofreDeEnergia.tsx` | orbes, saldo, "Como funciona?", origem do voo |
| `CartaAtiva.tsx` | uma carta em andamento, com controles e menu ⋯ |
| `TrilhaDePassos.tsx` | as casinhas; puro, só recebe números |
| `CartaFracassada.tsx` | faixa "Pode tentar de novo" |
| `RevelacaoDoTurno.tsx` | a sequência de revelação |
| `useEnergiaAutoSave.ts` | estado local, pausa de 400ms, falha e volta |
| `animacoes.ts` | voo do orbe (WAAPI) e keyframes; checa reduced-motion num lugar só |
| `previa.ts` | `previaDoFechamento(carta, energia)` e `cartasParaRevelar(cartas, vistoEm)`, puras |

O cuidado com custo de render do `Layout` continua valendo: nada de decodificar ou recriar objetos pesados por toque.

## 9. Testes

- **Unitários:** `previaDoFechamento` (passo grátis, teto, conclusão neste turno, teto 0) e `cartasParaRevelar` (com e sem `vistoEm`, só o último fechamento no primeiro acesso).
- **Hook:** `useEnergiaAutoSave` grava uma vez depois da pausa, junta toques seguidos e volta ao estado gravado quando a chamada falha.
- **Componentes:** o selo de teto 0 aparece no lugar dos controles; "+" desativa no teto; a revelação mostra "Tentar de novo" no fracasso; nada anima com reduced-motion.
- **Backend:** `refazerProjeto` recusa sem vaga.
- Os testes atuais do painel e da Energia (`HouseProjectsPanel*.test.tsx`) são ajustados à tela nova.
- **Verificação final:** screenshots em 390px e 1280px pelo Playwright, contra produção depois do deploy, sem gravar nada.

## Fora do escopo

- Qualquer mudança de regra: Energia variável, passo grátis ou teto.
- A aba Biblioteca e o fluxo de criar carta.
- Som.
- Animação ou revelação no painel do Mestre.
