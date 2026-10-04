import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { LEADER_PERSONAS, isDeadInChronicle, seatOf } from "@ravenloft/content";
import { houseRoster } from "@ravenloft/content/gm-codex";
import { makeDocClient } from "../src/db/dynamo";
import { makeChatFn } from "../src/ai/openai";
import { listTurns } from "../src/db/turns";
import { campaignPk } from "../src/keys";
import { buildPublicChronicle } from "../src/ai/diplomacy/chronicle";
import { REVIEW_SYSTEM_PROMPT } from "../src/ai/diplomacy/revisor";
import { gerarResposta } from "../src/diplomacy/gerarResposta";
import { houseKeyForName } from "../src/routes/diplomacyRoutes";
import { snapshotNoMomento } from "../src/avaliacao/momento";
import { docEmMemoria } from "../src/avaliacao/docEmMemoria";
import { medirCarta } from "./medir-carta.mjs";

/**
 * Avaliação de cartas: roda o pipeline REAL de resposta sobre um banco
 * congelado, para um conjunto fixo de cartas de jogador, e mede cada resposta.
 * Desenho em docs/superpowers/specs/2026-09-27-avaliacao-de-cartas-design.md.
 *
 *   npm run avaliar-cartas -- exportar
 *   npm run avaliar-cartas -- rodar --rotulo producao        # mede o que o jogador recebeu, sem modelo
 *   npm run avaliar-cartas -- rodar --rotulo depois --seco   # pipeline inteiro com chat falso
 *   npm run avaliar-cartas -- rodar --rotulo depois [--casos 1,3] [--repeticoes 2]
 *   npm run avaliar-cartas -- remedir --rotulo depois          # métricas novas sobre texto já gerado
 *   npm run avaliar-cartas -- relatorio
 *
 * `--prompts` grava o que o escritor recebeu em avaliacao/snapshots/prompts/.
 *
 * Roda de dentro de backend/. O snapshot fica em avaliacao/snapshots/, que é
 * gitignored: ele tem o metaplot e os segredos de todas as Casas.
 *
 * A chave da OpenAI vem da configuração da Lambda, em memória — ver o
 * cabeçalho de refazer-cartas-do-turno.mjs. Nunca de arquivo.
 */

const RAIZ = resolve(process.cwd(), "avaliacao");
const SNAPSHOTS = join(RAIZ, "snapshots");
const RESULTADOS = join(RAIZ, "resultados");

// ---------------------------------------------------------------------------
// Partes puras (testadas)
// ---------------------------------------------------------------------------

const parDe = (carta) => `#${carta.fromHouseId}~${carta.toHouseKey}#`;

/** O fio do par antes da carta, e o que a Casa que responde já tinha escrito nele. */
export function materialDoCaso(itens, carta) {
  const anteriores = itens
    .filter((i) => i.SK.startsWith("DIPLMSG#") && i.SK.includes(parDe(carta)) && String(i.createdAt) < String(carta.createdAt))
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return {
    recebida: String(carta.body ?? ""),
    fioAnterior: anteriores.map((m) => String(m.body ?? "")),
    anterioresDaCasa: anteriores.filter((m) => m.author === "AI").map((m) => String(m.body ?? "")),
  };
}

const mediana = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Os números que o critério de decisão lê, sobre as execuções sem erro. */
export function resumir(execucoes) {
  const ok = execucoes.filter((e) => !e.erro && e.metricas);
  const m = ok.map((e) => e.metricas);
  const razaoEco = (x) => (x.eco.total ? x.eco.respondidas / x.eco.total : 1);
  return {
    casos: ok.length,
    medianaReciclagem: mediana(m.map((x) => x.reciclagem)),
    casosComTermoMartelado: m.filter((x) => x.termosBatidos.some((t) => t.naResposta >= 3)).length,
    casosComEcoBaixo: m.filter((x) => razaoEco(x) < 0.7).length,
    mortes: m.reduce((n, x) => n + x.morteAfirmada.length, 0),
    vazias: m.filter((x) => x.vazia).length,
    mediaPrazos: m.length ? m.reduce((n, x) => n + x.prazos.length, 0) / m.length : 0,
    escala: m.filter((x) => x.escala).length,
    nomesForaDoCanone: m.reduce((n, x) => n + x.nomesForaDoCanone.length, 0),
    revisorCorrigiu: m.filter((x) => x.motivosRevisor.length).length,
    erros: execucoes.length - ok.length,
  };
}

/**
 * O critério do spec, fixado antes de medir.
 *
 * Calibrado na coluna `producao` (27/09/2026): o eco lexical deu 1/12 numa
 * resposta que respondia todas as perguntas — resposta boa parafraseia. O eco
 * ficou informativo e sai do gatilho do revisor; pergunta ignorada se julga
 * lendo as listas "sem eco" do relatório. O revisor dispara só com morte afirmada.
 */
