import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * Tira dos verbetes públicos a ambição e o segredo de cada figura.
 *
 * rewrite-house-wiki.mjs despejava "Quer: … Esconde: …" no fim de cada figura e
 * "**Busca:**" no bloco do líder. O verbete é lido pelos jogadores: ali estava,
 * em texto corrido, exatamente o que deveria custar uma cena para descobrir.
 * O gerador já não escreve mais isso; este script limpa o que ele deixou.
 *
 * Nada se perde: ambição e segredo continuam em shared/src/lore/characters.ts e
 * em diplomacy/leaders.ts, que só o Mestre e a IA leem.
 *
 * O que fica: "Recusa" — a linha vermelha é pública por natureza, é o que a
 * pessoa declara em mesa de negociação, e continua na ficha da Casa.
 *
 *   node scripts/limpar-ambicoes-wiki.mjs            # mostra o que mudaria
 *   node scripts/limpar-ambicoes-wiki.mjs --confirm  # grava
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const confirm = process.argv.includes("--confirm");
const OUTDIR = new URL("../../backups/wiki/antes-da-limpeza/", import.meta.url);

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;

/** Rótulo explícito, com ou sem negrito: "Quer:", "**Esconde:**". */
const ROTULO = /\s*\**(?:Quer|Esconde)\**:\**/;

const VERBOS = "Quer|quer|Deseja|deseja|Esconde|esconde|Almeja|almeja|Busca|busca|Anseia|anseia|Ambiciona|ambiciona";

/**
 * Frase de ambição ou segredo escrita como prosa, sem rótulo.
 *
 * A reescrita por IA dissolveu metade dos rótulos em texto corrido — "Quer
 * garantir que…", "Ela deseja expandir…" — e essas frases dizem a mesma coisa
 * que o rótulo dizia. Só conta a frase que ABRE com o verbo: no meio de uma
 * oração, "deseja" costuma descrever o que a Casa faz, não o que a pessoa
 * persegue em segredo.
 */
const PROSA_FIGURA = new RegExp(`(?:^|(?<=\\.\\s))(?:Ela |Ele )?(?:${VERBOS}) [^.]*\\.\\s*`, "g");

/**
 * Fora da lista de figuras a mesma frase pode ser a posição pública de uma
 * Casa: "Posições já apresentadas" abre a Casa do Ouro com "Deseja financiar a
 * Coroa" — isso é o que ela declarou em conselho, não o que ela esconde.
 * Por isso, em parágrafo solto, só corto quando o sujeito é uma pessoa.
 */
const PROSA_TEXTO = new RegExp(`(?:^|(?<=\\.\\s))(?:Ela |Ele )(?:${VERBOS}) [^.]*\\.\\s*`, "g");

/**
 * Ambição pendurada numa oração que começa com o temperamento.
 *
 * "Orgulhosa, desconfiada e decidida, busca reconhecimento da grandeza de
 * Caladris." — cortar a frase inteira levaria junto o temperamento, que é
 * público. Corta-se só da vírgula em diante, e o que sobra reganha o ponto.
 */
const CLAUSULA = new RegExp(`,\\s(?:que\\s)?(?:Ela |Ele )?(?:${VERBOS}) [^.]*\\.`, "g");

/**
 * O segredo pendurado no fim da frase: "…, mas esconde a insegurança sobre o
 * futuro da Ordem", "…, mas teme que suas críticas a tornem uma rival". É onde
 * o gerador despejava o campo `hides` quando a IA costurava tudo numa frase só.
 */
const SEGREDO = /,\s(?:mas |e )?(?:esconde|Esconde|teme|Teme|receia|Receia) [^.]*\./g;

/**
 * A ambição dita como substantivo: "Seu desejo é preservar a tradição", "Sua
 * grande ambição era garantir a autonomia do povo".
 */
const DESEJO = /(?:^|(?<=\.\s))S(?:eu|ua) (?:grande |maior )?(?:desejo|ambição|sonho) [^.]*\.\s*/g;

/**
 * Conectivo que perdeu a oração que ele ligava: cortar "…, mas teme que nunca
 * consiga" de "No entanto, teme que nunca consiga" deixa "No entanto." sozinho.
 */
const CONECTIVO = /(?:^|(?<=\.\s))(?:No entanto|Porém|Contudo|Entretanto|Todavia|Mas|Além disso)\.\s*/g;

/**
 * "Maera deseja que as histórias sejam lembradas." — a frase abre com o nome da
 * própria figura, e não com pronome. Em vez de tentar reconhecer nome próprio
 * no geral, uso o nome que o item já declara em negrito: preciso e sem chute.
 */
