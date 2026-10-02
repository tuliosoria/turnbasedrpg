import { describe, it, expect, vi } from "vitest";
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

  // A rota devolve CampaignFact (summary, status). `text` não existe, e o
  // bloco saía "Turno N:" com a frase vazia, inclusive fato revogado.
  it("mostra o resumo e o estado dos fatos", async () => {
    const client = new MockApiClient();
    vi.spyOn(client, "adminGetCorrespondence").mockResolvedValue({
      turnNumber: 3,
      threads: [],
      facts: [
        {
          id: "f1",
          campaignId: "c",
          turnNumber: 3,
          kind: "PROMESSA",
          betweenA: "solarion-k0hc",
          betweenB: "casa-karasoy",
          summary: "Solarion promete trigo até o degelo.",
          sourceMessageId: "m1",
          status: "ATIVO",
          createdAt: "2026-09-01T00:00:00.000Z",
        },
        {
          id: "f2",
          campaignId: "c",
          turnNumber: 2,
          kind: "AMEACA",
          betweenA: "khazdrun-wxey",
          betweenB: "casa-drakorys",
          summary: "Khazdrun ameaçou fechar a estrada.",
          sourceMessageId: "m2",
          status: "REVOGADO",
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    await setup(client);
    expect(await screen.findByText(/Solarion promete trigo até o degelo/)).toBeInTheDocument();
    expect(screen.getByText(/Turno 3 \(ativo\)/)).toBeInTheDocument();
    expect(screen.getByText(/Khazdrun ameaçou fechar a estrada/)).toBeInTheDocument();
    expect(screen.getByText(/Turno 2 \(revogado\)/)).toBeInTheDocument();
  });
});
