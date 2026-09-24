/**
 * De que lado cada sede está, na guerra que começou no Turno 8.
 *
 * Existe porque a regra de crise mandava perguntar "Coroa, Krythos ou nenhum
 * dos dois" e o modelo tratava isso como formulário: a chancelaria do Clã
 * Mandíbula de Osso — que está atacando Asterhall ao lado de Krythos —
 * escreveu a Solarion dizendo que o trato acabaria se Solarion ficasse com
 * Krythos. Ameaçou romper caso o outro se aliasse ao seu próprio aliado.
 *
 * A regra sozinha não conserta isso. Um modelo não deduz a própria posição a
 * partir de uma crônica de mil palavras enquanto também negocia lã e prazo. A
 * posição precisa chegar dita, curta, antes da carta.
 *
 * Só entram as sedes cuja posição o Turno 8 tornou pública. Quem não está aqui
 * não tem lado declarado, e é exatamente isso que a carta deve dizer.
 */
/**
 * De que lado, em uma palavra.
 *
 * Vive junto do texto e não numa segunda tabela porque as duas coisas dizem a
 * mesma verdade: separadas, uma seria corrigida um dia e a outra não.
 */
export type LadoNaGuerra = "COROA" | "KRYTHOS" | "NEUTRO" | "SEM_LADO";

interface Posicao {
  lado: Exclude<LadoNaGuerra, "SEM_LADO">;
  texto: string;
}

const LADOS: Record<string, Posicao> = {
  "cla-mandibula-de-osso": {
    lado: "KRYTHOS",
    texto:
    "Você ATACA Asterhall neste momento, aliado a Krythos. Dez mil dos seus sobem a muralha todas as noites do escuro. Você não pergunta ao outro se ele apoia Krythos para ameaçá-lo com isso: Krythos é seu aliado. O que lhe interessa saber é se ele vai socorrer a Coroa — homens, grão, ouro ou passagem —, porque isso o põe do outro lado da sua linha. Quem se declara neutro, ou amigo de Krythos, ainda fala com você sobre isso. Não sobre lã da estação passada.",
  },
  "casa-drakorys": {
    lado: "KRYTHOS",
    texto:
      "Você marcha sobre Asterhall com a coluna de Krythos, aliada ao Clã Mandíbula de Osso, e leva as máquinas que derrubam a muralha. Você não reconhece Alic Valerius. O que lhe interessa de cada Casa é passagem livre, neutralidade declarada, ou apoio aberto — e quem socorrer a Coroa fica do outro lado.",
  },
  "casa-valerius": {
    lado: "COROA",
    texto:
      "Você é a Coroa, e está sendo atacada. O que lhe interessa é socorro: homens, grão, ouro, passagem. Quem negocia com Krythos ou com os orcs está contra você.",
  },
  "casa-vargen": {
    lado: "COROA",
    texto:
      "Você é leal à Coroa que defende a fronteira, e Droskar está cheia de gente que desceu do Norte a pé. Você não confia numa capital que só lembra do Norte quando precisa de lanças, mas não está do lado de quem a ataca.",
  },
  "casa-rimerberg": {
    lado: "COROA",
    texto:
      "Você guarda a última neve e o Norte inteiro parou de responder. Você é leal à Coroa, e neste momento precisa de socorro mais do que o socorro precisa de você.",
  },
  "ordem-dos-tres": {
    lado: "NEUTRO",
    texto:
      "Você não serve à Coroa nem a Krythos: serve ao mandato de conter magia que ameace Valdren. É por isso que quer a coluna draconiana parada — não pelo trono, mas pelo que Kaelen Drakorys prometeu acordar sob Krythos.",
  },
  "irmandade-dos-corvos": {
    lado: "NEUTRO",
    texto:
      "Você não jura a ninguém e não toma lado: vende o que sabe a quem pagar, e é justamente por não tomar lado que suas cartas ainda atravessam as estradas de todos eles.",
  },
  "casa-ferrumor": {
    lado: "COROA",
    texto:
      "Você é fiel à Coroa, e não finge nobreza nisso: a Coroa é a maior compradora do seu aço e das suas frotas, e você protege o cliente que a sustenta. Por isso a capital sitiada é, antes de tudo, um prejuízo seu — e quem der ferro, passagem ou silêncio a Krythos está tirando dinheiro do seu bolso, não só mudando de bandeira.",
  },
  "casa-euralune": {
    lado: "NEUTRO",
    texto:
      "Você não declarou lado. Suas aves são a única rede que ainda funciona em Valdren, e essa neutralidade vale mais que qualquer aliança que você pudesse assinar.",
  },
};

/** O lado da sede, para entrar no pedido antes da carta. Vazio se não há. */
export function ladoDaSede(seatKey: string | null): string {
  const l = seatKey ? LADOS[seatKey] : undefined;
  return l ? `A POSIÇÃO DA SUA CASA NA GUERRA:\n${l.texto}` : "";
}

/**
 * De que lado esta sede está, para espalhar as cartas de um turno.
 *
 * Um jogador que abre a caixa e encontra três Casas leais à Coroa pedindo a
 * mesma coisa não está lendo um reino em guerra: está lendo a mesma carta três
 * vezes. Quem ainda não se declarou é `SEM_LADO`, e isso também é uma posição.
 */
export function ladoNaGuerra(seatKey: string | null): LadoNaGuerra {
  return (seatKey ? LADOS[seatKey]?.lado : undefined) ?? "SEM_LADO";
}

/**
 * Sedes que não conseguem escrever carta nenhuma neste momento, e por quê.
 *
 * Na abertura do Turno 9 chegaram duas cartas impossíveis: uma da Casa
 * Rimerberg, cujo senhor morreu cobrindo a retirada e cuja fortaleza foi
 * tomada, e uma da chancelaria de Casa Valerius, que está dentro de uma
 * Asterhall de onde não sai um selo real há três semanas. Ambas negociavam
 * comboios com prazo, e ambas seriam lidas pelos jogadores como prova de que
 * aquelas Casas estão de pé.
 *
 * O planejador escolhia sede por relação e por despensa; nada no sistema sabia
 * que uma sede pode estar destruída ou incomunicável. Isto é o que sabe.
 *
 * Vale para os DOIS caminhos de carta, e isso custou um turno para aprender. No
 * começo esta lista só calava a carta que o mundo manda por iniciativa própria;
 * quem respondia a carta de jogador não consultava nada. No Turno 10 a Casa do
 * Ouro escreveu oito vezes à chancelaria de Valerius e recebeu oito respostas —
 * a Coroa recusando renúncia e promulgando anistia de dentro de uma cidade de
 * onde não saía um selo. Sede muda é muda para quem escreve primeiro e para
 * quem responde.
 *
 * Silenciar aqui é reversível de propósito: quando Asterhall se comunicar de
 * novo, a linha sai desta lista e a Casa volta a escrever.
 */
export const SEDES_MUDAS: Record<string, string> = {
  "casa-rimerberg": "Rimewatch caiu e Ser Kael morreu cobrindo a retirada; não há chancelaria para escrever.",
  "casa-valerius": "Asterhall caiu e a chancelaria real se desfez com ela; não há quem responda pela Coroa.",
};

/** Esta sede consegue mandar carta agora? */
export function sedePodeEscrever(seatKey: string): boolean {
  return !(seatKey in SEDES_MUDAS);
}
