import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  // Revisão final: a carta refeita sai da lista do painel. Sem retrato, o
  // diálogo sumia sem confirmar (uma carta) ou mostrava "2 de 1" (duas).
  it("tentar de novo confirma ali mesmo, sem a lista mudar embaixo", async () => {
    const onFechar = vi.fn();
    const props = { aberta: true, semVaga: false, busy: false, onFechar, onTentarDeNovo: vi.fn().mockResolvedValue(true) };
    const { rerender } = render(<RevelacaoDoTurno {...props} cartas={[ok, falhou]} />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo — grátis, sucesso garantido/ }));
    rerender(<RevelacaoDoTurno {...props} cartas={[ok]} />); // o painel recarregou: a refeita saiu
    expect(screen.getByText("2 de 2")).toBeInTheDocument();
    expect(await screen.findByText(/Voltou para Em andamento/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onFechar).toHaveBeenCalled();
  });

  // Se o servidor recusa (ex.: a vaga foi tomada noutro aparelho), o diálogo
  // não pode confirmar o que não aconteceu — e o erro aparece nele, não atrás.
  it("recusa do servidor: não confirma e mostra o motivo no diálogo", async () => {
    const onTentarDeNovo = vi.fn().mockResolvedValue(false);
    const props = { aberta: true, semVaga: false, busy: false, onFechar: vi.fn(), onTentarDeNovo };
    const { rerender } = render(<RevelacaoDoTurno {...props} cartas={[falhou]} />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo — grátis, sucesso garantido/ }));
    rerender(<RevelacaoDoTurno {...props} cartas={[falhou]} erro="Libere uma vaga primeiro: sua Casa já tem o máximo de cartas ativas." />);
    await waitFor(() => expect(onTentarDeNovo).toHaveBeenCalled());
    expect(screen.queryByText(/Voltou para Em andamento/)).toBeNull();
    expect(screen.getByText(/sua Casa já tem o máximo/)).toBeInTheDocument();
  });

  it("com uma carta só, a refeita não faz o diálogo sumir", async () => {
    const props = { aberta: true, semVaga: false, busy: false, onFechar: vi.fn(), onTentarDeNovo: vi.fn().mockResolvedValue(true) };
    const { rerender } = render(<RevelacaoDoTurno {...props} cartas={[falhou]} />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo — grátis, sucesso garantido/ }));
    rerender(<RevelacaoDoTurno {...props} cartas={[]} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText(/Voltou para Em andamento/)).toBeInTheDocument();
  });

  it("sem cartas, não abre", () => {
    render(<RevelacaoDoTurno cartas={[]} aberta semVaga={false} busy={false} onFechar={vi.fn()} onTentarDeNovo={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
