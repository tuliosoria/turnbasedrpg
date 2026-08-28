import { Children, type ReactNode } from "react";
import Link from "@mui/material/Link";
import { Link as RouterLink } from "react-router-dom";
import { detectorDoCanone } from "../lore/detector";

/**
 * Um nome no meio da prosa não pode se vestir de botão.
 *
 * A tinta carmesim dos links serve para "clique aqui"; num parágrafo do Mestre
 * com quatro pessoas citadas ela vira pisca-pisca e o texto para de se ler. O
 * sublinhado pontilhado diz "isto leva a algum lugar" sem tirar o nome de
 * dentro da frase, e a cor só aparece quando o leitor passa por cima.
 */
const ESTILO = {
  color: "inherit",
  textDecoration: "underline dotted",
  textDecorationThickness: "1px",
  textUnderlineOffset: "0.2em",
  textDecorationColor: "text.disabled",
  "&:hover": { color: "primary.main", textDecorationColor: "primary.main" },
} as const;

export interface TextoComPessoasProps {
  texto: string;
  /**
   * Quem já virou link neste bloco. Compartilhe entre as partes de um mesmo
   * parágrafo para que um trecho em negrito no meio não reabra o nome.
   */
  vistos?: Set<string>;
}

/**
 * O texto como está, com o nome de quem tem ficha virando link.
 *
 * Nasceu de uma pergunta simples — "eu não lembrava quem era Dama Elara" — e
 * responde onde ela aparece: no meio da carta, sem obrigar ninguém a abrir a
 * lista de personagens em outra aba e procurar pelo nome.
 *
 * Nada aqui reescreve o texto. Os trechos somados devolvem exatamente a mesma
 * string que entrou; a única coisa que muda é o que envolve alguns pedaços.
 */
export function TextoComPessoas({ texto, vistos }: TextoComPessoasProps) {
  const marcados = vistos ?? new Set<string>();
  const partes = detectorDoCanone().trechos(texto);

  return (
    <>
      {partes.map((p, i) => {
        if (p.tipo === "texto" || marcados.has(p.id)) return p.valor;
        marcados.add(p.id);
        return (
          <Link
            key={`${p.id}-${i}`}
            component={RouterLink}
            // O sublinhado é todo do `sx`; o do MUI competiria com ele.
            underline="none"
            to={`/personagens/${p.id}`}
            title={`Quem é ${p.valor}?`}
            sx={ESTILO}
          >
            {p.valor}
          </Link>
        );
      })}
    </>
  );
}

/**
 * Aplica o mesmo tratamento aos filhos de um bloco já renderizado.
 *
 * Serve ao markdown, onde um parágrafo chega quebrado em pedaços: texto cru,
 * um <strong>, mais texto. Só os pedaços de texto cru passam pelo detector —
 * o que já é link continua sendo o link que o autor escreveu.
 */
export function comPessoas(children: ReactNode): ReactNode {
  const vistos = new Set<string>();
  return Children.map(children, (filho) =>
    typeof filho === "string" ? <TextoComPessoas texto={filho} vistos={vistos} /> : filho,
  );
}
