import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  EMBLEM_COLORS,
  EMBLEM_ICONS,
  validateAttributes,
  type Attributes,
  type Emblem,
} from "@ravenloft/content";
import { useApi } from "../api/ApiProvider";
import { savePlayerSession } from "../auth/playerSession";
import { Crest } from "../components/Crest";
import { HouseForm } from "../components/HouseForm";
import { Layout } from "../components/Layout";
import { resizeImageFile, resizeDataUrl } from "../utils/imageResize";
import { ApiError, type CreateAccountResult, type CreateHouseInput, type HouseExample } from "../types/api";

const steps = ["Conta", "Identidade da Casa", "Imagens da Casa", "Atributos", "Revisão"];
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
  const [images, setImages] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const MAX_IMAGES = 5;

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
    activeStep === 2 ||
    (activeStep === 3 && attributesValidation.valid) ||
    activeStep === 4;

  async function onPickFiles(files: FileList | null) {
    if (!files) return;
    setImageError(null);
    const room = MAX_IMAGES - images.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    try {
      const resized = await Promise.all(picked.map(resizeImageFile));
      setImages((prev) => [...prev, ...resized].slice(0, MAX_IMAGES));
    } catch {
      setImageError("Não foi possível processar a imagem.");
    }
  }

  async function onGenerate() {
    if (images.length >= MAX_IMAGES) return;
    setGenLoading(true);
    setImageError(null);
    try {
      const { image } = await api.generateHouseImage({
        name: form.name,
        description: form.historyText,
        emblem: form.emblem,
      });
      const resized = await resizeDataUrl(image);
      setImages((prev) => [...prev, resized].slice(0, MAX_IMAGES));
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : "Não foi possível gerar a imagem.");
    } finally {
      setGenLoading(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function createHouse() {
    setSaving(true);
    setError(null);
    try {
      setResult(await api.createAccountAndHouse({ ...form, displayName: displayName.trim(), images }));
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
      <Box sx={{ display: { xs: "block", sm: "none" }, mb: 3 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Passo {activeStep + 1} de {steps.length}
        </Typography>
        <Typography variant="h3">{steps[activeStep]}</Typography>
      </Box>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4, display: { xs: "none", sm: "flex" } }}>
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
        <HouseForm section="identity" value={form} onChange={setForm} example={example} />
      )}

      {activeStep === 2 && (
        <Stack spacing={2}>
          <Typography>Adicione até cinco imagens para a sua Casa. Esta etapa é opcional.</Typography>
          {imageError && <Alert severity="warning">{imageError}</Alert>}
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" component="label" disabled={images.length >= MAX_IMAGES}>
              Enviar imagens
              <input hidden type="file" accept="image/*" multiple onChange={(event) => onPickFiles(event.target.files)} />
            </Button>
            <Button variant="outlined" disabled={genLoading || images.length >= MAX_IMAGES} onClick={onGenerate}>
              {genLoading ? "Gerando..." : "Gerar com IA"}
            </Button>
          </Stack>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {images.map((src, index) => (
              <Box key={index} sx={{ position: "relative" }}>
                <Box
                  component="img"
                  src={src}
                  alt={`Imagem ${index + 1} da Casa`}
                  sx={{ width: 120, height: 80, objectFit: "cover", borderRadius: 1, display: "block" }}
                />
                <Button
                  size="small"
                  onClick={() => removeImage(index)}
                  sx={{ position: "absolute", top: 0, right: 0, minWidth: 0, px: 1 }}
                >
                  x
                </Button>
              </Box>
            ))}
          </Box>
        </Stack>
      )}

      {activeStep === 3 && (
        <Stack spacing={2}>
          <Typography>Distribua exatamente dez pontos entre os atributos da Casa.</Typography>
          <HouseForm section="attributes" attributeMode="budget" value={form} onChange={setForm} />
          {!attributesValidation.valid && <Alert severity="warning">{attributesValidation.error}</Alert>}
        </Stack>
      )}

      {activeStep === 4 && (
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
          {images.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {images.map((src, index) => (
                <Box
                  key={index}
                  component="img"
                  src={src}
                  alt={`Imagem ${index + 1} da Casa`}
                  sx={{ width: 120, height: 80, objectFit: "cover", borderRadius: 1, display: "block" }}
                />
              ))}
            </Box>
          )}
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
          <Typography sx={{ fontFamily: "Georgia, serif", fontSize: "2rem", letterSpacing: "0.08em", wordBreak: "break-word" }}>
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
