import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import OpenAI from "openai";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { SEATS } from "@ravenloft/content";

/**
 * Reescreve o verbete de cada Casa integrando o dossiê e o elenco.
 *
 * Reescrever texto autoral é a operação mais perigosa deste repositório: um
 * modelo que resume "perde" fatos sem avisar, e o autor só descobre meses
 * depois, quando precisa de um detalhe que não está mais lá.
 *
 * Por isso a reescrita é verificada, não confiada. Todo nome próprio e todo
 * número do texto original precisa reaparecer no texto novo; o que não
 * reaparece reprova o verbete, e verbete reprovado não é gravado. O backup em
 * backups/wiki é o segundo cinto de segurança, e restore-wiki.mjs desfaz.
 *
 *   node scripts/rewrite-house-wiki.mjs            # propõe e valida, sem gravar
 *   node scripts/rewrite-house-wiki.mjs --confirm  # grava os aprovados
 *   node scripts/rewrite-house-wiki.mjs --merge    # funde sem IA, sem perda possível
 */

const tableName = process.env.TABLE_NAME ?? "ravenloft-game";
const campaignId = process.env.CAMPAIGN_ID ?? "winter-dead";
const region = process.env.AWS_REGION ?? "us-east-1";
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const apiKey = process.env.OPENAI_API_KEY;
const confirm = process.argv.includes("--confirm");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7)?.split(",");
const merge = process.argv.includes("--merge");
const OUTDIR = new URL("../../backups/wiki/propostas/", import.meta.url);

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const openai = apiKey ? new OpenAI({ apiKey, timeout: 120000 }) : null;
const campaignPk = (id) => `CAMPAIGN#${id.toUpperCase().replace(/-/g, "_")}`;
const titleHead = (t) => t.split(/\s*[—–]\s*|\s+-\s+/)[0].trim();
const slugify = (n) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const SYSTEM = [
  "Você reescreve o verbete de uma Casa do reino de fantasia Valdren, para um livro de cenário de RPG.",
  "",
  "A REGRA ACIMA DE TODAS: nada do texto original pode se perder. Você INTEGRA material novo",
  "ao que já existe; você não resume, não condensa e não corta. Todo nome, número, lugar,",
  "evento e detalhe do original tem de continuar presente no resultado.",
  "",
  "O que fazer:",
  "1. Mantenha o texto original, reorganizado se necessário para o material novo caber bem.",
  "2. Integre o dossiê (população, território, cidades, capacidade militar, pressão demográfica).",
  "3. Integre as figuras da Casa, cada uma com o que faz e como se porta.",
  "4. Use Markdown com cabeçalhos ## para as seções. Não repita o título do verbete.",
  "5. NÃO invente fatos novos. Só o que está no original ou no material fornecido.",
  "6. NÃO diga que alguém morreu. Quem morreu é decidido fora do verbete.",
  "7. De cada pessoa nomeada no original, mantenha TODAS as informações: o cargo, a opinião",
  "   e qualquer coisa que ela tenha feito ou lugar aonde tenha ido. Não abrevie ninguém.",
  "8. O verbete é público, lido pelos jogadores. Descreva quem a pessoa é e como ela se porta,",
  "   nunca a ambição que ela persegue nem o segredo que ela guarda. Isso é material do Mestre.",
  "",
  "Responda apenas com o Markdown do verbete, sem cercas de código e sem comentários.",
  "Tudo em português do Brasil.",
].join("\n");

/**
 * Nomes próprios e números do texto — o que não pode sumir na reescrita.
 *
 * Descarta a primeira palavra de cada frase: lá, a maiúscula é gramática e não
 * indica nome próprio, e exigi-la geraria reprovações falsas.
 */
function factsOf(text) {
  const facts = new Set();
  for (const raw of text.match(/[\d]{1,3}(?:\.\d{3})+|\b\d{3,}\b/g) ?? []) facts.add(raw);
  const stripped = text.replace(/[#*_>`\[\]()]/g, " ");
  for (const sentence of stripped.split(/(?<=[.!?:;\n])\s+/)) {
    const words = sentence.trim().split(/\s+/);
    for (const w of words.slice(1)) {
      const clean = w.replace(/^[^A-Za-zÀ-Ú]+|[^A-Za-zÀ-Úà-ú]+$/g, "");
      if (clean.length >= 4 && /^[A-ZÀ-Ú]/.test(clean)) facts.add(clean);
    }
  }
  return [...facts];
}

/** Fatos do original ausentes no texto novo. */
function missingFacts(original, rewritten) {
  const target = fold(rewritten);
  return factsOf(original).filter((f) => !target.includes(fold(f)));
}

async function loadWiki() {
  const res = await doc.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
    ExpressionAttributeValues: { ":pk": campaignPk(campaignId), ":sk": "WIKI#" },
  }));
  return res.Items ?? [];
}

