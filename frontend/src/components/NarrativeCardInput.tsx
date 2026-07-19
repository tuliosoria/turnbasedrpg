import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Attributes, CardResponse, NarrativeCard } from "@ravenloft/content";

export function NarrativeCardInput({
  card,
  houseAttributes,
  value,
  onChange,
  disabled = false,
}: {
  card: NarrativeCard;
  houseAttributes: Attributes;
  value: CardResponse;
  onChange: (cr: CardResponse) => void;
  disabled?: boolean;
}) {
  const spendMax = card.spend ? Math.min(card.spend.max, houseAttributes[card.spend.attribute]) : 0;
  const spendAmount = Math.min(value.declaredSpend?.amount ?? 0, spendMax);

  function emitSpend(amount: number) {
    if (!card.spend) return;
    onChange({
      ...value,
      cardId: card.id,
      declaredSpend: { attribute: card.spend.attribute, amount },
    });
  }

  return (
    <Card component="section">
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ color: "secondary.main" }}>
              {card.constraintText}
            </Typography>
            <Typography variant="h3" gutterBottom>
              {card.title}
            </Typography>
            <Typography>{card.narrativeQuestion}</Typography>
            <Typography sx={{ color: "text.secondary", mt: 1 }}>{card.consequenceText}</Typography>
          </Box>

          {card.spend && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography sx={{ flexGrow: 1 }}>
                Gastar até {spendMax} de {card.spend.attribute}
              </Typography>
              <IconButton
                aria-label="Diminuir gasto"
                disabled={disabled || spendAmount <= 0}
                onClick={() => emitSpend(spendAmount - 1)}
                size="small"
              >
                −
              </IconButton>
              <Typography sx={{ minWidth: 24, textAlign: "center" }}>{spendAmount}</Typography>
              <IconButton
                aria-label="Aumentar gasto"
                disabled={disabled || spendAmount >= spendMax}
                onClick={() => emitSpend(spendAmount + 1)}
                size="small"
              >
                +
              </IconButton>
            </Stack>
          )}

          {card.choice && (
            <FormControl disabled={disabled}>
              <FormLabel>Escolha um atributo</FormLabel>
              <RadioGroup
                value={value.declaredChoice?.attribute ?? ""}
                onChange={(event) =>
                  onChange({
                    ...value,
                    cardId: card.id,
                    declaredChoice: { attribute: event.target.value as typeof card.choice.attributes[number] },
                  })
                }
              >
                {card.choice.attributes.map((attribute) => (
                  <FormControlLabel key={attribute} value={attribute} control={<Radio />} label={attribute} />
                ))}
              </RadioGroup>
            </FormControl>
          )}

          <TextField
            label="Resposta narrativa"
            value={value.text}
            onChange={(event) => onChange({ ...value, cardId: card.id, text: event.target.value })}
            disabled={disabled}
            multiline
            minRows={3}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
