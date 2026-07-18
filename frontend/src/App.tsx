import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { ClaimHousePage } from "./pages/ClaimHousePage";
import { LoginPage } from "./pages/LoginPage";
import { GamePage } from "./pages/GamePage";
import { AdminPage } from "./pages/AdminPage";
import { loadPlayerSession } from "./auth/playerSession";

function RequirePlayer({ children }: { children: React.ReactNode }) {
  return loadPlayerSession() ? <>{children}</> : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/claim" element={<ClaimHousePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/game" element={<RequirePlayer><GamePage /></RequirePlayer>} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
