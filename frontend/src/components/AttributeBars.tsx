import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ATTRIBUTE_KEYS, houseProfileFor, type AttributeKey, type Attributes, type HouseProfile } from "@ravenloft/content";
import { ATTRIBUTE_LABELS } from "../attributeLabels";

/** Qual linha do perfil explica cada atributo. */
const CAMPO_DO_ATRIBUTO: Record<AttributeKey, keyof HouseProfile> = {
  riqueza: "wealth",
  recursos: "resources",
  soldados: "soldiers",
  controle: "control",
};

/**
 * As barras dos quatro atributos e, quando a Casa é conhecida, o que cada
 * número significa para ela.
 *
 * O número sozinho não serve para negociar: Riqueza 4 em ouro vivo e Riqueza 4
 * em favores devidos levam a mesas completamente diferentes, e uma delas não
 * compra mantimento no inverno.
 */
export function AttributeBars({ attributes, seatKey }: { attributes: Attributes; seatKey?: string | null }) {
  const profile = seatKey ? houseProfileFor(seatKey) : null;

  return (
    // Com a página ocupando a tela inteira, uma barra sem teto atravessa mil e
    // setecentos pixels e vira um traço: o comprimento deixa de comunicar
    // proporção. A medida fica onde o olho ainda compara os quatro valores.
    <Stack spacing={profile ? 2 : 1.5} sx={{ maxWidth: 720 }}>
      {ATTRIBUTE_KEYS.map((key) => (
        <Box key={key}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography sx={{ width: 96 }} variant="body2">
              {ATTRIBUTE_LABELS[key]}
            </Typography>
            <LinearProgress
              aria-label={ATTRIBUTE_LABELS[key]}
              variant="determinate"
              value={(attributes[key] / 5) * 100}
              sx={{ flexGrow: 1, height: 8, borderRadius: 999 }}
            />
            <Typography sx={{ width: 24, textAlign: "right" }} variant="body2">
              {attributes[key]}
            </Typography>
          </Stack>
          {profile && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5, ml: { xs: 0, sm: "112px" } }}
            >
              {profile[CAMPO_DO_ATRIBUTO[key]]}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}
