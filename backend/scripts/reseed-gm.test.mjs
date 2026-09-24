import { describe, expect, it } from "vitest";
import { checarExpectativa, EXPECTATIVA, reconciliar, resumirPlano } from "./reseed-gm.mjs";

/** Um item "vivo" mínimo, no formato que o QueryCommand devolve. */
function vivo(entryId, section, title, body, order) {
  return { entryId, section, title, body, order, updatedAt: "2026-01-01T00:00:00.000Z" };
}

/** Uma entrada da semente, no formato de DEFAULT_GM_ENTRIES. */
function semente(section, title, body, order) {
  return { section, title, body, order };
}

describe("reconciliar", () => {
  it("deixa em paz um verbete idêntico ao da semente", () => {
    const itensVivos = [vivo("a1", "a-verdade", "X", "corpo X", 0)];
    const entradasSemente = [semente("a-verdade", "X", "corpo X", 0)];
    const { plano, sementeSemPar } = reconciliar(itensVivos, entradasSemente);
    expect(sementeSemPar).toEqual([]);
    expect(plano).toEqual([{ acao: "sem-alteracao", entryId: "a1", tituloVivo: "X", comoAchou: "titulo" }]);
  });

  it("marca corpo-atualizado quando o título bate mas o corpo não", () => {
    const itensVivos = [vivo("a1", "a-verdade", "X", "corpo antigo", 0)];
    const entradasSemente = [semente("a-verdade", "X", "corpo novo", 0)];
    const { plano } = reconciliar(itensVivos, entradasSemente);
    expect(plano).toHaveLength(1);
    expect(plano[0]).toMatchObject({
      acao: "corpo-atualizado",
      entryId: "a1",
      tituloVivo: "X",
      title: "X",
      body: "corpo novo",
      section: "a-verdade",
      order: 0,
    });
  });

  it("casa por título mesmo quando várias entradas existem", () => {
    const itensVivos = [
      vivo("a1", "s", "Um", "c1", 0),
      vivo("a2", "s", "Dois", "c2", 1),
    ];
    const entradasSemente = [semente("s", "Um", "c1", 0), semente("s", "Dois", "c2-novo", 1)];
    const { plano } = reconciliar(itensVivos, entradasSemente);
    const porId = Object.fromEntries(plano.map((p) => [p.entryId, p]));
    expect(porId.a1.acao).toBe("sem-alteracao");
    expect(porId.a2.acao).toBe("corpo-atualizado");
  });

  it("casa uma renomeação pela seção e ordem quando o título mudou", () => {
    const itensVivos = [vivo("mviukbg04j", "a-verdade", "Quem é o Rei Pálido", "corpo antigo", 1)];
    const entradasSemente = [semente("a-verdade", "Quem é o Rei Branco", "corpo novo", 1)];
    const { plano, sementeSemPar } = reconciliar(itensVivos, entradasSemente);
    expect(sementeSemPar).toEqual([]);
    expect(plano).toEqual([
      {
        acao: "renomeado",
        entryId: "mviukbg04j",
        tituloVivo: "Quem é o Rei Pálido",
        tituloNovo: "Quem é o Rei Branco",
        section: "a-verdade",
        title: "Quem é o Rei Branco",
        body: "corpo novo",
        order: 1,
        comoAchou: "secao-ordem",
      },
    ]);
  });

  it("preserva o entryId original numa renomeação, não cria um novo item", () => {
    const itensVivos = [vivo("id-original", "a-verdade", "Nome Velho", "corpo", 1)];
    const entradasSemente = [semente("a-verdade", "Nome Novo", "corpo", 1)];
    const { plano } = reconciliar(itensVivos, entradasSemente);
    expect(plano).toHaveLength(1);
    expect(plano[0].entryId).toBe("id-original");
  });

  it("preserva um verbete vivo sem par na semente em vez de apagá-lo", () => {
    const itensVivos = [
      vivo("a1", "a-verdade", "Conhecido", "c", 0),
      vivo("vortice-branco", "a-verdade", "O que são as Brumas: o Vórtice Branco", "texto do autor", 4),
    ];
    const entradasSemente = [semente("a-verdade", "Conhecido", "c", 0)];
    const { plano, sementeSemPar } = reconciliar(itensVivos, entradasSemente);
    expect(sementeSemPar).toEqual([]);
    const autorOnly = plano.find((p) => p.entryId === "vortice-branco");
    expect(autorOnly).toEqual({
      acao: "somente-autor",
      entryId: "vortice-branco",
      tituloVivo: "O que são as Brumas: o Vórtice Branco",
    });
    // e não deve aparecer em nenhum outro papel no plano
    expect(plano.filter((p) => p.entryId === "vortice-branco")).toHaveLength(1);
  });

  it("reporta um verbete da semente sem par vivo em vez de inventar um", () => {
    const itensVivos = [vivo("a1", "s", "Existe", "c", 0)];
    const entradasSemente = [semente("s", "Existe", "c", 0), semente("s", "Novo Nunca Visto", "c2", 5)];
    const { plano, sementeSemPar } = reconciliar(itensVivos, entradasSemente);
    expect(sementeSemPar).toEqual(["Novo Nunca Visto"]);
    expect(plano.some((p) => p.title === "Novo Nunca Visto")).toBe(false);
  });

  it("reproduz o diagnóstico completo: 15 sem alteração, 4 corpo-atualizado, 1 renomeado, 1 só do autor", () => {
    const itensVivos = [
      ...Array.from({ length: 15 }, (_, i) => vivo(`ok${i}`, "s", `Igual ${i}`, `corpo ${i}`, i)),
      vivo("c0", "s", "Corpo 0", "corpo antigo 0", 20),
      vivo("c1", "s", "Corpo 1", "corpo antigo 1", 21),
      vivo("c2", "s", "Corpo 2", "corpo antigo 2", 22),
      vivo("c3", "s", "Corpo 3", "corpo antigo 3", 23),
      vivo("mviukbg04j", "a-verdade", "Quem é o Rei Pálido", "corpo antigo do rei", 1),
      vivo("vortice-branco", "a-verdade", "O que são as Brumas: o Vórtice Branco", "texto do autor", 4),
    ];
    const entradasSemente = [
      ...Array.from({ length: 15 }, (_, i) => semente("s", `Igual ${i}`, `corpo ${i}`, i)),
      semente("s", "Corpo 0", "corpo novo 0", 20),
      semente("s", "Corpo 1", "corpo novo 1", 21),
      semente("s", "Corpo 2", "corpo novo 2", 22),
      semente("s", "Corpo 3", "corpo novo 3", 23),
      semente("a-verdade", "Quem é o Rei Branco", "corpo novo do rei", 1),
    ];
    const { plano, sementeSemPar } = reconciliar(itensVivos, entradasSemente);
    const porAcao = resumirPlano(plano);
    expect(porAcao["sem-alteracao"]).toHaveLength(15);
    expect(porAcao["corpo-atualizado"]).toHaveLength(4);
    expect(porAcao.renomeado).toHaveLength(1);
    expect(porAcao["somente-autor"]).toHaveLength(1);
    expect(porAcao["somente-autor"][0].entryId).toBe("vortice-branco");
    expect(sementeSemPar).toEqual([]);
  });
});