function prosaComNome(linha) {
  const nome = linha.match(/^\s*[-*]\s*\*\*([^*]+)\*\*/)?.[1] ?? "";
  const tokens = nome.replace(/[:,]/g, " ").split(/\s+/).filter((t) => t.length >= 3);
  if (!tokens.length) return null;
  const alt = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // "Capitão Orven deseja…" usa dois dos tokens do nome, não um: o nome na
  // frase pode vir tão completo quanto o autor quiser.
  return new RegExp(`(?:^|(?<=\\.\\s))(?:${alt})(?: (?:${alt}))* (?:${VERBOS}) [^.]*\\.\\s*`, "g");
}

export function limpar(body) {
  const saida = [];
  for (const linha of body.split("\n")) {
    // O bloco do líder traz a ambição como item próprio: a linha inteira sai.
    if (/^\s*[-*]\s*\**Busca:?\**/.test(linha)) {
      saida.push(null);
      continue;
    }

    let nova = linha;
    const corte = nova.search(ROTULO);
    if (corte !== -1) {
      const cauda = nova.slice(corte);
      // Recusa é pública e vem depois do rótulo em alguns verbetes; cortar até o
      // fim da linha a levaria junto. Se isso acontecer, prefiro parar a apagar.
      if (/Recusa/.test(cauda)) throw new Error(`Recusa depois do rótulo: ${linha.slice(0, 120)}`);
      nova = nova.slice(0, corte);
    }
    const figura = /^\s*[-*]\s/.test(linha);
    nova = nova.replace(figura ? PROSA_FIGURA : PROSA_TEXTO, "");
    if (figura) {
      const porNome = prosaComNome(linha);
      if (porNome) nova = nova.replace(porNome, "");
      nova = nova.replace(DESEJO, "").replace(CLAUSULA, ".").replace(SEGREDO, ".").replace(CONECTIVO, "");
    }

    if (nova === linha) {
      saida.push(linha);
      continue;
    }
    // Dois espaços no fim são quebra de linha forçada em Markdown, não sujeira:
    // comer esses espaços gruda o item seguinte no anterior. Corto o resto do
    // espaço em branco e devolvo a quebra que a linha já tinha.
    const quebra = /\s{2,}$/.test(linha) ? "  " : "";
    nova = nova.replace(/\s+$/, "");
    saida.push(nova.trim() ? nova + quebra : null);
  }
  return saida;
}

async function main() {
  const res = await doc.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "WIKI#" },
  }));

  const alterados = [];
  for (const item of res.Items ?? []) {
    const antes = String(item.body ?? "");
    const linhas = limpar(antes);
    const depois = linhas.filter((l) => l !== null).join("\n");
    if (depois !== antes) alterados.push({ item, antes, depois, linhas });
  }

  for (const { item, antes, depois, linhas } of alterados) {
    console.log("#".repeat(72));
    console.log(`${item.SK}  (${antes.length} -> ${depois.length} bytes)`);
    antes.split("\n").forEach((original, i) => {
      if (linhas[i] === original) return;
      console.log("  ANTES:", JSON.stringify(original.slice(0, 260)));
      console.log("  AGORA:", linhas[i] === null ? "(linha removida)" : JSON.stringify(linhas[i].slice(0, 260)));
      console.log();
    });
  }
  console.log(`verbetes a alterar: ${alterados.length}`);

  // Uma limpeza que quase funciona é pior do que nenhuma: deixa o jogador achar
  // que a informação não está lá. Aqui varro o resultado atrás do que escapou.
  const RESTO = /(?:^|(?<=[.\s]))(?:Quer|Deseja|Esconde|Almeja|Ambiciona|Busca|Teme)\b/;
  const sobras = [];
  for (const { item, depois } of alterados) {
    for (const l of depois.split("\n")) if (RESTO.test(l)) sobras.push(`${item.SK}\n    ${l.slice(0, 240)}`);
  }
  if (sobras.length) {
    console.log(`\nPARA CONFERIR — ${sobras.length} trechos que ainda soam a ambição ou segredo:`);
    sobras.forEach((s) => console.log("  " + s));
  }

  if (!confirm) return console.log("nada gravado — repita com --confirm");

  await mkdir(OUTDIR, { recursive: true });
  for (const { item, antes, depois } of alterados) {
    await writeFile(new URL(`${item.SK.replace(/[#/]/g, "_")}.md`, OUTDIR), antes, "utf8");
    await doc.send(new UpdateCommand({
      TableName: tableName,
      Key: { PK: campaignPk(campaignId), SK: item.SK },
      UpdateExpression: "SET #b = :b, updatedAt = :u",
      ExpressionAttributeNames: { "#b": "body" },
      ExpressionAttributeValues: { ":b": depois, ":u": new Date().toISOString() },
    }));
    console.log("gravado:", item.SK);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
