import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { conferirOrdem, indicePrimeiraMencao, extrairPrazo, separarOrdens, slugDaCasa } from "./gerar-snapshot-turno.mjs";

/**
 * Valida um turno resolvido antes de ele ser aplicado.
 *
 * O briefing MOSTRA sinais; ninguém é obrigado a olhar. Isto transforma sinal em
 * achado com severidade, e sai com código diferente de zero quando há ERRO.
 *
 * npm come `--ignorar`, `--erro` e `--aviso` quando não há um `--` separador:
 * o script recebe o valor e perde a flag, a isenção não aplica e a saída
 * continua 1. O separador entrega os argumentos intactos.
 *
 *   npm run validar                         # último turno resolvido
 *   npm run validar -- 10
 *   npm run validar -- 10 --ignorar ordem-sem-eco,nome-sem-registro
 *   npm run validar -- 10 --erro ordem-sem-eco
 *   npm run validar -- 10 --aviso ordem-sem-eco
 *
 * A REGRA DE SEVERIDADE: ela vem da confiabilidade da checagem, não da
 * importância do defeito. Só é ERRO o que é verdadeiro por construção. Checagem
 * heurística é AVISO — `ordem-sem-eco` já deu falso negativo comprovado (a ordem
 * "alinhamentos diplomáticos" está atendida e sai sem eco, porque as palavras
 * dela são genéricas), e portão que trava por engano é portão que se contorna.
 *
 * O bloqueio alcança scripts e quem lê o relatório. O admin aplica o turno pela
 * tela e nenhum script impede isso — amarrar a validação na rota é outro assunto.
 */

const TABLE = process.env.TABLE_NAME ?? "ravenloft-game";
const PK = "CAMPAIGN#WINTER_DEAD";
const RAIZ = "campaign-context/snapshots";

const achado = (id, mensagem, detalhe) => ({ id, mensagem, detalhe });
const texto = (t) => String(t ?? "");
const normal = (t) => texto(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
export const slug = (t) => normal(t).replace(/\s+/g, "-");

// ---------------------------------------------------------------------------
// As checagens. Cada uma é pura: recebe o contexto de UMA Casa, devolve achados.
// ---------------------------------------------------------------------------

/** Turno 9: Khazdrun ficou sem privado e o resultado ainda dizia "ver informação privada". */
export function privadoVazio(ctx) {
  return texto(ctx.privado).trim() ? [] : [achado("privado-vazio", `${ctx.casa.name} não recebeu informação privada neste turno.`)];
}

const ESPERA = /\b(espera(m|is)?\s+(a\s+)?vossa|aguarda(m|is)?\s+(a\s+)?vossa|aguardo\s+vossa|o\s+que\s+fareis|qual\s+ser[áa]\s+a\s+(vossa\s+)?resposta|fica\s+com\s+o\s+patriarca|decidireis)\b/iu;

/**
 * Na tela o resultado aparece ACIMA do privado, então privado que pede decisão
 * envelhece no instante em que o turno fecha e fica no histórico para sempre.
 */
export function privadoPedeDecisao(ctx) {
  const ps = texto(ctx.privado).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const ultimo = ps.at(-1) ?? "";
  if (!ultimo) return [];
  if (ultimo.endsWith("?") || ESPERA.test(ultimo)) {
    return [achado("privado-pede-decisao", `O privado de ${ctx.casa.name} termina pedindo decisão.`, ultimo.slice(0, 160))];
  }
  return [];
}

const VALOR = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };
const paraNumero = (p) => (/^\d+$/.test(p) ? Number(p) : VALOR[normal(p)] ?? null);
const ATRIBUTOS = ["riqueza", "recursos", "soldados", "controle"];

