import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProjectCard } from "@ravenloft/content";
import { CartaAtiva } from "./CartaAtiva";

function carta(over: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: "c1", title: "Rota de Caravanas", category: "ECONOMY", status: "ACTIVE", description: "d",
    turnsCompleted: 0, durationTurns: 3, refeita: false,
    completionEffects: { attributeChanges: [{ attribute: "riqueza", amount: 1, permanent: true }], favors: [], assets: [], qualitativeEffects: [], unlocks: [] },
    ...over,
  } as ProjectCard;
}

const base = { energia: 0, teto: 2, livre: 3, busy: false, onMudar: vi.fn(), onCancelar: vi.fn(), onReescrever: vi.fn() };

describe("CartaAtiva", () => {
  it("diz onde a carta vai estar no fim do turno", () => {
    render(<CartaAtiva {...base} carta={carta()} energia={1} />);
    expect(screen.getByText("Fim do turno: → 2 de 3")).toBeInTheDocument();
  });

  it("+ e − chamam onMudar", () => {
    const onMudar = vi.fn();
    render(<CartaAtiva {...base} carta={carta()} energia={1} onMudar={onMudar} />);
    fireEvent.click(screen.getByRole("button", { name: "Pôr Energia em Rota de Caravanas" }));
    fireEvent.click(screen.getByRole("button", { name: "Tirar Energia de Rota de Caravanas" }));
    expect(onMudar.mock.calls).toEqual([[1], [-1]]);
  });

  it("no teto, + desativa e diz por quê", () => {
    render(<CartaAtiva {...base} carta={carta()} energia={2} />);
    expect(screen.getByRole("button", { name: "Pôr Energia em Rota de Caravanas" })).toBeDisabled();
    expect(screen.getByText("Esta carta já recebe o máximo")).toBeInTheDocument();
  });

  it("sem saldo, + desativa e diz por quê", () => {
    render(<CartaAtiva {...base} carta={carta()} energia={0} livre={0} />);
    expect(screen.getByRole("button", { name: "Pôr Energia em Rota de Caravanas" })).toBeDisabled();
    expect(screen.getByText("Sem Energia livre")).toBeInTheDocument();
  });

  // A dúvida do Obelisco: teto 0 não é "não consigo", é "não precisa".
  it("teto 0 e conclui: selo no lugar dos botões", () => {
    render(<CartaAtiva {...base} carta={carta({ turnsCompleted: 0, durationTurns: 1, refeita: true })} teto={0} />);
    expect(screen.getByText(/Conclui sozinha no fim do turno. Não precisa de Energia./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pôr Energia/ })).toBeNull();
    expect(screen.getByText("Sucesso garantido")).toBeInTheDocument();
    expect(screen.getByText("Conclui neste turno")).toBeInTheDocument();
  });

  it("pausada: selo e sem controles", () => {
    render(<CartaAtiva {...base} carta={carta({ status: "PAUSED" })} teto={0} />);
    expect(screen.getByText("Pausada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pôr Energia/ })).toBeNull();
  });

  it("menu ⋯ oferece Reescrever só para refeita, e Cancelar sempre", () => {
    const { rerender } = render(<CartaAtiva {...base} carta={carta()} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    expect(screen.queryByRole("menuitem", { name: "Reescrever" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Cancelar carta" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    rerender(<CartaAtiva {...base} carta={carta({ refeita: true, durationTurns: 1 })} teto={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    expect(screen.getByRole("menuitem", { name: "Reescrever" })).toBeInTheDocument();
  });

  it("mostra o ganho ao concluir", () => {
    render(<CartaAtiva {...base} carta={carta()} />);
    expect(screen.getByText(/^Ao concluir: /)).toBeInTheDocument();
  });
});
