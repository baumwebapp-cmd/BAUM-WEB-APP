"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  FileText,
  Package,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

const NAV_POR_ROL = {
  DUENO: [
    { href: "/dashboard", label: "Inicio", icono: LayoutDashboard, exacto: true },
    { href: "/dashboard/proyectos", label: "Proyectos", icono: FolderOpen },
    { href: "/dashboard/usuarios", label: "Usuarios", icono: Users },
  ],
  SUPERADMIN: [
    { href: "/dashboard", label: "Inicio", icono: LayoutDashboard, exacto: true },
    { href: "/dashboard/proyectos", label: "Proyectos", icono: FolderOpen },
    { href: "/dashboard/usuarios", label: "Usuarios", icono: Users },
  ],
  GERENTE: [
    { href: "/dashboard", label: "Inicio", icono: LayoutDashboard, exacto: true },
    { href: "/dashboard/proyectos", label: "Proyectos", icono: FolderOpen },
  ],
  DISENADOR: [
    { href: "/dashboard", label: "Inicio", icono: LayoutDashboard, exacto: true },
    { href: "/dashboard/proyectos", label: "Proyectos", icono: FolderOpen },
  ],
  COSTOS: [
    { href: "/dashboard", label: "Inicio", icono: LayoutDashboard, exacto: true },
    { href: "/dashboard/proyectos", label: "Proyectos", icono: FolderOpen },
  ],
  PRODUCCION: [
    { href: "/dashboard", label: "Inicio", icono: LayoutDashboard, exacto: true },
    { href: "/dashboard/proyectos", label: "Proyectos", icono: FolderOpen },
  ],
};

const ETIQUETA_ROL = {
  DUENO:      "Dueño",
  SUPERADMIN: "Superadmin",
  GERENTE:    "Gerente",
  DISENADOR:  "Diseñador",
  COSTOS:     "Costos",
  PRODUCCION: "Producción",
};

function estaActivo(pathname, href, exacto) {
  if (exacto) return pathname === href;
  return pathname.startsWith(href);
}

function Sidebar({ abierto, onCerrar, anchoSidebar }) {
  const { data: sesion } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const rol = sesion?.user?.rol || "GERENTE";
  const navItems = NAV_POR_ROL[rol] || NAV_POR_ROL.GERENTE;

  async function cerrarSesion() {
    await signOut({ redirect: false });
    router.replace("/login");
  }

  const iniciales = sesion?.user?.nombre
    ? sesion.user.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  return (
    <>
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: anchoSidebar,
          background: "#212121",
          display: "flex",
          flexDirection: "column",
          zIndex: 50,
          transition: "transform 0.25s ease",
          transform: abierto ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #333333", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img
            src="/baum_logo_bco.svg"
            alt="BAUM Industria Carpintera"
            style={{ maxWidth: "80%", maxHeight: 64, objectFit: "contain" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextSibling.style.display = "block";
            }}
          />
          <div style={{ display: "none" }}>
            <div style={{ color: "#c9a84c", fontSize: 22, fontWeight: 700, letterSpacing: 2, marginBottom: 2 }}>BAUM</div>
            <div style={{ color: "#555555", fontSize: 10, letterSpacing: 3, textTransform: "uppercase" }}>Industria Carpintera</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          <div style={{ marginBottom: 8, padding: "0 12px" }}>
            <span style={{ color: "#555555", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
              Menú
            </span>
          </div>
          {navItems.map(({ href, label, icono: Icono, exacto }) => {
            const activo = estaActivo(pathname, href, exacto);
            return (
              <a
                key={href}
                href={href}
                onClick={(e) => { e.preventDefault(); router.push(href); onCerrar?.(); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  marginBottom: 2,
                  color: activo ? "#c9a84c" : "#aaaaaa",
                  background: activo ? "rgba(201,168,76,0.10)" : "transparent",
                  fontWeight: activo ? 600 : 400,
                  fontSize: 14,
                  transition: "all 0.15s",
                  cursor: "pointer",
                  textDecoration: "none",
                }}
              >
                <Icono size={18} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {activo && <ChevronRight size={14} style={{ opacity: 0.6 }} />}
              </a>
            );
          })}
        </nav>

        <div style={{ borderTop: "1px solid #333333", padding: "16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 4 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(201,168,76,0.15)",
              border: "1.5px solid rgba(201,168,76,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#c9a84c",
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {iniciales}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {sesion?.user?.nombre || "Usuario"}
              </div>
              <div style={{ color: "#c9a84c", fontSize: 11, fontWeight: 500 }}>
                {ETIQUETA_ROL[rol]}
              </div>
            </div>
          </div>

          <button
            onClick={cerrarSesion}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              color: "#888888",
              fontSize: 14,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#888888"; e.currentTarget.style.background = "transparent"; }}
          >
            <LogOut size={17} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}

const BREAKPOINT_DESKTOP = 768;

export default function DashboardLayout({ children }) {
  const { status } = useSession();
  const router = useRouter();
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [esDesktop, setEsDesktop] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    function actualizar() {
      const desktop = window.innerWidth >= BREAKPOINT_DESKTOP;
      setEsDesktop(desktop);
      if (desktop) setSidebarAbierto(false);
    }
    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
        <span className="spinner" style={{ width: 28, height: 28, borderTopColor: "#c9a84c" }} />
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  const SIDEBAR_W = 220;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f5f5f5" }}>
      <Sidebar
        abierto={esDesktop || sidebarAbierto}
        esDesktop={esDesktop}
        onCerrar={() => setSidebarAbierto(false)}
        anchoSidebar={SIDEBAR_W}
      />

      {/* Overlay móvil */}
      {!esDesktop && sidebarAbierto && (
        <div
          onClick={() => setSidebarAbierto(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }}
        />
      )}

      <div style={{
        flex: 1,
        marginLeft: esDesktop ? SIDEBAR_W : 0,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        transition: "margin-left 0.25s ease",
      }}>
        {/* Header solo en móvil */}
        {!esDesktop && (
          <header style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            background: "rgba(245,245,245,0.95)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid #e8e8e8",
            padding: "0 20px",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#212121", letterSpacing: "0.02em" }}>
              Sistema de Gestión
            </span>
            <button
              onClick={() => setSidebarAbierto(true)}
              style={{ background: "transparent", border: "none", color: "#212121", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
          </header>
        )}

        <main style={{ flex: 1, padding: "32px 24px", maxWidth: 1280, margin: "0 auto", width: "100%" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
