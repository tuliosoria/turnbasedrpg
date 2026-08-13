import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import OpenAI from "openai";
import { readFile, writeFile } from "node:fs/promises";
import { SEATS } from "@ravenloft/content";

/**
 * Gera a persona de quem responde por cada Casa, a partir do cânone.
 *
 * Uma carta assinada por uma instituição soa igual à de qualquer outra
 * instituição. Uma carta assinada por Lorde Thrain, que acha que pedra não
 * suporta duas fundações, soa como ele.
 *
 * O resultado é escrito num arquivo do repositório, não no banco: a
 * personalidade de um líder é cânone do mundo e vale para qualquer campanha,
 * ao contrário de quem está vivo nesta partida. Fica revisável e editável à mão.
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const apiKey = process.env.OPENAI_API_KEY;
const confirm = process.argv.includes("--confirm");
const OUT = process.argv.find((a) => a.endsWith(".ts")) ?? "../../shared/src/diplomacy/leaders.ts";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const openai = apiKey ? new OpenAI({ apiKey, timeout: 60000 }) : null;
const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;
const titleHead = (t) => t.split(/\s*[—–]\s*|\s+-\s+/)[0].trim();
const slugify = (n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const SYSTEM = [
  "Você define quem responde as cartas de uma Casa do reino de fantasia Valdren.",
  "",
  "Regras:",
  "1. Use APENAS o cânone fornecido. Se ele nomeia o líder, use esse nome exato — não invente outro.",
  "2. Se o cânone não nomeia ninguém, crie um nome coerente com a cultura daquele povo.",
  "3. A personalidade tem de nascer do que a Casa viveu, não de arquétipos genéricos. Uma Casa que foi escravizada não escreve como uma Casa que financia guerras.",
  "4. Inclua ao menos um traço que atrapalha essa pessoa: orgulho, desconfiança, pressa, rancor. Líder sem falha não negocia, só concorda.",
  "5. Responda APENAS com JSON válido, sem cercas de código, no formato:",
  '{"leaderName":"","title":"","temperament":"","speechStyle":"","wants":"","refuses":""}',
  "",
  "temperament: 2 a 3 traços concretos, com a razão canônica de cada um.",
  "speechStyle: como essa pessoa escreve — extensão, formalidade, se cita a história, se ameaça, se ironiza.",
  "wants: o que ela busca em qualquer negociação.",
  "refuses: o que ela nunca aceitará, e por quê.",
  "Tudo em português.",
].join("\n");

async function loadHouses() {
  const res = await doc.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "WIKI#" },
  }));
  // SEATS é a lista de quem recebe cartas. Filtrar pela seção "casas" do wiki
  // deixava a Ordem do Sino e a Ordem dos Três sem voz própria.
  const byKey = new Map();
  for (const e of res.Items ?? []) {
    const k = slugify(titleHead(e.title));
    const prev = byKey.get(k);
    if (!prev || String(e.body ?? "").length > prev.length) byKey.set(k, String(e.body ?? ""));
  }
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7)?.split(",");
  return SEATS
    .filter((s) => !only || only.includes(s.key))
    .map((s) => ({ key: s.key, title: s.name, house: s.name, body: byKey.get(s.key) ?? "" }))
    .sort((a, b) => a.house.localeCompare(b.house));
}

const LEADER_RE = /(?:Lorde|Lady|Senhor|Senhora|Rei|Rainha|Príncipe|Princesa|Chanceler|Faraó|Alto Senhor|Strategos|Pontífice|Trino|Khan|Matriarca|Prior|Priora|Abade|Abadessa|Arquimago|Arquimaga|Guardião|Guardiã|Mestre|Mestra|Conde|Condessa|Duque|Duquesa|Capitão|Capitã)\s+[A-ZÀ-Ú][\wÀ-ú'-]+(?:\s+[A-ZÀ-Ú][\wÀ-ú'-]+)?/g

async function persona(h) {
  const named = [...new Set(h.body.match(LEADER_RE) ?? [])].slice(0, 4);
  const user = [
    `Casa: ${h.house}`,
    named.length ? `Líderes nomeados no cânone: ${named.join("; ")}` : "O cânone não nomeia o líder desta Casa.",
    `Cânone:\n${h.body.slice(0, 3000)}`,
    "Defina quem responde as cartas desta Casa.",
  ].join("\n\n");

  const res = await openai.chat.completions.create({
    model, temperature: 0.8, max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
  });
  return JSON.parse(res.choices[0]?.message?.content ?? "{}");
}

async function main() {
  const houses = await loadHouses();
  if (!confirm) {
    console.log(`[dry-run] ${houses.length} Casas:`);
    for (const h of houses) {
      const named = [...new Set(h.body.match(LEADER_RE) ?? [])].slice(0, 2);
      console.log(`  ${h.key.padEnd(26)} ${named.length ? named.join(", ") : "(sem líder no cânone — será criado)"}`);
    }
    console.log("\nRode com --confirm para gerar.");
    return;
  }
  if (!openai) throw new Error("OPENAI_API_KEY ausente");

  let out = {};
  try {
    const prior = await readFile(new URL(OUT, import.meta.url), "utf-8");
    out = JSON.parse(prior.match(/LEADER_PERSONAS: Record<string, LeaderPersona> = (\{[\s\S]*?\});/)[1]);
  } catch { /* primeira execução */ }

  for (const [i, h] of houses.entries()) {
    try {
      out[h.key] = await persona(h);
      console.log(`  [${i + 1}/${houses.length}] ${h.house} -> ${out[h.key].leaderName}`);
    } catch (e) {
      console.error(`  [${i + 1}/${houses.length}] ${h.house} FALHOU: ${e?.message ?? e}`);
    }
  }

  const file = `/**
 * Quem responde as cartas de cada Casa.
 *
 * Gerado a partir do cânone por backend/scripts/seed-leader-personas.mjs e
 * versionado à mão: a personalidade de um líder é cânone do mundo, vale para
 * qualquer campanha e deve ser editável como qualquer outro texto do cenário.
 *
 * Sem isto toda Casa escreve como a mesma chancelaria educada. Com isto, Lorde
 * Thrain responde como alguém que acha que pedra não suporta duas fundações.
 */
export interface LeaderPersona {
  leaderName: string;
  title: string;
  temperament: string;
  speechStyle: string;
  wants: string;
  refuses: string;
}

export const LEADER_PERSONAS: Record<string, LeaderPersona> = ${JSON.stringify(out, null, 2)};

export function personaFor(houseKey: string): LeaderPersona | null {
  return LEADER_PERSONAS[houseKey] ?? null;
}
`;
  await writeFile(new URL(OUT, import.meta.url), file, "utf-8");
  console.log(`\n${Object.keys(out).length} personas escritas em ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
