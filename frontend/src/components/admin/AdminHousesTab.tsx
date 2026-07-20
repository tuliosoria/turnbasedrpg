import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { EMBLEM_COLORS, EMBLEM_ICONS, type Attributes, type Emblem, type House } from "@ravenloft/content";
import { useApi } from "../../api/ApiProvider";
import type { AdminDashboard } from "../../types/api";
import { HouseForm, type HouseFormValue } from "../HouseForm";
import type { RunAction } from "./types";

const emptyAttributes: Attributes = { riqueza: 0, recursos: 0, soldados: 0, controle: 0 };
const blankEmblem: Emblem = { icon: EMBLEM_ICONS[0], color1: EMBLEM_COLORS[0], color2: EMBLEM_COLORS[1] };

function blankHouseForm(): HouseFormValue {
  return {
    name: "",
    motto: "",
    emblem: { ...blankEmblem },
    leaderName: "",
    heirName: "",
    castleName: "",
    townsText: "",
    historyText: "",
    specialty: "",
    weakness: "",
    attributes: { ...emptyAttributes },
  };
}

function houseToForm(house: House): HouseFormValue {
  return {
    name: house.name,
    motto: house.motto,
    emblem: { ...house.emblem },
    leaderName: house.leaderName,
    heirName: house.heirName,
    castleName: house.castleName,
    townsText: house.townsText,
    historyText: house.historyText,
    specialty: house.specialty,
    weakness: house.weakness,
    attributes: { ...house.attributes },
  };
}

interface AdminHousesTabProps {
  dashboard: AdminDashboard;
  busy: boolean;
  runAction: RunAction;
}

export function AdminHousesTab({ dashboard, busy, runAction }: AdminHousesTabProps) {
  const api = useApi();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<HouseFormValue>(() => blankHouseForm());
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [editingHouseId, setEditingHouseId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<HouseFormValue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<House | null>(null);
  const [newHouseCode, setNewHouseCode] = useState<{ houseId: string; playerCode: string } | null>(null);

  function openCreate() {
    setCreateForm(blankHouseForm());
    setCreateDisplayName("");
    setEditingHouseId(null);
    setShowCreate(true);
  }

  function submitCreate() {
    void runAction(async (adminToken) => {
      const res = await api.adminCreateHouse(adminToken, {
        ...createForm,
        displayName: createDisplayName.trim(),
      });
      setNewHouseCode(res);
      setShowCreate(false);
    }, "Casa criada.");
  }

  function toggleEdit(house: House) {
    setShowCreate(false);
    if (editingHouseId === house.houseId) {
      setEditingHouseId(null);
      setEditForm(null);
    } else {
      setEditingHouseId(house.houseId);
      setEditForm(houseToForm(house));
    }
  }

  function submitEdit(houseId: string) {
    if (!editForm) return;
    void runAction(
      (adminToken) => api.adminUpdateHouse(adminToken, { houseId, ...editForm }),
      "Casa atualizada.",
    );
    setEditingHouseId(null);
    setEditForm(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    void runAction((adminToken) => api.adminDeleteHouse(adminToken, target.houseId), "Casa removida.");
  }

  return (
    <>
      <Card component="section">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography variant="h2">Gerenciar Casas</Typography>
              <Button variant="outlined" disabled={busy} onClick={openCreate}>
                Adicionar Casa
              </Button>
            </Stack>

            {showCreate && (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 2 }}>
                <Typography variant="h3" gutterBottom>Nova Casa</Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Nome de exibição do jogador"
                    value={createDisplayName}
                    onChange={(e) => setCreateDisplayName(e.target.value.slice(0, 40))}
                    required
                    helperText="Um código de acesso será gerado para este jogador."
                  />
                  <HouseForm value={createForm} onChange={setCreateForm} attributeMode="free" />
                  <Stack direction="row" spacing={2}>
                    <Button
                      color="secondary"
                      disabled={busy || createDisplayName.trim().length === 0 || createForm.name.trim().length === 0}
                      onClick={submitCreate}
                    >
                      Criar Casa
                    </Button>
                    <Button variant="outlined" disabled={busy} onClick={() => setShowCreate(false)}>
                      Cancelar
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}

            {dashboard.houses.map((house) => (
              <Box key={house.houseId} sx={{ borderTop: "1px solid", borderColor: "divider", pt: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Box>
                    <Typography variant="h3">{house.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Riqueza {house.attributes.riqueza} · Recursos {house.attributes.recursos} · Soldados {house.attributes.soldados} · Controle {house.attributes.controle}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" disabled={busy} onClick={() => toggleEdit(house)}>
                      {editingHouseId === house.houseId ? "Fechar" : "Editar"}
                    </Button>
                    <Button color="error" variant="outlined" disabled={busy} onClick={() => setDeleteTarget(house)}>
                      Deletar
                    </Button>
                  </Stack>
                </Stack>
                {editingHouseId === house.houseId && editForm && (
                  <Box sx={{ mt: 2 }}>
                    <HouseForm value={editForm} onChange={setEditForm} attributeMode="free" />
                    <Button color="secondary" sx={{ mt: 2 }} disabled={busy} onClick={() => submitEdit(house.houseId)}>
                      Salvar alterações
                    </Button>
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Deletar Casa?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Isso vai apagar permanentemente a Casa <strong>{deleteTarget?.name}</strong>, a conta do jogador
            e todas as ordens enviadas por ela. Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button color="error" disabled={busy} onClick={confirmDelete}>
            Sim, deletar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(newHouseCode)} onClose={() => setNewHouseCode(null)}>
        <DialogTitle>Casa criada</DialogTitle>
        <DialogContent>
          <DialogContentText gutterBottom>
            Entregue este código de acesso ao jogador. É o login da Casa.
          </DialogContentText>
          <Typography sx={{ fontFamily: "Georgia, serif", fontSize: "2rem", letterSpacing: "0.08em", wordBreak: "break-word" }}>
            {newHouseCode?.playerCode}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="secondary" onClick={() => setNewHouseCode(null)}>
            Entendi
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
