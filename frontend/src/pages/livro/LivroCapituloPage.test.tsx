import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiProvider } from "../../api/ApiProvider";
import { LivroCapituloPage } from "./LivroCapituloPage";
import { saveAdminToken, clearAdminToken } from "../../auth/adminSession";

const rascunho = {
  chapterId: "c1", part: "parte-1", order: 1, title: "A forja e a leva",
  body: "Meu mestre chamava-se Halden.\n\nO aco negro nao perdoa o apressado.",
  status: "rascunho" as const, updatedAt: "",
  comentarios: [{ id: "k1", paragrafo: 1, trecho: "O aco negro nao perdoa o apressado.", texto: "COMENTARIO-ANTIGO", criadoEm: "" }],
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

  /**
   * Editar um parágrafo manda o capítulo inteiro de volta, com aquele
   * parágrafo trocado e todos os outros intactos. É o que permite precisão de
   * revisão sem rota nova no servidor.
   */
  it("edita um parágrafo e devolve o capítulo com o resto intacto", async () => {
    saveAdminToken("tok");
    const salvar = vi.fn(async (_t: string, _id: string, _input: Record<string, unknown>) => rascunho);
    montar({ ...base, adminListBook: async () => [rascunho], adminUpdateBookChapter: salvar });

    const editar = await screen.findAllByRole("button", { name: /editar par[áa]grafo/i });
    fireEvent.click(editar[1]);
    fireEvent.change(screen.getByLabelText(/par[áa]grafo/i), { target: { value: "Reescrito." } });
    fireEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

    await waitFor(() =>
      expect(salvar.mock.calls[0][2]).toMatchObject({
        body: "Meu mestre chamava-se Halden.\n\nReescrito.",
      }),
    );
  });

  it("mostra o comentário existente junto do parágrafo que ele critica", async () => {
    saveAdminToken("tok");
    montar({ ...base, adminListBook: async () => [rascunho] });
    expect(await screen.findByText("COMENTARIO-ANTIGO")).toBeInTheDocument();
  });

  it("cria um comentário no parágrafo e guarda o trecho junto", async () => {
    saveAdminToken("tok");
    const salvar = vi.fn(async (_t: string, _id: string, _input: Record<string, unknown>) => rascunho);
    montar({ ...base, adminListBook: async () => [rascunho], adminUpdateBookChapter: salvar });

    const comentar = await screen.findAllByRole("button", { name: /comentar par[áa]grafo/i });
    fireEvent.click(comentar[0]);
    fireEvent.change(screen.getByLabelText("Comentário"), { target: { value: "frio demais aqui" } });
    fireEvent.click(screen.getByRole("button", { name: /^comentar$/i }));

    await waitFor(() => {
      const enviados = (salvar.mock.calls[0][2] as { comentarios: { texto: string; trecho: string; paragrafo: number }[] }).comentarios;
      expect(enviados).toHaveLength(2);
      expect(enviados[1]).toMatchObject({ texto: "frio demais aqui", paragrafo: 0, trecho: "Meu mestre chamava-se Halden." });
    });
  });

  it("apaga um comentário quando o Mestre manda", async () => {
    saveAdminToken("tok");
    const salvar = vi.fn(async (_t: string, _id: string, _input: Record<string, unknown>) => rascunho);
    montar({ ...base, adminListBook: async () => [rascunho], adminUpdateBookChapter: salvar });

    fireEvent.click(await screen.findByRole("button", { name: /apagar coment[áa]rio/i }));
    await waitFor(() =>
      expect((salvar.mock.calls[0][2] as { comentarios: unknown[] }).comentarios).toEqual([]),
    );
  });

  /**
   * O comentário cujo trecho eu reescrevi não some: vira órfão e aparece no fim
   * do capítulo com o trecho antigo citado.
   */
  it("mostra como órfão o comentário cujo trecho não existe mais", async () => {
    saveAdminToken("tok");
    const reescrito = { ...rascunho, body: "Um capitulo inteiramente outro agora." };
    montar({ ...base, adminListBook: async () => [reescrito] });
    expect(await screen.findByText(/sem lugar no texto/i)).toBeInTheDocument();
    expect(screen.getByText("COMENTARIO-ANTIGO")).toBeInTheDocument();
  });

  // O jogador não vê ação nenhuma, e sobretudo não vê a revisão.
  it("não mostra ação nem comentário ao jogador", async () => {
    const publicado = { ...rascunho, status: "publicado" as const, comentarios: undefined };
    montar({ ...base, getBook: async () => [publicado], adminListBook: async () => [rascunho] });
    await screen.findByText(/Meu mestre chamava-se Halden/);
    expect(screen.queryByRole("button", { name: /editar par[áa]grafo/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /comentar par[áa]grafo/i })).toBeNull();
    expect(screen.queryByText("COMENTARIO-ANTIGO")).toBeNull();
  });
});

/**
 * A revisão precisa se anunciar.
 *
 * As ações nasceram escondidas atrás de `opacity: 0`, aparecendo só no hover.
 * A página parecia não ter nada, e em tela de toque não teria mesmo. Pior: o
 * JSDOM ignora hover, então os testes passavam com a feature invisível.
 *
 * Agora há um aviso no topo, e ele responde de graça a pergunta que o Mestre
 * faz primeiro quando não vê os botões: é o site que está quebrado ou sou eu
 * que não entrei como mestre?
 */
describe("descoberta da revisão", () => {
  it("avisa o Mestre de que ele pode editar e comentar", async () => {
    saveAdminToken("tok");
    montar({ ...base, adminListBook: async () => [rascunho] });
    expect(await screen.findByText(/modo de revis[ãa]o/i)).toBeInTheDocument();
  });

  it("não mostra aviso nenhum ao jogador", async () => {
    const publicado = { ...rascunho, status: "publicado" as const, comentarios: undefined };
    montar({ ...base, getBook: async () => [publicado] });
    await screen.findByText(/Meu mestre chamava-se Halden/);
    expect(screen.queryByText(/modo de revis[ãa]o/i)).toBeNull();
  });
});
