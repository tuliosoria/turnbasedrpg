import OpenAI from "openai";
import { readFile, writeFile } from "node:fs/promises";

/**
 * Gera as fichas de identidade dos NPCs que não saem do elenco das Casas — a
 * Coroa, os 27 magos da Ordem dos Três, generais, sacerdotes — a partir do
 * cânone, e escreve shared/src/npc/rosterCodex.ts.
 *
 * Identidade é canon: como as personas de líder, o resultado é revisado em diff
 * e commitado, não gravado no banco. Tier 1 (Major NPCs) primeiro.
 *
 *   node scripts/seed-npc-codex.mjs --tier=MAJOR            # propõe, mostra
 *   node scripts/seed-npc-codex.mjs --tier=MAJOR --write    # grava o arquivo
 */

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const write = process.argv.includes("--write");
const tier = process.argv.find((a) => a.startsWith("--tier="))?.slice(7) ?? "MAJOR";
const OUT = new URL("../../shared/src/npc/rosterCodex.ts", import.meta.url);

/**
 * As fontes canônicas de onde as identidades saem. A Coroa e a Ordem dos Três
 * são o Tier 1 mais óbvio; generais e sacerdotes vêm depois.
 */
const SOURCES = [
  "valdren-context/PUBLICO/13_COROA_GOVERNO_LEIS_TRIBUTOS_E_ECONOMIA.md",
  "valdren-context/PUBLICO/06_ORDEM_DOS_TRES_E_OS_27_MAGOS.md",
  "valdren-context/PUBLICO/03_CASAS_ORDENS_E_PODERES_EXPANDIDOS.md",
];

const SYSTEM = [
  "Você extrai fichas de identidade de NPCs do cânone de Valdren para um jogo.",
  "",
  "Identidade é o que muda quase nunca: quem a pessoa é, não como ela se sente agora.",
  "NÃO invente humor, opinião do momento nem relação com Casas — isso é estado, vem depois.",
  "Extraia só pessoas nomeadas e relevantes (Rei, Rainha, arquimagos, generais, sacerdotes de peso).",
  "",
  "Para cada uma, devolva um objeto JSON com estes campos, em português:",
  "  id (slug do nome), name, role, tier ('MAJOR'), affiliation (chave: 'coroa', 'ordem-dos-tres', ou a Casa),",
  "  location (onde costuma estar), personality, speechStyle, values, fears, ambitions,",
  "  redLines (o que nunca aceita), secrets (o que esconde, para o GM), roleplayGuidance (como interpretá-lo).",
  "",
  "Responda apenas com um array JSON, sem cercas de código.",
].join("\n");

async function main() {
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente — a geração precisa da chave.");
  const openai = new OpenAI({ apiKey, timeout: 120000 });

  const canon = (await Promise.all(
    SOURCES.map((s) => readFile(new URL(`../../${s}`, import.meta.url), "utf-8").catch(() => "")),
  )).join("\n\n");

  const res = await openai.chat.completions.create({
    model,
    temperature: 0.4,
    max_tokens: 8000,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Tier alvo: ${tier}.\n\nCÂNONE:\n${canon.slice(0, 40000)}` },
    ],
  });

  const raw = (res.choices[0]?.message?.content ?? "").replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    console.error("Resposta não era JSON válido. Início:\n", raw.slice(0, 400));
    process.exit(1);
  }
  if (!Array.isArray(list)) throw new Error("Esperava um array de fichas.");

  console.log(`${list.length} fichas geradas:`);
  for (const n of list) console.log(`  ${n.tier ?? "?"}  ${n.affiliation ?? "?"}  ${n.name ?? "?"} — ${n.role ?? ""}`);

  if (!write) {
    console.log("\nRode com --write para gravar shared/src/npc/rosterCodex.ts.");
    return;
  }

  const file = [
    'import type { NpcIdentity } from "./codex.js";',
    "",
    "/**",
    " * NPCs gerados do cânone por backend/scripts/seed-npc-codex.mjs, revisados e",
    " * commitados como canon. A Coroa, os 27 magos, generais e sacerdotes.",
    " */",
    `export const ROSTER_CODEX: NpcIdentity[] = ${JSON.stringify(list, null, 2)};`,
    "",
  ].join("\n");
  await writeFile(OUT, file, "utf-8");
  console.log(`\nGravado: shared/src/npc/rosterCodex.ts (${list.length} fichas). Revise o diff antes de commitar.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
