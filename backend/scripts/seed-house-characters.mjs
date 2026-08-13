import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import OpenAI from "openai";
import { readFile, writeFile } from "node:fs/promises";
import { SEATS } from "@ravenloft/content";

/**
 * Cria o elenco de cada Casa a partir do cânone.
 *
 * O cenário nomeia líderes, mas quase nenhuma Casa tem gente ao redor deles: um
 * herdeiro, um conselheiro que discorda, alguém que carrega o trabalho sujo.
 * São essas figuras que dão a uma Casa textura de lugar habitado em vez de
 * bandeira num mapa.
 *
 * Regras que o gerador precisa obedecer:
 * - nomes já canônicos são preservados, nunca substituídos;
 * - ninguém é declarado morto aqui: morte é estado de partida, derivada da
 *   crônica em mortality.ts;
 * - cada Casa recebe pelo menos uma figura em conflito com a própria liderança,
 *   porque Casa unânime não produz história.
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const apiKey = process.env.OPENAI_API_KEY;
const confirm = process.argv.includes("--confirm");
const OUT = new URL("../../shared/src/lore/characters.ts", import.meta.url);

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const openai = apiKey ? new OpenAI({ apiKey, timeout: 90000 }) : null;
const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;
const titleHead = (t) => t.split(/\s*[—–]\s*|\s+-\s+/)[0].trim();
const slugify = (n) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const SYSTEM = [
  "Você cria o elenco de uma Casa do reino de fantasia Valdren, para um livro de cenário de RPG.",
  "",
  "Regras:",
  "1. Use o cânone fornecido. Nomes que já aparecem nele são obrigatórios e não podem ser trocados.",
  "2. NUNCA declare ninguém morto e nunca escreva sobre a morte de alguém. Quem morreu nesta campanha é decidido fora daqui, a partir da crônica.",
  "2b. Pessoas que o cânone declara mortas continuam no elenco, descritas como eram em vida.",
  "3. Crie de 3 a 5 figuras: quem lidera, quem herda, e pessoas que fazem a Casa funcionar — um mestre de ofício, uma comandante, um arquivista, uma sacerdotisa.",
  "4. PELO MENOS UMA figura deve discordar da própria liderança, com um motivo concreto vindo da história da Casa. Casa unânime não produz história.",
  "5. Cada figura precisa de algo que ela quer e algo que ela esconde ou teme. Descrição sem tensão vira enfeite.",
  "6. Nada de poderes mágicos não previstos no cânone. Magia em Valdren é rara, ritual e cara.",
  "7. Responda APENAS com JSON válido, sem cercas de código:",
  '{"characters":[{"name":"","role":"","description":"","wants":"","hides":""}]}',
  "",
  "description: 2 a 3 frases. Quem é, o que faz, como as pessoas a tratam.",
  "Tudo em português do Brasil.",
].join("\n");

async function loadWiki() {
  const res = await doc.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "WIKI#" },
  }));
  return res.Items ?? [];
}

/** Frases dos turnos que declaram mortes, para o gerador não ressuscitar ninguém. */
async function deathsFromTurns() {
  const res = await doc.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "TURN#" },
  }));
  const turns = (res.Items ?? [])
    .filter((t) => !String(t.SK).includes("#SUB#"))
    .sort((a, b) => Number(b.turnId ?? 0) - Number(a.turnId ?? 0));

  const sentences = [];
  for (const t of turns) {
    const text = `${t.publicEvent ?? ""} ${t.result?.publicResult ?? ""}`.replace(/\s+/g, " ");
    sentences.push(...(text.match(/[^.!?]*\b(morr\w*|mort\w*|pereceu|v[íi]tim\w*)\b[^.!?]*[.!?]/gi) ?? []));
  }
  // Frases que nomeiam gente valem mais que "muitos morreram": são elas que
  // dizem QUEM morreu. Sem esta ordenação, as mortes genéricas dos primeiros
  // turnos empurravam para fora a lista da Asteria, e o elenco ressuscitava
  // Lorde Thrain e Aylin Karasoy.
  const named = sentences.filter((x) => /[A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú]/.test(x));
  const rest = sentences.filter((x) => !named.includes(x));
  return [...named, ...rest].slice(0, 8).join(" ");
}

