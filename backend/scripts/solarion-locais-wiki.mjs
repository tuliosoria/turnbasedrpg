/**
 * Mistura a geografia que o jogador de Solarion escreveu com a que o Mestre
 * semeou.
 *
 * Havia dois mapas para a mesma Casa. O do Mestre: Deserto de Sahr, a
 * cidade-oásis de Sahra-Lun, o Observatório das Sete Sombras, os poços. O do
 * jogador: Solythar erguida onde o Grande Rio encontra o mar, o Deserto de
 * Kha'Zer como muralha a oeste, o rio Nayrath, a Esfinge e as pirâmides.
 *
 * Os dois se encaixam sem que nenhum precise ceder, porque o próprio jogador
 * escreveu a ponte: no mito de Nahr'Zul que o Mestre aprovou, Sahr era terra
 * fértil cortada por rios até que a Deusa do Rio recolheu suas águas. O Atlas
 * do Mestre já dizia que Sahr tem "rios mortos" e "fontes subterrâneas" — é o
 * mesmo rio, enterrado. Daí sai a mistura:
 *
 * - Sahr é o deserto inteiro, e Kha'Zer é o nome que os caravaneiros dão ao
 *   trecho pior, entre Solythar e o interior;
 * - o Nayrath é a única água que a Deusa deixou, e por isso a foz vale um
 *   reino;
 * - Solythar é a capital viva, no rio; Sahra-Lun é a cidade antiga, dos poços
 *   e do Observatório;
 * - as Setas, a ordem de sinaleiros que o jogador propôs, existem para vencer
 *   a distância entre as duas.
 *
 * O mesmo corpo de texto vive em três lugares: a semente em
 * shared/src/defaultWiki.ts, o espelho em valdren-context/PUBLICO e o verbete
 * publicado no DynamoDB. As funções aqui trabalham em cima do markdown puro,
 * para servir aos três. Cada bloco só é trocado se estiver presente, porque a
 * semente não tem Dossiê e o verbete publicado tem.
 *
 * Roda em seco por padrão. Com --confirm, grava o verbete publicado e guarda o
 * corpo anterior, com a hora no nome, em backups/wiki/solarion-locais/.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.TABLE_NAME || "ravenloft-game";
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "winter-dead";
const PK = `CAMPAIGN#${CAMPAIGN_ID.toUpperCase().replace(/-/g, "_")}`;
const SK = "WIKI#casas-003-casa-solarion-os-olhos-do-meio-dia";

/**
 * Cada troca é um par exato. `de` precisa aparecer no texto no máximo uma vez;
 * `para` já é o resultado final, para que rodar de novo não mude nada.
 *
 * `somenteSe` marca os blocos que só existem no verbete publicado: o Dossiê foi
 * acrescentado depois, por rewrite-house-wiki.mjs, e não está na semente.
 */
