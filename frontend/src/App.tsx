import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { CreateHousePage } from "./pages/CreateHousePage";
import { LoginPage } from "./pages/LoginPage";
import { GamePage } from "./pages/GamePage";
import { AdminPage } from "./pages/AdminPage";
import { GalleryPage } from "./pages/GalleryPage";
import { WikiPage } from "./pages/WikiPage";
import { loadPlayerSession } from "./auth/playerSession";

function RequirePlayer({ children }: { children: React.ReactNode }) {
  return loadPlayerSession() ? <>{children}</> : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/criar" element={<CreateHousePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/game" element={<RequirePlayer><GamePage /></RequirePlayer>} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/galeria" element={<GalleryPage />} />
      <Route path="/valdren" element={<WikiPage />} />
      <Route path="/valdren/:section" element={<WikiPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
