import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiProvider } from "../../api/ApiProvider";
import type { ApiClient } from "../../api/client";
import { gravarVistoEm } from "./previa";
import { useNovidadesDasCartas } from "./useNovidadesDasCartas";

const quando = "2026-09-23T14:06:03.000Z";
const projetos = [
  { id: "a", status: "COMPLETED", category: "ECONOMY", resolvedAt: quando },
  { id: "b", status: "FAILED", category: "INTELLIGENCE", resolvedAt: quando },
  { id: "c", status: "ACTIVE", category: "ECONOMY", resolvedAt: null },
];
const api = { getProjects: vi.fn().mockResolvedValue({ projects: projetos }) } as unknown as ApiClient;
const wrapper = ({ children }: { children: ReactNode }) => createElement(ApiProvider, { client: api, children });

beforeEach(() => localStorage.clear());

describe("useNovidadesDasCartas", () => {
  it("conta por aba e zera depois de visto", async () => {
    const { result } = renderHook(() => useNovidadesDasCartas("tok", "casa-x"), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ projetos: 1, espioes: 1 }));
    act(() => { gravarVistoEm("casa-x", "projetos", quando); gravarVistoEm("casa-x", "espioes", quando); });
    await waitFor(() => expect(result.current).toEqual({ projetos: 0, espioes: 0 }));
  });

  // Revisão final: cartas do mesmo fechamento saem segundos umas das outras.
  // Com um "visto" só por Casa, fechar a revelação de Projetos (obra às :05)
  // escondia para sempre a rede de espiões (às :02).
  it("ver a revelação de Projetos não esconde a de Espiões", async () => {
    const api2 = { getProjects: vi.fn().mockResolvedValue({ projects: [
      { id: "obra", status: "COMPLETED", category: "ECONOMY", resolvedAt: "2026-09-23T12:00:05.000Z" },
      { id: "rede", status: "COMPLETED", category: "INTELLIGENCE", resolvedAt: "2026-09-23T12:00:02.000Z" },
    ] }) } as unknown as ApiClient;
    const w2 = ({ children }: { children: ReactNode }) => createElement(ApiProvider, { client: api2, children });
    const { result } = renderHook(() => useNovidadesDasCartas("tok", "casa-y"), { wrapper: w2 });
    await waitFor(() => expect(result.current).toEqual({ projetos: 1, espioes: 1 }));
    act(() => gravarVistoEm("casa-y", "projetos", "2026-09-23T12:00:05.000Z"));
    await waitFor(() => expect(result.current).toEqual({ projetos: 0, espioes: 1 }));
  });

  it("sem sessão, zero e nenhuma chamada", () => {
    const { result } = renderHook(() => useNovidadesDasCartas(null, null), { wrapper });
    expect(result.current).toEqual({ projetos: 0, espioes: 0 });
  });
});