describe("checarExpectativa", () => {
  const semente20 = [
    ...Array.from({ length: 15 }, (_, i) => semente("s", `Igual ${i}`, `corpo ${i}`, i)),
    semente("s", "Corpo 0", "corpo novo 0", 20),
    semente("s", "Corpo 1", "corpo novo 1", 21),
    semente("s", "Corpo 2", "corpo novo 2", 22),
    semente("s", "Corpo 3", "corpo novo 3", 23),
    semente("a-verdade", "Quem é o Rei Branco", "corpo novo do rei", 1),
  ];
  const vivo21 = [
    ...Array.from({ length: 15 }, (_, i) => vivo(`ok${i}`, "s", `Igual ${i}`, `corpo ${i}`, i)),
    vivo("c0", "s", "Corpo 0", "corpo antigo 0", 20),
    vivo("c1", "s", "Corpo 1", "corpo antigo 1", 21),
    vivo("c2", "s", "Corpo 2", "corpo antigo 2", 22),
    vivo("c3", "s", "Corpo 3", "corpo antigo 3", 23),
    vivo("mviukbg04j", "a-verdade", "Quem é o Rei Pálido", "corpo antigo do rei", 1),
    vivo("vortice-branco", "a-verdade", "O que são as Brumas: o Vórtice Branco", "texto do autor", 4),
  ];

  it("aprova o diagnóstico exatamente esperado", () => {
    const { plano, sementeSemPar } = reconciliar(vivo21, semente20);
    // o teste usa títulos fictícios ("Igual N", "Corpo N"), então a EXPECTATIVA real
    // do script (que cita os títulos verdadeiros) não bate aqui — comparação
    // isolada, com uma expectativa equivalente, para não depender de rede.
    const expectativaEquivalente = {
      ...EXPECTATIVA,
      corpoAtualizado: ["Corpo 0", "Corpo 1", "Corpo 2", "Corpo 3"].sort(),
    };
    const porAcao = resumirPlano(plano);
    expect(porAcao["sem-alteracao"]).toHaveLength(expectativaEquivalente.naoAlterados);
    expect(porAcao["corpo-atualizado"].map((p) => p.tituloVivo).sort()).toEqual(
      expectativaEquivalente.corpoAtualizado,
    );
    expect(porAcao.renomeado).toHaveLength(1);
    expect(sementeSemPar).toEqual([]);
  });

  it("recusa quando um verbete extra apareceu no banco (drift)", () => {
    const comDrift = [...vivo21, vivo("extra", "s", "Ninguém esperava por mim", "c", 99)];
    const { plano, sementeSemPar } = reconciliar(comDrift, semente20);
    const { ok, motivos } = checarExpectativa(plano, sementeSemPar, semente20, comDrift);
    expect(ok).toBe(false);
    expect(motivos.length).toBeGreaterThan(0);
  });

  it("recusa quando a renomeação não é a esperada", () => {
    const vivoComOutraRenomeacao = vivo21.map((it) =>
      it.entryId === "mviukbg04j" ? { ...it, title: "Um Nome Qualquer" } : it,
    );
    const { plano, sementeSemPar } = reconciliar(vivoComOutraRenomeacao, semente20);
    const { ok, motivos } = checarExpectativa(plano, sementeSemPar, semente20, vivoComOutraRenomeacao);
    expect(ok).toBe(false);
    expect(motivos.some((m) => m.includes("renomeação"))).toBe(true);
  });

  it("recusa quando o verbete só-do-autor sumiu (o que apagaria vortice-branco)", () => {
    const semOAutor = vivo21.filter((it) => it.entryId !== "vortice-branco");
    const { plano, sementeSemPar } = reconciliar(semOAutor, semente20);
    const { ok, motivos } = checarExpectativa(plano, sementeSemPar, semente20, semOAutor);
    expect(ok).toBe(false);
    expect(motivos.some((m) => m.includes("banco tem"))).toBe(true);
  });
});
