import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ENERGIA_POR_TURNO } from "@ravenloft/content";

/**
 * Gera o contexto legível da campanha a partir do DynamoDB.
 *
 * A verdade da partida vive no banco e não é legível sem escavar: achar o fio
 * de um prisioneiro custou varrer novecentos itens e remontar à mão uma trilha
 * que atravessava quatro turnos. Este script transforma isso em leitura.
 *
 * Escreve dois arquivos por audiência: o que ela sabe agora (`estado.md`) e
 * como se chegou até aqui (`cronica.md`).
 *
 * As CARTAS não se servem daqui. O contexto de mundo delas já existe e é
 * `buildPublicChronicle`, montado dos mesmos turnos — dois canais para a mesma
 * coisa divergiriam, e este repositório já pagou por cópia que diverge.
 *
 *   npm run contexto
 *
 * Sobrescreve sem perguntar, de propósito: nada aqui é autoral, e o `git diff`
 * é a rede de segurança. Nunca escreve em `valdren-context/`, que é cânone.
 */

const CAMPAIGN_ID = process.env.CAMPAIGN_ID ?? "winter-dead";
const TABLE = process.env.TABLE_NAME ?? "ravenloft-game";
const PK = "CAMPAIGN#WINTER_DEAD";
const RAIZ = "campaign-context/inverno-dos-mortos";

/** `"Do Ouro"` → `"do-ouro"`. A pasta usa o nome curto, não o id. */
export function pastaDaCasa(nome) {
  return String(nome)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const de = (itens, prefixo) => itens.filter((i) => String(i.SK ?? "").startsWith(prefixo));
const porTurno = (a, b) => (a.turnNumber ?? 0) - (b.turnNumber ?? 0) || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));

/**
 * Recorta os registros do banco em fatias por audiência.
 *
 * É aqui que mora a regra de sigilo, e é por isso que ela é uma função pura com
 * teste próprio: com pasta por audiência, vazar segredo deixa de depender do
 * julgamento de um modelo e passa a ser asserção.
 */
