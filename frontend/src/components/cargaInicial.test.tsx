import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApiProvider } from "../api/ApiProvider";
import type { PactsView, SpyView } from "../api/client";
import type { ProjectsView } from "../types/api";
import { HouseProjectsPanel } from "./HouseProjectsPanel";
import { PactsPanel } from "./PactsPanel";
import { SpyPanel } from "./SpyPanel";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const spyVazio: SpyView = { tiers: [], operations: [] };
const pactosVazios: PactsView = { firmados: [], abertos: [], historico: [], favores: [], ativos: [] };
const projetosVazios = {
  templates: [],
  recommended: [],
  projects: [],
  favors: [],
  slotLimit: 3,
  stability: 0,
  attributes: { riqueza: 0, recursos: 0, soldados: 0, controle: 0 },
  energia: { total: 0, porProjeto: {}, tetoPorProjeto: {}, distribuiu: false },
} as ProjectsView;

describe("primeira carga dos painéis do jogador", () => {
  it("mostra o carregamento, o erro e a nova tentativa nos Espiões", async () => {
    const cargas = [deferred<SpyView>(), deferred<SpyView>()];
    let n = 0;
    render(
      <ApiProvider client={{ listSpyOps: () => cargas[n++].promise } as never}>
        <SpyPanel playerToken="t" />
      </ApiProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    cargas[0].reject(new Error("sem rede"));
    expect(await screen.findByRole("alert")).toHaveTextContent("sem rede");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    cargas[1].resolve(spyVazio);
    expect(await screen.findByRole("heading", { name: "Mandar alguém perguntar" })).toBeInTheDocument();
  });

  it("mostra o carregamento, o erro e a nova tentativa nos Pactos", async () => {
    const cargas = [deferred<PactsView>(), deferred<PactsView>()];
    let n = 0;
    render(
      <ApiProvider client={{ listPacts: () => cargas[n++].promise } as never}>
        <PactsPanel playerToken="t" />
      </ApiProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    cargas[0].reject(new Error("sem rede"));
    expect(await screen.findByRole("alert")).toHaveTextContent("sem rede");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    cargas[1].resolve(pactosVazios);
    expect(await screen.findByRole("heading", { name: "O que sua Casa firmou" })).toBeInTheDocument();
  });

  it("mostra o carregamento, o erro e a nova tentativa nos Projetos", async () => {
    const cargas = [deferred<ProjectsView>(), deferred<ProjectsView>()];
    let n = 0;
    render(
      <ApiProvider client={{ getProjects: () => cargas[n++].promise } as never}>
        <HouseProjectsPanel playerToken="t" onChanged={() => {}} />
      </ApiProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    cargas[0].reject(new Error("sem rede"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Erro ao carregar projetos.");

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(screen.getByRole("status")).toHaveTextContent("Carregando...");
    cargas[1].resolve(projetosVazios);
    expect(await screen.findByText("Projetos da Casa")).toBeInTheDocument();
  });
});
