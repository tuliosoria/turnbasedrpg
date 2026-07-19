import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ATTRIBUTE_KEYS, type AttributeKey, type NarrativeCard } from "@ravenloft/content";

type CardType = "none" | "spend" | "choice";

function cardType(card: NarrativeCard): CardType {
  if (card.spend) return "spend";
  if (card.choice) return "choice";
  return "none";
}

export function NarrativeCardEditor({
  card,
  onChange,
  onRemove,
}: {
  card: NarrativeCard;
  onChange: (c: NarrativeCard) => void;
  onRemove: () => void;
}) {
  function update(patch: Partial<NarrativeCard>) {
    onChange({ ...card, ...patch });
  }

  function changeType(nextType: CardType) {
    if (nextType === "spend") {
      onChange({
        ...card,
        spend: card.spend ?? { attribute: ATTRIBUTE_KEYS[0], max: 1 },
        choice: undefined,
      });
      return;
    }
    if (nextType === "choice") {
      onChange({
        ...card,
        spend: undefined,
        choice: card.choice ?? { attributes: [ATTRIBUTE_KEYS[0]], amount: 1 },
      });
      return;
    }
    onChange({ ...card, spend: undefined, choice: undefined });
  }

  function updateSpend(patch: Partial<NonNullable<NarrativeCard["spend"]>>) {
    onChange({
      ...card,
      choice: undefined,
      spend: { attribute: card.spend?.attribute ?? ATTRIBUTE_KEYS[0], max: card.spend?.max ?? 1, ...patch },
    });
  }

  function updateChoice(patch: Partial<NonNullable<NarrativeCard["choice"]>>) {
    onChange({
      ...card,
      spend: undefined,
      choice: { attributes: card.choice?.attributes ?? [ATTRIBUTE_KEYS[0]], amount: card.choice?.amount ?? 1, ...patch },
    });
  }

  return (
    <Card component="section">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h3">Carta narrativa</Typography>
          <TextField label="Título" value={card.title} onChange={(event) => update({ title: event.target.value })} />
          <TextField
            label="O que permite"
            value={card.constraintText}
            onChange={(event) => update({ constraintText: event.target.value })}
            multiline
            minRows={2}
          />
          <TextField
            label="Pergunta narrativa"
            value={card.narrativeQuestion}
            onChange={(event) => update({ narrativeQuestion: event.target.value })}
            multiline
            minRows={2}
          />
          <TextField
            label="Consequência"
            value={card.consequenceText}
            onChange={(event) => update({ consequenceText: event.target.value })}
            multiline
            minRows={2}
          />

          <FormControl fullWidth>
            <InputLabel id={`${card.id}-type-label`}>Tipo da carta</InputLabel>
            <Select
              labelId={`${card.id}-type-label`}
              label="Tipo da carta"
              value={cardType(card)}
              onChange={(event: SelectChangeEvent) => changeType(event.target.value as CardType)}
            >
              <MenuItem value="none">Nenhum</MenuItem>
              <MenuItem value="spend">Gasto</MenuItem>
              <MenuItem value="choice">Escolha</MenuItem>
            </Select>
          </FormControl>

          {card.spend && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id={`${card.id}-spend-attribute-label`}>Atributo de gasto</InputLabel>
                <Select
                  labelId={`${card.id}-spend-attribute-label`}
                  label="Atributo de gasto"
                  value={card.spend.attribute}
                  onChange={(event: SelectChangeEvent) => updateSpend({ attribute: event.target.value as AttributeKey })}
                >
                  {ATTRIBUTE_KEYS.map((attribute) => (
                    <MenuItem key={attribute} value={attribute}>
                      {attribute}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Máximo"
                type="number"
                value={card.spend.max}
                onChange={(event) => updateSpend({ max: Number(event.target.value) })}
              />
            </Stack>
          )}

          {card.choice && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id={`${card.id}-choice-attributes-label`}>Atributos de escolha</InputLabel>
                <Select
                  labelId={`${card.id}-choice-attributes-label`}
                  label="Atributos de escolha"
                  multiple
                  value={card.choice.attributes}
                  renderValue={(selected) => selected.join(", ")}
                  onChange={(event) => {
                    const selected = event.target.value;
                    updateChoice({
                      attributes: (typeof selected === "string" ? selected.split(",") : selected) as AttributeKey[],
                    });
                  }}
                >
                  {ATTRIBUTE_KEYS.map((attribute) => (
                    <MenuItem key={attribute} value={attribute}>
                      <Checkbox checked={card.choice?.attributes.includes(attribute) ?? false} />
                      <ListItemText primary={attribute} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Quantidade"
                type="number"
                value={card.choice.amount}
                onChange={(event) => updateChoice({ amount: Number(event.target.value) })}
              />
            </Stack>
          )}

          <Button variant="outlined" color="error" onClick={onRemove}>
            Remover
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
