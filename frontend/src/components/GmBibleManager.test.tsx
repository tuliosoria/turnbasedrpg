import { describe, it, expect } from "vitest";
import { act } from "react";
import { render, screen } from "@testing-library/react";
import { ApiProvider } from "../api/ApiProvider";
import { MockApiClient } from "../api/mockClient";
import { GmBibleManager } from "./GmBibleManager";

describe("GmBibleManager", () => {
  it("não oferece semear quando a lista não carrega", async () => {
    const client = new MockApiClient();
    const { adminToken } = await client.adminLogin("qualquer");
    client.adminListGm = async () => {
      throw new Error("rede");
    };
    await act(async () => {
      render(
        <ApiProvider client={client}>
          <GmBibleManager token={adminToken} />
        </ApiProvider>,
      );
    });
    expect(await screen.findByText("Não foi possível carregar a Bíblia do Mestre.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Carregar Bíblia do Mestre/i })).toBeNull();
  });
});
