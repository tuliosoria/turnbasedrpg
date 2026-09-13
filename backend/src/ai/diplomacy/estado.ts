import type { LeaderPersona, NpcDynamic, NpcRelation } from "@ravenloft/content";

/**
 * Quem escreve esta carta, agora, por dentro.
 *
 * As dezoito cartas de IA do Turno 9 não têm uma única ocorrência de alguém
 * dizendo "não sei", com medo declarado, cansado de escrever, ou informando
 * que o próprio conselho discorda. Toda Casa de Valdren era um negociador
 * perfeitamente informado, decidido e disponível — e é isso, não o estilo, que
 * faz o jogador sentir que fala com uma máquina.
 *
 * A matéria-prima sempre existiu: a persona traz temperamento e o que a pessoa
 * recusa, e a memória viva traz humor, preocupações e o que ela quer. Nada
 * disso chegava com peso suficiente para mudar o tom de uma carta.
 */
export function estadoInterior(persona: LeaderPersona | null, dyn: NpcDynamic | null): string {
  const linhas: string[] = [];
  if (dyn?.mood?.trim()) linhas.push(`Seu humor hoje: ${dyn.mood.trim()}`);
  if (dyn?.concerns?.trim()) linhas.push(`O que te tira o sono: ${dyn.concerns.trim()}`);
  if (dyn?.objective?.trim()) linhas.push(`O que você está tentando conseguir: ${dyn.objective.trim()}`);
  if (dyn?.loyalty?.trim()) linhas.push(`A quem você deve lealdade, e quanto: ${dyn.loyalty.trim()}`);
  if (persona?.refuses?.trim()) linhas.push(`O que você não aceita, aconteça o que acontecer: ${persona.refuses.trim()}`);
  if (linhas.length === 0) return "";

  return [
    "COMO VOCÊ ESTÁ, POR DENTRO. Isto não é decoração: é o que faz a carta soar como uma pessoa e não como uma chancelaria.",
    ...linhas.map((l) => `- ${l}`),
    "",
    "Deixe isso aparecer. Você tem permissão para dizer que não sabe uma coisa, que está com medo, que seus capitães discordam de você, que está cansado de escrever sem resposta, ou que não decidiu ainda. Uma carta que admite dúvida convence mais que uma que finge certeza sobre tudo.",
  ].join("\n");
}

/** Um número de relação vira sentimento; ninguém escreve carta pensando em escala. */
function comoSente(r: NpcRelation): string[] {
  const s: string[] = [];
  if (r.trust >= 70) s.push("você confia nesta Casa, e isso já lhe custou caro antes com outras");
  else if (r.trust <= 30) s.push("você não confia nesta Casa, e escreve medindo cada palavra");
  if (r.fear >= 50) s.push("você tem medo do que ela pode fazer, e não quer que isso apareça na carta");
  if (r.resentment >= 40) s.push("você guarda mágoa dela, e ela vaza mesmo quando você tenta ser cordial");
  if (r.obligation >= 50) s.push("você deve algo a ela, e sabe disso");
  if (r.respect >= 70) s.push("você respeita esta Casa, mesmo discordando dela");
  return s;
}

/**
 * O que já se passou entre estes dois, além do texto das cartas.
 *
 * O fio diz o que foi escrito; isto diz o que a relação virou. Uma Casa que
 * escreveu três vezes sem resposta não escreve a quarta com a mesma cortesia,
 * e nenhuma regra de estilo produz essa irritação — só o fato dela.
 */
export function historicoDaRelacao(
  fio: { turnNumber: number; author: "PLAYER" | "AI" }[],
  dyn: NpcDynamic | null,
  playerHouseId: string,
  nomeDoJogador: string,
): string {
  const linhas: string[] = [];

  if (fio.length === 0) {
    linhas.push(`Vocês nunca se escreveram. Esta é a primeira vez, e ela precisa se apresentar como primeira.`);
  } else {
    const turnos = [...new Set(fio.map((m) => m.turnNumber))];
    const semResposta = (() => {
      let n = 0;
      for (let i = fio.length - 1; i >= 0 && fio[i].author === "AI"; i--) n++;
      return n;
    })();
    linhas.push(`Vocês se escrevem desde o turno ${turnos[0]} — ${fio.length} cartas ao todo.`);
    if (semResposta >= 2) {
      linhas.push(`Você já mandou ${semResposta} cartas seguidas sem que ${nomeDoJogador} respondesse. Isso incomoda, e pode aparecer na carta.`);
    }
  }

  const rel = dyn?.relations?.[playerHouseId];
  if (rel) {
    const sent = comoSente(rel);
    if (rel.summary?.trim()) linhas.push(`O que ficou entre vocês: ${rel.summary.trim()}`);
    if (sent.length) linhas.push(`Como você se sente sobre ${nomeDoJogador}: ${sent.join("; ")}.`);
  }

  const lembra = (dyn?.memory ?? [])
    .slice(-4)
    .map((m) => `- [Turno ${m.turnNumber}] ${m.description}`);
  if (lembra.length) linhas.push(`Coisas que você viveu e não esquece:\n${lembra.join("\n")}`);

  return linhas.length ? `A RELAÇÃO DE VOCÊS DOIS:\n${linhas.join("\n")}` : "";
}
