import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("leva ao verbete de origem na Enciclopédia", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <HistoriasPage />
      </MemoryRouter>,
    );
    // Uma história por verbete: cada botão aponta para a seção que a originou.
    const destinos = screen
      .getAllByRole("link", { name: /Ler na Enciclopédia/ })
      .map((a) => a.getAttribute("href"));
    expect(destinos).toContain("/valdren/casas");
    expect(destinos).toContain("/valdren/brumas");
  });
});
