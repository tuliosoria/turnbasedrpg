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

/**
 * Agrupa cartas de corpo idêntico numa só entrada.
 *
 * Carta aberta vai para as quinze potências e o banco guarda quinze registros.
 * Sem isto, o arquivo de Do Ouro no turno 10 repetia a mesma proclamação de
 * Sétimo quinze vezes e enterrava as cartas que realmente pediam alguma coisa.
 */
export function agruparPorCorpo(cartas) {
  const mapa = new Map();
  for (const c of cartas) {
    const chave = `${c.author}|${String(c.body ?? "").trim()}`;
    const g = mapa.get(chave);
    if (g) g.destinos.push(c.toHouseKey);
    else mapa.set(chave, { ...c, destinos: [c.toHouseKey] });
  }
  return [...mapa.values()];
}


// ---------------------------------------------------------------------------
// O briefing: a camada que se lê antes de escrever, e que cabe no orçamento.
//
// Os arquivos `-context.md` são arquivo morto: 331 KB para um turno, ~84 mil
// tokens, 80% deles carta na íntegra. Quem recebe "leia todos" ou queima o
// orçamento ou folheia — e folhear é como se perde o prazo que importava.
// Aqui fica só o que decide: estado, relógio, pedido esperando resposta, o que
// já foi dito, e ferida aberta. Nada é resumido por modelo; tudo é extraído.
// ---------------------------------------------------------------------------

const NUM_PALAVRAS = [
  "primeiro","segundo","terceiro","quarto","quinto","sexto","sétimo","setimo","oitavo","nono","décimo","decimo",
  "vigésimo","vigesimo","trigésimo","trigesimo",
  "um","uma","dois","duas","três","tres","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze",
  "quatorze","catorze","quinze","dezesseis","dezessete","dezoito","dezenove","vinte","trinta","quarenta","cinquenta",
  "sessenta","setenta","oitenta","noventa","cem","cento",
].join("|");
const NUM = `(?:\\d{1,3}|(?:${NUM_PALAVRAS})(?:\\s+(?:${NUM_PALAVRAS}))?)`;
const UNIDADE = "(?:dias?|luas?|semanas?|sinos?|noites?|vigílias?|vigilias?)";
const PREP = "(?:a partir d[oa]|em até|em ate|dentro de|a cada|até|ate|em|no|na|ao|à|por|d[oa])";
const PRAZO_COM_NUMERO = new RegExp(`\\b${PREP}\\s+${NUM}\\s+${UNIDADE}\\b`, "giu");
const PRAZO_MARCO = /\b(?:próximo|proximo|próxima|proxima|mesma|mesmo|nesta|neste)\s+(?:pouso de correio|vigília|vigilia|lua|frota|sino|maré|mare)\b|\ba cada lua\b/giu;

/**
 * Os prazos declarados num compromisso, como o texto os escreve.
 *
 * Devolve o TRECHO, não um número: o Mestre precisa poder conferir a leitura, e
 * data inventada a partir de prosa é pior do que nenhuma data. Quando não
 * reconhece nada devolve vazio — e o compromisso vai para a lista dos sem
 * prazo, que existe justamente para o relógio não dar falsa segurança.
 */
export function extrairPrazo(texto) {
  const t = String(texto ?? "");
  const achados = [...t.matchAll(PRAZO_COM_NUMERO), ...t.matchAll(PRAZO_MARCO)]
    .sort((a, b) => a.index - b.index)
    .map((m) => m[0].trim().replace(/\s+/g, " "));
  return [...new Set(achados)];
}

const MARCADOR_PEDIDO = /\b(pedimos|peço|peco|pedem|pede|pedi|mandai|mandem|enviai|enviem|precisamos|preciso|precisa|exigimos|exijo|exige|queremos|quero|trazei|tragam|traga|confirmem|confirme|respondam|responda|solicitamos|solicito|esperamos)\b/iu;
const SAUDACAO = /^(?:à|a|ao|aos|patriarca|faraó|farao|senhor|senhora|lady|lorde|grande|prezad)/iu;

