import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { TurnDraftBanner } from "./TurnDraftBanner";

const HOUSES = [
  { houseId: "h-ouro", name: "Casa do Ouro" },
  { houseId: "h-khaz", name: "Casa Khazdrun" },
];

async function setup(onLoad = vi.fn(), turnStatus?: string) {
  const client = new MockApiClient();
  const { adminToken } = await client.adminLogin("code");
  client.setTurnDraftForTest({
    publicEvent: "Drakorys denuncia a Coroa.",
    // Uma chave por nome de Casa, outra por houseId — as duas devem casar.
    privateInfo: { "Casa do Ouro": "Vejam a rota vigiada.", "h-khaz": "O resíduo arcano confirma." },
    note: "Racional: primeira fratura aberta.",
    eventImageUrl: "https://img.test/kaelen.png",
    createdAt: "2026-08-15T12:00:00.000Z",
  });
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <TurnDraftBanner adminToken={adminToken} houses={HOUSES} turnStatus={turnStatus} onLoad={onLoad} />
      </ApiProvider>,
    );
  });
  return { client, onLoad };
}

describe("TurnDraftBanner", () => {
  it("mostra o rascunho pendente com a nota e o evento público", async () => {
    await setup();
    expect(await screen.findByText(/Rascunho de turno pendente/)).toBeInTheDocument();
    expect(screen.getByText(/Drakorys denuncia a Coroa/)).toBeInTheDocument();
    expect(screen.getByText(/primeira fratura aberta/)).toBeInTheDocument();
  });

  it("carrega nos campos, mapeando info privada por nome e por id", async () => {
    const { onLoad } = await setup();
    await screen.findByText(/Rascunho de turno pendente/);
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Carregar nos campos/ })); });
    expect(onLoad).toHaveBeenCalledWith("Drakorys denuncia a Coroa.", {
      "h-ouro": "Vejam a rota vigiada.",
      "h-khaz": "O resíduo arcano confirma.",
    });
  });

  it("define a imagem do turno a partir da sugestão do rascunho", async () => {
    const onImageSet = vi.fn();
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("code");
    client.setTurnDraftForTest({
      publicEvent: "E", privateInfo: {}, note: "", eventImageUrl: "https://img.test/kaelen.png",
      createdAt: "2026-08-15T12:00:00.000Z",
    });
    await act(async () => {
      render(
        <ApiProvider client={client}>
          <TurnDraftBanner adminToken={adminToken} houses={HOUSES} onLoad={vi.fn()} onImageSet={onImageSet} />
        </ApiProvider>,
      );
    });
    await screen.findByText(/Rascunho de turno pendente/);
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Usar como imagem do turno/ })); });
    expect(onImageSet).toHaveBeenCalledWith("https://img.test/kaelen.png");
    expect(await screen.findByText(/Imagem definida/)).toBeInTheDocument();
  });

  it("carrega o resultado proposto, mapeando resultados por Casa", async () => {
    const onLoadResolution = vi.fn();
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("code");
    client.setTurnDraftForTest({
      publicEvent: "E", privateInfo: {}, note: "", createdAt: "2026-08-15T12:00:00.000Z",
      resolution: {
        publicResult: "As Casas se movem.",
        houseResults: { "Casa do Ouro": "Exército mobilizado.", "h-khaz": "Investigação avança." },
        discoveries: ["A Asteria foi sabotada."],
      },
    });
    await act(async () => {
      render(
        <ApiProvider client={client}>
          <TurnDraftBanner adminToken={adminToken} houses={HOUSES} onLoad={vi.fn()} onLoadResolution={onLoadResolution} />
        </ApiProvider>,
      );
    });
    await screen.findByText(/Resultado proposto do turno atual/);
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Carregar resultado nos campos/ })); });
    expect(onLoadResolution).toHaveBeenCalledWith(
      "As Casas se movem.",
      { "h-ouro": "Exército mobilizado.", "h-khaz": "Investigação avança." },
      ["A Asteria foi sabotada."],
    );
  });

  it("descarta o rascunho e some", async () => {
    const { client } = await setup();
    await screen.findByText(/Rascunho de turno pendente/);
    await act(async () => { await userEvent.click(screen.getByRole("button", { name: /Descartar rascunho/ })); });
    await waitFor(() => expect(screen.queryByText(/Rascunho de turno pendente/)).not.toBeInTheDocument());
    const { draft } = await client.adminGetTurnDraft("mock-admin-token");
    expect(draft).toBeNull();
  });
});

describe("estado do turno", () => {
  const renderBanner = ({ turnStatus }: { turnStatus: string }) => setup(vi.fn(), turnStatus);

  // Os campos de compor só existem em DRAFT. Carregar neles com o turno
  // trancado escrevia num formulário invisível e parecia botão quebrado.
  it("não deixa carregar nos campos com o turno trancado, e explica por quê", async () => {
    await renderBanner({ turnStatus: "LOCKED" });
    const botao = await screen.findByRole("button", { name: /Carregar nos campos/i });
    expect(botao).toBeDisabled();
    expect(screen.getByText(/só aparecem com o turno em DRAFT/i)).toBeInTheDocument();
  });

  it("deixa carregar com o turno em DRAFT", async () => {
    await renderBanner({ turnStatus: "DRAFT" });
    const botao = await screen.findByRole("button", { name: /Carregar nos campos/i });
    expect(botao).toBeEnabled();
  });
});

/** Monta o banner com um rascunho feito à medida do teste. */
async function comRascunho(draft: Record<string, unknown>) {
  const client = new MockApiClient();
  const { adminToken } = await client.adminLogin("code");
  client.setTurnDraftForTest({ createdAt: "2026-08-29T12:00:00.000Z", ...draft } as never);
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <TurnDraftBanner adminToken={adminToken} houses={[{ houseId: "house-1", name: "Casa Khazdrun" }]} onLoad={vi.fn()} />
      </ApiProvider>,
    );
  });
}

describe("o preview mostra o que o jogador vai ver", () => {
  // O Mestre revisava o rascunho vendo "**O céu tem uma data.**" com os
  // asteriscos à mostra, enquanto o jogador receberia o negrito renderizado.
  // Revisar um texto que renderiza diferente do que se lê convida a "consertar"
  // o que não está quebrado.
  it("renderiza o negrito do evento em vez de mostrar asteriscos", async () => {
    await comRascunho({ publicEvent: "**O céu tem uma data.**", privateInfo: {}, note: "" });
    expect(await screen.findByText("O céu tem uma data.")).toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it("renderiza o resultado público do mesmo jeito", async () => {
    await comRascunho({
      publicEvent: "evento", privateInfo: {}, note: "",
      resolution: { publicResult: "**Gor-Kirius convocou.**", houseResults: {}, discoveries: [] },
    });
    expect(await screen.findByText("Gor-Kirius convocou.")).toBeInTheDocument();
  });

  // Antes só havia uma etiqueta com o nome da Casa: dava para saber que existiam
  // quatro mil caracteres de privado e não dava para lê-los sem antes carregar
  // nos campos. Revisar exigia aceitar primeiro.
  it("mostra o texto privado de cada Casa, e não só o nome dela", async () => {
    await comRascunho({
      publicEvent: "evento", privateInfo: {}, note: "",
      resolution: {
        publicResult: "",
        houseResults: { "house-1": "A frota voltou inteira." },
        discoveries: [],
      },
    });
    expect(await screen.findByText("A frota voltou inteira.")).toBeInTheDocument();
  });
});