export const TROCAS = [
  {
    nome: "inspiração",
    de: "> **Inspiração:** cidades-oásis, astronomia persa e árabe, cortes élficas antigas e civilizações que convivem com um passado imperial controverso.",
    para: "> **Inspiração:** cidades-oásis, astronomia persa e árabe, Egito faraônico, cortes élficas antigas e civilizações que convivem com um passado imperial controverso.",
  },
  {
    nome: "território e sede",
    de: "> **Território:** Deserto de Sahr.  \n> **Sede:** Sahra-Lun.",
    para: "> **Território:** Deserto de Sahr, o vale do rio Nayrath e a foz onde ele encontra o mar.  \n> **Sede:** Solythar, a Cidade do Sol. Sahra-Lun guarda os poços e o Observatório.",
  },
  {
    nome: "seção de geografia",
    de: [
      "### Sahra-Lun",
      "",
      "A capital foi construída ao redor de fontes subterrâneas.",
      "",
      "Torres de vento refrescam salões. Pátios internos escondem jardins. Espelhos de bronze conduzem luz a corredores profundos. O Observatório das Sete Sombras registra eclipses, cometas e mudanças no céu.",
      "",
      "A cidade controla poços e estações de caravana. Destruir um poço é considerado crime pior que roubar ouro.",
    ].join("\n"),
    para: [
      "### O rio e o deserto",
      "",
      "Solarion vive entre duas coisas: uma água só e uma areia sem fim.",
      "",
      "Os sacerdotes contam que Sahr foi terra fértil, cortada por rios, e que a Deusa do Rio era adorada como mãe da região. Ela amou o Sol, e da união nasceu um filho que morreu antes de vir ao mundo. Ao descobrir que o Sol amara outra, recolheu suas águas da terra. Os rios sumiram, as florestas morreram, o solo rachou. O que sobrou é o Deserto de Sahr, e os leitos vazios que cortam seus planaltos são os rios que ela levou.",
      "",
      "Uma água ficou: o Nayrath, o Grande Rio, que desce pela borda leste do deserto até o mar. Tudo o que Solarion planta, bebe e embarca depende dele, e a cheia anual é o calendário do reino.",
      "",
      "O que a Deusa não levou desceu. As fontes subterrâneas dos oásis são, para os sacerdotes, o mesmo rio enterrado. É por isso que um poço em Sahr é assunto sagrado antes de ser assunto de comércio.",
      "",
      "Sob as areias, dizem, dorme Nahr'Zul, o filho não nascido. Seu corpo é a massa de areia sob o deserto; seu sangue, o calor que queima as pedras ao meio-dia. Quem atravessa sem ler os sinais pode ser tragado pela areia movediça. Os habitantes de Sahr dizem que ele não mata por fome, mas por ressentimento: “Eu deveria ter nascido.”",
      "",
      "Ao trecho pior, o vazio entre Solythar e o interior, os caravaneiros dão outro nome: Deserto de Kha'Zer, o deus que tomou a terra morta. Dunas que trocam de lugar, calor que sufoca e rotas que só guias antigos conhecem. Exércitos já tentaram atravessá-lo; poucos chegaram do outro lado em condições de lutar. Kha'Zer é a primeira muralha de Solarion, e não custa um soldado.",
      "",
      "### Solythar, a Cidade do Sol",
      "",
      "Solythar foi erguida onde o Nayrath encontra o mar. Seu mercado é o maior do continente: vende-se ali o que sai de todos os reinos, e mercador que atravessa o deserto raramente volta de mãos vazias.",
      "",
      "De longe parece coisa de lenda. Uma Esfinge enorme vigia a entrada principal. Pirâmides, obeliscos e templos de pedra branca se erguem em honra dos três deuses: Kha'Zer, senhor do deserto; Nayrath, guardião do Grande Rio; e Thal-Merion, soberano do Sol. Canais, jardins irrigados e as academias fundadas por Zefhyrus ocupam o resto.",
      "",
      "Chegar é o problema. A oeste está Kha'Zer. A leste, o Nayrath defende a cidade com águas profundas, correntezas violentas e canais ocultos que só pilotos treinados atravessam. Na foz, bancos de areia e correntes imprevisíveis desmontam uma frota antes que ela alcance o interior.",
      "",
      "No Templo de Nymara, Deusa das Águas e das Cheias, vive reclusa a rainha Samira, Sacerdotisa do Rio. Ela deixa o templo uma vez por ano, na lua cheia da grande cheia.",
      "",
      "### Sahra-Lun, o Oásis das Sete Sombras",
      "",
      "Sahra-Lun é a cidade antiga, no coração de Sahr, construída ao redor de fontes subterrâneas.",
      "",
      "Torres de vento refrescam salões. Pátios internos escondem jardins. Espelhos de bronze conduzem luz a corredores profundos. O Observatório das Sete Sombras registra eclipses, cometas e mudanças no céu.",
      "",
      "A cidade controla poços e estações de caravana. Destruir um poço é considerado crime pior que roubar ouro.",
      "",
      "Fora das duas cidades o reino vive de povoados. Nayren, às margens do Nayrath, entrega o grão. Athon, cercada de deserto, faz a cerâmica e o vidro que as caravanas carregam.",
      "",
      "Entre uma ponta e outra ficam as torres das Setas, a ordem que leva recado por espelho, luz, sino e bandeira. É o único jeito de uma notícia atravessar Kha'Zer mais rápido que um camelo.",
    ].join("\n"),
  },
  {
    nome: "região do dossiê",
    somenteSe: "## Dossiê",
    de: "Deserto de Sahr, oásis, rotas de caravanas, cânions e comunidades ligadas às fontes subterrâneas.",
    para: "O vale e a foz do rio Nayrath, o Deserto de Sahr e sua parte mais dura, chamada Kha'Zer, com oásis, rotas de caravanas, cânions e comunidades ligadas às fontes subterrâneas.",
  },
  {
    nome: "cidades do dossiê",
    somenteSe: "## Dossiê",
    de: "Sahra-Lun: 58.000 habitantes.\n\nO restante vive em cidades de oásis, fortalezas de poços, comunidades de pastores, estações de caravana e pequenos centros de estudo.",
    para: "Solythar: 64.000 habitantes.\n\nSahra-Lun: 58.000 habitantes.\n\nNayren, às margens do Nayrath, e Athon, no meio do deserto, somam pouco mais de 10.000. O restante vive em cidades de oásis, fortalezas de poços, comunidades de pastores, estações de caravana e pequenos centros de estudo.",
  },
  {
    nome: "pressão demográfica",
    somenteSe: "## Dossiê",
    // Agora que a Casa tem duas cidades, "a cidade" ficou ambíguo: os canais
    // antigos e as ruínas são de Sahra-Lun.
    de: "A cidade cresce mais rapidamente que a capacidade dos canais mais antigos.",
    para: "Sahra-Lun cresce mais rapidamente que a capacidade dos canais mais antigos.",
  },
];