/** Uma frase é saudação quando é curta e termina em vírgula, ou abre com título. */
const ehSaudacao = (f) => (f.endsWith(",") && f.split(/\s+/).length <= 6) || (SAUDACAO.test(f) && f.split(/\s+/).length <= 8);

/**
 * A frase em que a carta pede alguma coisa.
 *
 * A primeira linha de uma carta é quase sempre "Patriarca," — listar isso como
 * pedido produz uma lista de saudações. `achouMarcador: false` diz que a
 * extração é palpite de posição, não de verbo, para o briefing não afirmar mais
 * do que sabe.
 */
export function extrairPedido(texto) {
  const frases = String(texto ?? "")
    .split(/(?<=[.!?])\s+|\n+/).map((f) => f.trim()).filter((f) => f.length > 3);
  const corte = (f) => (f.length > 240 ? f.slice(0, 237) + "..." : f);
  const comVerbo = frases.find((f) => MARCADOR_PEDIDO.test(f) && !ehSaudacao(f));
  if (comVerbo) return { pedido: corte(comVerbo), achouMarcador: true };
  const substancial = frases.find((f) => f.length > 40 && !ehSaudacao(f)) ?? frases[0] ?? "";
  return { pedido: corte(substancial), achouMarcador: false };
}

// Nome próprio: maiúscula inicial, hífen interno permitido ("Boca-de-Forja"),
// e sequência ligada por espaço ("Tomas Três-Pontes") ou por conector minúsculo
// ("Casa do Ouro"). Sem a ligação por espaço, todo nome de duas palavras entrava
// partido no índice e nenhum deles casava com o que o texto realmente diz.
const TOKEN_NOME = String.raw`\p{Lu}[\p{Ll}]*(?:['’]\p{L}[\p{Ll}]*)*(?:-(?:\p{Lu}|\p{Ll})[\p{Ll}]*)*`;
// Liga por espaço ou tabulação, NUNCA por quebra de linha: com `\s` o índice
// colava o fim de um parágrafo no começo do outro ("Casa dos Anões" + "Você").
const NOME = new RegExp(`${TOKEN_NOME}(?:(?:[ \\t]+(?:de|do|da|dos|das|e)[ \\t]+|[ \\t]+)${TOKEN_NOME})*`, "gu");

/**
 * Palavra que abre frase com maiúscula sem ser nome de nada.
 *
 * Sem esta lista o índice vinha com "Você T1", "Recursos T6" e "Ao T3" no meio
 * dos nomes que importam, e uma tabela suja não se consulta. Só descarta nome de
 * UMA palavra: "Casa" sai, "Casa do Ouro" fica.
 */
const COMUNS = new Set(["você","voce","ele","ela","eles","elas","isso","aquilo","este","esta","esse","essa","aquele","aquela",
  "até","ate","ao","aos","à","às","as","os","um","uma","uns","umas","outro","outra","outros","outras","nada","tudo","todos","todas",
  "depois","quando","enquanto","então","entao","porque","porém","porem","mas","também","tambem","ainda","agora","antes","assim",
  "casa","casas","coroa","conselho","norte","sul","leste","oeste","rei","rainha","lorde","lady","patriarca","príncipe","principe",
  "senhor","senhora","informação","informacao","recursos","riqueza","controle","soldados","estabilidade","resultado","segredo",
  "sim","não","nao","sem","com","seu","sua","seus","suas","meu","minha","nosso","nossa","dois","duas","três","tres","quatro"]);

/**
 * Em que turno cada nome próprio apareceu pela primeira vez nos textos da Casa.
 *
 * É a tabela que pega recontagem: a moeda nova de cunho da Casa do Ouro foi
 * descoberta no turno 6 e voltou como revelação no 10. Só entra nome visto ao
 * menos uma vez no MEIO de uma frase — senão toda palavra que abre parágrafo
 * ("Depois", "Quando") viraria personagem. É índice para consultar, não regra.
 */
