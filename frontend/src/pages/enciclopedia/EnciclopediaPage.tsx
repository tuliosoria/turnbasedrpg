import { useState } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { Layout } from "../../components/Layout";
import { loadAdminToken } from "../../auth/adminSession";
import { GaleriaTab } from "./GaleriaTab";
import { EntidadesTab } from "./EntidadesTab";
import { EstudioTab } from "./EstudioTab";

export function EnciclopediaPage() {
  const isAdmin = !!loadAdminToken();
  const [tab, setTab] = useState(0);

  return (
    <Layout>
      <Typography variant="h4" sx={{ mb: 2 }}>Enciclopédia Visual</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Galeria" />
        <Tab label="Entidades" />
        {isAdmin && <Tab label="Estúdio" />}
      </Tabs>
      <Box hidden={tab !== 0}>{tab === 0 && <GaleriaTab />}</Box>
      <Box hidden={tab !== 1}>{tab === 1 && <EntidadesTab />}</Box>
      {isAdmin && <Box hidden={tab !== 2}>{tab === 2 && <EstudioTab />}</Box>}
    </Layout>
  );
}
