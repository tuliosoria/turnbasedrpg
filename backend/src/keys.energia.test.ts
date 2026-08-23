import { describe, expect, it } from "vitest";
import { energiaSk } from "./keys";

describe("energiaSk", () => {
  it("separa por turno e por Casa", () => {
    expect(energiaSk(7, "casa-do-ouro")).toBe("ENERGY#007#casa-do-ouro");
  });

  it("preenche o turno com zeros, para ordenar como número", () => {
    expect(energiaSk(1, "x") < energiaSk(10, "x")).toBe(true);
  });
});