/** O texto afirma mudança de atributo e a trilha do turno diz outra coisa. */
export function numeroContradito(ctx) {
  const t = texto(ctx.resultado) + "\n" + texto(ctx.privado);
  const daTrilha = (ctx.trilha ?? []).find((x) => String(x.motivo ?? "").includes(`turno ${ctx.turno}`));
  if (!daTrilha) return [];
  const out = [];
  for (const attr of ATRIBUTOS) {
    const re = new RegExp(`${attr}[^.!?]{0,80}?\\bde\\s+([\\wáéíóúãõç]+)\\s+para\\s+([\\wáéíóúãõç]+)`, "giu");
    for (const m of t.matchAll(re)) {
      const de = paraNumero(m[1]), para = paraNumero(m[2]);
      if (de === null || para === null) continue;
      const antes = Number(daTrilha.antes?.[attr]), depois = Number(daTrilha.depois?.[attr]);
      if (!Number.isFinite(antes) || !Number.isFinite(depois)) continue;   // sem trilha do atributo: é aviso, não erro
      if (antes !== de || depois !== para) {
        out.push(achado("numero-contradito",
          `${ctx.casa.name}: o texto diz ${attr} de ${de} para ${para}; a trilha do turno diz ${antes} para ${depois}.`,
          m[0].slice(0, 120)));
      }
    }
  }
  return out;
}

const JANELA = 10;
const shingles = (t, n = JANELA) => {
  const ps = normal(t).split(" ").filter(Boolean);
  const out = new Map();
  for (let i = 0; i + n <= ps.length; i++) out.set(ps.slice(i, i + n).join(" "), i);
  return out;
};

/**
 * Trecho literal de 10+ palavras que a mesma Casa já leu num turno anterior.
 *
 * Janelas de 10 palavras se sobrepõem: uma repetição de vinte palavras acende
 * onze janelas. Elas são fundidas na corrida mais longa, senão um defeito vira
 * onze achados e o relatório fica ilegível.
 *
 * É AVISO e não ERRO de propósito. Na primeira execução real pegou uma
 * recontagem minha de verdade — o bloqueio da Estrada Branca, que o turno 9 de
 * Do Ouro já contava — e pegou junto uma retomada deliberada em Khazdrun ("o
 * caderno velho da biblioteca, aquele em que..."), que é ofício e não descuido.
 * Não distingue as duas, então não pode ser portão.
 */
export function repeticaoLiteral(ctx) {
  const anteriores = new Map();
  for (const { turno, texto: t } of ctx.textosAnteriores ?? []) {
    for (const s of shingles(t).keys()) if (!anteriores.has(s)) anteriores.set(s, turno);
  }
  const palavras = normal(`${texto(ctx.resultado)} ${texto(ctx.privado)}`).split(" ").filter(Boolean);
  const corridas = [];
  let i = 0;
  while (i + JANELA <= palavras.length) {
    const janela = palavras.slice(i, i + JANELA).join(" ");
    if (!anteriores.has(janela)) { i += 1; continue; }
    // estende a corrida enquanto a janela seguinte também for velha
    let fim = i + JANELA;
    while (fim < palavras.length && anteriores.has(palavras.slice(fim - JANELA + 1, fim + 1).join(" "))) fim += 1;
    corridas.push({ trecho: palavras.slice(i, fim).join(" "), turno: anteriores.get(janela), n: fim - i });
    i = fim;
  }
  return corridas.slice(0, 4).map((c) => achado("repeticao-literal",
    `${ctx.casa.name} repetiu ${c.n} palavras do turno ${c.turno}.`, `turno ${c.turno}: "${c.trecho}"`));
}

const GENERICOS = new Set(["fortificacao", "montanha", "defesa", "desenvolvimento", "aprimoramento", "construcao",
  "projeto", "naval", "local", "regional", "popular", "estabelecer", "estabelecimento", "criar", "treinar", "formar",
  "melhoria", "cultivo", "subterraneo", "novos", "nova", "nossa", "nosso"]);

/** Projeto que falhou em turno ANTERIOR e cujo nome não aparece em texto nenhum desde então. */
export function projetoFalhadoNaoContado(ctx) {
  const out = [];
  for (const pr of ctx.projetos ?? []) {
    if (pr.status !== "FAILED") continue;
    const quando = Number(pr.lastProcessedTurnId ?? pr.createdAtTurn ?? 0);
    if (!quando || quando >= Number(ctx.turno)) continue;
    const distintivas = normal(pr.title).split(" ").filter((p) => p.length >= 5 && !GENERICOS.has(p));
    if (!distintivas.length) continue;
    const desde = [...(ctx.textosAnteriores ?? []).filter((x) => x.turno >= quando).map((x) => x.texto),
      ctx.resultado, ctx.privado].map(normal).join(" ");
    if (!distintivas.some((p) => desde.includes(p))) {
      out.push(achado("projeto-falhado-nao-contado",
        `"${pr.title}" falhou no turno ${quando} e ${ctx.casa.name} nunca foi informada.`,
        `nenhuma destas palavras aparece nos textos desde o turno ${quando}: ${distintivas.join(", ")}`));
    }
  }
  return out;
}

