import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { LivroCapituloPage } from "./LivroCapituloPage";
import { saveAdminToken, clearAdminToken } from "../../auth/adminSession";

const rascunho = {
  chapterId: "c1", part: "parte-1", order: 1, title: "A forja e a leva",
  body: "Meu mestre chamava-se Halden.", status: "rascunho" as const,
  updatedAt: "", notas: "NOTA-ANTIGA",
};

const base = { getWiki: async () => [], getBook: async () => [] };

function montar(api: unknown) {
  return render(
    <ApiProvider client={api as never}>
      <MemoryRouter initialEntries={["/livro/c1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/livro/:chapterId" element={<LivroCapituloPage />} />
          <Route path="/livro" element={<div>índice</div>} />
        </Routes>
      </MemoryRouter>
    </ApiProvider>,
  );
}

beforeEach(() => clearAdminToken());

/**
 * O Mestre precisa ler o próprio rascunho.
 *
 * A rota pública filtra por `publicado`, e o livro inteiro está em rascunho
 * para não vazar aos jogadores. Sem isto, a página que existe para ler o
 * romance responde "ainda não foi publicado" justamente a quem o escreveu, e
 * ler 120 mil palavras vira ler dentro de um campo de edição.
 */
describe("LivroCapituloPage para o Mestre", () => {
  it("lê um capítulo em rascunho quando há token de mestre", async () => {
    saveAdminToken("tok");
    montar({ ...base, adminListBook: async () => [rascunho] });
    expect(await screen.findByText("Meu mestre chamava-se Halden.")).toBeInTheDocument();
    expect(screen.getByText(/rascunho/i)).toBeInTheDocument();
  });

  it("devolve o jogador ao índice, porque para ele o capítulo não existe", async () => {
    montar({ ...base, adminListBook: async () => [rascunho] });
    expect(await screen.findByText("índice")).toBeInTheDocument();
  });

  it("mostra a nota do Mestre e a salva", async () => {
    saveAdminToken("tok");
    const salvar = vi.fn(async (_t: string, _id: string, _input: Record<string, unknown>) => rascunho);
    montar({ ...base, adminListBook: async () => [rascunho], adminUpdateBookChapter: salvar });

    const campo = await screen.findByLabelText(/nota/i);
    expect(campo).toHaveValue("NOTA-ANTIGA");
    fireEvent.change(campo, { target: { value: "o Brunn está frio demais aqui" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar nota/i }));

    await waitFor(() =>
      expect(salvar).toHaveBeenCalledWith("tok", "c1", expect.objectContaining({ notas: "o Brunn está frio demais aqui" })),
    );
  });

  // Salvar a nota não pode mexer no texto do capítulo.
  it("manda o corpo intacto ao salvar a nota", async () => {
    saveAdminToken("tok");
    const salvar = vi.fn(async (_t: string, _id: string, _input: Record<string, unknown>) => rascunho);
    montar({ ...base, adminListBook: async () => [rascunho], adminUpdateBookChapter: salvar });
    fireEvent.change(await screen.findByLabelText(/nota/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar nota/i }));
    await waitFor(() =>
      expect(salvar.mock.calls[0][2]).toMatchObject({ body: "Meu mestre chamava-se Halden." }),
    );
  });

  it("deixa editar o capítulo sem sair da leitura", async () => {
    saveAdminToken("tok");
    const salvar = vi.fn(async (_t: string, _id: string, _input: Record<string, unknown>) => rascunho);
    montar({ ...base, adminListBook: async () => [rascunho], adminUpdateBookChapter: salvar });

    fireEvent.click(await screen.findByRole("button", { name: /editar/i }));
    const corpo = screen.getByLabelText(/texto do capítulo/i);
    fireEvent.change(corpo, { target: { value: "Texto reescrito." } });
    fireEvent.click(screen.getByRole("button", { name: /salvar capítulo/i }));

    await waitFor(() =>
      expect(salvar.mock.calls[0][2]).toMatchObject({ body: "Texto reescrito." }),
    );
  });
});
