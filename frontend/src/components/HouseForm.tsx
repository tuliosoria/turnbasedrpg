import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  EMBLEM_COLORS,
  EMBLEM_ICONS,
  emblemColorName,
  type Attributes,
  type EmblemColor,
  type EmblemIcon,
} from "@ravenloft/content";
import type { CreateHouseInput, HouseExample } from "../types/api";
import { Crest } from "./Crest";
import { PointBuy } from "./PointBuy";

export type HouseFormValue = Omit<CreateHouseInput, "displayName">;

type HouseFormProps = {
  value: HouseFormValue;
  onChange: (value: HouseFormValue) => void;
  attributeMode?: "budget" | "free";
  section?: "identity" | "attributes" | "all";
  example?: HouseExample | null;
};

export function HouseForm({
  value,
  onChange,
  attributeMode = "budget",
  section = "all",
  example = null,
}: HouseFormProps) {
  function update<K extends keyof HouseFormValue>(key: K, next: HouseFormValue[K]) {
    onChange({ ...value, [key]: next });
  }

  const showIdentity = section === "identity" || section === "all";
  const showAttributes = section === "attributes" || section === "all";

  return (
    <Stack spacing={2}>
      {showIdentity && (
        <>
          <TextField label="Nome da Casa" value={value.name} onChange={(event) => update("name", event.target.value.slice(0, 60))} required />
          <TextField label="Lema" value={value.motto} onChange={(event) => update("motto", event.target.value.slice(0, 120))} required />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <FormControl fullWidth>
              <InputLabel id="emblem-icon-label">Ícone do brasão</InputLabel>
              <Select
                labelId="emblem-icon-label"
                label="Ícone do brasão"
                value={value.emblem.icon}
                onChange={(event) => update("emblem", { ...value.emblem, icon: event.target.value as EmblemIcon })}
              >
                {EMBLEM_ICONS.map((icon) => (
                  <MenuItem key={icon} value={icon}>
                    {icon}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="emblem-color1-label">Cor principal</InputLabel>
              <Select
                labelId="emblem-color1-label"
                label="Cor principal"
                value={value.emblem.color1}
                onChange={(event) => update("emblem", { ...value.emblem, color1: event.target.value as EmblemColor })}
              >
                {EMBLEM_COLORS.map((color) => (
                  <MenuItem key={color} value={color}>
                    <Box component="span" sx={{ display: "inline-block", width: 14, height: 14, mr: 1, borderRadius: "3px", backgroundColor: color, border: "1px solid rgba(255,255,255,0.3)", verticalAlign: "middle" }} />
                    {emblemColorName(color)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="emblem-color2-label">Cor secundária</InputLabel>
              <Select
                labelId="emblem-color2-label"
                label="Cor secundária"
                value={value.emblem.color2}
                onChange={(event) => update("emblem", { ...value.emblem, color2: event.target.value as EmblemColor })}
              >
                {EMBLEM_COLORS.map((color) => (
                  <MenuItem key={color} value={color}>
                    <Box component="span" sx={{ display: "inline-block", width: 14, height: 14, mr: 1, borderRadius: "3px", backgroundColor: color, border: "1px solid rgba(255,255,255,0.3)", verticalAlign: "middle" }} />
                    {emblemColorName(color)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Crest emblem={value.emblem} name={value.name || "Casa sem nome"} />
          </Stack>
          <TextField label="Líder" value={value.leaderName} onChange={(event) => update("leaderName", event.target.value)} required />
          <TextField label="Herdeiro" value={value.heirName} onChange={(event) => update("heirName", event.target.value)} required />
          <TextField label="Castelo" value={value.castleName} onChange={(event) => update("castleName", event.target.value)} required />
          <TextField label="Terras e vilas" value={value.townsText} onChange={(event) => update("townsText", event.target.value)} multiline minRows={3} required />
          <TextField label="História" value={value.historyText} onChange={(event) => update("historyText", event.target.value)} multiline minRows={3} required />
          <TextField label="Especialidade" value={value.specialty} onChange={(event) => update("specialty", event.target.value)} required />
          <TextField label="Fraqueza" value={value.weakness} onChange={(event) => update("weakness", event.target.value)} required />

          {example && (
            <Accordion>
              <AccordionSummary>Ver exemplo: Casa Vargen</AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  <Typography variant="h3">{example.name}</Typography>
                  <Typography sx={{ color: "text.secondary" }}>{example.motto}</Typography>
                  <Typography>{example.historyText}</Typography>
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}
        </>
      )}

      {showAttributes && (
        <PointBuy
          value={value.attributes}
          onChange={(attributes: Attributes) => update("attributes", attributes)}
          freeMode={attributeMode === "free"}
        />
      )}
    </Stack>
  );
}
