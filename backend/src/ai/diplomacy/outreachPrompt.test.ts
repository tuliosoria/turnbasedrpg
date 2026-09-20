import { describe, it, expect } from "vitest";
import { buildOutreachUser } from "./outreachPrompt";

/**
 * A carta proativa também precisa saber onde a história está.
 *
 * A resposta a carta recebe a crônica pública desde o começo. A proativa
 * recebia só os fatos extraídos — e a extração roda por modelo na resolução do
 * turno: o turno 8 rendeu quinze fatos, o turno 9 rendeu dois e nenhum de
 * alcance geral. Resultado: o mundo escrevia sem saber que o sol não voltou,
 * que Rimewatch caiu com dezoito mil e que Aurivale quebrou.
 *
 * É a mesma armadilha que a skill do projeto descreve: regra ligada num só dos
 * dois caminhos falha no outro.
 */
const plan = {
  fromSeatKey: "casa-euralune", fromSeatName: "Casa Euralune",
  toSeatKey: "casa-khazdrun", toHouseKey: "casa-khazdrun",
  toHouseName: "Khazdrun", toHouseId: "khazdrun-wxey",
  motive: "pedir ferro de forja", kind: "ESCASSEZ",
} as never;

const base = { plan, relation: null, publicEvent: "", lastOrder: "" };

describe("buildOutreachUser", () => {
  it("leva a crônica pública para dentro da carta proativa", () => {
    const texto = buildOutreachUser({ ...base, chronicle: "## Turno 10\nO sol parou e não voltou." } as never);
    expect(texto).toContain("O sol parou e não voltou.");
  });

  it("não inventa bloco de crônica quando não há turno resolvido", () => {
    const texto = buildOutreachUser({ ...base, chronicle: "" } as never);
    expect(texto).not.toMatch(/aconteceu no reino/i);
  });
});
