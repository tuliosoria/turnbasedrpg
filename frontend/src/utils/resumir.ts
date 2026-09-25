/**
 * Encurta um texto para prévia sem cortar palavra no meio.
 *
 * O `slice(0, 160)` cru deixava "Khar-D" e frases que paravam no meio sem
 * sinal nenhum de que continuavam — quem lia achava que o texto estava
 * quebrado, e não resumido.
 */
export function resumir(texto: string, max = 160): string {
  const limpo = texto.trim();
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max);
  const ultimoEspaco = corte.search(/\s\S*$/);
  const base = ultimoEspaco > max * 0.6 ? corte.slice(0, ultimoEspaco) : corte;
  return `${base.replace(/[\s,;:.—-]+$/, "")}…`;
}
