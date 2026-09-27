import { describe, expect, it } from "vitest";
import { medirCarta, reciclagem, termosBatidos, eco, nomesForaDoCanone, morteAfirmada } from "./medir-carta.mjs";

const acordo = "Entregaremos quarenta fardos de tecido no Vau Negro, junto ao Miemar, na próxima lua, contra o sal que prometestes.";

describe("reciclagem", () => {
  it("é 1 quando a resposta repete uma carta anterior da Casa", () => {
    expect(reciclagem(acordo, [acordo])).toBe(1);
  });

  it("é 0 quando nada se repete", () => {
    expect(reciclagem("Os mortos pararam diante de Droskar e ninguém sabe o motivo disto.", [acordo])).toBe(0);
  });

  it("ignora acento e caixa", () => {
    expect(reciclagem(acordo.toUpperCase().replace("próxima", "proxima"), [acordo])).toBe(1);
  });

  it("é 0 para resposta curta demais para formar shingle", () => {
    expect(reciclagem("Sim.", [acordo])).toBe(0);
  });
});

describe("termosBatidos", () => {
  it("acha o nome que o fio martelou e conta quantas vezes volta na resposta", () => {
    const fio = [acordo, "O Vau Negro segue aberto.", "No Vau Negro, o tecido espera.", "Tecido e sal no Vau Negro."];
    const termos = termosBatidos(fio, "Mandaremos tudo ao Vau Negro. O Vau Negro é nosso ponto.");
    const vau = termos.find((t) => t.termo === "vau negro");
    expect(vau).toEqual({ termo: "vau negro", noFio: 4, naResposta: 2 });
  });

  it("ignora os nomes das duas Casas da carta", () => {
    const fio = ["Solarion saúda o Clã.", "Solarion envia tecido.", "Solarion confirma.", "O Clã Mandíbula de Osso agradece a Solarion."];
    const termos = termosBatidos(fio, "Solarion, Solarion, Solarion.", 5, ["Solarion", "Clã Mandíbula de Osso"]);
    expect(termos.map((t) => t.termo)).not.toContain("solarion");
    expect(termos.map((t) => t.termo)).not.toContain("mandibula osso");
  });

  it("não lista termo que o fio usou menos de três vezes", () => {
    expect(termosBatidos(["Uma vez Droskar."], "Droskar")).toEqual([]);
  });
});

describe("eco", () => {
  it("separa perguntas respondidas das ignoradas", () => {
    const recebida = "Garok, o que vistes nos mortos parados diante de Droskar? Pedimos também notícias da ponte de Stonebridge.";
    const resposta = "Os mortos parados diante de Droskar não se mexem; vimos três noites de fileira imóvel.";
    const r = eco(recebida, resposta);
    expect(r.total).toBe(2);
    expect(r.respondidas).toBe(1);
    expect(r.semEco[0]).toMatch(/Stonebridge/);
  });

  it("carta sem pergunta nem pedido tem total zero", () => {
    expect(eco("Saudações do Sol.", "Saudações.").total).toBe(0);
  });
});

describe("nomesForaDoCanone", () => {
  it("aponta nome próprio no meio da frase que ninguém conhece", () => {
    const r = nomesForaDoCanone("Mandaremos o capitão Borvak Dente-Frio com a escolta de Garok.", ["Garok"]);
    expect(r).toEqual(["Borvak Dente-Frio"]);
  });

  it("não aponta palavra que só abre frase", () => {
    expect(nomesForaDoCanone("Depois disso, veremos.", [])).toEqual([]);
  });
});

describe("morteAfirmada", () => {
  it("pega o caso Thorgul, inclusive com 'cair' depois de 'de'", () => {
    const r = morteAfirmada("Depois de Thorgul cair, o clã hesitou. Seguimos.", ["Thorgul Crânio-Cinzento"]);
    expect(r).toEqual([{ nome: "Thorgul Crânio-Cinzento", frase: "Depois de Thorgul cair, o clã hesitou." }]);
  });

  it("não acusa quem aparece vivo", () => {
    expect(morteAfirmada("Thorgul mandou repetir a carta.", ["Thorgul Crânio-Cinzento"])).toEqual([]);
  });
});

describe("medirCarta", () => {
  it("junta tudo e marca resposta vazia", () => {
    const m = medirCarta({ resposta: "", recebida: "O que quereis?", anterioresDaCasa: [], fioAnterior: [], nomesConhecidos: [], vivos: [], motivos: [] });
    expect(m.vazia).toBe(true);
    expect(m.tamanho).toBe(0);
  });

  it("devolve prazos, escala e motivos do revisor", () => {
    const m = medirCarta({
      resposta: "Mandaremos 300 toneladas de grão em dez dias.",
      recebida: "Precisamos de grão.",
      anterioresDaCasa: [], fioAnterior: [], nomesConhecidos: [], vivos: [],
      motivos: ["2. respondia outra carta"],
    });
    expect(m.prazos.length).toBe(1);
    expect(m.escala).toMatch(/toneladas/);
    expect(m.motivosRevisor).toEqual(["2. respondia outra carta"]);
    expect(m.vazia).toBe(false);
  });
});
