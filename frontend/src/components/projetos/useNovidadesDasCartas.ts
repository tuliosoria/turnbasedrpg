import { useCallback, useEffect, useState } from "react";
import type { ProjectCard } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import { cartasParaRevelar, EVENTO_REVELACAO, lerVistoEm } from "./previa";

/**
 * Quantas cartas resolvidas cada aba ainda não revelou. O jogador costuma
 * abrir /game na aba Turnos; sem o selo, a revelação ficaria escondida.
 */
export function useNovidadesDasCartas(playerToken: string | null, houseId: string | null): { projetos: number; espioes: number } {
  const api = useApi();
  const [cartas, setCartas] = useState<ProjectCard[]>([]);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!playerToken) return;
    let vivo = true;
    api.getProjects(playerToken).then((v) => { if (vivo) setCartas(v.projects); }).catch(() => {});
    return () => { vivo = false; };
  }, [api, playerToken]);

  const reler = useCallback(() => setVersao((n) => n + 1), []);
  useEffect(() => {
    window.addEventListener(EVENTO_REVELACAO, reler);
    return () => window.removeEventListener(EVENTO_REVELACAO, reler);
  }, [reler]);

  if (!playerToken || !houseId) return { projetos: 0, espioes: 0 };
  void versao;
  const novas = cartasParaRevelar(cartas, lerVistoEm(houseId));
  return {
    projetos: novas.filter((c) => c.category !== "INTELLIGENCE").length,
    espioes: novas.filter((c) => c.category === "INTELLIGENCE").length,
  };
}