export function indicePrimeiraMencao(textos, limite = 120) {
  const ocorrencias = new Map();
  for (const { turno, texto } of [...textos].sort((a, b) => a.turno - b.turno)) {
    const t = String(texto ?? "");
    for (const m of t.matchAll(NOME)) {
      // O conector puxa a palavra anterior para dentro do nome: "Até Alic",
      // "Sua Casa". Descasca palavra comum à esquerda até sobrar nome de verdade.
      let nome = m[0].trim();
      // Só descasca quando o pedaço seguinte também é nome ("Até Alic" → "Alic").
      // Se o seguinte é conector minúsculo, a palavra faz parte do nome e fica:
      // "Casa do Ouro" não pode virar "do Ouro".
      for (;;) {
        const partes = nome.split(/[ \t]+/);
        if (partes.length < 2) break;
        if (!COMUNS.has(partes[0].toLowerCase())) break;
        if (!/^\p{Lu}/u.test(partes[1])) break;
        nome = partes.slice(1).join(" ");
      }
      const umaPalavra = !/[ \t]/.test(nome);
      if (nome.length < 4) continue;
      if (umaPalavra && COMUNS.has(nome.toLowerCase())) continue;
      const antes = t.slice(0, m.index).replace(/[\s*_>"“]+$/u, "");
      const meio = antes.length > 0 && !/[.!?:;]$/u.test(antes);
      const atual = ocorrencias.get(nome) ?? { nome, turno, meio: false };
      ocorrencias.set(nome, { nome, turno: Math.min(atual.turno, turno), meio: atual.meio || meio });
    }
  }
  return [...ocorrencias.values()].filter((x) => x.meio)
    .sort((a, b) => a.turno - b.turno || a.nome.localeCompare(b.nome))
    .slice(0, limite)
    .map(({ nome, turno }) => ({ nome, turno }));
}

/** Em que turno cada atributo mudou por último; `null` quando nunca mudou. */
export function semMudancaDesde(trilha) {
  const fora = {};
  for (const t of trilha ?? []) {
    const turno = Number(/turno (\d+)/.exec(String(t.motivo ?? ""))?.[1] ?? 0);
    const antes = t.antes ?? {}, depois = t.depois ?? {};
    for (const k of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
      if (!(k in fora)) fora[k] = null;
      if (antes[k] !== depois[k]) fora[k] = Math.max(fora[k] ?? 0, turno);
    }
  }
  return fora;
}

/**
 * Corta preservando o começo, que é onde o compromisso diz quem faz o quê.
 * A íntegra fica no arquivo; repeti-la aqui devolveria o problema que o briefing
 * existe para resolver — o de Solarion tinha 5 KB só de compromissos sem prazo.
 */
const corte = (texto, n = 200) => {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 3) + "..." : t;
};

export function montarBriefing({ turno, ultimo, casa, ordens, resultado, privado, pactos, semResposta, entreJogadores, projetos, favores, fatos, trilha, textosAnteriores }) {
  const slug = slugDaCasa(casa.name);
  const p = [`# ${casa.name} — turno ${turno}: o que importa`, ""];
  p.push(`> Gerado. Leia ISTO antes de escrever; o arquivo grande é consulta, não leitura.`);
  if (!ultimo) p.push(`> Turno encerrado: números de projeto, favor e atributo são os de hoje.`);
  p.push("");

  const a = casa.attributes ?? {};
  const mudou = semMudancaDesde(trilha);
  const idade = (k) => (mudou[k] ? (Number(mudou[k]) === Number(turno) ? " (mudou agora)" : ` (desde o turno ${mudou[k]})`) : "");
  p.push("## Onde está", "");
  p.push(`riqueza ${a.riqueza ?? "?"}${idade("riqueza")} · recursos ${a.recursos ?? "?"}${idade("recursos")} · soldados ${a.soldados ?? "?"}${idade("soldados")} · controle ${a.controle ?? "?"}${idade("controle")} · estabilidade ${casa.stability ?? "?"}`);
  p.push(`ativos: ${(casa.assets ?? []).join(", ") || "nenhum"}`, "");

  const recentes = (pactos ?? []).filter((c) => c.status === "ATIVO" && Number(c.turnNumber ?? 0) >= Number(turno) - 1);
  const antigos = (pactos ?? []).filter((c) => c.status === "ATIVO" && Number(c.turnNumber ?? 0) < Number(turno) - 1);
  const comPrazo = [], semPrazo = [];
  for (const c of recentes) {
    const prazos = extrairPrazo(c.summary ?? c.quote ?? "");
    (prazos.length ? comPrazo : semPrazo).push({ c, prazos });
  }
  p.push("## O relógio", "");
  if (!comPrazo.length) p.push("_Nenhum prazo reconhecido._", "");
  for (const { c, prazos } of comPrazo) p.push(`- **${prazos.join(" · ")}** — T${c.turnNumber}: ${corte(c.summary)}`);
  if (comPrazo.length) p.push("");
  if (semPrazo.length) {
    p.push("### De pé, sem prazo reconhecido — confira no texto", "");
    for (const { c } of semPrazo) p.push(`- T${c.turnNumber}: ${corte(c.summary, 160)}`);
    p.push("");
  }
  if (antigos.length) p.push(`_${antigos.length} pacto${antigos.length > 1 ? "s" : ""} ATIVO de antes do turno ${Number(turno) - 1} ${antigos.length > 1 ? "ficaram" : "ficou"} no arquivo._`, "");

  if ((entreJogadores ?? []).length) {
    p.push("## Combinado com outra Casa de JOGADOR — é fato, mesmo sem texto de turno", "");
    for (const c of entreJogadores) {
      const { pedido } = extrairPedido(c.body);
      p.push(`- **${c.toHouseKey}** (T${c.turnNumber}): ${pedido}`);
    }
    p.push("");
  }

  p.push("## Pedido esperando resposta desta Casa", "");
  if (!(semResposta ?? []).length) p.push("_Nenhum._", "");
  for (const c of semResposta ?? []) {
    const { pedido, achouMarcador } = extrairPedido(c.body);
    // pedido já vem cortado em 240 por extrairPedido
    p.push(`- **${c.toHouseKey}** (T${c.turnNumber}): ${pedido}${achouMarcador ? "" : "  _(sem verbo de pedido; leia a carta)_"}`);
  }
  p.push("");

  p.push(`## As ordens do turno ${turno}, e se o texto respondeu`, "");
  if (!(ordens ?? []).length) p.push("_Nenhuma ordem registrada._", "");
  for (const o of ordens ?? []) {
    const { achadas } = conferirOrdem(o.texto, `${resultado}\n${privado}`);
    const linha = String(o.texto).split("\n")[0].slice(0, 110);
    p.push(`- ${achadas.length ? "eco" : "**SEM ECO**"} · ${o.numero ?? "—"}. ${linha}`);
  }
  p.push("");

  p.push("## Feridas abertas", "");
  const vivos = (projetos ?? []).filter((x) => x.status !== "COMPLETED");
  if (!vivos.length) p.push("_Nenhuma._", "");
  for (const pr of vivos) {
    p.push(`- **${pr.title ?? "—"}** — ${pr.status}${pr.durationTurns ? ` ${pr.turnsCompleted ?? 0}/${pr.durationTurns}` : ""}`);
    if (pr.status === "FAILED" && pr.lastProcessedTurnId != null && Number(pr.lastProcessedTurnId) !== Number(turno)) {
      p.push(`  - ⚠ falhou no turno ${pr.lastProcessedTurnId}, não neste. O jogador já soube?`);
    }
  }
  p.push("");
  if ((favores ?? []).length) {
    p.push("## Favores pendentes na tela do jogador", "");
    for (const f of favores) p.push(`- ${f.fromHouseId}: ${f.reason ?? ""} _(desde ${String(f.createdAt ?? "").slice(0, 10)})_`);
    p.push("");
  }
  if ((fatos ?? []).length) {
    p.push("## Segredos que esta Casa já tem", "");
    for (const f of fatos) p.push(`- T${f.turnNumber}: ${corte(textoDoFato(f), 150)}`);
    p.push("");
  }

  const indice = indicePrimeiraMencao([...(textosAnteriores ?? []), { turno, texto: `${resultado}\n${privado}` }]);
  p.push("## Já dito — primeira menção", "");
  p.push(indice.length ? indice.map((x) => `${x.nome} T${x.turno}`).join(" · ") : "_Nada._", "");

  p.push("---", "", `Cartas na íntegra, ordens completas e todo o resto: \`${slug}-turn${turno}-context.md\`. Mundo: \`valdren-turn${turno}-briefing.md\`.`, "");
  return p.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function montarBriefingMundo({ turno, fatos, potencias, casas, pactos }) {
  const p = [`# Valdren — turno ${turno}: o que importa`, "", "> Gerado. Só material público.", ""];
  const doTurno = fatos.filter((f) => Number(f.turnNumber) === Number(turno));
  const antes = fatos.filter((f) => Number(f.turnNumber) < Number(turno) && Number(f.turnNumber) >= Number(turno) - 2 && f.status === "ATIVO");
  p.push("## O que mudou neste turno", "");
  if (!doTurno.length) p.push("_Nada registrado._", "");
  for (const f of doTurno) p.push(`- ${textoDoFato(f)}`);
  p.push("");
  p.push("## Ainda de pé, dos dois turnos anteriores", "");
  if (!antes.length) p.push("_Nada._", "");
  for (const f of antes) p.push(`- T${f.turnNumber}: ${corte(textoDoFato(f), 170)}`);
  p.push("");
  if (casas.length) {
    p.push("## Casas de jogador", "");
    for (const c of casas) {
      const a = c.attributes ?? {};
      p.push(`- **${c.name}** — riqueza ${a.riqueza ?? "?"}, recursos ${a.recursos ?? "?"}, soldados ${a.soldados ?? "?"}, controle ${a.controle ?? "?"}, estabilidade ${c.stability ?? "?"}`);
    }
    p.push("");
  }
  if (potencias.length) {
    p.push("## O que cada potência quer", "");
    for (const n of potencias) p.push(`- **${n.id}**: ${corte(n.objective, 110)} _[${corte(n.mood, 60)}]_`);
    p.push("");
  }
  // Prazo de acordo entre NPCs não entra aqui: eram 8,9 KB, e o que importa para
  // escrever o turno está no relógio do briefing de cada Casa de jogador.
  const comPrazo = pactos.filter((c) => c.status === "ATIVO" && Number(c.turnNumber ?? 0) === Number(turno) && extrairPrazo(c.summary ?? "").length);
  if (comPrazo.length) p.push(`_${comPrazo.length} acordos com prazo fechados neste turno entre potências; os que envolvem Casa de jogador estão no briefing dela._`, "");
  p.push("---", "", `Relações entre potências, fatos antigos e o resto: \`valdren-turn${turno}-context.md\`.`, "");
  return p.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * As cartas trocadas com OUTRA Casa de jogador.
 *
 * São uma classe à parte, e a mais perigosa de ignorar: do outro lado há uma
 * pessoa, o fio é um registro só lido pelos dois, e o que os dois combinaram por
 * escrito é FATO — mesmo que nenhum texto de turno tenha confirmado.
 *
 * Foi esta leitura que me faltou: nas cartas do turno 9, Khazdrun pagou as
 * estufas, mandou navios buscá-las, agradeceu a entrega, e Solarion despachou os
 * operadores que iriam montá-las. Eu li o texto de turno de Solarion, que falava
 * de OUTRA remessa ainda na estrada, e "consertei" o turno 10 de Khazdrun para
 * dizer que as estufas não tinham chegado. O jogador reclamou, e tinha razão.
 */
export function acordoEntreJogadores(cartas, sedesDeJogador) {
  return (cartas ?? []).filter((c) => c.author !== "AI" && sedesDeJogador.has(String(c.toHouseKey)))
    .sort((a, b) => Number(a.turnNumber) - Number(b.turnNumber) || String(a.createdAt).localeCompare(String(b.createdAt)));
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

  const agrupadas = agruparPorCorpo(cartas);
  const repetidas = cartas.length - agrupadas.length;
  p.push("## Cartas deste turno, na íntegra", "");
  if (repetidas > 0) p.push(`_${cartas.length} registros, ${agrupadas.length} textos distintos: ${repetidas} são a mesma carta enviada a mais de uma potência, agrupadas abaixo._`, "");
  if (!agrupadas.length) p.push("_Nenhuma._", "");
  for (const c of agrupadas) {
    const lado = c.author === "AI" ? `${c.destinos.join(", ")} → ${casa.name}` : `${casa.name} → ${c.destinos.join(", ")}`;
    const marca = c.author === "AI" ? "" : "  (escrita pelo JOGADOR)";
    const quantas = c.destinos.length > 1 ? `  · mesma carta a ${c.destinos.length} destinatários` : "";
    p.push(`### ${lado}${marca}${quantas} · ${String(c.createdAt ?? "").slice(0, 16)}`, "", String(c.body ?? "").trim(), "");
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

      // Os textos que esta Casa já leu, para o índice de primeira menção saber
      // o que seria recontar.
      const textosAnteriores = turnos.filter((t) => t.turnId < alvo).map((t) => ({
        turno: t.turnId,
        texto: `${t.result?.houseResults?.[id] ?? ""}\n${t.privateInfo?.[id] ?? ""}`,
      }));
      await writeFile(join(RAIZ, `${slugDaCasa(casa.name)}-turn${alvo}-briefing.md`), montarBriefing({
        turno: alvo, ultimo, casa, ordens: separarOrdens(sub?.orderText), resultado, privado,
        pactos: ate(todosPactos).filter((c) => JSON.stringify(c).toLowerCase().includes(slugDaCasa(casa.name))),
        semResposta,
        projetos: de(itens, `PROJECT#${id}#`).filter((pr) => Number(pr.createdAtTurn ?? 0) <= Number(alvo)),
        favores: de(itens, "FAVOR#").filter((f) => f.toHouseId === id && f.status === "PENDING"),
        fatos: ate(todosFatos).filter((f) => String(f.visibility ?? "").includes(sede)),
        trilha: de(itens, `HATTR#${id}#`),
        entreJogadores: acordoEntreJogadores(
          cartas.filter((c) => c.fromHouseId === id && Number(c.turnNumber) >= Number(alvo) - 1),
          new Set(casas.map((c) => `casa-${slugDaCasa(c.name)}`))),
        textosAnteriores,
      }), "utf8");
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

    await writeFile(join(RAIZ, `valdren-turn${alvo}-briefing.md`), montarBriefingMundo({
      turno: alvo,
      fatos: ate(todosFatos).filter((f) => String(f.visibility ?? "") === "PUBLICO")
        .sort((a, b) => Number(b.turnNumber) - Number(a.turnNumber)),
      potencias: ultimo ? de(itens, "NPCDYN#") : [],
      casas: ultimo ? casas : [],
      pactos: ate(todosPactos),
    }), "utf8");

    const conf = join(RAIZ, `_conferencia-turn${alvo}.md`);
    await writeFile(conf, montarConferencia(alvo, porCasa), "utf8");
    console.log(`  turno ${alvo}: ${casas.length} Casas + mundo + conferência (briefing + arquivo)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