/** Heurística de palavra-chave: AVISO, nunca ERRO por padrão. */
export function ordemSemEco(ctx) {
  const resposta = `${texto(ctx.resultado)}\n${texto(ctx.privado)}`;
  return (ctx.ordens ?? []).filter((o) => conferirOrdem(o.texto, resposta).achadas.length === 0)
    .map((o) => achado("ordem-sem-eco",
      `${ctx.casa.name}: ordem ${o.numero ?? "—"} sem eco no texto.`,
      texto(o.texto).split("\n")[0].slice(0, 110)));
}

const TITULOS = /^(capit[ãa]o|capit[ãa]|lorde|lady|senhor(a)?|dama|almirante|pr[íi]ncipe|princesa|patriarca|rainha|rei|ser|mestre|mestra|sacerdotisa|general|sargento|far[áa]o)\s+/iu;
const TRATAMENTOS = new Set(["alteza", "majestade", "vossa", "excelencia", "senhoria", "ordens", "draconatos", "anoes", "elfos", "orcs"]);

/**
 * Nome próprio que o turno inventou e que não existe em registro nenhum.
 *
 * Três limpezas, todas por defeito visto na primeira execução real: "Belegue e
 * Ritolun" vinha colado pelo conector e nenhum dos dois era conferido; "Capitão
 * Arven Solkar" não casava com o registro por causa do título; e "Alteza" entrava
 * como personagem novo.
 */
export function nomeSemRegistro(ctx) {
  const indice = indicePrimeiraMencao([...(ctx.textosAnteriores ?? []),
    { turno: ctx.turno, texto: `${texto(ctx.resultado)}\n${texto(ctx.privado)}` }]);
  const limpar = (nome) => nome.split(/\s+e\s+/).map((n) => n.replace(TITULOS, "").trim()).filter(Boolean);
  const novos = indice.filter((x) => Number(x.turno) === Number(ctx.turno))
    .flatMap((x) => limpar(x.nome).map((nome) => ({ ...x, nome })))
    .filter((x) => x.nome.length >= 4 && !TRATAMENTOS.has(normal(x.nome)))
    .filter((x) => !ctx.registrados.has(slug(x.nome)))
    .filter((x, i, arr) => arr.findIndex((y) => y.nome === x.nome) === i);
  if (!novos.length) return [];
  return [achado("nome-sem-registro",
    `${ctx.casa.name}: ${novos.length} nome(s) novo(s) sem registro em wiki, entidade visual ou NPC.`,
    novos.map((x) => x.nome).join(", "))];
}

/** Compromisso fechado neste turno cujo prazo o extrator não reconheceu. */
export function compromissoSemPrazo(ctx) {
  const semPrazo = (ctx.pactos ?? []).filter((c) => c.status === "ATIVO"
    && Number(c.turnNumber ?? 0) === Number(ctx.turno)
    && extrairPrazo(c.summary ?? c.quote ?? "").length === 0);
  if (!semPrazo.length) return [];
  // Um achado por Casa, não vinte: vinte linhas iguais afogam os quatro erros.
  return [achado("compromisso-sem-prazo",
    `${ctx.casa.name}: ${semPrazo.length} compromisso(s) do turno sem prazo reconhecido — leia no briefing.`,
    semPrazo.map((c) => texto(c.summary).slice(0, 70)).join(" | "))];
}

/** A conferência cruzada não é defeito: é leitura obrigatória que ninguém faz. */
export function conferenciaPendente(ctx) {
  return ctx.cruzamentos > 0
    ? [achado("conferencia-pendente", `${ctx.cruzamentos} trecho(s) em que ${ctx.casa.name} fala de outra Casa — compare com o texto dela.`)]
    : [];
}

