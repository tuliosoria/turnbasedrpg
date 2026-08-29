import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttributeChangeChips } from "./AttributeChangeChips";

describe("o motivo de um ganho automático", () => {
  // Sem o motivo, o jogador vê o atributo subir e não sabe o que fez para
  // merecer, nem o que fazer para repetir.
  it("diz por que o recurso subiu quando a causa não foi o Mestre", () => {
    render(
      <AttributeChangeChips
        changes={[{ key: "recursos", before: 1, after: 2, delta: 1, motivo: "por 3 rotas comerciais abertas" }]}
      />,
    );
    expect(screen.getByText(/por 3 rotas comerciais abertas/)).toBeInTheDocument();
  });

  it("não inventa motivo quando não há", () => {
    render(<AttributeChangeChips changes={[{ key: "recursos", before: 1, after: 2, delta: 1 }]} />);
    expect(screen.getByText("Recursos 1 → 2 (+1)")).toBeInTheDocument();
  });
});
