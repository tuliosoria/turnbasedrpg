import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "../../types/api";
import { useEnergiaAutoSave, aguardarGravacaoDeEnergia } from "./useEnergiaAutoSave";

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
  it("grava o que estava pendente ao desmontar", async () => {
    const gravar = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 0 }, gravar }));
    act(() => result.current.mudar("a", 1));
    unmount();
    // Vai pela fila (assíncrona), para a aba nova esperar por ela antes de ler.
    await aguardarGravacaoDeEnergia();
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

  // Revisão final, Importante 2: uma recarga que lê antes da gravação chegar
  // trazia o mapa velho, a tela o adotava, e o próximo toque apagava Energia.
  describe("com gravação em voo", () => {
    function adiada() {
      let resolver!: () => void; let rejeitar!: (e: unknown) => void;
      const promessa = new Promise<void>((res, rej) => { resolver = res; rejeitar = rej; });
      return { promessa, resolver, rejeitar };
    }

    it("ignora o mapa velho do servidor enquanto a gravação não chega", async () => {
      const voo = adiada();
      const gravar = vi.fn().mockReturnValue(voo.promessa);
      const { result, rerender } = renderHook((p: { gravado: Record<string, number> }) => useEnergiaAutoSave({ gravado: p.gravado, gravar }), {
        initialProps: { gravado: { a: 0 } as Record<string, number> },
      });
      act(() => result.current.mudar("a", 1));
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      expect(gravar).toHaveBeenCalledTimes(1);
      rerender({ gravado: { a: 0, b: 0 } }); // recarga que leu antes do PUT
      expect(result.current.energia.a).toBe(1);
      await act(async () => { voo.resolver(); await voo.promessa; });
      expect(result.current.energia.a).toBe(1);
    });

    it("aguardarGravacaoDeEnergia só resolve depois que a gravação chega", async () => {
      const voo = adiada();
      const { result } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 0 }, gravar: vi.fn().mockReturnValue(voo.promessa) }));
      act(() => result.current.mudar("a", 1));
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      let pronto = false;
      void aguardarGravacaoDeEnergia().then(() => { pronto = true; });
      await act(async () => { await Promise.resolve(); });
      expect(pronto).toBe(false);
      await act(async () => { voo.resolver(); await voo.promessa; await Promise.resolve(); await Promise.resolve(); });
      expect(pronto).toBe(true);
    });

    it("grava em fila: a segunda só sai depois da primeira", async () => {
      const voo = adiada();
      const gravar = vi.fn().mockReturnValueOnce(voo.promessa).mockResolvedValue(undefined);
      const { result } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 0 }, gravar }));
      act(() => result.current.mudar("a", 1));
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      act(() => result.current.mudar("a", 1));
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      expect(gravar).toHaveBeenCalledTimes(1);
      await act(async () => { voo.resolver(); await voo.promessa; await Promise.resolve(); await Promise.resolve(); });
      expect(gravar).toHaveBeenCalledTimes(2);
      expect(gravar).toHaveBeenLastCalledWith({ a: 2 });
    });

    it("a falha de uma gravação antiga não desfaz um toque mais novo", async () => {
      const voo = adiada();
      const gravar = vi.fn().mockReturnValueOnce(voo.promessa).mockResolvedValue(undefined);
      const { result } = renderHook(() => useEnergiaAutoSave({ gravado: { a: 0 }, gravar }));
      act(() => result.current.mudar("a", 1));
      await act(async () => { await vi.advanceTimersByTimeAsync(400); });
      act(() => result.current.mudar("a", 1)); // toque novo, ainda na pausa
      await act(async () => { voo.rejeitar(new Error("rede")); await voo.promessa.catch(() => {}); });
      expect(result.current.energia.a).toBe(2);
    });
  });
});
