import { describe, expect, it } from "vitest";
import { isDeadInChronicle } from "./mortality";

/**
 * Trechos reais da crônica, copiados dos turnos gravados no banco.
 *
 * Não são paráfrases de propósito: a primeira versão deste teste usava um
 * resumo escrito à mão, e a distância entre "Celene" e a palavra de morte
 * saiu maior do que no texto verdadeiro. O teste passava até com uma
 * implementação ingênua de janela de caracteres — a mesma que produziu o bug.
 */
const TURN_1 = [
  "existem relatos de mortos deixando suas sepulturas.",
  "",
  "Um mensageiro de Stonebridge confirmou a chegada de refugiados. Entre eles estava",
  "um soldado reconhecido por seus antigos companheiros como um homem morto e enterrado meses antes.",
  "",
  "Antes de encerrar a assembleia, Celene apresentou uma segunda questão: a coroação",
  "de seu filho Alic, de apenas 12 anos.",
].join("\n");

const TURN_2 = [
  "Os sinos de Asterhall tocaram antes do nascer do sol.",
  "",
  "Não anunciaram morte, ataque ou celebração.",
  "",
  "Convocaram as Casas.",
  "",
  "Quando as grandes portas do Salão Real foram abertas, cada estandarte já ocupava",
  "seu lugar. Representantes de todas as Casas reconhecidas haviam respondido ao chamado de Lady Celene.",
].join("\n");

const TURN_3 = [
  "Alguns passageiros conseguiram sobreviver, mas dezenas morreram era o fim do navio Asteria.",
  "",
  "Entre os mortos confirmados estão Lorde Thrain Khazdrun, senhor de Khar-Durak;",
  "Aylin Karasoy, líder da Casa Karasoy; Theron Drakorys, comandante da delegação de Krythos;",
  "Conde Lucien de Montclair, representante de Auremont; e Prior Severin, uma das",
  "principais vozes da Ordem do Sino.",
].join("\n");

const CHRONICLE = [TURN_1, TURN_2, TURN_3].join("\n\n");

describe("isDeadInChronicle", () => {
  it("reconhece todos os mortos da Asteria", () => {
    for (const name of [
      "Lorde Thrain Khazdrun",
      "Aylin Karasoy",
      "Theron Drakorys",
      "Conde Lucien de Montclair",
      "Prior Severin",
    ]) {
      expect(isDeadInChronicle(name, CHRONICLE), name).toBe(true);
    }
  });

  /**
   * O caso que a geração por IA errou. Celene é a regente: aparece em todos os
   * turnos, e os turnos 1 e 2 mencionam morte a menos de 200 caracteres do nome
   * dela sem que nada disso seja sobre ela.
   */
  it("mantém Lady Celene viva apesar da morte mencionada por perto", () => {
    expect(isDeadInChronicle("Lady Celene Valerius", TURN_1)).toBe(false);
    expect(isDeadInChronicle("Lady Celene Valerius", TURN_2)).toBe(false);
    expect(isDeadInChronicle("Lady Celene Valerius", CHRONICLE)).toBe(false);
  });

  // Procurar pelo sobrenome mataria a Casa inteira junto com o líder.
  it("não mata parentes homônimos do morto", () => {
    expect(isDeadInChronicle("Selim Karasoy", CHRONICLE)).toBe(false);
    expect(isDeadInChronicle("Borin Khazdrun", CHRONICLE)).toBe(false);
  });

  it("ignora títulos ao identificar a pessoa", () => {
    expect(isDeadInChronicle("Thrain", CHRONICLE)).toBe(true);
    expect(isDeadInChronicle("Lady", CHRONICLE)).toBe(false);
  });

  it("é indiferente a acento e caixa", () => {
    expect(isDeadInChronicle("THRAIN KHAZDRÚN", CHRONICLE)).toBe(true);
  });

  it("não morre ninguém sem crônica", () => {
    expect(isDeadInChronicle("Aylin Karasoy", "")).toBe(false);
    expect(isDeadInChronicle("", CHRONICLE)).toBe(false);
  });
});

