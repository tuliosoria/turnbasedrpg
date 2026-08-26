import { describe, expect, it } from "vitest";
import { ADMIN_GROUPS, groupOf, sectionOf } from "./adminNav";

describe("ADMIN_GROUPS", () => {
  it("reduz o painel a quatro entradas de primeiro nível", () => {
    expect(ADMIN_GROUPS.map((g) => g.value)).toEqual(["turno", "casas", "mundo", "sistema"]);
  });

  // Ler as cartas, aprovar as cartas e escrever o resultado é uma sequência.
  // Sub-abas fariam o Mestre pular de um lado para o outro no meio do trabalho.
  it("deixa o grupo do turno empilhado, sem segunda fileira", () => {
    expect(groupOf("turno").sections).toEqual([]);
    expect(sectionOf("turno", null)).toBe("");
  });
});

describe("links antigos", () => {
  // O painel guarda a aba em ?tab=. Há links salvos apontando para os doze
  // valores velhos; quebrá-los perderia o marcador de página de quem já usa.
  it.each([
    ["turnos", "turno", ""],
    ["projetos", "turno", ""],
    ["correspondencia", "turno", ""],
    ["casas", "casas", "casas"],
    ["relacoes", "casas", "relacoes"],
    ["vivos", "casas", "vivos"],
    ["historia", "mundo", "biblia"],
    ["canonico", "mundo", "canonico"],
    ["prompts", "mundo", "prompts"],
    ["sistema", "sistema", ""],
  ])("leva ?tab=%s para %s/%s", (antigo, grupo, secao) => {
    expect(groupOf(antigo).value).toBe(grupo);
    expect(sectionOf(antigo, null)).toBe(secao);
  });

  it("manda as abas mortas e o desconhecido para o turno", () => {
    for (const morta of ["galeria", "senhas", "abracadabra", null]) {
      expect(groupOf(morta).value).toBe("turno");
    }
  });
});

describe("seções", () => {
  it("aceita a seção pedida quando ela existe no grupo", () => {
    expect(sectionOf("mundo", "estudio")).toBe("estudio");
    expect(sectionOf("casas", "vivos")).toBe("vivos");
  });

  it("cai na primeira seção quando a pedida não existe naquele grupo", () => {
    expect(sectionOf("casas", "estudio")).toBe("casas");
    expect(sectionOf("mundo", "inventada")).toBe("biblia");
  });

  it("traz as ferramentas visuais para dentro do Mundo", () => {
    const mundo = groupOf("mundo").sections.map((s) => s.value);
    expect(mundo).toContain("acervo");
    expect(mundo).toContain("entidades");
    expect(mundo).toContain("estudio");
  });
});
