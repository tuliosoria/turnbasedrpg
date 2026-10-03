import { describe, expect, it } from "vitest";
import { historicoDaRelacao } from "./estado";

describe("historicoDaRelacao", () => {
  it("omite 'desde o turno' quando o número mais antigo não foi carimbado", () => {
    const texto = historicoDaRelacao(
      [{ turnNumber: 0, author: "PLAYER" }, { turnNumber: 0, author: "AI" }],
      null,
      "casa-khazdrun",
      "Khazdrun",
    );
    expect(texto).not.toContain("turno 0");
    expect(texto).not.toContain("desde o turno");
  });

  it("usa o turno mais antigo que existe, e ignora o zero da conversa corrente", () => {
    const texto = historicoDaRelacao(
      [
        { turnNumber: 0, author: "AI" },
        { turnNumber: 4, author: "PLAYER" },
      ],
      null,
      "casa-khazdrun",
      "Khazdrun",
    );
    expect(texto).toContain("desde o turno 4");
    expect(texto).toContain("2 cartas ao todo");
    expect(texto).not.toContain("turno 0");
  });
});