/**
 * Aplica as trocas que couberem no texto. Idempotente: um bloco que já está no
 * formato novo é deixado em paz. Um bloco que devia estar ali e não aparece em
 * nenhuma das duas formas é erro, porque significa que o texto mudou de forma
 * por baixo.
 */
export function misturarLocais(body) {
  let novo = body;

  for (const troca of TROCAS) {
    if (novo.includes(troca.para)) continue;
    if (troca.somenteSe && !novo.includes(troca.somenteSe)) continue;
    if (!novo.includes(troca.de)) {
      throw new Error(`Bloco "${troca.nome}" não foi encontrado nem na forma antiga nem na nova.`);
    }
    novo = novo.replace(troca.de, troca.para);
  }

  return novo;
}

/** Quais blocos este texto ainda tem para trocar — serve ao ensaio. */
export function blocosPendentes(body) {
  return TROCAS
    .filter((t) => !body.includes(t.para) && (!t.somenteSe || body.includes(t.somenteSe)))
    .map((t) => t.nome);
}

async function main() {
  const gravar = process.argv.includes("--confirm");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  const { Item } = await doc.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK, SK } }));
  if (!Item) throw new Error(`Verbete ${SK} não encontrado em ${TABLE_NAME}.`);

  const pendentes = blocosPendentes(Item.body);
  const novo = misturarLocais(Item.body);
  if (novo === Item.body) {
    console.log("Nada a alterar: o verbete já traz os locais misturados.");
    return;
  }

  console.log(`Verbete: ${Item.title}`);
  console.log(`Blocos a trocar: ${pendentes.join(", ")}.`);
  console.log(`Corpo: ${Item.body.length} -> ${novo.length} caracteres.`);

  if (!gravar) {
    console.log("\nEnsaio. Rode com --confirm para gravar.");
    return;
  }

  const dir = new URL("../../backups/wiki/solarion-locais/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  const marca = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(new URL(`casa-solarion-${marca}.md`, dir), Item.body);

  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { ...Item, body: novo, updatedAt: new Date().toISOString() },
  }));
  console.log(`Gravado. Corpo anterior em backups/wiki/solarion-locais/casa-solarion-${marca}.md.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