export function decidir(r, limiarReciclagem = 0.15) {
  return {
    detector: r.medianaReciclagem >= limiarReciclagem || r.casosComTermoMartelado >= 2,
    revisor: r.mortes > 0,
  };
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out._.push(a); continue; }
    const k = a.slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) out[k] = true; else { out[k] = v; i++; }
  }
  return out;
}

function ultimoSnapshot() {
  const xs = existsSync(SNAPSHOTS) ? readdirSync(SNAPSHOTS).filter((f) => f.endsWith(".json")).sort() : [];
  if (!xs.length) throw new Error("Nenhum snapshot. Rode `exportar` antes.");
  return join(SNAPSHOTS, xs[xs.length - 1]);
}

async function exportar() {
  const tabela = process.env.TABLE_NAME ?? "ravenloft-game";
  const pk = campaignPk(process.env.CAMPAIGN_ID ?? "winter-dead");
  const doc = makeDocClient(process.env.AWS_REGION ?? "us-east-1");
  const itens = [];
  let cursor;
  do {
    const res = await doc.send(new QueryCommand({
      TableName: tabela, KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk }, ...(cursor ? { ExclusiveStartKey: cursor } : {}),
    }));
    itens.push(...(res.Items ?? []));
    cursor = res.LastEvaluatedKey;
  } while (cursor);
  mkdirSync(SNAPSHOTS, { recursive: true });
  const arq = join(SNAPSHOTS, `snapshot-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(arq, JSON.stringify(itens));
  console.log(`${itens.length} itens → ${arq}`);
}

/** Envolve o chat para guardar o que o escritor recebeu e o que o revisor disse. */
function gravador(chat) {
  const registro = { escritor: null, revisor: null };
  const fn = async (system, user, json, max) => {
    const raw = await chat(system, user, json, max);
    if (system === REVIEW_SYSTEM_PROMPT) registro.revisor = raw;
    else registro.escritor = { user, raw };
    return raw;
  };
  return { fn, registro };
}

/** Chat de custo zero: exercita o pipeline inteiro sem modelo. */
function chatSeco() {
  let ultimo = "";
  return async (system) => {
    if (system === REVIEW_SYSTEM_PROMPT) return JSON.stringify({ veredito: "ok", carta: ultimo, motivos: [], acordo: null });
    ultimo = "Recebemos a vossa carta e a lemos com atenção. Responderemos pelo próximo correio.";
    return JSON.stringify({ carta: ultimo, acordo: null });
  };
}

const motivosDe = (raw) => {
  try { const o = JSON.parse(raw ?? ""); return Array.isArray(o.motivos) ? o.motivos.filter((m) => typeof m === "string") : []; }
  catch { return []; }
};

async function rodarCaso(snapshot, caso, { producao, seco, chatReal, fixa = null }) {
  const { itens, carta, respostaGravada } = snapshotNoMomento(snapshot, caso.sentId);
  const campaignId = carta.PK.replace(/^CAMPAIGN#/, "");
  const { doc } = docEmMemoria(itens);
  const casa = itens.find((i) => i.SK === `HOUSE#${carta.fromHouseId}`);
  const ownKey = casa ? houseKeyForName(String(casa.name)) : null;
  if (!ownKey) throw new Error(`Casa do jogador sem sede: ${carta.fromHouseId}`);

  const { fn, registro } = gravador(producao || seco || fixa ? chatSeco() : chatReal);
  const config = { tableName: "avaliacao", campaignId };
  const reply = await gerarResposta({ doc, config, chat: fn, chatDiplomacia: fn }, {
    playerHouseId: carta.fromHouseId, ownKey, toHouseKey: carta.toHouseKey,
    toCharacterId: carta.toCharacterId ?? null, sentId: carta.id,
  });

  const turnos = await listTurns(doc, "avaliacao", campaignId);
  const cronica = buildPublicChronicle(turnos);
  const pessoas = [
    ...Object.values(LEADER_PERSONAS).map((p) => p.leaderName),
    ...houseRoster(carta.toHouseKey).map((c) => c.name),
    ...houseRoster(ownKey).map((c) => c.name),
  ];
  const vivos = [...new Set(pessoas)].filter((n) => n && !isDeadInChronicle(n, cronica));

  const resposta = fixa ? fixa.resposta : producao ? String(respostaGravada?.body ?? "") : String(reply?.body ?? "");
  const material = materialDoCaso(itens, carta);
  return {
    resposta,
    prompt: registro.escritor?.user ?? "",
    promptChars: registro.escritor?.user.length ?? 0,
    metricas: medirCarta({
      resposta, ...material, vivos,
      casas: [String(casa.name), seatOf(carta.toHouseKey)?.name ?? "", seatOf(ownKey)?.name ?? ""],
      // Conhecido é o que o escritor tinha em mãos: nome fora do material é invenção.
      nomesConhecidos: [registro.escritor?.user ?? ""],
      motivos: fixa ? fixa.motivos : producao ? [] : motivosDe(registro.revisor),
    }),
  };
}