async function castFor(house, body, deaths, canon, persona) {
  const user = [
    `Casa: ${house}`,
    persona
      ? `LÍDER CANÔNICO — obrigatório aparecer no elenco com este nome exato: ${persona.leaderName}, ${persona.title}.`
      : "",
    `Cânone da Casa:\n${body.slice(0, 3500)}`,
    canon ? `Dados canônicos: população ${canon.population ?? "?"}; ${canon.region}` : "",
    deaths ? `MORTES JÁ CONFIRMADAS na campanha — respeite:\n${deaths}` : "",
    "Crie o elenco desta Casa.",
  ].filter(Boolean).join("\n\n");

  const res = await openai.chat.completions.create({
    model, temperature: 0.85, max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
  return Array.isArray(parsed.characters) ? parsed.characters : [];
}

async function main() {
  const wiki = await loadWiki();
  // A lista autoritativa é SEATS — quem pode receber uma carta. Filtrar por
  // `section === "casas"` perdia a Ordem do Sino e a Ordem dos Três, cujos
  // verbetes moram em "religioes" e "magia" apesar de serem potências jogáveis.
  const byKey = new Map();
  for (const e of wiki) {
    const k = slugify(titleHead(e.title));
    const prev = byKey.get(k);
    if (!prev || String(e.body ?? "").length > prev.length) byKey.set(k, String(e.body ?? ""));
  }
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7)?.split(",");
  const houses = SEATS
    .filter((s) => !only || only.includes(s.key))
    .map((s) => ({ key: s.key, house: s.name, body: byKey.get(s.key) ?? "" }))
    .sort((a, b) => a.house.localeCompare(b.house));
  const empty = houses.filter((h) => !h.body).map((h) => h.key);
  if (empty.length) console.warn(`  aviso: sem verbete no wiki -> ${empty.join(", ")}`);

  const deaths = await deathsFromTurns();
  let personas = {};
  try {
    const src = await readFile(new URL("../../shared/src/diplomacy/leaders.ts", import.meta.url), "utf-8");
    personas = JSON.parse(src.match(/LEADER_PERSONAS: Record<string, LeaderPersona> = (\{[\s\S]*?\});/)[1]);
  } catch { /* personas são opcionais */ }

  let canon = {};
  try {
    const src = await readFile(new URL("../../shared/src/lore/houseCanon.ts", import.meta.url), "utf-8");
    canon = JSON.parse(src.match(/HOUSE_CANON: Record<string, HouseCanon> = (\{[\s\S]*?\});/)[1]);
  } catch { /* dossiê é opcional */ }

  if (!confirm) {
    console.log(`[dry-run] ${houses.length} Casas. Mortes detectadas: ${deaths ? "sim" : "nenhuma"}`);
    console.log(deaths.slice(0, 300));
    return;
  }
  if (!openai) throw new Error("OPENAI_API_KEY ausente");

  let out = {};
  try {
    const prior = await readFile(OUT, "utf-8");
    out = JSON.parse(prior.match(/HOUSE_CHARACTERS: Record<string, HouseCharacter\[\]> = (\{[\s\S]*?\});/)[1]);
  } catch { /* primeira execução */ }

  for (const [i, h] of houses.entries()) {
    try {
      out[h.key] = await castFor(h.house, h.body, deaths, canon[h.key], personas[h.key]);
      console.log(`  [${i + 1}/${houses.length}] ${h.house} -> ${out[h.key].length} figuras`);
    } catch (e) {
      console.error(`  [${i + 1}/${houses.length}] ${h.house} FALHOU: ${e?.message ?? e}`);
      out[h.key] = [];
    }
  }

  const file = `/**
 * O elenco de cada Casa: quem lidera, quem herda, quem discorda.
 *
 * Gerado a partir do cânone por backend/scripts/seed-house-characters.mjs e
 * versionado à mão. Cânone do mundo, não estado de partida: quem está vivo
 * sai de \`isDeadInChronicle\`, em mortality.ts.
 */
export interface HouseCharacter {
  name: string;
  role: string;
  description: string;
  wants: string;
  hides: string;
}

export const HOUSE_CHARACTERS: Record<string, HouseCharacter[]> = ${JSON.stringify(out, null, 2)};

export function charactersFor(key: string): HouseCharacter[] {
  return HOUSE_CHARACTERS[key] ?? [];
}
`;
  await writeFile(OUT, file, "utf-8");
  const total = Object.values(out).reduce((n, c) => n + c.length, 0);
  console.log(`\n${total} figuras em ${Object.keys(out).length} Casas.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
