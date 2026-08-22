/**
 * Dá recompensa às cartas que já estavam em jogo quando a regra mudou.
 *
 * As três cartas ativas em produção foram criadas antes de a biblioteca passar
 * a prometer ganho, e terminariam entregando só narrativa — duas delas depois
 * de cinco turnos de espera. O Mestre pediu que fossem reescritas junto com o
 * resto ("rescreve cartas existentes mesmo as ativas").
 *
 * Só o `completionEffects` muda. Custo, duração e progresso ficam de fora: o
 * jogador já pagou o preço antigo e planejou em cima do prazo antigo, e mexer
 * neles seria mudar o preço de algo já comprado.
 *
 * Uso, obrigatoriamente de dentro de `backend/`:
 *   node scripts/migrar-efeitos-cartas-ativas.mjs            (ensaio)
 *   node scripts/migrar-efeitos-cartas-ativas.mjs --confirm  (grava)
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DEFAULT_PROJECT_TEMPLATES } from "../../shared/dist/index.js";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE_NAME = process.env.TABLE_NAME || "ravenloft-game";
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || "winter-dead";
const PK = `CAMPAIGN#${CAMPAIGN_ID.toUpperCase().replace(/-/g, "_")}`;

/** Herda o efeito que a biblioteca passou a oferecer para aquela carta. */
function doTemplate(id) {
  const t = DEFAULT_PROJECT_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Template ${id} não existe mais na biblioteca.`);
  return { templateId: id, durationTurns: t.durationTurns, costs: t.costs, completionEffects: t.completionEffects };
}

/**
 * Os projetos que este script sabe migrar, pela chave do banco.
 *
 * Deliberadamente uma lista fechada: um projeto ativo fora dela faz o script
 * parar, em vez de inventar recompensa para uma carta que ninguém revisou.
 */
export const EFEITOS_NOVOS = {
  "PROJECT#do-ouro-g0gg#u2agb4ksqz": doTemplate("fundar-uma-academia-de-oficiais"),
  "PROJECT#khazdrun-wxey#67o2lpv8ea": doTemplate("construir-um-aqueduto"),

  // A Torre de Vigilância é carta customizada da Solarion, feita pela IA a
  // partir do pedido do jogador, e não tem template de onde herdar. São 4
  // turnos por custo 2, então a faixa permite até +2 permanente.
  "PROJECT#solarion-k0hc#j1q2uwnwce": {
    templateId: null,
    durationTurns: 4,
    costs: [{ type: "WEALTH", amount: 2, timing: "ON_START" }],
    completionEffects: {
      attributeChanges: [{ attribute: "controle", amount: 2, permanent: true }],
      favors: [],
      assets: ["Torre de Vigilância"],
      qualitativeEffects: ["Do alto dela, o deserto deixa de esconder quem se aproxima."],
      unlocks: [],
    },
  },
};

/** Devolve o projeto com o efeito novo. Erro se não estiver no plano. */
export function migrarProjeto(projeto) {
  const def = EFEITOS_NOVOS[projeto.SK];
  if (!def) throw new Error(`${projeto.SK} ("${projeto.title}") não está no plano de migração.`);
  return { ...projeto, completionEffects: def.completionEffects };
}

/**
 * Compara conteúdo, não ordem de chave. O DynamoDB devolve os campos de um
 * objeto em ordem arbitrária, então comparar `JSON.stringify` cru acusaria
 * diferença onde não há e o script deixaria de ser idempotente.
 */
function iguais(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => iguais(v, b[i]));
  const ca = Object.keys(a);
  const cb = Object.keys(b);
  return ca.length === cb.length && ca.every((k) => Object.hasOwn(b, k) && iguais(a[k], b[k]));
}

/** Se este projeto ainda tem o que mudar. */
export function precisaMigrar(projeto) {
  const def = EFEITOS_NOVOS[projeto.SK];
  if (!def) return false;
  return !iguais(projeto.completionEffects, def.completionEffects);
}

async function main() {
  const gravar = process.argv.includes("--confirm");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  const { Items = [] } = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :p AND begins_with(SK, :s)",
    ExpressionAttributeValues: { ":p": PK, ":s": "PROJECT#" },
  }));

  const ativos = Items.filter((p) => p.status === "ACTIVE");
  const foraDoPlano = ativos.filter((p) => !EFEITOS_NOVOS[p.SK]);
  if (foraDoPlano.length) {
    throw new Error(
      `Projetos ativos fora do plano: ${foraDoPlano.map((p) => `${p.SK} ("${p.title}")`).join(", ")}. ` +
      "Acrescente-os a EFEITOS_NOVOS antes de rodar.",
    );
  }

  const marca = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = new URL("../../backups/projetos/efeitos/", import.meta.url);
  let mexidos = 0;

  for (const projeto of ativos) {
    if (!precisaMigrar(projeto)) {
      console.log(`${projeto.title}: nada a alterar.`);
      continue;
    }
    const novo = migrarProjeto(projeto);
    mexidos++;
    console.log(`\n${projeto.title} (${projeto.turnsCompleted}/${projeto.durationTurns} turnos)`);
    console.log(`  Antes:  ${JSON.stringify(projeto.completionEffects)}`);
    console.log(`  Depois: ${JSON.stringify(novo.completionEffects)}`);

    if (!gravar) continue;

    mkdirSync(dir, { recursive: true });
    const nomeArquivo = `${projeto.SK.replace(/^PROJECT#/, "").replace(/#/g, "-")}-${marca}.json`;
    writeFileSync(new URL(nomeArquivo, dir), JSON.stringify(projeto, null, 2));
    await doc.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...novo, updatedAt: new Date().toISOString() },
    }));
    console.log("  Gravado.");
  }

  if (!gravar && mexidos) console.log("\nEnsaio. Rode com --confirm para gravar.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
