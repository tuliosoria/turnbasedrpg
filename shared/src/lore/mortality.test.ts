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
 * Três falsos positivos reais, achados na crônica de verdade (não paráfrase).
 * Cada um é um mecanismo diferente do mesmo bug de fundo: contar como morte
 * qualquer frase onde o nome e uma palavra de morte aparecem juntos, sem
 * checar se a morte é DAQUELA pessoa.
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

describe("isDeadInChronicle — três falsos positivos reais da crônica", () => {
  it("não mata Ser Kael Rimerberg por 'kaelen' conter 'kael' (substring sem fronteira de palavra)", () => {
    expect(isDeadInChronicle("Ser Kael Rimerberg", TURN_10_MAQUINAS_DE_KAELEN)).toBe(false);
  });

  it("não mata Lady Celene por ela relatar a morte de quem mora no Norte", () => {
    expect(isDeadInChronicle("Lady Celene Valerius", TURN_1_RELATO_DE_CELENE)).toBe(false);
  });

  it("não mata Thorgul pela morte dos orcs DE Thorgul (posse, não sujeito)", () => {
    expect(isDeadInChronicle("Thorgul Crânio Cinzento", TURN_9_ORCS_DE_THORGUL)).toBe(false);
  });

  it("continua reconhecendo a morte quando é dita direto sobre a pessoa", () => {
    expect(isDeadInChronicle("Ser Kael Rimerberg", KAEL_MORTE_REAL)).toBe(true);
  });
});

/**
 * Regressões da revisão: as correções de dois-pontos-como-fim-de-frase e de
 * "de <nome> = posse" resolviam os três casos acima, mas erravam para o
 * outro lado em duas formas reais e comuns da crônica. Cada bloco abaixo
 * cobre as DUAS direções — o caso que tem que voltar a morrer e o caso que
 * tem que continuar vivo — porque a suíte antiga só tinha exemplos de uma
 * direção e foi assim que a regressão passou despercebida.
 */

describe("isDeadInChronicle — dois-pontos é direcional, não corta a frase", () => {
  // Forma sintética que cobre o mesmo formato da lista de mortos da Asteria
  // ("Entre os mortos confirmados estão...") mas escrita com dois-pontos em
  // vez de "estão": a palavra de morte vem ANTES dos dois-pontos e os nomes
  // DEPOIS. Cortar a frase no ":" (a correção anterior) separava os dois e
  // ninguém era encontrado morto.
  const LISTA_DE_MORTOS_COM_DOIS_PONTOS =
    "Entre os mortos confirmados: Lorde Thrain Khazdrun; Aylin Karasoy; Theron Drakorys.";

  const NOMES_LIDOS_EM_VOZ_ALTA =
    "Os nomes dos mortos foram lidos em voz alta: Aylin Karasoy, Theron Drakorys.";

  // Aqui nome E palavra de morte ficam do MESMO lado (depois dos
  // dois-pontos) — não depende de direção nenhuma, só não pode ter sido
  // apagado pelo corte de frase no ":".
  const NOTICIA_DA_MORTE_DE_AYLIN =
    "Uma só notícia atravessou o Salão: a morte de Aylin.";

  // Real, campanha em produção (publico/cronica.md, Turno 6): o assunto
  // ("notícias graves") vem antes dos dois-pontos sem palavra de morte, e a
  // palavra de morte e o nome ficam juntos depois — o mesmo formato de
  // NOTICIA_DA_MORTE_DE_AYLIN, com texto verbatim.
  const NOTICIAS_GRAVES_DE_KHAR_DURAK =
    "De Khar-Durak vazam notícias graves: os fornos pararam, e diz-se que os clãs da montanha estão a ponto de se voltar uns contra os outros por causa da morte de Lorde Thrain.";

  it("morte antes dos dois-pontos alcança nomes depois deles", () => {
    for (const name of ["Lorde Thrain Khazdrun", "Aylin Karasoy", "Theron Drakorys"]) {
      expect(isDeadInChronicle(name, LISTA_DE_MORTOS_COM_DOIS_PONTOS), name).toBe(true);
    }
  });

  it("'nomes dos mortos foram lidos: Fulano, Beltrano' também alcança", () => {
    expect(isDeadInChronicle("Aylin Karasoy", NOMES_LIDOS_EM_VOZ_ALTA)).toBe(true);
    expect(isDeadInChronicle("Theron Drakorys", NOMES_LIDOS_EM_VOZ_ALTA)).toBe(true);
  });

  it("nome e morte do mesmo lado dos dois-pontos continuam reconhecidos", () => {
    expect(isDeadInChronicle("Aylin Karasoy", NOTICIA_DA_MORTE_DE_AYLIN)).toBe(true);
  });

  it("[real, Turno 6 público] notícia grave antes dos dois-pontos, morte e nome depois", () => {
    expect(isDeadInChronicle("Lorde Thrain Khazdrun", NOTICIAS_GRAVES_DE_KHAR_DURAK)).toBe(true);
  });

  it("nome só ANTES dos dois-pontos não herda morte que só aparece DEPOIS (forma da Celene)", () => {
    expect(isDeadInChronicle("Lady Celene Valerius", TURN_1_RELATO_DE_CELENE)).toBe(false);
  });

  /**
   * Limitação conhecida e aceita, não um acidente: quando a MESMA pessoa é
   * sujeito antes dos dois-pontos e o verbo de morte vem depois sem repetir
   * o nome ("Fulano teve o destino que temiam: morreu afogado."), a forma é
   * gramaticalmente idêntica à da Celene — não dá para separar "quem relata"
   * de "quem morre" só pela posição do nome e da palavra de morte em torno
   * do ":". Entre morte real (recuperável só se o nome for repetido depois
   * do ":") e um outro Celene, o código erra para o lado seguro: fica vivo.
   */
  it("[limitação documentada] mesma pessoa antes do ':' e verbo de morte depois, sem repetir o nome, lê como viva", () => {
    expect(
      isDeadInChronicle(
        "Lorde Thrain Khazdrun",
        "Thrain Khazdrun teve o destino que todos temiam: morreu afogado no naufrágio.",
      ),
    ).toBe(false);
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