/**
 * Falsos positivos reais, achados na crônica de verdade (não paráfrase).
 * Cada um é um mecanismo diferente do mesmo bug de fundo: contar como morte
 * qualquer frase onde o nome e uma palavra de morte aparecem juntos, sem
 * checar se a morte é DAQUELA pessoa. Dois têm correção (fronteira de
 * palavra, filtro de posse); o terceiro (Celene) não tem — ver o comentário
 * na respectiva `it` sobre por que a correção foi removida.
 */

// Turno 10, crônica pública. "kaelen" contém "kael" como substring; sem
// fronteira de palavra, a frase matava Ser Kael Rimerberg num turno em que o
// sobrenome dele nunca aparece — quem está morrendo aqui é Kaelen Drakorys,
// nome diferente.
const TURN_10_MAQUINAS_DE_KAELEN =
  "Asterhall ainda está de pé, cercada por três coisas ao mesmo tempo: os orcs no muro, os próprios mortos nas ruas e as máquinas de Kaelen subindo o rio.";

// Turno 1, crônica pública. Celene é quem REPORTA a notícia do Norte, não
// quem morreu. O nome dela fica antes dos dois-pontos; a palavra de morte
// vem depois, no conteúdo do que ela relatou.
const TURN_1_RELATO_DE_CELENE =
  "Lady Celene apresentou mensagens preocupantes vindas do Norte: A cidade de Rimewatch deixou de responder, aldeias foram abandonadas e existem relatos de mortos deixando suas sepulturas.";

// Turno 9, crônica pública. Quem morre são os ORCS DE Thorgul — ele é dono
// da tropa, não sujeito do verbo. Thorgul segue vivo e lidera o assalto a
// Asterhall no turno seguinte.
const TURN_9_ORCS_DE_THORGUL =
  "Os orcs de Thorgul que morriam subindo a corda também levantavam. Não voltavam para o acampamento. Entravam na fileira. Pela primeira vez em catorze noites, o Clã Mandíbula de Osso recuou de um trecho de muralha que já tinha tomado, e recuou dos próprios mortos, não dos vivos.";

// Ficha SEGREDO da Casa do Ouro (nunca aparece na crônica pública). Serve só
// para confirmar que a frase direta — nome, verbo de morte, sem relato nem
// posse no meio — continua reconhecida depois do ajuste.
const KAEL_MORTE_REAL = "Ser Kael Rimerberg morreu cobrindo a retirada.";

