import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Gera um snapshot por Casa de um turno já resolvido.
 *
 * Existe por uma falha real e repetida: o turno 10 de Khazdrun contou duas vezes
 * o mesmo interrogatório, deu por entregues estufas que ainda estavam na estrada
 * e não respondeu a cinco das dez ordens do jogador — inclusive a cremação dos
 * mortos e a evacuação de Droskar, que o jogador tinha negociado por carta. O
 * texto foi escrito lendo a crônica, que trunca carta em 110 caracteres e não
 * mostra ordem nenhuma.
 *
 * `estado.md` e `cronica.md` respondem "o que aconteceu na campanha".
 * Este script responde outra pergunta: "o que ESTA Casa pediu neste turno, o que
 * prometeu por escrito, e o que o turno devolveu a ela".
 *
 *   node backend/scripts/gerar-snapshot-turno.mjs        # último turno resolvido
 *   node backend/scripts/gerar-snapshot-turno.mjs 10
 *
 * Escreve `campaign-context/snapshots/<casa>-turn<N>-context.md`, um por Casa de
 * jogador, mais `_conferencia-turn<N>.md` com os pares de trechos em que uma Casa
 * fala de outra — é ali que mora a contradição entre dois textos do mesmo turno.
 *
 * Sobrescreve sem perguntar. Nada aqui é autoral; o `git diff` é a rede.
 */

const CAMPAIGN_ID = process.env.CAMPAIGN_ID ?? "winter-dead";
const TABLE = process.env.TABLE_NAME ?? "ravenloft-game";
const PK = "CAMPAIGN#WINTER_DEAD";
const RAIZ = "campaign-context/snapshots";

const de = (itens, prefixo) => itens.filter((i) => String(i.SK ?? "").startsWith(prefixo));

/** `"Do Ouro"` → `"do-ouro"`. Mesma regra do gerar-contexto. */
export function slugDaCasa(nome) {
  return String(nome)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Quebra o texto de ordens numerado pelo jogador em itens.
 *
 * O jogador numera ("1.", "2 —", "10."), e é por item que se confere se o turno
 * respondeu. Sem numeração devolve um item só, que é o certo: melhor um bloco
 * inteiro para ler do que dez pedaços inventados.
 */
export function separarOrdens(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return [];
  const linhas = t.split("\n");
  const itens = [];
  let atual = null;
  let proximo = 1;
  for (const linha of linhas) {
    const m = /^\s*(\d{1,2})\s*[.)—-]\s*(.*)$/.exec(linha);
    if (m && Number(m[1]) === proximo) {
      if (atual) itens.push(atual);
      atual = { numero: Number(m[1]), texto: m[2].trim() };
      proximo += 1;
    } else if (atual) {
      atual.texto += "\n" + linha;
    }
  }
  if (atual) itens.push(atual);
  if (!itens.length) return [{ numero: null, texto: t }];
  return itens.map((i) => ({ ...i, texto: i.texto.trim() }));
}

const ARTIGOS = new Set(["para","como","dos","das","que","com","uma","por","nos","nas","sem","sob","será","serão","seus","suas","nossa","nosso","nossas","nossos","mais","cada","este","esta","isso","caso","onde","quando","também","ainda","apenas","conforme","diante","entre","sobre","antes","depois","novos","novas","todos","todas"]);

/** Palavras longas e específicas de uma ordem, para procurar no texto do turno. */
export function palavrasChave(texto, limite = 6) {
  const vistas = new Set();
  const out = [];
  for (const cru of String(texto).toLowerCase().split(/[^a-záàâãéêíóôõúüç]+/)) {
    if (cru.length < 5 || ARTIGOS.has(cru) || vistas.has(cru)) continue;
    vistas.add(cru);
    out.push(cru);
    if (out.length >= limite) break;
  }
  return out;
}

/** Quantas das palavras-chave da ordem aparecem no que o turno devolveu. */
export function conferirOrdem(ordem, resposta) {
  const alvo = String(resposta ?? "").toLowerCase();
  const chaves = palavrasChave(ordem);
  const achadas = chaves.filter((p) => alvo.includes(p));
  return { chaves, achadas };
}

