# Contexto de partida

Esta pasta guarda **o que aconteceu numa mesa**, não o mundo.

`valdren-context/` descreve Valdren: geografia, Casas, cosmologia, história.
Vale para qualquer campanha e não muda porque alguém jogou.

Aqui fica o oposto: alianças firmadas, promessas quebradas, cartas trocadas,
resultados de turno. Se você recomeçar a campanha com outros jogadores, nada
disto existe — a aliança entre Solarion e Karasoy foi daquela mesa.

## Por que a separação importa

Se as duas camadas morassem juntas, uma promessa quebrada no turno 3 viraria
verdade permanente de Valdren, e uma campanha nova nasceria contaminada com a
história da anterior. Pior: uma IA montando contexto trataria "Solarion
prometeu grãos" com o mesmo peso de "Rimewatch guarda a última fronteira" —
uma é fofoca de partida, a outra é cânone.

Quem monta contexto para IA deve ler as duas, sabendo qual é qual: o cânone é
**verdade fixa**, isto aqui é **o que aconteceu**.

## Onde as coisas vivem

`npm run contexto` gera `inverno-dos-mortos/` a partir do banco. Uma pasta por
audiência: `publico/`, `mestre/` e `casas/<nome>/`. Cada uma tem `estado.md`
(onde as coisas estão) e `cronica.md` (como se chegou aqui).

`npm run snapshot` gera `snapshots/`: briefings e arquivos de contexto por Casa
e por turno, mais a conferência daquele turno.

Não edite esses arquivos: a próxima execução sobrescreve. O metaplot não é
gerado — ele é autoral e vive em `valdren-context/MESTRE/`. Leia `mestre/`
antes de rascunhar turno ou responder sobre a campanha.

Nunca escreva estado de partida em `valdren-context/`.
