import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AudiosPage } from "./AudiosPage";
import { NARRACOES } from "./narracoes";

describe("AudiosPage", () => {
  it("lista as narrações com um player de vídeo", () => {
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AudiosPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Áudios" })).toBeInTheDocument();
    expect(screen.getByText(NARRACOES[0].title)).toBeInTheDocument();
    const source = container.querySelector("video > source");
    expect(source?.getAttribute("src")).toContain(".mp4");
  });
});