export const CHECKS = [
  { id: "privado-vazio", severidade: "ERRO", fn: privadoVazio },
  { id: "privado-pede-decisao", severidade: "ERRO", fn: privadoPedeDecisao },
  { id: "numero-contradito", severidade: "ERRO", fn: numeroContradito },
  { id: "repeticao-literal", severidade: "AVISO", fn: repeticaoLiteral },
  { id: "projeto-falhado-nao-contado", severidade: "ERRO", fn: projetoFalhadoNaoContado },
  { id: "ordem-sem-eco", severidade: "AVISO", fn: ordemSemEco },
  { id: "nome-sem-registro", severidade: "AVISO", fn: nomeSemRegistro },
  { id: "compromisso-sem-prazo", severidade: "NOTA", fn: compromissoSemPrazo },
  { id: "conferencia-pendente", severidade: "NOTA", fn: conferenciaPendente },
];

export const severidades = (override = {}) =>
  Object.fromEntries(CHECKS.map((c) => [c.id, override[c.id] ?? c.severidade]));

/** Separa por severidade e decide o portão. Ignorado continua no relatório, marcado. */
export function resumir(achados, ignorados = new Set()) {
  const marcados = achados.map((a) => ({ ...a, ignorado: ignorados.has(a.id) }));
  const por = (s) => marcados.filter((a) => a.severidade === s && !a.ignorado);
  return {
    erros: por("ERRO"), avisos: por("AVISO"), notas: por("NOTA"),
    ignorados: marcados.filter((a) => a.ignorado),
    bloqueia: por("ERRO").length > 0,
  };
}

// ---------------------------------------------------------------------------
// Casca
// ---------------------------------------------------------------------------

const de = (itens, prefixo) => itens.filter((i) => String(i.SK ?? "").startsWith(prefixo));

async function lerParticao() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, QueryCommand } = await import("@aws-sdk/lib-dynamodb");
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }));
  const itens = []; let ExclusiveStartKey;
  do {
    const r = await doc.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK }, ExclusiveStartKey }));
    itens.push(...(r.Items ?? [])); ExclusiveStartKey = r.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return itens;
}

function lerFlags(argv) {
  const ignorar = new Set(), override = {};
  for (let i = 0; i < argv.length; i++) {
    const proximo = () => String(argv[i + 1] ?? "").split(",").filter(Boolean);
    if (argv[i] === "--ignorar") proximo().forEach((id) => ignorar.add(id));
    if (argv[i] === "--erro") proximo().forEach((id) => { override[id] = "ERRO"; });
    if (argv[i] === "--aviso") proximo().forEach((id) => { override[id] = "AVISO"; });
  }
  const turno = argv.find((a) => /^\d+$/.test(a));
  return { ignorar, override, turno: turno ? Number(turno) : null };
}

function relatorio(turno, porCasa, r) {
  const l = [`# Validação do turno ${turno}`, "", `> Gerado por \`npm run validar -- ${turno}\`. ${r.bloqueia ? "**BLOQUEADO**" : "Sem erro."}`, ""];
  const bloco = (titulo, itens) => {
    if (!itens.length) return;
    l.push(`## ${titulo}`, "");
    for (const a of itens) {
      l.push(`- **${a.id}** — ${a.mensagem}`);
      if (a.detalhe) l.push(`  - ${a.detalhe}`);
    }
    l.push("");
  };
  bloco("ERRO", r.erros); bloco("AVISO", r.avisos); bloco("NOTA", r.notas);
  bloco("Ignorado por decisão do Mestre", r.ignorados);
  l.push(`Casas verificadas: ${porCasa.join(", ")}.`, "");
  return l.join("\n");
}

