import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "../../types/api";
import { useEnergiaAutoSave } from "./useEnergiaAutoSave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useEnergiaAutoSave", () => {
  it("atualiza na hora e grava uma vez só depois da pausa, juntando toques", async () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 0 }, gravar }));
    act(() => { result.current.mudar("a", 1); result.current.mudar("a", 1); });
    expect(result.current.energia.a).toBe(2);
    expect(gravar).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(gravar).toHaveBeenCalledWith({ a: 2 });
  });

  // Review Focus 1: a aba Espiões só mexe numa carta, mas grava o mapa inteiro.
  it("grava o mapa inteiro, preservando as cartas que não foram tocadas", async () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useEnergiaAutoSave({ gravado: { obra: 2, espiao: 0 }, gravar }));
    act(() => result.current.mudar("espiao", 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(gravar).toHaveBeenCalledWith({ obra: 2, espiao: 1 });
  });

  it("nunca fica negativo", () => {
    const { result } = renderHook(() => useEnergiaAutoSave({ gravado: {}, gravar: vi.fn() }));
    act(() => result.current.mudar("a", -1));
    expect(result.current.energia.a ?? 0).toBe(0);
  });

  // Review Focus 3: turno trancado.
  it("se a gravação falha, volta ao último valor gravado e mostra o motivo", async () => {
    const gravar = vi.fn().mockRejectedValue(new ApiError("TURN_LOCKED", "O turno não está aberto para distribuir Energia."));
    const { result } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 1 }, gravar }));
    act(() => result.current.mudar("a", 1));
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(result.current.energia.a).toBe(1);
    expect(result.current.erro).toMatch(/turno não está aberto/);
  });

  // Review Focus 2: tocou e saiu antes da pausa.
  it("grava o que estava pendente ao desmontar", () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 0 }, gravar }));
    act(() => result.current.mudar("a", 1));
    unmount();
    expect(gravar).toHaveBeenCalledWith({ a: 1 });
  });

  it("acompanha o servidor quando não há nada pendente", () => {
    const gravar = vi.fn();
    const { result, rerender } = renderHook((p: { gravado: Record<string, number> }) => useEnergiaAutoSave({ gravado: p.gravado, gravar }), {
      initialProps: { gravado: { a: 0 } },
    });
    rerender({ gravado: { a: 2 } });
    expect(result.current.energia.a).toBe(2);
  });
});