describe("isDeadInChronicle — falsos positivos reais da crônica", () => {
  it("não mata Ser Kael Rimerberg por 'kaelen' conter 'kael' (substring sem fronteira de palavra)", () => {
    expect(isDeadInChronicle("Ser Kael Rimerberg", TURN_10_MAQUINAS_DE_KAELEN)).toBe(false);
  });

  it("não mata Thorgul pela morte dos orcs DE Thorgul (posse, não sujeito)", () => {
    expect(isDeadInChronicle("Thorgul Crânio Cinzento", TURN_9_ORCS_DE_THORGUL)).toBe(false);
  });

  it("continua reconhecendo a morte quando é dita direto sobre a pessoa", () => {
    expect(isDeadInChronicle("Ser Kael Rimerberg", KAEL_MORTE_REAL)).toBe(true);
  });

  /**
   * Limitação documentada, ACEITA e não corrigida — decisão da revisão.
   *
   * A forma é sempre a mesma: um nome e uma morte SEM RELAÇÃO ENTRE SI caem
   * na mesma frase, e como a frase inteira é a unidade de busca — sem
   * tratamento nenhum para o que vem antes ou depois de um ":" no meio dela
   * — nada aqui sabe dizer de quem é a morte. Três exemplos, do mais simples
   * ao mais afiado:
   *
   * - Celene (turno 1, crônica pública): ela é quem RELATA a notícia do
   *   Norte, não quem morreu. O nome dela e "mortos" caem na mesma frase
   *   porque a notícia que ela traz fala de gente morrendo alhures.
   * - "Os cavalos morreram na estrada: Aylin Karasoy chegou cansada." —
   *   quem morre são os cavalos; Aylin só chegou cansada.
   * - "Theron Drakorys morreu na batalha: Lady Celene Valerius chegou ao
   *   castelo sã e salva." — o exemplo mais afiado: a MESMA frase que mata
   *   Celene diz, com todas as letras, que ela chegou sã e salva.
   *
   * Uma correção chegou a existir para separar essas formas — tratar o ":"
   * como direção dentro da frase, deixando morte à esquerda alcançar nome à
   * direita — mas foi removida: ela produzia o erro espelhado, matando
   * gente viva sempre que uma morte sem relação nenhuma dividisse frase com
   * o nome dela (exatamente os dois exemplos de cavalo/batalha acima, que
   * eram "false" antes e viraram "true" com aquela tentativa). Cortar a
   * frase no ":" também foi tentado antes disso, e quebrava a lista de
   * mortos real que usa dois-pontos em vez de "estão". As duas tentativas
   * trocaram uma forma quebrada por outra; frase inteira, sem tratamento
   * especial para ":", é a única regra que sobrevive a todas as formas
   * conhecidas, e o preço é aceitar estes falsos positivos.
   *
   * Para Celene especificamente, a resposta (`true`, morta) até bate com a
   * verdade — a morte dela é real, segredo do Turno 8 da Casa do Ouro
   * (mesmo mecanismo do Ser Kael Rimerberg), nunca publicado na crônica, e
   * fica bem fora da janela de ~4500 caracteres mais recentes que
   * `buildPublicChronicle` entrega à diplomacia — mas por acidente, não por
   * mérito: o código chega lá sem saber desse segredo, e erraria (viva) se
   * o turno 1 não tivesse essa frase específica.
   */
  it("[limitação documentada] nome e morte sem relação na mesma frase leem como morte", () => {
    expect(isDeadInChronicle("Lady Celene Valerius", TURN_1_RELATO_DE_CELENE)).toBe(true);
    expect(
      isDeadInChronicle("Aylin Karasoy", "Os cavalos morreram na estrada: Aylin Karasoy chegou cansada."),
    ).toBe(true);
    expect(
      isDeadInChronicle(
        "Lady Celene Valerius",
        "Theron Drakorys morreu na batalha: Lady Celene Valerius chegou ao castelo sã e salva.",
      ),
    ).toBe(true);
  });
});

describe("isDeadInChronicle — 'de/do/da <nome>' só é posse quando a cabeça não é palavra de morte", () => {
  it("'a morte de X', 'o corpo de X', 'o cadáver de X' continuam sendo a morte de X", () => {
    expect(isDeadInChronicle("Lorde Thrain Khazdrun", "A corte inteira se calou com a morte de Thrain.")).toBe(true);
    expect(isDeadInChronicle("Aylin Karasoy", "O corpo de Aylin foi enterrado ao amanhecer.")).toBe(true);
    expect(isDeadInChronicle("Theron Drakorys", "O cadáver de Theron foi enterrado sem honras.")).toBe(true);
    expect(isDeadInChronicle("Aylin Karasoy", "O enterro de Aylin reuniu meia cidade.")).toBe(true);
    expect(isDeadInChronicle("Theron Drakorys", "Ninguém chorou a morte de Theron.")).toBe(true);
  });

  // Real, campanha em produção (mestre/cronica.md): a forma mais idiomática
  // de anunciar uma morte em português é exatamente esta — "a morte de X" —
  // e é a que o filtro de posse apagava por engano.
  it("[real, mestre/cronica.md] 'até que a morte de Thrain seja esclarecida' continua morte", () => {
    expect(
      isDeadInChronicle(
        "Lorde Thrain Khazdrun",
        "Uma parcela do Conselho exige que Durgan rompa com Alic e suspenda qualquer compromisso militar com a Coroa até que a morte de Thrain seja esclarecida.",
      ),
    ).toBe(true);
  });

  it("'os orcs de/do X' continua sendo posse (X não morreu, a tropa dele morreu)", () => {
    expect(isDeadInChronicle("Thorgul Crânio Cinzento", TURN_9_ORCS_DE_THORGUL)).toBe(false);
    expect(
      isDeadInChronicle(
        "Thorgul Crânio Cinzento",
        "Os orcs do Thorgul que morriam subindo a corda também levantavam.",
      ),
    ).toBe(false);
  });
});