export function separarPorAudiencia(itens, casas) {
  const turnos = de(itens, "TURN#").filter((t) => /^TURN#\d+$/.test(t.SK)).sort((a, b) => a.turnId - b.turnId);
  const cartas = de(itens, "DIPLMSG#").sort(porTurno);
  const fatos = de(itens, "WFACT#");
  const pactos = de(itens, "CFACT#");
  const relacoes = de(itens, "HRELATION#");
  const npcs = de(itens, "NPCDYN#");
  const projetos = de(itens, "PROJECT#");
  const favores = de(itens, "FAVOR#");
  const trilha = de(itens, "HATTR#");
  const energia = de(itens, "ENERGY#");

  // A sede é a chave pela qual um fato privado nomeia a Casa dona dele.
  const sedeDe = (houseId) => {
    const nome = casas.find((c) => c.houseId === houseId)?.name ?? "";
    return `casa-${pastaDaCasa(nome)}`;
  };

  /** O turno visto por quem só pode ver o público dele. */
  const turnoPublico = (t) => ({
    turnId: t.turnId, status: t.status, publicEvent: t.publicEvent,
    publicResult: t.result?.publicResult ?? null, privado: null, resultadoPrivado: null,
  });

  /** O turno visto por uma Casa: o público, mais o que só ela viveu. */
  const turnoDaCasa = (t, houseId) => ({
    ...turnoPublico(t),
    privado: t.privateInfo?.[houseId] ?? null,
    resultadoPrivado: t.result?.houseResults?.[houseId] ?? null,
  });

  const publico = {
    audiencia: "publico", nome: "Público", houseId: null, sede: null,
    turnos: turnos.map(turnoPublico),
    // Carta é correspondência privada entre duas partes. Nenhuma delas é o
    // reino, então o arquivo público não guarda carta nenhuma.
    cartas: [],
    fatos: fatos.filter((f) => f.visibility === "PUBLICO" && f.status === "ATIVO"),
    pactos: pactos.filter((p) => p.status === "ATIVO" && (p.kind === "ALIANCA" || p.kind === "ACORDO")),
    relacoes, npcs: [], projetos: [], favores: [], trilha: [], energia: [],
    casas: casas.map((c) => ({ houseId: c.houseId, name: c.name, assets: c.assets ?? [] })),
  };

  const porCasa = {};
  for (const casa of casas) {
    const sede = sedeDe(casa.houseId);
    porCasa[pastaDaCasa(casa.name)] = {
      audiencia: "casa", nome: casa.name, houseId: casa.houseId, sede,
      turnos: turnos.map((t) => turnoDaCasa(t, casa.houseId)),
      cartas: cartas.filter((m) => m.fromHouseId === casa.houseId),
      fatos: [...publico.fatos, ...fatos.filter((f) => f.visibility === sede && f.status === "ATIVO")],
      pactos: pactos.filter((p) => p.betweenA === casa.houseId || p.betweenB === sede),
      relacoes,
      npcs: [],
      projetos: projetos.filter((p) => p.houseId === casa.houseId),
      favores: favores.filter((f) => f.toHouseId === casa.houseId || f.fromHouseId === casa.houseId),
      trilha: [],
      energia: energia.filter((e) => e.houseId === casa.houseId),
      casas: [casa],
    };
  }

  const mestre = {
    audiencia: "mestre", nome: "Mestre", houseId: null, sede: null,
    // O Mestre vê o privado de todas as Casas de uma vez.
    turnos: turnos.map((t) => ({
      ...turnoPublico(t),
      privadoPorCasa: Object.fromEntries(casas.map((c) => [c.name, t.privateInfo?.[c.houseId] ?? null])),
      resultadoPorCasa: Object.fromEntries(casas.map((c) => [c.name, t.result?.houseResults?.[c.houseId] ?? null])),
    })),
    cartas, fatos, pactos, relacoes, npcs, projetos, favores, trilha, energia, casas,
  };

  return { publico, mestre, casas: porCasa };
}

const linha = (s) => (s == null || s === "" ? null : String(s));
const bloco = (titulo, corpo) => (corpo && corpo.length ? [`## ${titulo}`, "", corpo, ""].join("\n") : "");
const lista = (xs) => xs.filter(Boolean).map((x) => `- ${x}`).join("\n");

/**
 * A situação de uma carta, que é como o Mestre pensa nelas.
 *
 * O status cru tem doze valores e não ordena nada: "Estabelecer uma Rota de
 * Caravanas" saía três vezes, em três linhas iguais menos a última palavra, e
 * não havia como dizer qual estava andando e qual tinha sido cancelada.
 */
const GRUPO_DE_STATUS = {
  ACTIVE: "Em andamento", APPROVED: "Em andamento", PAUSED: "Em andamento",
  PENDING_GM: "Esperando decisão", PENDING_TARGET: "Esperando decisão",
  PENDING_PLAYER: "Esperando decisão", PENDING_AI: "Esperando decisão",
  DRAFT: "Esperando decisão",
  COMPLETED: "Concluídos",
  CANCELLED: "Encerrados sem efeito", FAILED: "Encerrados sem efeito",
  REJECTED: "Encerrados sem efeito",
};

const ORDEM_DOS_GRUPOS = ["Em andamento", "Esperando decisão", "Concluídos", "Encerrados sem efeito"];

/**
 * Status que o mapa não conhece cai em "Esperando decisão", nunca fora do
 * arquivo: uma carta invisível é pior que uma carta no grupo errado.
 */
const grupoDe = (p) => GRUPO_DE_STATUS[p.status] ?? "Esperando decisão";

/** O que uma carta concluída deixou no mundo, em uma linha. */
function efeitosDaCarta(p) {
  const e = p.completionEffects ?? {};
  const partes = [
    ...(e.assets ?? []).map((a) => `ativo "${a}"`),
    ...(e.attributeChanges ?? []).map((c) => `${c.attribute} ${c.amount >= 0 ? "+" : ""}${c.amount}`),
    ...(e.favors ?? []).map((x) => `favor com ${x.targetHouseId}`),
    ...(e.unlocks ?? []),
  ];
  return partes.length ? ` → ${partes.join(", ")}` : "";
}

/**
 * Uma carta em uma linha. O id vai em crase no FIM: quem lê pula, e quem
 * precisa cruzar com a alocação de Energia acha.
 */
export function linhaDeProjeto(p) {
  const id = ` · \`${p.id}\``;
  const desde = p.createdAtTurn != null ? ` · desde T${p.createdAtTurn}` : "";
  const quando = p.lastProcessedTurnId != null ? `T${p.lastProcessedTurnId}` : "turno não registrado";
  switch (grupoDe(p)) {
    case "Em andamento":
      return `${p.title} — ${p.turnsCompleted ?? 0}/${p.durationTurns ?? "?"} turnos${desde}${id}`;
    case "Concluídos":
      return `${p.title} — ${quando}, ${p.outcome ?? "SEM DESFECHO"}${efeitosDaCarta(p)}${id}`;
    case "Encerrados sem efeito":
      return `${p.title} — ${p.status}${p.lastProcessedTurnId != null ? ` no ${quando}` : ""}${id}`;
    default:
      return `${p.title} — ${p.status}${desde}${id}`;
  }
}

export function blocoDeProjetos(f) {
  if (!f.projetos.length) return "";
  const nomeDaCasa = new Map(f.casas.map((c) => [c.houseId, c.name]));
  const porCasa = new Map();
  for (const p of f.projetos) {
    const nome = nomeDaCasa.get(p.houseId) ?? p.houseId;
    if (!porCasa.has(nome)) porCasa.set(nome, []);
    porCasa.get(nome).push(p);
  }
  const corpo = [...porCasa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([nome, cartas]) => {
      const linhas = [`### ${nome}`, ""];
      for (const grupo of ORDEM_DOS_GRUPOS) {
        const doGrupo = cartas.filter((p) => grupoDe(p) === grupo);
        if (!doGrupo.length) continue;
        linhas.push(`**${grupo}**`, "", lista(doGrupo.map(linhaDeProjeto)), "");
      }
      return linhas.join("\n");
    })
    .join("\n");
  return bloco("Projetos", corpo);
}

/**
 * A alocação de Energia do turno corrente.
 *
 * `ENERGY#` guarda `porProjeto: { <id>: pontos }`, e id de projeto não existia
 * em `.md` nenhum — era o motivo de este bloco não poder existir antes da
 * Tarefa 1. Casa sem item sai como "não alocou": ausência silenciosa é
 * indistinguível de bug de leitura, e Do Ouro nunca alocou em turno nenhum.
 */
export function blocoDeEnergia(f) {
  const corrente = f.turnos[f.turnos.length - 1];
  if (!corrente || !f.casas.length || !f.energia.length) return "";
  const titulo = new Map(f.projetos.map((p) => [p.id, p.title]));
  const doTurno = f.energia.filter((e) => e.turnId === corrente.turnId);
  const linhas = f.casas.map((c) => {
    const entradas = Object.entries(doTurno.find((e) => e.houseId === c.houseId)?.porProjeto ?? {});
    if (!entradas.length) return `**${c.name}** (T${corrente.turnId}) — não alocou`;
    const total = entradas.reduce((s, [, n]) => s + n, 0);
    const detalhe = entradas
      .map(([id, n]) => `${titulo.get(id) ?? `${id} (projeto não encontrado)`} ${n}`)
      .join(", ");
    return `**${c.name}** (T${corrente.turnId}) — ${total} de ${ENERGIA_POR_TURNO} pontos: ${detalhe}`;
  });
  return bloco("Energia do turno", lista(linhas));
}

/** Fatia → `estado.md`: onde as coisas estão agora. */
export function montarEstado(f) {
  const ultimo = [...f.turnos].reverse().find((t) => t.publicResult) ?? null;
  const corrente = f.turnos[f.turnos.length - 1] ?? null;
  const partes = [
    `# Estado da campanha — ${f.nome}`,
    "",
    "> Gerado por `npm run contexto`. Não edite à mão: a próxima execução sobrescreve.",
    "",
    corrente ? `**Turno corrente:** ${corrente.turnId} (${corrente.status})` : "**Nenhum turno ainda.**",
    "",
  ];

  if (corrente?.publicEvent) partes.push(bloco("O que o reino está vivendo", corrente.publicEvent));
  if (ultimo?.publicResult) partes.push(bloco(`Resultado público do turno ${ultimo.turnId}`, ultimo.publicResult));

  if (f.audiencia === "casa") {
    const u = [...f.turnos].reverse().find((t) => t.resultadoPrivado || t.privado);
    if (u?.resultadoPrivado) partes.push(bloco(`O que ${f.nome} viveu no turno ${u.turnId}`, u.resultadoPrivado));
    if (corrente?.privado) partes.push(bloco("Informação privada deste turno", corrente.privado));
  }

  if (f.audiencia === "mestre") {
    const u = f.turnos[f.turnos.length - 1];
    const privados = Object.entries(u?.privadoPorCasa ?? {}).filter(([, v]) => v);
    const resultados = Object.entries(u?.resultadoPorCasa ?? {}).filter(([, v]) => v);
    if (resultados.length) partes.push(bloco("O que cada Casa viveu", resultados.map(([n, v]) => `### ${n}\n\n${v}`).join("\n\n")));
    if (privados.length) partes.push(bloco("Informação privada de cada Casa", privados.map(([n, v]) => `### ${n}\n\n${v}`).join("\n\n")));
  }

  if (f.fatos.length) {
    partes.push(bloco("Fatos do mundo", lista(
      [...f.fatos].sort((a, b) => (b.turnNumber ?? 0) - (a.turnNumber ?? 0))
        .map((x) => `**T${x.turnNumber}**${f.audiencia === "mestre" ? ` _(${x.visibility})_` : ""} — ${x.summary}`),
    )));
  }

  if (f.pactos.length) {
    partes.push(bloco("Pactos de pé", lista(f.pactos.map((p) => `${p.kind} com ${p.betweenB}: ${p.summary}`))));
  }

  // Número de ficha não é coisa que uma Casa saiba da outra: fora do público.
  if (f.audiencia !== "publico") {
    partes.push(bloco("Casas", lista(f.casas.map((c) => {
      const a = c.attributes ?? {};
      return `**${c.name}** — riqueza ${a.riqueza}, recursos ${a.recursos}, soldados ${a.soldados}, controle ${a.controle}` +
        `; estabilidade ${c.stability ?? "?"}${(c.assets ?? []).length ? `; ativos: ${c.assets.join(", ")}` : ""}`;
    }))));
  } else {
    partes.push(bloco("Casas de jogador", lista(f.casas.map((c) =>
      `**${c.name}**${(c.assets ?? []).length ? ` — ativos: ${c.assets.join(", ")}` : ""}`))));
  }

  partes.push(blocoDeProjetos(f));
  partes.push(blocoDeEnergia(f));
  if (f.favores.length) {
    partes.push(bloco("Favores", lista(f.favores.map((x) => `${x.status}: ${x.reason}`))));
  }
  if (f.npcs.length) {
    partes.push(bloco("Memória viva dos NPCs", lista(f.npcs.map((n) =>
      `**${n.id}** — humor: ${n.mood ?? "?"}; objetivo: ${n.objective ?? "?"}`))));
  }
  if (f.trilha.length) {
    partes.push(bloco("Trilha de atributos", lista(f.trilha.map((t) =>
      `${t.quando} — ${t.houseId}: ${t.motivo}`))));
  }

  if (f.audiencia === "mestre") {
    partes.push(bloco("Metaplot",
      "O metaplot **não é gerado**: ele é autoral e vive em `valdren-context/MESTRE/`.\n" +
      "O banco sabe o que aconteceu, não por que aconteceu."));
  }

  return partes.filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Fatia → `cronica.md`: como se chegou até aqui. */
export function montarCronica(f) {
  const partes = [
    `# Crônica da campanha — ${f.nome}`,
    "",
    "> Gerado por `npm run contexto`. Não edite à mão.",
    "",
  ];

  for (const t of f.turnos) {
    partes.push(`## Turno ${t.turnId}`, "");
    const pedacos = [
      linha(t.publicEvent) && `**Evento público.** ${t.publicEvent}`,
      linha(t.publicResult) && `**Resultado público.** ${t.publicResult}`,
      linha(t.resultadoPrivado) && `**O que ${f.nome} viveu.** ${t.resultadoPrivado}`,
      linha(t.privado) && `**Informação privada.** ${t.privado}`,
    ].filter(Boolean);

    if (f.audiencia === "mestre") {
      for (const [nome, v] of Object.entries(t.resultadoPorCasa ?? {})) if (v) pedacos.push(`**${nome} viveu.** ${v}`);
      for (const [nome, v] of Object.entries(t.privadoPorCasa ?? {})) if (v) pedacos.push(`**Privado de ${nome}.** ${v}`);
    }

    partes.push(pedacos.length ? pedacos.join("\n\n") : "_Sem registro para esta audiência._", "");

    const doTurno = f.cartas.filter((m) => m.turnNumber === t.turnId);
    if (doTurno.length) {
      partes.push("**Correspondência.**", "", lista(doTurno.map((m) => {
        const quem = m.author === "AI" ? `${m.toHouseKey} →` : `→ ${m.toHouseKey}`;
        const primeira = String(m.body ?? "").split("\n").find((l) => l.trim())?.trim().slice(0, 110) ?? "";
        return `${quem} ${primeira}`;
      })), "");
    }
  }

  return partes.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ---------------------------------------------------------------------------
// Casca: lê o banco, chama as funções puras, escreve os arquivos.
// ---------------------------------------------------------------------------

async function lerParticao() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, QueryCommand } = await import("@aws-sdk/lib-dynamodb");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }));
  const itens = [];
  let ExclusiveStartKey;
  do {
    const r = await doc.send(new QueryCommand({
      TableName: TABLE, KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK }, ExclusiveStartKey,
    }));
    itens.push(...(r.Items ?? []));
    ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return { itens };
}

async function escrever(pasta, estado, cronica) {
  await mkdir(pasta, { recursive: true });
  await writeFile(join(pasta, "estado.md"), estado, "utf8");
  await writeFile(join(pasta, "cronica.md"), cronica, "utf8");
  console.log(`  ${pasta}/{estado,cronica}.md`);
}

async function main() {
  const { itens } = await lerParticao();
  const casas = de(itens, "HOUSE#").filter((h) => /^HOUSE#[^#]+$/.test(h.SK));
  console.log(`${itens.length} itens, ${casas.length} Casas de jogador.`);

  const f = separarPorAudiencia(itens, casas);
  await escrever(join(RAIZ, "publico"), montarEstado(f.publico), montarCronica(f.publico));
  await escrever(join(RAIZ, "mestre"), montarEstado(f.mestre), montarCronica(f.mestre));
  for (const [slug, fatia] of Object.entries(f.casas)) {
    await escrever(join(RAIZ, "casas", slug), montarEstado(fatia), montarCronica(fatia));
  }

}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
