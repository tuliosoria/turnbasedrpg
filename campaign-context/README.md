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

A correspondência e o registro de fatos ficam no DynamoDB, sob a partição da
campanha (`CAMPAIGN#<id>`), já isolados por partida. Esta pasta é para
material exportado ou escrito à mão sobre uma campanha específica.

Nunca escreva estado de partida em `valdren-context/`.