async function rodar(o) {
  const rotulo = o.rotulo;
  if (!rotulo || rotulo === true) throw new Error("--rotulo é obrigatório (producao, antes, depois…)");
  const producao = rotulo === "producao";
  const seco = !!o.seco;
  const repeticoes = producao || seco ? 1 : Number(o.repeticoes ?? 2);
  const arqSnapshot = typeof o.snapshot === "string" ? o.snapshot : ultimoSnapshot();
  const snapshot = JSON.parse(readFileSync(arqSnapshot, "utf8"));
  const filtro = typeof o.casos === "string" ? new Set(o.casos.split(",")) : null;
  const casos = JSON.parse(readFileSync(join(RAIZ, "casos.json"), "utf8")).filter((c) => !filtro || filtro.has(String(c.id)));

  let chatReal = null;
  if (!producao && !seco) {
    const key = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_DIPLOMACY_MODEL;
    if (!key || !model) throw new Error("OPENAI_API_KEY e OPENAI_DIPLOMACY_MODEL em memória (ver cabeçalho).");
    chatReal = makeChatFn(key, model, "high");
    console.log(`Plano: ${casos.length} casos × ${repeticoes} repetições = ${casos.length * repeticoes} gerações (${model}, esforço alto), 2–3 chamadas cada.`);
  }

  let commit = "?";
  try { commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(); } catch { /* fora de git */ }
  const saida = { rotulo, commit, snapshot: arqSnapshot.split("/").pop(), seco, data: new Date().toISOString(), execucoes: [] };
  mkdirSync(RESULTADOS, { recursive: true });
  const arq = join(RESULTADOS, `${rotulo}.json`);

  for (const caso of casos) {
    for (let r = 1; r <= repeticoes; r++) {
      let exec;
      for (let tentativa = 1; tentativa <= 2; tentativa++) {
        try {
          exec = { id: caso.id, sentId: caso.sentId, repeticao: r, ...(await rodarCaso(snapshot, caso, { producao, seco, chatReal })) };
          break;
        } catch (e) {
          exec = { id: caso.id, sentId: caso.sentId, repeticao: r, erro: String(e?.message ?? e) };
          // Snapshot ou doc falso quebrado não melhora tentando de novo.
          if (/snapshot|docEmMemoria|sem sede/.test(exec.erro)) break;
        }
      }
      // O prompt tem segredo de Casa: vai para a pasta ignorada, nunca para o resultado.
      if (exec.prompt !== undefined) {
        if (o.prompts) {
          mkdirSync(join(SNAPSHOTS, "prompts"), { recursive: true });
          writeFileSync(join(SNAPSHOTS, "prompts", `${rotulo}-${caso.id}-${r}.txt`), exec.prompt);
        }
        delete exec.prompt;
      }
      saida.execucoes.push(exec);
      writeFileSync(arq, JSON.stringify(saida, null, 2));
      const m = exec.metricas;
      console.log(exec.erro
        ? `caso ${caso.id} #${r}: ERRO ${exec.erro}`
        : `caso ${caso.id} #${r}: ${m.tamanho} car., prompt ${exec.promptChars}, reciclagem ${m.reciclagem.toFixed(2)}, eco ${m.eco.respondidas}/${m.eco.total}, prazos ${m.prazos.length}`);
    }
  }
  console.log(`→ ${arq}`);
}

/**
 * Recalcula as métricas de um rótulo já gerado, sem modelo: o texto e os
 * motivos do revisor ficam; o material é remontado pelo código deste
 * diretório. Para `antes`, rode dentro do worktree do código velho.
 */
async function remedir(o) {
  const arq = join(RESULTADOS, `${o.rotulo}.json`);
  const saida = JSON.parse(readFileSync(arq, "utf8"));
  const snapshot = JSON.parse(readFileSync(typeof o.snapshot === "string" ? o.snapshot : ultimoSnapshot(), "utf8"));
  const casos = JSON.parse(readFileSync(join(RAIZ, "casos.json"), "utf8"));
  for (const e of saida.execucoes) {
    if (e.erro) continue;
    const caso = casos.find((c) => c.id === e.id);
    const r = await rodarCaso(snapshot, caso, { fixa: { resposta: e.resposta, motivos: e.metricas.motivosRevisor } });
    e.metricas = r.metricas;
    e.promptChars = r.promptChars;
  }
  saida.remedido = new Date().toISOString();
  writeFileSync(arq, JSON.stringify(saida, null, 2));
  console.log(`→ ${arq} (remedido)`);
}

