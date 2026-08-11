import { useEffect, useRef, useState } from "react";
import { useApi } from "../../api/ApiProvider";
import type { VisualGeneration } from "@ravenloft/content";

const TERMINAL: VisualGeneration["status"][] = ["COMPLETED", "NEEDS_REVIEW", "FAILED"];
const TIMEOUT_MS = 5 * 60 * 1000;

export interface GenerationPollingState {
  generation: VisualGeneration | null;
  loading: boolean;
  error: string | null;
}

export function useGenerationPolling(generationId: string | null, intervalMs = 3000): GenerationPollingState {
  const api = useApi();
  const [generation, setGeneration] = useState<VisualGeneration | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!generationId) {
      setGeneration(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    setError(null);
    setGeneration(null);
    startRef.current = Date.now();

    const tick = async () => {
      try {
        const gen = await api.getVisualGeneration(generationId);
        if (cancelled) return;
        setGeneration(gen);
        if (TERMINAL.includes(gen.status)) {
          setLoading(false);
          return;
        }
        if (Date.now() - startRef.current > TIMEOUT_MS) {
          setError("A geração está demorando mais que o esperado. Recarregue para verificar.");
          setLoading(false);
          return;
        }
        timer = setTimeout(tick, intervalMs);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Falha ao consultar a geração.");
        setLoading(false);
      }
    };
    void tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, generationId, intervalMs]);

  return { generation, loading, error };
}
