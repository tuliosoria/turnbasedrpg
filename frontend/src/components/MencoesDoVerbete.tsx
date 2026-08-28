import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { SEATS, fullCodex, type Mencoes } from "@ravenloft/content";

/**
 * Quantos links cabem antes de o painel deixar de ser navegação.
 *
 * O verbete "Os Vinte e Sete Magos da Ordem dos Três" cita onze pessoas, e a
 * seção "casas" inteira cita setenta. Uma parede de etiquetas não ajuda quem
 * está tentando escolher para onde ir.
 */
const TETO = 8;

interface Destino {
  chave: string;
  nome: string;
  para: string;
}

function Lista({ titulo, destinos, indice }: { titulo: string; destinos: Destino[]; indice: string }) {
  if (destinos.length === 0) return null;
  const mostrados = destinos.slice(0, TETO);
  const excedente = destinos.length - mostrados.length;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {titulo}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
        {mostrados.map((d) => (
          <Chip
            key={d.chave}
            size="small"
            variant="outlined"
            clickable
            component={RouterLink}
            to={d.para}
            label={d.nome}
          />
        ))}
        {excedente > 0 && (
          <Link component={RouterLink} to={indice} variant="caption" sx={{ alignSelf: "center" }}>
            e mais {excedente}
          </Link>
        )}
      </Box>
    </Box>
  );
}

/**
 * Quem é citado neste verbete, com o caminho até a página de cada um.
 *
 * Este painel é índice: mostra o elenco do verbete de uma olhada, e inclui as
 * Casas, que o texto corrido não linka. O nome dentro do parágrafo também virou
 * link ([[TextoComPessoas]]), e a repetição é intencional — quem quer saber
 * "quem aparece aqui?" olha o rodapé; quem travou no meio de uma frase clica
 * ali mesmo.
 *
 * A ressalva antiga continua valendo: a detecção é boa, não é perfeita. Ela é
 * conservadora de propósito — só nome próprio, nunca sobrenome, e nada que o
 * cânone escreva em minúscula. Link ausente é oportunidade perdida; link errado
 * é afirmação falsa no meio da prosa do Mestre.
 */
export function MencoesDoVerbete({ mencoes }: { mencoes: Mencoes }) {
  const casas: Destino[] = mencoes.casas.flatMap((chave) => {
    const seat = SEATS.find((s) => s.key === chave);
    return seat ? [{ chave, nome: seat.name, para: `/casa/${chave}` }] : [];
  });
  const elenco = fullCodex();
  const personagens: Destino[] = mencoes.personagens.flatMap((id) => {
    const npc = elenco.find((n) => n.id === id);
    return npc ? [{ chave: id, nome: npc.name, para: `/personagens/${id}` }] : [];
  });

  if (casas.length === 0 && personagens.length === 0) return null;

  return (
    <Stack spacing={1.5} sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: "divider" }}>
      <Typography variant="subtitle2" fontWeight="bold">
        Neste verbete
      </Typography>
      <Lista titulo="Casas citadas" destinos={casas} indice="/casas" />
      <Lista titulo="Quem aparece" destinos={personagens} indice="/personagens" />
    </Stack>
  );
}
