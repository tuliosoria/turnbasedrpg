import { describe, expect, it } from "vitest";
import { LEADER_PERSONAS } from "./leaders.js";

describe("a voz das personas", () => {
  const personas = Object.entries(LEADER_PERSONAS);

  // Os jogadores acharam as cartas pomposas e enigmáticas, e a culpa não era do
  // modelo: 13 das 16 personas mandavam escrever "formal e elaborada", com
  // "vocabulário rico" e "linguagem rica". A IA estava obedecendo.
  it("não manda ninguém escrever de forma elaborada, eloquente ou rica", () => {
    const pomposos = personas.filter(([, p]) =>
      /formal e elaborad|eloqu|vocabul[áa]rio rico|linguagem rica|cartas tendem a ser extensas/i.test(p.speechStyle),
    );
    expect(pomposos.map(([k]) => k)).toEqual([]);
  });

  it("descreve o que as frases da pessoa fazem, não só o quanto ela é formal", () => {
    for (const [chave, p] of personas) {
      expect(p.speechStyle.length, chave).toBeGreaterThan(60);
    }
  });

  // Arcaísmo em todo mundo não é época, é papel de parede: quando o capitão de
  // fronteira e a Regente escrevem no mesmo "vós", o "vós" para de significar.
  it("reserva o 'vós' à Coroa e ao clero", () => {
    const arcaicos = personas.filter(([, p]) => /em v[óo]s/i.test(p.speechStyle)).map(([k]) => k);
    expect(arcaicos.sort()).toEqual(["casa-valerius", "ordem-do-sino", "ordem-dos-tres"]);
  });
});
