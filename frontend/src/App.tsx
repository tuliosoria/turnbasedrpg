import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { CreateHousePage } from "./pages/CreateHousePage";
import { LoginPage } from "./pages/LoginPage";
import { GamePage } from "./pages/GamePage";
import { CanonicoPage } from "./pages/CanonicoPage";
import { GalleryPage } from "./pages/GalleryPage";
import { WikiPage } from "./pages/WikiPage";
import { WikiIndexPage } from "./pages/wiki/WikiIndexPage";
import { CasaPage } from "./pages/casa/CasaPage";
import { CasasPage } from "./pages/casa/CasasPage";
import { PersonagensIndexPage } from "./pages/personagens/PersonagensIndexPage";
import { PersonagemPage } from "./pages/personagens/PersonagemPage";
import { HistoriasPage } from "./pages/historias/HistoriasPage";
import { loadPlayerSession } from "./auth/playerSession";

const AdminPage = lazy(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })));

/**
 * Guarda as rotas de jogador e guarda também para onde a pessoa estava indo:
 * sem isso o login sempre despejava todo mundo em `/game`, e quem clicava em
 * "Adicionar Canônico" deslogado nunca chegava ao destino que escolheu.
 */
function RequirePlayer({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (loadPlayerSession()) return <>{children}</>;
  return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/criar" element={<CreateHousePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/game" element={<RequirePlayer><GamePage /></RequirePlayer>} />
        <Route path="/canonico" element={<RequirePlayer><CanonicoPage /></RequirePlayer>} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/galeria" element={<GalleryPage />} />
        {/* A wiki do jogador é /valdren. /enciclopedia era o híbrido público
            GM/jogador; bookmarks antigos caem na crônica. */}
        <Route path="/enciclopedia" element={<Navigate to="/valdren" replace />} />
        <Route path="/casas" element={<CasasPage />} />
        <Route path="/casa/:chave" element={<CasaPage />} />
        <Route path="/personagens" element={<PersonagensIndexPage />} />
        <Route path="/personagens/:id" element={<PersonagemPage />} />
        <Route path="/historias" element={<HistoriasPage />} />
        <Route path="/valdren" element={<WikiIndexPage />} />
        <Route path="/valdren/:section" element={<WikiPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
