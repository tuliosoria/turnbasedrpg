export interface DefaultGmEntry {
  section: string;
  title: string;
  body: string;
  order: number;
}

/**
 * The GM-only lore of Valdren, the buried truth of the campaign. This content
 * is seeded into the Bíblia do Mestre and shown only to the admin. It reveals
 * that the Pale King is Othmar I, the king Valdren erased; the ancient betrayal
 * of the Great Houses; the phases for revealing the truth; and Othmar's three
 * anchors. None of it is ever served through a public endpoint.
 */
export const DEFAULT_GM_ENTRIES: DefaultGmEntry[] = [
  // ── A Verdade ────────────────────────────────────────────────────────
  {
    section: "a-verdade",
    title: "A verdade sobre o Inverno das Cinzas",
    order: 0,
    body: `A história oficial diz que, há trezentos anos, Valdren quase morreu de fome e frio por não ter um governo forte, e que foram as Grandes Casas e a Igreja do Sino que salvaram o reino. É mentira.

Durante o Inverno das Cinzas, Valdren tinha um rei legítimo: Othmar I. Ele abriu os celeiros reais, suspendeu impostos e confiscou o alimento que os nobres escondiam. Salvou milhares de pessoas e, ao fazê-lo, ameaçou o poder das Casas, dos mercadores e da Igreja.

Quando surgiu uma ameaça no Norte, Othmar marchou com o exército real. As Casas juraram enviar comida, cavalos e reforços. A ajuda nunca chegou. O exército morreu devagar, de fome e frio. Os mensageiros do rei foram presos ou executados. Antes mesmo de ele morrer, a Igreja declarou que havia perdido o favor divino, e os arquivos começaram a ser reescritos.

Othmar foi abandonado pelo próprio reino que tentava salvar. Foi então que as Brumas lhe ofereceram poder. Ele voltou como o Rei Pálido.`,
  },
  {
    section: "a-verdade",
    title: "Quem é o Rei Pálido",
    order: 1,
    body: `O Rei Pálido é Othmar I, o rei que Valdren apagou. Ele não é apenas um necromante maligno, e não deve ser jogado como um.

Othmar ainda acredita que ama Valdren. Para ele, a vida é a origem de todo mal: os vivos sentem fome, adoecem, envelhecem, desejam poder, traem e temem a morte. Sua solução é um reino eterno de mortos, onde ninguém passará fome, nenhuma criança ficará órfã, nenhum soldado temerá morrer, nenhuma Casa acumulará alimento e nenhuma guerra recomeçará. A paz será absoluta porque ninguém terá liberdade suficiente para rompê-la.

Ele não vê seu exército como invasor: acredita estar retomando seu reino. Não chama os soldados das Casas de inimigos, e sim de rebeldes. Não diz que mata seu povo, e sim que o liberta do sofrimento.

O horror dele está em como sua lógica parece coerente, mesmo destruindo tudo o que torna a vida digna de ser vivida.`,
  },
  {
    section: "a-verdade",
    title: "Valdren está presa",
    order: 2,
    body: `Valdren não está apenas cercada pelas Brumas. A ilha foi retirada de seu mundo original e transformada em um domínio isolado. As Brumas alteram caminhos, distâncias, a passagem do tempo, os sonhos, as lembranças e os próprios registros históricos.

O reino permanece preso porque seu sistema político foi construído sobre um crime que nunca foi reconhecido. Valdren apagou Othmar, preservou as instituições que o traíram e transformou a mentira em alicerce da sociedade.

O retorno do Rei Pálido é a história enterrada tentando voltar à superfície.`,
  },
  {
    section: "a-verdade",
    title: "As Brumas manipulam Othmar",
    order: 3,
    body: `As Brumas não querem simplesmente que Othmar conquiste Valdren. Elas querem manter a tragédia dele viva.

Othmar está preso a uma contradição: ama Valdren, mas acredita que precisa destruí-la para salvá-la. As Brumas alimentam sua raiva, sua obsessão e a memória do abandono.

Elas também colocam os jogadores diante das mesmas escolhas que condenaram Othmar: proteger apenas o próprio território, esconder alimento, abandonar aliados, sacrificar os soldados de outra Casa, usar a crise para conquistar poder, alterar registros, silenciar verdades incômodas.

Se as Casas repetirem a traição, Othmar terá certeza de que sempre esteve certo. Se agirem de outra forma, começam a romper o ciclo.`,
  },

  // ── O Segredo das Casas ──────────────────────────────────────────────
  {
    section: "casas-segredo",
    title: "Casa Vargen",
    order: 0,
    body: `Seus antepassados deveriam proteger a retirada do exército real. Em vez disso, fecharam uma passagem e impediram que soldados famintos e refugiados voltassem ao sul. A história oficial transformou isso numa defesa heroica.

Pista: um antigo estandarte mostra os lobos da Casa voltados para o sul, como se estivessem impedindo alguém de retornar.`,
  },
  {
    section: "casas-segredo",
    title: "Casa Auremont",
    order: 1,
    body: `Controlava os celeiros e as rotas comerciais. Seus antepassados esconderam alimento e inflaram os preços durante a fome. Depois financiaram a reconstrução e passaram à história como salvadores.

Pista: livros de contabilidade registram enormes reservas de grãos sob nomes falsos.`,
  },
  {
    section: "casas-segredo",
    title: "Casa Valerius",
    order: 2,
    body: `Seus juristas redigiram os decretos que declararam Othmar morto, depois ilegítimo e, por fim, inexistente.

Pista: páginas dos arquivos reais têm numeração interrompida e selos colados sobre nomes raspados.`,
  },
  {
    section: "casas-segredo",
    title: "Guilda do Ferro Negro",
    order: 3,
    body: `Desviou metal e armas destinados ao exército real para as forças que preparavam a sucessão. Também forjou as correntes usadas para trancar os depósitos de alimento.

Pista: o metal encontrado nas ruínas do Norte tem uma liga secreta ainda usada pela Guilda.`,
  },
  {
    section: "casas-segredo",
    title: "Ordem do Sino",
    order: 4,
    body: `Parte da antiga Igreja declarou que Othmar fora abandonado pelos deuses. Os sinos anunciaram sua morte antes que ela tivesse sido confirmada.

Pista: existe um toque removido da liturgia, chamado Toque do Rei Sem Nome.`,
  },
  {
    section: "casas-segredo",
    title: "Irmandade dos Corvos",
    order: 5,
    body: `Alguns mensageiros tentaram entregar os pedidos de socorro de Othmar. Outros aceitaram pagamento para fazer as mensagens desaparecerem.

Pista: certos corvos treinados ainda repetem a frase "O rei ainda espera pelo pão."

Estes segredos devem se ajustar às histórias que os jogadores criarem. O objetivo não é culpar os personagens de hoje, mas fazê-los decidir o que farão com a herança de suas Casas.`,
  },

  // ── Como Revelar a Verdade ───────────────────────────────────────────
  {
    section: "revelacao",
    title: "Fase 1: Rumores no inverno",
    order: 0,
    body: `Os jogadores encontram fortalezas silenciosas, mortos se levantando, refugiados chegando, o inverno começando cedo, símbolos antigos entre os inimigos e histórias sobre um rei coroado.

Não revele Othmar. O foco é sobrevivência, logística e política.`,
  },
  {
    section: "revelacao",
    title: "Fase 2: O exército que se lembra",
    order: 1,
    body: `Os jogadores descobrem mortos com armaduras reais antigas, senhas militares esquecidas, fortalezas chamadas por outros nomes, documentos alterados, acusações de traição e um Rei Pálido que trata o povo como seus súditos.

Ainda deve ser possível acreditar que ele está mentindo.`,
  },
  {
    section: "revelacao",
    title: "Fase 3: O rei apagado",
    order: 2,
    body: `Os jogadores descobrem que Othmar I existiu, que governava durante o Inverno das Cinzas, que marchou para o Norte, que as Casas juraram ajudá-lo, que os suprimentos nunca chegaram, que sua existência foi apagada de propósito e que as instituições de hoje se beneficiaram de sua queda.

A partir daqui, a verdade vira arma política. As Casas podem revelá-la, escondê-la ou usá-la contra rivais.`,
  },
  {
    section: "revelacao",
    title: "Fase 4: A oferta de Othmar",
    order: 3,
    body: `Othmar apresenta sua visão diretamente. A cada jogador ele pode oferecer algo diferente: o retorno de um herdeiro morto, proteção para uma cidade, a destruição de uma Casa rival, o reconhecimento de sua legitimidade, a revelação de um segredo, o governo de uma região ou a preservação de uma família.

Ele não deve apenas ameaçar os jogadores. Deve tentá-los.`,
  },
  {
    section: "revelacao",
    title: "Fase 5: A verdade sobre as Brumas",
    order: 4,
    body: `Os jogadores descobrem que Othmar foi manipulado, que as Brumas alimentam seu ressentimento, que Valdren está presa num ciclo, que uma vitória militar não bastará, que as Casas estão repetindo o passado e que memória, verdade e juramentos têm poder real.

Isso não absolve Othmar. Ele foi manipulado, mas escolheu o pacto e continua escolhendo sua visão.`,
  },

  // ── As Âncoras de Othmar ─────────────────────────────────────────────
  {
    section: "ancoras",
    title: "Como derrotar Othmar",
    order: 0,
    body: `Othmar não tem um filactério tradicional. Sua imortalidade depende de três âncoras: a Coroa de Ferro Branco, o Livro dos Nomes Ausentes e o Juramento Quebrado.

Para derrotá-lo em definitivo, os jogadores precisam separá-lo da Coroa, devolver os nomes apagados à história e reparar ou reconhecer o juramento quebrado.

Isso não deve aparecer como uma lista de objetivos. Precisa ser descoberto por meio de ruínas, arquivos, sonhos, rituais e consequências.`,
  },
  {
    section: "ancoras",
    title: "A Coroa de Ferro Branco",
    order: 1,
    body: `Representa a autoridade de Othmar e sua convicção de que ainda é o rei legítimo. Enquanto estiver ligado à Coroa, ele pode comandar os mortos que juraram servir ao reino.`,
  },
  {
    section: "ancoras",
    title: "O Livro dos Nomes Ausentes",
    order: 2,
    body: `Contém os nomes originais de soldados, refugiados e famílias apagados durante a reconstrução. Enquanto seguirem sem nome, esses mortos não conseguem alcançar o Silêncio.`,
  },
  {
    section: "ancoras",
    title: "O Juramento Quebrado",
    order: 3,
    body: `As Casas juraram enviar ajuda a Othmar. O juramento nunca foi cumprido, desfeito ou reconhecido publicamente. Ele permanece como uma dívida espiritual herdada pelas instituições de hoje.`,
  },

  // ── A Pergunta Central ───────────────────────────────────────────────
  {
    section: "pergunta",
    title: "A pergunta central da campanha",
    order: 0,
    body: `A campanha começa perguntando como os vivos vão deter o avanço dos mortos. Mas sua verdadeira pergunta é outra: Valdren merece sobreviver sem reconhecer aquilo que tornou o reino possível?

O Rei Pálido é o antagonista. Ele também é a memória que Valdren tentou enterrar.

As Casas não precisam aceitar a visão de Othmar. Precisam provar que são capazes de construir algo diferente do mundo que o criou.`,
  },
];