async function main() {
  const { ignorar, override, turno: pedido } = lerFlags(process.argv.slice(2));
  const itens = await lerParticao();
  const turnos = de(itens, "TURN#").filter((t) => /^TURN#\d+$/.test(t.SK)).sort((a, b) => a.turnId - b.turnId);
  const alvo = pedido ?? [...turnos].reverse().find((t) => t.result)?.turnId;
  const turno = turnos.find((t) => t.turnId === alvo);
  if (!turno?.result) { console.error(`Turno ${alvo} não existe ou não foi resolvido.`); process.exit(2); }

  const sev = severidades(override);
  const casas = de(itens, "HOUSE#").filter((h) => /^HOUSE#[^#]+$/.test(h.SK));
  const registrados = new Set();
  // Um nome conta como registrado tanto inteiro quanto pelas palavras que o
  // compõem: o verbete é "Stonebridge, a Ponte das Cinco Águas" e o texto diz
  // "Stonebridge". Sem isso metade das potências do mapa entra como nome novo.
  const registrar = (nome) => {
    const s = slug(nome);
    if (!s) return;
    registrados.add(s);
    for (const parte of s.split("-")) if (parte.length >= 4) registrados.add(parte);
  };
  for (const i of itens) {
    const sk = String(i.SK);
    if (sk.startsWith("WIKI#")) registrar(i.title ?? "");
    if (sk.startsWith("VENTITY#")) [i.name, i.title, i.entityName].forEach((n) => n && registrar(n));
    if (sk.startsWith("NPCDYN#")) { registrar(sk.split("#").pop().replace(/-/g, " ")); registrar(String(i.affiliation ?? "").replace(/^casa-/, "")); }
    if (sk.startsWith("HRELATION#")) [i.fromKey, i.toKey].forEach((k) => k && registrar(String(k).replace(/^(casa|cla|ordem|irmandade|grande-casa)-/, "")));
    if (sk.startsWith("CFACT#")) [i.betweenA, i.betweenB].forEach((k) => k && registrar(String(k).replace(/^(casa|cla|ordem|irmandade|grande-casa)-/, "")));
  }
  for (const c of casas) { registrar(c.name); registrar(c.castleName ?? ""); }

  const todos = [];
  for (const casa of casas) {
    const id = casa.houseId;
    const sub = itens.find((i) => i.SK === `TURN#${String(alvo).padStart(3, "0")}#SUB#${id}`);
    const ctx = {
      turno: alvo, casa,
      resultado: turno.result?.houseResults?.[id] ?? "",
      privado: turno.privateInfo?.[id] ?? "",
      ordens: separarOrdens(sub?.orderText),
      textosAnteriores: turnos.filter((t) => t.turnId < alvo).map((t) => ({
        turno: t.turnId, texto: `${t.result?.houseResults?.[id] ?? ""}\n${t.privateInfo?.[id] ?? ""}` })),
      projetos: de(itens, `PROJECT#${id}#`),
      trilha: de(itens, `HATTR#${id}#`),
      pactos: de(itens, "CFACT#").filter((c) => JSON.stringify(c).toLowerCase().includes(slugDaCasa(casa.name))),
      registrados,
      cruzamentos: 0,
    };
    for (const c of CHECKS) for (const a of c.fn(ctx)) todos.push({ ...a, severidade: sev[c.id] });
  }

  const r = resumir(todos, ignorar);
  const nomes = casas.map((c) => c.name);
  const cor = { ERRO: "\x1b[31m", AVISO: "\x1b[33m", NOTA: "\x1b[36m" };
  for (const [rotulo, lista] of [["ERRO", r.erros], ["AVISO", r.avisos], ["NOTA", r.notas]]) {
    for (const a of lista) {
      console.log(`${cor[rotulo]}${rotulo}\x1b[0m ${a.id} — ${a.mensagem}`);
      if (a.detalhe) console.log(`      ${a.detalhe}`);
    }
  }
  for (const a of r.ignorados) console.log(`\x1b[90mIGNORADO por decisão do Mestre: ${a.id} — ${a.mensagem}\x1b[0m`);

  await mkdir(RAIZ, { recursive: true });
  const arquivo = join(RAIZ, `_validacao-turn${alvo}.md`);
  await writeFile(arquivo, relatorio(alvo, nomes, r), "utf8");
  console.log(`\n${r.erros.length} ERRO, ${r.avisos.length} AVISO, ${r.notas.length} NOTA${r.ignorados.length ? `, ${r.ignorados.length} ignorado` : ""} — ${arquivo}`);
  if (r.bloqueia) { console.log("\x1b[31mTurno NÃO deve ser aplicado enquanto houver ERRO.\x1b[0m"); process.exit(1); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