function loadModule(path, name) {
  return readFile(new URL(path, import.meta.url), "utf-8").then((s) =>
    JSON.parse(s.match(new RegExp(`${name}[^=]*= (\\{[\\s\\S]*?\\});`))[1]));
}

/**
 * Pessoas que o verbete original já nomeia, no formato "- **Nome:** …".
 *
 * O elenco gerado não conhece essas pessoas e a reescrita as substituía pelo
 * elenco novo: o verbete de Solarion perdia Lorde Qasir da Primeira Luz, que só
 * existe ali. Quem o autor nomeou entra na reescrita por obrigação.
 */
function namedInOriginal(body) {
  return [...body.matchAll(/^\s*[-*]\s*\*\*([^:*]+?):?\*\*/gm)].map((m) => m[1].trim());
}

async function rewrite(seat, entry, canon, cast, persona) {
  const material = [
    canon && [
      "DOSSIÊ CANÔNICO:",
      canon.population ? `População: ${canon.population.toLocaleString("pt-BR")}` : "",
      canon.region ? `Região: ${canon.region}` : "",
      canon.mainCity ? `Cidades: ${canon.mainCity}` : "",
      canon.society ? `Quem vive lá: ${canon.society}` : "",
      canon.military ? `Capacidade militar: ${canon.military}` : "",
      canon.demographicPressure ? `Pressão demográfica: ${canon.demographicPressure}` : "",
    ].filter(Boolean).join("\n"),
    // Ambição e segredo ficam de fora do material: o verbete é público e o que a
    // pessoa quer ou esconde é carta do Mestre. Sai só quem ela é e como se porta.
    persona && `QUEM RESPONDE PELA CASA:\n${persona.leaderName}, ${persona.title}. ${persona.temperament} Recusa: ${persona.refuses}`,
    cast?.length && `FIGURAS DA CASA:\n${cast.map((c) => `- ${c.name}, ${c.role}. ${c.description}`).join("\n")}`,
  ].filter(Boolean).join("\n\n");

  const named = namedInOriginal(entry.body);
  const user = [
    `Casa: ${seat.name} (sede em ${seat.seat})`,
    named.length
      ? `PESSOAS JÁ NOMEADAS NO ORIGINAL — todas obrigatórias no resultado, com o mesmo nome e o mesmo papel: ${named.join("; ")}. As figuras novas se somam a estas, não as substituem.`
      : "",
    `VERBETE ORIGINAL — preserve tudo daqui:\n${entry.body}`,
    `MATERIAL A INTEGRAR:\n${material}`,
    "Reescreva o verbete integrando o material, sem perder nada do original.",
  ].filter(Boolean).join("\n\n");

  const res = await openai.chat.completions.create({
    model, temperature: 0.5, max_tokens: 4000,
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
  });
  return (res.choices[0]?.message?.content ?? "").replace(/^```(?:markdown)?\n?|\n?```$/g, "").trim();
}

/**
 * Funde o material novo ao verbete sem passar por IA.
 *
 * A saída de escape para quando o modelo não consegue preservar tudo: o
 * verbete de Solarion tem uma frase — "All Marifh foi enviado a Asterhall para
 * exigir provas" — que se perdia em toda tentativa. Aqui a preservação é
 * estrutural, não uma instrução que o modelo pode ignorar: o texto original sai
 * inteiro e o material novo vem depois dele.
 *
 * Fica menos costurado do que uma reescrita boa, e é exatamente por isso que
 * serve de fallback e não de padrão.
 */
