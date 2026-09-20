import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
    relacoes, npcs: [], projetos: [], favores: [], trilha: [],
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
    cartas, fatos, pactos, relacoes, npcs, projetos, favores, trilha, casas,
  };

  return { publico, mestre, casas: porCasa };
}

const linha = (s) => (s == null || s === "" ? null : String(s));
const bloco = (titulo, corpo) => (corpo && corpo.length ? [`## ${titulo}`, "", corpo, ""].join("\n") : "");
const lista = (xs) => xs.filter(Boolean).map((x) => `- ${x}`).join("\n");

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

  if (f.projetos.length) {
    partes.push(bloco("Projetos", lista(f.projetos.map((p) => `${p.title} — ${p.status}${p.outcome ? ` (${p.outcome})` : ""}`))));
  }
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