/**
 * O texto de um fato ou pacto.
 *
 * O banco guarda a prosa em `summary` (e repete em `quote`); não existe campo
 * `text`. Ler o campo errado devolve uma lista de marcadores vazios, que é
 * pior do que não gerar o arquivo — parece que o mundo não tem fato nenhum.
 */
const textoDoFato = (f) => {
  const corpo = String(f.summary ?? f.quote ?? f.text ?? "").trim();
  const selo = [f.kind, f.status && f.status !== "ATIVO" ? f.status : null].filter(Boolean).join(" ");
  return selo ? `_${selo}_ ${corpo}` : corpo;
};

const bloco = (titulo, corpo) => corpo && String(corpo).trim() ? [`## ${titulo}`, "", String(corpo).trim(), ""] : [];

/** Frases de um texto que nomeiam outra Casa — matéria-prima da conferência cruzada. */
export function frasesQueCitam(texto, nomes) {
  const frases = String(texto ?? "").split(/(?<=[.!?])\s+|\n+/);
  const out = [];
  for (const f of frases) {
    const citados = nomes.filter((n) => n && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(f));
    if (citados.length) out.push({ frase: f.trim(), citados });
  }
  return out;
}

export function montarSnapshot({ turno, ultimo, casa, ordens, resultado, privado, publico, resultadoPublico, cartas, pactos, projetos, favores, fatos, trilha, semResposta }) {
  const p = [];
  p.push(`# ${casa.name} — turno ${turno} (snapshot)`, "");
  p.push(`> Gerado por \`node backend/scripts/gerar-snapshot-turno.mjs ${turno}\`. Não edite à mão.`);
  p.push("> Material do Mestre: contém a informação privada desta Casa. Não misture Casas num mesmo arquivo.");
  if (!ultimo) p.push(`> **Turno encerrado.** Ordens, textos e cartas são exatamente os do turno ${turno}. Projetos e favores aparecem com o estado de HOJE, marcado onde isso importa — não os leia como estado do turno ${turno}.`);
  p.push("");

  // O banco guarda só os números de HOJE em HOUSE#. Para turno antigo, o que dá
  // para afirmar é o `depois` da trilha daquele turno; sem trilha, dizer que não
  // se sabe é melhor do que mostrar o número de hoje com cara de histórico.
  const daTrilha = trilha.find((t) => t.depois)?.depois;
  const attr = daTrilha ?? (ultimo ? casa.attributes ?? {} : {});
  const numeros = `riqueza ${attr.riqueza ?? "?"} · recursos ${attr.recursos ?? "?"} · soldados ${attr.soldados ?? "?"} · controle ${attr.controle ?? "?"}`;
  if (daTrilha) p.push(`**Atributos ao fim do turno ${turno}:** ${numeros} · estabilidade ${casa.stability ?? "?"} _(estabilidade é a de hoje)_`);
  else if (ultimo) p.push(`**Atributos ao fim do turno ${turno}:** ${numeros} · estabilidade ${casa.stability ?? "?"}`);
  else p.push(`**Atributos ao fim do turno ${turno}:** não registrados. Os de hoje são riqueza ${casa.attributes?.riqueza ?? "?"} · recursos ${casa.attributes?.recursos ?? "?"} · soldados ${casa.attributes?.soldados ?? "?"} · controle ${casa.attributes?.controle ?? "?"}, e **não** valem como número deste turno.`);
  if (trilha.length) {
    for (const t of trilha) {
      const antes = t.antes ?? {}, depois = t.depois ?? {};
      const mudou = Object.keys({ ...antes, ...depois }).filter((k) => antes[k] !== depois[k])
        .map((k) => `${k} ${antes[k]} → ${depois[k]}`);
      p.push(`**Mudou neste turno:** ${mudou.length ? mudou.join(", ") : "nada"} _(${t.motivo ?? ""})_`);
    }
  }
  p.push(`**Ativos:** ${(casa.assets ?? []).join(", ") || "nenhum"}`, "");

  p.push("## As ordens que a Casa deu", "");
  if (!ordens.length) p.push("_Nenhuma ordem registrada._", "");
  for (const o of ordens) {
    p.push(`### Ordem ${o.numero ?? "—"}`, "", o.texto, "");
    const { chaves, achadas } = conferirOrdem(o.texto, `${resultado}\n${privado}`);
    const marca = achadas.length ? `eco no turno: ${achadas.join(", ")}` : "**nenhuma palavra desta ordem aparece no que o turno devolveu**";
    p.push(`- [ ] respondida? _(${marca}; chaves: ${chaves.join(", ") || "—"})_`, "");
  }

  p.push(...bloco("O que o turno devolveu a esta Casa", resultado));
  p.push(...bloco("Informação privada que esta Casa recebeu", privado));
  p.push(...bloco("Evento público do turno", publico));
  p.push(...bloco("Resultado público do turno", resultadoPublico));

  p.push("## Cartas deste turno, na íntegra", "");
  if (!cartas.length) p.push("_Nenhuma._", "");
  for (const c of cartas) {
    const quem = c.author === "AI" ? `${c.toHouseKey} → ${casa.name}` : `${casa.name} → ${c.toHouseKey}`;
    p.push(`### ${quem}${c.author === "AI" ? "" : "  (escrita pelo JOGADOR)"} · ${String(c.createdAt ?? "").slice(0, 16)}`, "", String(c.body ?? "").trim(), "");
  }

  if (semResposta.length) {
    p.push("## Cartas de NPC que o jogador ainda não respondeu", "");
    for (const c of semResposta) p.push(`- ${c.toHouseKey} (T${c.turnNumber}): ${String(c.body ?? "").split("\n").find((l) => l.trim())?.slice(0, 140) ?? ""}`);
    p.push("");
  }

  p.push("## Compromissos de pé que envolvem esta Casa", "");
  if (!pactos.length) p.push("_Nenhum._", "");
  for (const c of pactos) p.push(`- **T${c.turnNumber ?? "?"} ${c.status ?? ""}** — ${textoDoFato(c)}`);
  p.push("");

  p.push(ultimo ? "## Projetos" : "## Projetos (estado de hoje; abertos até o turno " + turno + ")", "");
  if (!projetos.length) p.push("_Nenhum._", "");
  for (const pr of projetos) {
    const passo = pr.durationTurns ? ` (${pr.turnsCompleted ?? 0}/${pr.durationTurns} turnos)` : "";
    p.push(`- **${pr.title ?? "—"}** — ${pr.status}${pr.outcome ? ` ${pr.outcome}` : ""}${passo}, aberto no turno ${pr.createdAtTurn ?? "?"}`);
    if (pr.outcomeNarrative) p.push(`  - desfecho: ${pr.outcomeNarrative}`);
    if (pr.status === "FAILED" && pr.lastProcessedTurnId != null && Number(pr.lastProcessedTurnId) !== Number(turno)) {
      p.push(`  - ⚠ falhou no turno ${pr.lastProcessedTurnId}, não neste. Confira se o jogador já foi informado.`);
    }
  }
  p.push("");

  p.push(ultimo ? "## Favores pendentes" : "## Favores pendentes (estado de hoje)", "");
  if (!favores.length) p.push("_Nenhum._", "");
  for (const f of favores) p.push(`- **${f.status}** desde ${String(f.createdAt ?? "").slice(0, 10)} — ${f.fromHouseId}: ${f.reason ?? ""}`);
  p.push("");

  p.push("## Fatos privados desta Casa", "");
  if (!fatos.length) p.push("_Nenhum._", "");
  for (const f of fatos) p.push(`- **T${f.turnNumber ?? "?"}** — ${textoDoFato(f)}`);
  p.push("");

  return p.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * O arquivo do mundo: o que qualquer Casa sabe, mais o que cada potência quer.
 *
 * Sem ele, escrever um turno obriga a lembrar de cabeça se a capital já caiu e se
 * a fileira parada em Droskar andou. Fato público errado é o pior dos três erros,
 * porque ele chega a todas as Casas ao mesmo tempo.
 */
export function montarMundo({ turno, publico, resultadoPublico, fatos, potencias, relacoes, casas, pactos }) {
  const p = [`# Valdren — turno ${turno} (mundo)`, ""];
  p.push(`> Gerado por \`node backend/scripts/gerar-snapshot-turno.mjs ${turno}\`. Não edite à mão.`);
  p.push("> Só material público: é o que toda Casa pode saber. O que é de uma Casa só vive no arquivo dela.", "");

  const doTurno = fatos.filter((f) => Number(f.turnNumber) === Number(turno));
  const recentes = fatos.filter((f) => Number(f.turnNumber) < Number(turno) && Number(f.turnNumber) >= Number(turno) - 2);
  p.push("## Onde o mundo está", "");
  if (!doTurno.length) p.push("_Nenhum fato público novo neste turno._", "");
  for (const f of doTurno) p.push(`- ${textoDoFato(f)}`);
  p.push("");
  if (recentes.length) {
    p.push("### E o que ainda estava de pé nos dois turnos anteriores", "");
    for (const f of recentes) p.push(`- **T${f.turnNumber}** — ${textoDoFato(f)}`);
    p.push("");
  }

  p.push(...bloco("Evento público do turno", publico));
  p.push(...bloco("Resultado público do turno", resultadoPublico));

  p.push("## As potências, e o que cada uma quer agora", "");
  if (!potencias.length) p.push("_Humor e objetivo das potências só valem para o turno corrente; o banco guarda um estado só, o de hoje. Para turno encerrado, use as cartas e os fatos acima._", "");
  const porSede = {};
  for (const n of potencias) (porSede[n.affiliation ?? "—"] ??= []).push(n);
  for (const sede of Object.keys(porSede).sort()) {
    p.push(`### ${sede}`, "");
    for (const n of porSede[sede]) {
      p.push(`- **${n.id}** — humor: ${n.mood ?? "?"}; objetivo: ${n.objective ?? "?"}`);
      const ultima = (n.memory ?? []).slice(-1)[0];
      if (ultima) p.push(`  - lembra do turno ${ultima.turnNumber}: ${ultima.description}`);
    }
    p.push("");
  }

  p.push("## Como as potências se olham", "");
  const comNota = relacoes.filter((r) => String(r.note ?? "").trim());
  if (!comNota.length) p.push("_Nenhuma nota._", "");
  for (const r of comNota) p.push(`- **${r.fromKey} → ${r.toKey}** (amizade ${r.amizade ?? "?"}, comércio ${r.comercio ?? "?"}): ${String(r.note).trim()}`);
  p.push("");

  p.push("## Casas de jogador, pelos números", "");
  for (const c of casas) {
    const a = c.attributes ?? {};
    p.push(`- **${c.name}** (${c.castleName ?? "?"}) — riqueza ${a.riqueza ?? "?"}, recursos ${a.recursos ?? "?"}, soldados ${a.soldados ?? "?"}, controle ${a.controle ?? "?"}, estabilidade ${c.stability ?? "?"}`);
  }
  p.push("");

  p.push("## Pactos de pé", "");
  const ativos = pactos.filter((c) => c.status === "ATIVO");
  if (!ativos.length) p.push("_Nenhum._", "");
  for (const c of ativos) p.push(`- **T${c.turnNumber ?? "?"}** — ${textoDoFato(c)}`);
  p.push("");

  return p.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function montarConferencia(turno, porCasa) {
  const nomes = porCasa.map((c) => c.casa.name);
  const p = [`# Conferência cruzada — turno ${turno}`, "",
    "> Gerado. Cada linha é um trecho do texto de uma Casa que nomeia outra Casa.",
    "> Duas Casas contando a mesma coisa de formas incompatíveis é o erro que nenhum",
    "> snapshot isolado pega — foi assim que as estufas de Solarion chegaram a",
    "> Khar-Durak no mesmo turno em que partiram de Solythar.", ""];
  for (const { casa, resultado, privado } of porCasa) {
    const outros = nomes.filter((n) => n !== casa.name).concat(["Solarion", "Khazdrun", "Krythos", "Vargen", "Droskar", "Asterhall"]);
    const achados = frasesQueCitam(`${resultado}\n${privado}`, [...new Set(outros)]);
    p.push(`## No texto de ${casa.name}`, "");
    if (!achados.length) p.push("_Nada que nomeie outra Casa._", "");
    for (const a of achados) p.push(`- [${a.citados.join(", ")}] ${a.frase}`);
    p.push("");
  }
  return p.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
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
  return itens;
}

async function main() {
  const itens = await lerParticao();
  const turnos = de(itens, "TURN#").filter((t) => /^TURN#\d+$/.test(t.SK)).sort((a, b) => a.turnId - b.turnId);
  const resolvidos = turnos.filter((t) => t.result);
  const ultimoId = resolvidos.at(-1)?.turnId;

  const arg = process.argv[2];
  const alvos = arg === "todos" ? resolvidos.map((t) => t.turnId)
    : arg ? [Number(arg)]
    : [ultimoId];
  if (!alvos.length || alvos.some((n) => !turnos.some((t) => t.turnId === n))) {
    console.error(`Turno inexistente. Resolvidos no banco: ${resolvidos.map((t) => t.turnId).join(", ")}`);
    process.exit(1);
  }

  const casas = de(itens, "HOUSE#").filter((h) => /^HOUSE#[^#]+$/.test(h.SK));
  const cartas = de(itens, "DIPLMSG#");
  const todosPactos = de(itens, "CFACT#");
  const todosFatos = de(itens, "WFACT#");
  await mkdir(RAIZ, { recursive: true });

  for (const alvo of alvos) {
    const turno = turnos.find((t) => t.turnId === alvo);
    const ultimo = alvo === ultimoId;
    // Um pacto ou fato de turno POSTERIOR não existia quando este turno fechou.
    // Mostrá-lo aqui é exatamente o anacronismo que este arquivo serve para evitar.
    const ate = (lista) => lista.filter((x) => Number(x.turnNumber ?? 0) <= Number(alvo));
    const porCasa = [];

    for (const casa of casas) {
      const id = casa.houseId;
      const sede = `casa-${slugDaCasa(casa.name)}`;
      const sub = itens.find((i) => i.SK === `TURN#${String(alvo).padStart(3, "0")}#SUB#${id}`);
      const resultado = turno.result?.houseResults?.[id] ?? "";
      const privado = turno.privateInfo?.[id] ?? "";
      const minhas = cartas.filter((c) => c.fromHouseId === id && Number(c.turnNumber) === Number(alvo))
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const ateAgora = cartas.filter((c) => c.fromHouseId === id && Number(c.turnNumber) <= Number(alvo));
      const semResposta = ateAgora.filter((c) => c.author === "AI")
        .filter((c) => !ateAgora.some((o) => o.toHouseKey === c.toHouseKey && o.author !== "AI"
          && String(o.createdAt) > String(c.createdAt)))
        .sort((a, b) => Number(b.turnNumber) - Number(a.turnNumber)).slice(0, 12);

      const texto = montarSnapshot({
        turno: alvo, ultimo, casa, ordens: separarOrdens(sub?.orderText), resultado, privado,
        publico: turno.publicEvent, resultadoPublico: turno.result?.publicResult,
        cartas: minhas, semResposta,
        pactos: ate(todosPactos).filter((c) => JSON.stringify(c).toLowerCase().includes(slugDaCasa(casa.name))),
        projetos: de(itens, `PROJECT#${id}#`).filter((pr) => Number(pr.createdAtTurn ?? 0) <= Number(alvo)),
        favores: de(itens, "FAVOR#").filter((f) => f.toHouseId === id && f.status === "PENDING"),
        fatos: ate(todosFatos).filter((f) => String(f.visibility ?? "").includes(sede)),
        trilha: de(itens, `HATTR#${id}#`).filter((t) => String(t.motivo ?? "").includes(`turno ${alvo}`)),
      });
      const arquivo = join(RAIZ, `${slugDaCasa(casa.name)}-turn${alvo}-context.md`);
      await writeFile(arquivo, texto, "utf8");
      porCasa.push({ casa, resultado, privado });
    }

    const mundo = join(RAIZ, `valdren-turn${alvo}-context.md`);
    await writeFile(mundo, montarMundo({
      turno: alvo, publico: turno.publicEvent, resultadoPublico: turno.result?.publicResult,
      fatos: ate(todosFatos).filter((f) => String(f.visibility ?? "") === "PUBLICO")
        .sort((a, b) => Number(b.turnNumber) - Number(a.turnNumber)),
      potencias: ultimo ? de(itens, "NPCDYN#") : [],
      relacoes: ultimo ? de(itens, "HRELATION#").filter((r) => r.fromKey !== r.toKey) : [],
      casas: ultimo ? casas : [],
      pactos: ate(todosPactos),
    }), "utf8");

    const conf = join(RAIZ, `_conferencia-turn${alvo}.md`);
    await writeFile(conf, montarConferencia(alvo, porCasa), "utf8");
    console.log(`  turno ${alvo}: ${casas.length} Casas + mundo + conferência`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
