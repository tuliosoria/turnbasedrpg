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
    act(() => gravarVistoEm("casa-x", quando));
    await waitFor(() => expect(result.current).toEqual({ projetos: 0, espioes: 0 }));
  });

  it("sem sessão, zero e nenhuma chamada", () => {
    const { result } = renderHook(() => useNovidadesDasCartas(null, null), { wrapper });
    expect(result.current).toEqual({ projetos: 0, espioes: 0 });
  });
});
