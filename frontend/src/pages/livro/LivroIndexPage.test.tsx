import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { LivroIndexPage } from "./LivroIndexPage";
import { saveAdminToken, clearAdminToken } from "../../auth/adminSession";

const rascunho = {
  chapterId: "c1", part: "parte-1", order: 1, title: "A forja e a leva",
  body: "corpo", status: "rascunho" as const, updatedAt: "",
};
const base = { getWiki: async () => [], getBook: async () => [], adminListBook: async () => [rascunho] };

const montar = () =>
  render(
    <ApiProvider client={base as never}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LivroIndexPage />
      </MemoryRouter>
    </ApiProvider>,
  );

beforeEach(() => clearAdminToken());

describe("LivroIndexPage", () => {
  it("lista os rascunhos para o Mestre", async () => {
    saveAdminToken("tok");
    montar();
    expect(await screen.findByText("A forja e a leva")).toBeInTheDocument();
  });

  it("continua dizendo ao jogador que o romance não foi publicado", async () => {
    montar();
    expect(await screen.findByText(/ainda não foi publicado/i)).toBeInTheDocument();
  });
});
