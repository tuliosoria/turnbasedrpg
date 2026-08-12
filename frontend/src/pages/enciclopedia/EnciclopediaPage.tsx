import { useState } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { Layout } from "../../components/Layout";
import { loadAdminToken } from "../../auth/adminSession";
import { AcervoTab } from "./AcervoTab";
import { GaleriaTab } from "./GaleriaTab";
import { EntidadesTab } from "./EntidadesTab";
import { EstudioTab } from "./EstudioTab";

export function EnciclopediaPage() {
  const isAdmin = !!loadAdminToken();
  const [tab, setTab] = useState(0);

  return (
    <Layout>
      <Typography variant="h4" sx={{ mb: 2 }}>Valdren — Enciclopédia</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Acervo" />
        <Tab label="Galeria" />
        <Tab label="Entidades" />
        <Tab label="Estúdio" />
      </Tabs>
      <Box hidden={tab !== 0}>{tab === 0 && <AcervoTab isAdmin={isAdmin} />}</Box>
      <Box hidden={tab !== 1}>{tab === 1 && <GaleriaTab />}</Box>
      <Box hidden={tab !== 2}>{tab === 2 && <EntidadesTab />}</Box>
      <Box hidden={tab !== 3}>{tab === 3 && <EstudioTab isAdmin={isAdmin} />}</Box>
    </Layout>
  );
}
