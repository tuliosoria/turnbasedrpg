import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  EMBLEM_COLORS,
  EMBLEM_ICONS,
  emblemColorName,
  validateAttributes,
  type Attributes,
  type Emblem,
  type EmblemColor,
  type EmblemIcon,
} from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { savePlayerSession } from "../auth/playerSession";
import { Crest } from "../components/Crest";
import { Layout } from "../components/Layout";
import { PointBuy } from "../components/PointBuy";
import { ApiError, type CreateAccountResult, type CreateHouseInput, type HouseExample } from "../types/api";

const steps = ["Conta", "Identidade da Casa", "Atributos", "Revisão"];
const initialAttributes: Attributes = { riqueza: 2, recursos: 3, soldados: 2, controle: 3 };
const initialEmblem: Emblem = {
  icon: EMBLEM_ICONS[0],
  color1: EMBLEM_COLORS[0],
  color2: EMBLEM_COLORS[1],
};

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

export function CreateHousePage() {
  const api = useApi();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [form, setForm] = useState<Omit<CreateHouseInput, "displayName">>({
    name: "",
    motto: "",
    emblem: initialEmblem,
    leaderName: "",
    heirName: "",
    castleName: "",
    townsText: "",
    historyText: "",
    specialty: "",
    weakness: "",
    attributes: initialAttributes,
  });
  const [example, setExample] = useState<HouseExample | null>(null);
  const [result, setResult] = useState<CreateAccountResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getHouseExample().then(setExample).catch(() => setExample(null));
  }, [api]);

  const attributesValidation = useMemo(() => validateAttributes(form.attributes), [form.attributes]);
  const identityValid =
    hasText(form.name) &&
    form.name.length <= 60 &&
    hasText(form.motto) &&
    form.motto.length <= 120 &&
    hasText(form.leaderName) &&
    hasText(form.heirName) &&
    hasText(form.castleName) &&
    hasText(form.townsText) &&
    hasText(form.historyText) &&
    hasText(form.specialty) &&
    hasText(form.weakness);
  const canAdvance =
    (activeStep === 0 && displayName.trim().length > 0 && displayName.trim().length <= 40) ||
    (activeStep === 1 && identityValid) ||
    (activeStep === 2 && attributesValidation.valid) ||
    activeStep === 3;

  function update<K extends keyof Omit<CreateHouseInput, "displayName">>(
    key: K,
    value: Omit<CreateHouseInput, "displayName">[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createHouse() {
    setSaving(true);
    setError(null);
    try {
      setResult(await api.createAccountAndHouse({ ...form, displayName: displayName.trim() }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível fundar a Casa.");
    } finally {
      setSaving(false);
    }
  }

  function enterGame() {
    if (!result) return;
    savePlayerSession({
      playerToken: result.playerToken,
      houseId: result.houseId,
      displayName: result.displayName,
    });
    navigate("/game");
  }

  return (
    <Layout>
      <Typography variant="h1" gutterBottom>
        Criar conta
      </Typography>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {steps.map((step) => (
          <Step key={step}>
            <StepLabel>{step}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {activeStep === 0 && (
        <Stack spacing={2}>
          <Typography>Primeiro, diga como você quer aparecer para a mesa.</Typography>
          <TextField
            label="Nome de exibição"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value.slice(0, 40))}
            required
            helperText={`${displayName.length}/40`}
          />
        </Stack>
      )}

      {activeStep === 1 && (
        <Stack spacing={2}>
          <TextField label="Nome da Casa" value={form.name} onChange={(event) => update("name", event.target.value.slice(0, 60))} required />
          <TextField label="Lema" value={form.motto} onChange={(event) => update("motto", event.target.value.slice(0, 120))} required />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
            <FormControl fullWidth>
              <InputLabel id="emblem-icon-label">Ícone do brasão</InputLabel>
              <Select
                labelId="emblem-icon-label"
                label="Ícone do brasão"
                value={form.emblem.icon}
                onChange={(event) => update("emblem", { ...form.emblem, icon: event.target.value as EmblemIcon })}
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
                value={form.emblem.color1}
                onChange={(event) => update("emblem", { ...form.emblem, color1: event.target.value as EmblemColor })}
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
                value={form.emblem.color2}
                onChange={(event) => update("emblem", { ...form.emblem, color2: event.target.value as EmblemColor })}
              >
                {EMBLEM_COLORS.map((color) => (
                  <MenuItem key={color} value={color}>
                    <Box component="span" sx={{ display: "inline-block", width: 14, height: 14, mr: 1, borderRadius: "3px", backgroundColor: color, border: "1px solid rgba(255,255,255,0.3)", verticalAlign: "middle" }} />
                    {emblemColorName(color)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Crest emblem={form.emblem} name={form.name || "Casa sem nome"} />
          </Stack>
          <TextField label="Líder" value={form.leaderName} onChange={(event) => update("leaderName", event.target.value)} required />
          <TextField label="Herdeiro" value={form.heirName} onChange={(event) => update("heirName", event.target.value)} required />
          <TextField label="Castelo" value={form.castleName} onChange={(event) => update("castleName", event.target.value)} required />
          <TextField label="Terras e vilas" value={form.townsText} onChange={(event) => update("townsText", event.target.value)} multiline minRows={3} required />
          <TextField label="História" value={form.historyText} onChange={(event) => update("historyText", event.target.value)} multiline minRows={3} required />
          <TextField label="Especialidade" value={form.specialty} onChange={(event) => update("specialty", event.target.value)} required />
          <TextField label="Fraqueza" value={form.weakness} onChange={(event) => update("weakness", event.target.value)} required />

          <Accordion>
            <AccordionSummary>Ver exemplo: Casa Vargen</AccordionSummary>
            <AccordionDetails>
              {example ? (
                <Stack spacing={1}>
                  <Typography variant="h3">{example.name}</Typography>
                  <Typography sx={{ color: "text.secondary" }}>{example.motto}</Typography>
                  <Typography>{example.historyText}</Typography>
                </Stack>
              ) : (
                <Typography sx={{ color: "text.secondary" }}>Exemplo indisponível.</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        </Stack>
      )}

      {activeStep === 2 && (
        <Stack spacing={2}>
          <Typography>Distribua exatamente dez pontos entre os atributos da Casa.</Typography>
          <PointBuy value={form.attributes} onChange={(attributes) => update("attributes", attributes)} />
          {!attributesValidation.valid && <Alert severity="warning">{attributesValidation.error}</Alert>}
        </Stack>
      )}

      {activeStep === 3 && (
        <Stack spacing={2}>
          <Typography variant="h2">Revisão</Typography>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Crest emblem={form.emblem} name={form.name || "Casa sem nome"} size={72} />
            <Box>
              <Typography variant="h3">{form.name || "Casa sem nome"}</Typography>
              <Typography sx={{ color: "text.secondary" }}>{form.motto || "Sem lema"}</Typography>
              <Typography>Jogador: {displayName}</Typography>
            </Box>
          </Box>
          <Button color="secondary" size="large" disabled={saving} onClick={createHouse}>
            {saving ? "Fundando..." : "Fundar a Casa"}
          </Button>
        </Stack>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
        <Button variant="outlined" disabled={activeStep === 0 || saving} onClick={() => setActiveStep((step) => step - 1)}>
          Voltar
        </Button>
        {activeStep < steps.length - 1 && (
          <Button disabled={!canAdvance || saving} onClick={() => setActiveStep((step) => step + 1)}>
            Próximo
          </Button>
        )}
      </Stack>

      <Dialog open={Boolean(result)} onClose={() => undefined}>
        <DialogTitle>Casa fundada</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>Guarde este código — é o seu acesso.</Typography>
          <Typography sx={{ fontFamily: "Georgia, serif", fontSize: "2rem", letterSpacing: "0.08em" }}>
            {result?.playerCode}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={enterGame}>
            Entrar no jogo
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
