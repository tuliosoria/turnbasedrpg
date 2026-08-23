import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import { MockApiClient } from "../../api/mockClient";
import { AdminCorrespondenceTab } from "./AdminCorrespondenceTab";

async function setup(client: MockApiClient) {
  const { adminToken } = await client.adminLogin("code");
  await act(async () => {
    render(
      <ApiProvider client={client}>
        <AdminCorrespondenceTab adminToken={adminToken} />
      </ApiProvider>,
    );
  });
}

describe("AdminCorrespondenceTab", () => {
  it("avisa quando ainda não houve correspondência", async () => {
    await setup(new MockApiClient());
    expect(await screen.findByText(/Nenhuma carta foi enviada ainda/)).toBeInTheDocument();
  });

  // O Mestre precisa ler os dois lados: o que a Casa pediu e o que lhe responderam.
  it("mostra a carta do jogador e a resposta da Casa", async () => {
    const client = new MockApiClient();
    const account = await client.createAccountAndHouse({
      name: "Solarion", motto: "O Sol jamais se curva!",
      emblem: { icon: "chama", color1: "#7f1d1d", color2: "#3f3f46" },
      castleName: "Sahra-Lun", townsText: "Oásis.", historyText: "Estudiosos.",
      specialty: "Astronomia", weakness: "Orgulho",
      attributes: { riqueza: 4, recursos: 3, soldados: 1, controle: 2 },
    } as never);
    await client.sendCorrespondence(account.playerToken, {
      toHouseKey: "casa-karasoy",
      body: "Propomos uma aliança contra o inverno.",
    });

    await setup(client);

    expect(await screen.findByText("Propomos uma aliança contra o inverno.")).toBeInTheDocument();
    // Cabeçalho do fio: quem escreveu para quem.
    expect(screen.getByText(/→ Casa Karasoy/)).toBeInTheDocument();
    // Os rótulos dizem quem falou, para o Mestre não confundir jogador com IA.
    expect(screen.getByText(/escreveu$/)).toBeInTheDocument();
    expect(screen.getByText(/respondeu$/)).toBeInTheDocument();
  });
});
