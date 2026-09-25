import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ProjectCard } from "@ravenloft/content";
import { CartaFracassada } from "./CartaFracassada";
import { RevelacaoDoTurno } from "./RevelacaoDoTurno";

const efeitos = { attributeChanges: [], favors: [], assets: ["Balão de Vento"], qualitativeEffects: [], unlocks: [] };
const ok = { id: "ok", title: "Balões", status: "COMPLETED", outcomeNarrative: "Sobem e voltam.", completionEffects: efeitos } as unknown as ProjectCard;
const falhou = { id: "f", title: "Dispositivo", status: "FAILED", outcomeNarrative: "Estourou a bancada.", completionEffects: efeitos } as unknown as ProjectCard;

describe("CartaFracassada", () => {
  it("oferece tentar de novo", () => {
    const onTentarDeNovo = vi.fn();
    render(<CartaFracassada carta={falhou} semVaga={false} busy={false} onTentarDeNovo={onTentarDeNovo} />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo — grátis/ }));
    expect(onTentarDeNovo).toHaveBeenCalled();
  });

  // Review Focus 5.
  it("sem vaga, desativa e diz o que fazer", () => {
    render(<CartaFracassada carta={falhou} semVaga busy={false} onTentarDeNovo={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeDisabled();
    expect(screen.getByText("Libere uma vaga primeiro")).toBeInTheDocument();
  });
});

describe("RevelacaoDoTurno", () => {
  it("revela uma carta por vez e fecha no fim", () => {
    const onFechar = vi.fn();
    render(<RevelacaoDoTurno cartas={[ok, falhou]} aberta semVaga={false} busy={false} onFechar={onFechar} onTentarDeNovo={vi.fn()} />);
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByText(/Recebido: .*Balão de Vento/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("2 de 2")).toBeInTheDocument();
    expect(screen.getByText("Fracassou")).toBeInTheDocument();
    expect(screen.getByText("Estourou a bancada.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalled();
  });

  it("no fracasso, tentar de novo sai dali mesmo", () => {
    const onTentarDeNovo = vi.fn();
    render(<RevelacaoDoTurno cartas={[falhou]} aberta semVaga={false} busy={false} onFechar={vi.fn()} onTentarDeNovo={onTentarDeNovo} />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo — grátis, sucesso garantido/ }));
    expect(onTentarDeNovo).toHaveBeenCalledWith("f");
  });

  it("sem cartas, não abre", () => {
    render(<RevelacaoDoTurno cartas={[]} aberta semVaga={false} busy={false} onFechar={vi.fn()} onTentarDeNovo={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
