import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { EscribaTab } from "./EscribaTab";
import { saveAdminToken, clearAdminToken } from "../../auth/adminSession";

const TOKEN = "mock-admin-token";

const casas = [
  { houseId: "vargen-x1", name: "Casa Vargen" },
  { houseId: "solarion-k0", name: "Casa Solarion" },
];

async function setup(client = new MockApiClient()) {
  saveAdminToken(TOKEN);
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <EscribaTab casas={casas} />
      </ApiProvider>,
    );
  });
  return client;
}

afterEach(() => clearAdminToken());

async function preencher(campo: RegExp, valor: string) {
  const input = screen.getByLabelText(campo);
  await userEvent.clear(input);
  await userEvent.type(input, valor);
}

describe("EscribaTab", () => {
  /**
   * O modo manual é o coração da ferramenta: quem quiser escrever sem IA
   * simplesmente não aperta o botão da prévia. Publicar tem que funcionar com
   * os campos preenchidos à mão e nenhuma chamada de IA.
   */
  it("publica sem passar pela IA", async () => {
    const client = await setup();
    const preview = vi.spyOn(client, "escribaPreview");
    const publicar = vi.spyOn(client, "escribaPublicar");

    await preencher(/Título/, "Sera de Vargen");
    await preencher(/Nome canônico/, "Sera de Vargen");
    await preencher(/Texto do verbete/, "Batedora das fronteiras.");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /Publicar no cânone/ }));
    });

    expect(preview).not.toHaveBeenCalled();
    expect(publicar).toHaveBeenCalledTimes(1);
    expect(publicar.mock.calls[0][1].proposal.title).toBe("Sera de Vargen");
  });

  it("a prévia da IA preenche os campos", async () => {
    await setup();

    await preencher(/O que você quer tornar canônico/, "Uma batedora chamada Sera.");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /Consultar o Escriba/ }));
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Título/)).toHaveValue("Uma batedora chamada Sera.");
    });
    expect((screen.getByLabelText(/Texto do verbete/) as HTMLTextAreaElement).value).toContain(
      "Uma batedora chamada Sera.",
    );
  });

  it("não publica sem título nem corpo", async () => {
    const client = await setup();
    const publicar = vi.spyOn(client, "escribaPublicar");

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /Publicar no cânone/ }));
    });

    expect(publicar).not.toHaveBeenCalled();
    expect(screen.getByText(/Título e texto do verbete são obrigatórios/)).toBeTruthy();
  });

  it("manda a Casa escolhida, e null quando nenhuma", async () => {
    const client = await setup();
    const publicar = vi.spyOn(client, "escribaPublicar");

    await preencher(/Título/, "O Farol Quebrado");
    await preencher(/Texto do verbete/, "Fica na ponta norte.");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /Publicar no cânone/ }));
    });

    expect(publicar.mock.calls[0][1].houseId).toBeNull();
  });

  it("depois de publicar, oferece o verbete criado", async () => {
    await setup();

    await preencher(/Título/, "Sera de Vargen");
    await preencher(/Texto do verbete/, "Batedora das fronteiras.");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /Publicar no cânone/ }));
    });

    await waitFor(() => {
      expect(screen.getByText(/publicado no cânone/i)).toBeTruthy();
    });
  });

  /**
   * O conserto de um verbete órfão já existe no Acervo. A tela precisa dizer
   * isso em vez de mostrar um erro cru, senão o Mestre republica e duplica.
   */
  it("uma falha parcial explica onde consertar", async () => {
    const client = await setup();
    vi.spyOn(client, "escribaPublicar").mockRejectedValue(
      new Error("O verbete foi gravado, mas a entidade não. (verbete wiki07)"),
    );

    await preencher(/Título/, "Sera de Vargen");
    await preencher(/Texto do verbete/, "Batedora das fronteiras.");
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /Publicar no cânone/ }));
    });

    await waitFor(() => {
      expect(screen.getByText(/wiki07/)).toBeTruthy();
    });
  });
});
