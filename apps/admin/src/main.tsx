import { StrictMode, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from "react-router";
import { AuthProvider, useAuth } from "./auth";
import { Dashboard } from "./pages/Dashboard";
import { LeadDetail, Leads } from "./pages/Leads";
import { Login } from "./pages/Login";
import { extraRoutes, extraNav } from "./pages/extra";
import { SaleDetail, Sales } from "./pages/Sales";
import { Loading } from "./ui";
import "./styles.css";

function Shell({ children }: { children: ReactNode }) {
  const { session, caps, logout, meta } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const links: { to: string; label: string; show: boolean }[] = [
    { to: "/", label: "Обзор", show: true },
    { to: "/leads", label: "Заявки", show: caps.leadsRead },
    { to: "/sales", label: "Продажи", show: caps.leadsRead },
    ...extraNav(caps, meta),
  ];
  return (
    <div className="shell">
      <nav className="nav" aria-label="Разделы">
        <img src="/admin/armorix-horizontal-light.svg" alt="ARMORIX" width="150" height="33" />
        <button
          className="btn small nav-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen((v) => !v)}
        >
          Меню
        </button>
        <div className={`links ${open ? "open" : ""}`} id="nav-links" key={location.pathname}>
          {links
            .filter((l) => l.show)
            .map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          <div className="spacer" />
          <div className="who">{session?.user.name ?? session?.user.email}</div>
          <button className="btn small" type="button" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </nav>
      <main id="main">{children}</main>
    </div>
  );
}

function App() {
  const { session, loading, caps } = useAuth();
  if (loading) return <Loading label="Проверяем вход" />;
  if (!session || !session.mfa.passed) return <Login key={session?.user.id ?? "anon"} />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {caps.leadsRead && <Route path="/leads" element={<Leads />} />}
        {caps.leadsRead && <Route path="/leads/:ref" element={<LeadDetail />} />}
        {caps.leadsRead && <Route path="/sales" element={<Sales />} />}
        {caps.leadsRead && <Route path="/sales/:id" element={<SaleDetail />} />}
        {extraRoutes(caps)}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<p className="muted">Раздел не найден или недоступен для вашей роли</p>} />
      </Routes>
    </Shell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

const pre = document.getElementById("preloader");
if (pre) {
  pre.classList.add("done");
  setTimeout(() => pre.remove(), 400);
}