function relatorio(o) {
  const limiar = Number(o.limiar ?? 0.15);
  const casos = JSON.parse(readFileSync(join(RAIZ, "casos.json"), "utf8"));
  const ordem = ["producao", "antes", "depois"];
  const rotulos = readdirSync(RESULTADOS).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5))
    .sort((a, b) => (ordem.indexOf(a) + 1 || 99) - (ordem.indexOf(b) + 1 || 99) || a.localeCompare(b));
  const dados = Object.fromEntries(rotulos.map((r) => [r, JSON.parse(readFileSync(join(RESULTADOS, `${r}.json`), "utf8"))]));
  const pct = (x) => `${(x * 100).toFixed(0)}%`;

  const L = [
    "# Avaliação de cartas", "",
    "> Gerado por `npm run avaliar-cartas -- relatorio`. Métricas são sinais para decidir onde olhar, não notas.",
    `> Limiar de reciclagem: ${limiar}. Replay aproximado como história (NPC, relação e wiki no estado do snapshot), idêntico entre rótulos.`, "",
    "## Resumo", "",
    "| rótulo | commit | casos | reciclagem (mediana) | termo martelado | eco < 0,7 | mortes | prazos/carta | escala | nomes fora | revisor corrigiu | vazias | erros |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  const resumos = {};
  for (const r of rotulos) {
    const s = (resumos[r] = resumir(dados[r].execucoes));
    L.push(`| ${r}${dados[r].seco ? " (seco)" : ""} | ${dados[r].commit} | ${s.casos} | ${pct(s.medianaReciclagem)} | ${s.casosComTermoMartelado} | ${s.casosComEcoBaixo} | ${s.mortes} | ${s.mediaPrazos.toFixed(1)} | ${s.escala} | ${s.nomesForaDoCanone} | ${s.revisorCorrigiu} | ${s.vazias} | ${s.erros} |`);
  }
  if (resumos.depois) {
    const d = decidir(resumos.depois, limiar);
    L.push("", "## Decisão (critério do spec, sobre `depois`)", "",
      `- Detector de repetição: **${d.detector ? "SIM" : "não"}**`,
      `- Ajuste no revisor: **${d.revisor ? "SIM" : "não"}**`);
  }

  for (const caso of casos) {
    L.push("", `## Caso ${caso.id} — ${caso.par}`, "", `_${caso.porque}_`, "");
    const qualquer = rotulos.map((r) => dados[r].execucoes.find((e) => e.id === caso.id)).find(Boolean);
    if (!qualquer) { L.push("(sem execução)"); continue; }
    for (const r of rotulos) {
      for (const e of dados[r].execucoes.filter((x) => x.id === caso.id)) {
        L.push(`### ${r} #${e.repeticao}`, "");
        if (e.erro) { L.push(`**ERRO:** ${e.erro}`, ""); continue; }
        const m = e.metricas;
        L.push(
          `reciclagem ${pct(m.reciclagem)} · eco ${m.eco.respondidas}/${m.eco.total} · prazos ${m.prazos.length} · ${m.tamanho} car. · prompt ${e.promptChars} car.`,
          m.termosBatidos.length ? `termos do fio: ${m.termosBatidos.map((t) => `${t.termo} (${t.noFio}→${t.naResposta})`).join(", ")}` : "",
          m.eco.semEco.length ? `sem eco: ${m.eco.semEco.map((f) => `«${f}»`).join(" ")}` : "",
          m.morteAfirmada.length ? `**morte afirmada:** ${m.morteAfirmada.map((x) => `${x.nome}: «${x.frase}»`).join(" ")}` : "",
          m.nomesForaDoCanone.length ? `nomes fora do material: ${m.nomesForaDoCanone.join(", ")}` : "",
          m.escala ? `escala: ${m.escala}` : "",
          m.motivosRevisor.length ? `revisor: ${m.motivosRevisor.join(" | ")}` : "",
          "", "```text", e.resposta, "```", "",
        );
      }
    }
  }
  const arq = join(RAIZ, "relatorio.md");
  writeFileSync(arq, L.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n") + "\n");
  console.log(`→ ${arq}`);
}

async function main() {
  const o = args(process.argv.slice(2));
  const cmd = o._[0];
  if (cmd === "exportar") return exportar();
  if (cmd === "rodar") return rodar(o);
  if (cmd === "relatorio") return relatorio(o);
  if (cmd === "remedir") return remedir(o);
  console.error("uso: avaliar-cartas exportar | rodar --rotulo X [--seco] [--casos 1,2] [--repeticoes N] | remedir --rotulo X | relatorio [--limiar 0.15]");
  process.exitCode = 1;
}

if (process.argv[1] && /avaliar(-cartas)?\.m?js$/.test(process.argv[1]) && !process.env.VITEST) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
