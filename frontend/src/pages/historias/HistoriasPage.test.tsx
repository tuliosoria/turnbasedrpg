import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HistoriasPage } from "./HistoriasPage";
import { HISTORIAS } from "./historias";

describe("HistoriasPage", () => {
  it("lista as histórias com um player de áudio", () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HistoriasPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Histórias Contadas" })).toBeInTheDocument();
    expect(screen.getByText(HISTORIAS[0].title)).toBeInTheDocument();
    // Áudio, não vídeo: o player pesado saiu de cena.
    const audio = container.querySelector("audio");
    expect(audio?.querySelector("source")?.getAttribute("src")).toContain(".mp3");
    // Sem metadata o player não mostra duração e parece travado ao dar play.
    expect(audio?.getAttribute("preload")).toBe("metadata");
    expect(container.querySelector("video")).toBeNull();
  });

  it("avisa e oferece o arquivo direto quando o áudio não carrega", () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HistoriasPage />
      </MemoryRouter>,
    );
    // Um <audio> que falha fica cinza e mudo: sem isso o jogador não sabe de nada.
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.error(container.querySelector("source")!);
    expect(screen.getByRole("alert")).toHaveTextContent(/bloqueio de rede/);
    expect(screen.getByRole("link", { name: "Abrir o arquivo direto" })).toHaveAttribute(
      "href",
      HISTORIAS[0].audioUrl,
    );
  });

  it("leva ao verbete de origem na Enciclopédia", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HistoriasPage />
      </MemoryRouter>,
    );
    // Cada botão aponta para a seção da Enciclopédia que originou a história.
    const destinos = screen
      .getAllByRole("link", { name: /Ler na Enciclopédia/ })
      .map((a) => a.getAttribute("href"));
    for (const h of HISTORIAS) {
      if (h.section) expect(destinos).toContain(`/valdren/${h.section}`);
    }
  });
});
