import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../types/api";

/**
 * Uma fila só para as gravações de Energia, compartilhada pelos painéis de
 * Projetos e de Espiões. Sem ela, um toque numa aba e a troca para a outra
 * faziam o GET da aba nova correr junto com o PUT da antiga: se o GET lia
 * primeiro, a tela adotava o mapa velho e o próximo toque apagava Energia.
 */
let fila: Promise<void> = Promise.resolve();

function enfileirar(tarefa: () => Promise<unknown>): Promise<void> {
  const proxima = fila.then(tarefa).then(() => undefined);
  fila = proxima.catch(() => undefined);
  return proxima;
}

/** Resolve quando toda gravação de Energia já enviada chegou ao servidor. */
export function aguardarGravacaoDeEnergia(): Promise<void> {
  return fila;
}

/**
 * Energia gravada a cada toque, sem botão "Distribuir".
 *
 * O botão fazia o jogador perder a escolha sem perceber quando esquecia de
 * apertar. Aqui a tela muda na hora e a gravação sai depois de uma pausa,
 * sempre com o mapa INTEIRO da Casa: a aba Espiões mostra uma categoria só, e
 * gravar só o recorte apagaria a Energia das obras.
 */
export function useEnergiaAutoSave(opts: {
  gravado: Record<string, number>;
  gravar: (porProjeto: Record<string, number>) => Promise<unknown>;
  atrasoMs?: number;
}): { energia: Record<string, number>; mudar: (projectId: string, delta: 1 | -1) => void; erro: string | null } {
  const { gravado, gravar, atrasoMs = 400 } = opts;
  const [energia, setEnergia] = useState<Record<string, number>>(gravado);
  const [erro, setErro] = useState<string | null>(null);
  const confirmado = useRef(gravado);
  const pendente = useRef<Record<string, number> | null>(null);
  const voando = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gravarRef = useRef(gravar);
  gravarRef.current = gravar;

  // O servidor é a verdade quando não há toque esperando nem gravação no ar:
  // uma recarga que leu antes de o PUT chegar traz o mapa velho, e adotá-lo
  // faria o próximo toque apagar Energia.
  //
  // Compara pelo conteúdo, não pela identidade: um chamador que passe um
  // objeto novo a cada render (sem useMemo) faria este efeito disparar,
  // mudar o estado e renderizar de novo, sem fim.
  const chave = JSON.stringify(Object.entries(gravado).sort(([a], [b]) => a.localeCompare(b)));
  const gravadoRef = useRef(gravado);
  gravadoRef.current = gravado;
  useEffect(() => {
    if (pendente.current || voando.current > 0) return;
    confirmado.current = gravadoRef.current;
    setEnergia(gravadoRef.current);
  }, [chave]);

  const enviar = useCallback(() => {
    const mapa = pendente.current;
    pendente.current = null;
    timer.current = null;
    if (!mapa) return;
    voando.current += 1;
    void enfileirar(() => gravarRef.current(mapa))
      .then(
        () => {
          confirmado.current = mapa;
          setErro(null);
        },
        (e) => {
          // Só volta a tela se esta era a última escolha: um toque mais novo,
          // esperando ou no ar, ainda vai gravar o que o jogador vê.
          if (!pendente.current && voando.current === 1) setEnergia(confirmado.current);
          setErro(e instanceof ApiError ? e.message : "Não foi possível gravar a Energia.");
        },
      )
      .finally(() => {
        voando.current -= 1;
      });
  }, []);

  const mudar = useCallback((projectId: string, delta: 1 | -1) => {
    setEnergia((atual) => {
      const proximo = { ...atual, [projectId]: Math.max(0, (atual[projectId] ?? 0) + delta) };
      pendente.current = proximo;
      return proximo;
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(enviar, atrasoMs);
  }, [atrasoMs, enviar]);

  // Tocou e trocou de aba antes da pausa: a escolha não pode se perder. Vai
  // pela mesma fila, para a aba nova esperar por ela antes de ler.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    const mapa = pendente.current;
    if (mapa) void enfileirar(() => gravarRef.current(mapa)).catch(() => undefined);
  }, []);

  return { energia, mudar, erro };
}