function mergeDeterministic(entry, canon, cast, persona) {
  const already = new Set(namedInOriginal(entry.body).map(fold));
  const parts = [entry.body.trim()];

  if (canon) {
    const rows = [
      canon.population && ["População", `${canon.population.toLocaleString("pt-BR")} habitantes`],
      canon.region && ["Região", canon.region],
      canon.mainCity && ["Cidades", canon.mainCity],
      canon.society && ["Quem vive lá", canon.society],
      canon.military && ["Capacidade militar", canon.military],
      canon.demographicPressure && ["Pressão demográfica", canon.demographicPressure],
    ].filter(Boolean);
    // Cada campo vira um bloco, não um item de lista: metade destes valores tem
    // parágrafos ou uma lista própria dentro, e "- **Rótulo:** " na frente disso
    // achata tudo numa linha só.
    if (rows.length) parts.push(`## Dossiê\n\n${rows.map(([k, v]) => `**${k}**\n\n${String(v).trim()}`).join("\n\n")}`);
  }

  if (persona) {
    parts.push(`## Quem responde pela Casa\n\n**${persona.leaderName}**, ${persona.title}. ${persona.temperament}\n\n- **Recusa:** ${persona.refuses}`);
  }

  // Quem o original já nomeia fica onde o autor a colocou; repeti-la aqui
  // criaria duas versões da mesma pessoa no mesmo verbete.
  const novos = (cast ?? []).filter((c) => ![...already].some((n) => fold(c.name).includes(n) || n.includes(fold(c.name))));
  if (novos.length) {
    parts.push(`## Outras figuras da Casa\n\n${novos.map((c) =>
      `- **${c.name}**, ${c.role}. ${c.description}`).join("\n")}`);
  }

  return parts.join("\n\n");
}

async function main() {
  const wiki = await loadWiki();

  // Um verbete por Casa, escolhendo o mais longo quando há mais de um: a Ordem
  // do Sino aparece em "religioes" e em "magia", e o artigo principal é o que
  // descreve a instituição, não a menção de passagem.
  const byKey = new Map();
  for (const e of wiki) {
    const k = slugify(titleHead(e.title));
    const prev = byKey.get(k);
    if (!prev || String(e.body ?? "").length > String(prev.body ?? "").length) byKey.set(k, e);
  }

  const [canon, characters, personas] = await Promise.all([
    loadModule("../../shared/src/lore/houseCanon.ts", "HOUSE_CANON"),
    loadModule("../../shared/src/lore/characters.ts", "HOUSE_CHARACTERS"),
    loadModule("../../shared/src/diplomacy/leaders.ts", "LEADER_PERSONAS"),
  ]);

  const targets = SEATS.filter((s) => (!only || only.includes(s.key)) && byKey.has(s.key));
  const absent = SEATS.filter((s) => !byKey.has(s.key));
  if (absent.length) console.warn(`aviso: sem verbete -> ${absent.map((s) => s.key).join(", ")}`);
  if (!merge && !openai) throw new Error("OPENAI_API_KEY ausente");

  await mkdir(OUTDIR, { recursive: true });
  const approved = [];
  let rejected = 0;

  for (const [i, seat] of targets.entries()) {
    const entry = byKey.get(seat.key);
    const label = `[${i + 1}/${targets.length}] ${seat.name}`;
    try {
      const body = merge
        ? mergeDeterministic(entry, canon[seat.key], characters[seat.key], personas[seat.key])
        : await rewrite(seat, entry, canon[seat.key], characters[seat.key], personas[seat.key]);
      const missing = missingFacts(entry.body, body);
      const growth = body.length - entry.body.length;

      await writeFile(new URL(`${seat.key}.md`, OUTDIR), body, "utf-8");

      if (missing.length) {
        console.error(`  ${label} REPROVADO — perdeu ${missing.length}: ${missing.slice(0, 8).join(", ")}`);
        rejected++;
        continue;
      }
      console.log(`  ${label} ok (${entry.body.length} -> ${body.length} chars, +${growth})`);
      approved.push({ entry, body });
    } catch (e) {
      console.error(`  ${label} FALHOU: ${e?.message ?? e}`);
      rejected++;
    }
  }

  console.log(`\n${approved.length} aprovados, ${rejected} reprovados. Propostas em backups/wiki/propostas/`);
  if (!confirm) {
    console.log("Rode com --confirm para gravar os aprovados.");
    return;
  }

  for (const { entry, body } of approved) {
    await doc.send(new UpdateCommand({
      TableName: tableName,
      Key: { PK: entry.PK, SK: entry.SK },
      UpdateExpression: "SET body = :b, updatedAt = :u",
      ExpressionAttributeValues: { ":b": body, ":u": new Date().toISOString() },
    }));
    console.log(`  gravado: ${entry.title}`);
  }
  console.log(`\n${approved.length} verbetes atualizados.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
