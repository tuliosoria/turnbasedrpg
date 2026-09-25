import { describe, it, expect } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ENERGIA_POR_TURNO } from "@ravenloft/content";
import { TrilhaDePassos } from "./TrilhaDePassos";
import { CofreDeEnergia } from "./CofreDeEnergia";

describe("TrilhaDePassos", () => {
  it("uma casinha por turno, marcando andada, grátis, Energia e vazia", () => {
    const { container } = render(<TrilhaDePassos previa={{ andadas: 1, gratis: 1, comEnergia: 2, depois: 4, total: 5, conclui: false }} />);
    const tipos = [...container.querySelectorAll("[data-passo]")].map((e) => e.getAttribute("data-passo"));
    expect(tipos).toEqual(["andada", "gratis", "energia", "energia", "vazia"]);
    expect(screen.getByLabelText("1 de 5 turnos; no fim do turno: 4 de 5")).toBeInTheDocument();
  });
});

describe("CofreDeEnergia", () => {
  it("mostra orbes acesos para o que está livre e o saldo", () => {
    const { container } = render(<CofreDeEnergia total={3} livre={2} origemRef={createRef()} />);
    expect(container.querySelectorAll('[data-orbe="aceso"]').length).toBe(2);
    expect(container.querySelectorAll('[data-orbe="apagado"]').length).toBe(1);
    expect(screen.getByText("2 de 3 livres")).toBeInTheDocument();
    expect(screen.getByText(/o que sobrar se perde no fechamento/i)).toBeInTheDocument();
  });

  it("'Como funciona?' explica as três regras com os números do jogo", () => {
    render(<CofreDeEnergia total={ENERGIA_POR_TURNO} livre={ENERGIA_POR_TURNO} origemRef={createRef()} />);
    fireEvent.click(screen.getByRole("button", { name: /Como funciona/i }));
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByText(/anda 1 passo por turno, de graça/i)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Cada ponto de Energia é 1 passo a mais/i)).toBeInTheDocument();
    expect(within(dialogo).getByText(/tentar de novo/i)).toBeInTheDocument();
  });
});
