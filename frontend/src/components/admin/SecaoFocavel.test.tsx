import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Secao } from "./AdminTurnoTab";

const aberta = (nome: RegExp) => screen.getByRole("button", { name: nome }).getAttribute("aria-expanded") === "true";

describe("a seção recolhida do Turno", () => {
  it("fica fechada sem foco", () => {
    render(<Secao titulo="Projetos das Casas" ancora="projetos" foco={null}>lista</Secao>);
    expect(aberta(/Projetos das Casas/)).toBe(false);
  });

  // O atalho dourado precisa abrir a seção onde a pendência mora; recolhida,
  // o Mestre clicava e não via nada mudar.
  it("abre quando o atalho aponta para ela", () => {
    render(<Secao titulo="Projetos das Casas" ancora="projetos" foco={{ alvo: "projetos", vez: 1 }}>lista</Secao>);
    expect(aberta(/Projetos das Casas/)).toBe(true);
  });

  it("não abre quando o atalho aponta para outra", () => {
    render(<Secao titulo="Projetos das Casas" ancora="projetos" foco={{ alvo: "espioes", vez: 1 }}>lista</Secao>);
    expect(aberta(/Projetos das Casas/)).toBe(false);
  });

  it("reabre num segundo clique depois de o Mestre fechar", async () => {
    const { rerender } = render(<Secao titulo="Projetos das Casas" ancora="projetos" foco={{ alvo: "projetos", vez: 1 }}>lista</Secao>);
    await userEvent.click(screen.getByRole("button", { name: /Projetos das Casas/ }));
    expect(aberta(/Projetos das Casas/)).toBe(false);
    rerender(<Secao titulo="Projetos das Casas" ancora="projetos" foco={{ alvo: "projetos", vez: 2 }}>lista</Secao>);
    expect(aberta(/Projetos das Casas/)).toBe(true);
  });
});
