"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { FolderOpen, Building2, Layers, Clock } from "lucide-react";

function iniciales(nombre) {
  const palabras = (nombre || "").trim().split(/\s+/);
  return palabras.slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
}

function tiempoRelativo(fecha) {
  if (!fecha) return "";
  const seg = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000);
  if (seg < 60) return "hace unos segundos";
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} ${min === 1 ? "minuto" : "minutos"}`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} ${hrs === 1 ? "hora" : "horas"}`;
  const dias = Math.floor(hrs / 24);
  if (dias < 30) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  return `hace ${anios} ${anios === 1 ? "año" : "años"}`;
}

export default function InicioPage() {
  const { status: sesionStatus } = useSession();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/dashboard/resumen");
      const data = await res.json();
      if (res.ok) setDatos(data);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (sesionStatus === "authenticated") cargar();
  }, [sesionStatus, cargar]);

  if (sesionStatus === "loading" || cargando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!datos) return null;

  const tarjetas = [
    { label: "Proyectos activos", valor: datos.proyectosActivos, icono: FolderOpen },
    { label: "Clientes", valor: datos.clientesActivos, icono: Building2 },
    { label: "Claves activas", valor: datos.clavesActivas, icono: Layers },
    { label: "Pendientes de acción", valor: datos.pendientesAccion, icono: Clock },
  ];

  const actividad = datos.actividadReciente || [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>Sistema de gestión</div>
        <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 600, color: "#212121" }}>Inicio</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        {tarjetas.map(({ label, valor, icono: Icono }) => (
          <div
            key={label}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              padding: "20px 24px",
              borderBottom: "3px solid #e5e5e5",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {label}
              </span>
              <Icono size={16} style={{ color: "#9ca3af" }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#212121", lineHeight: 1 }}>
              {valor ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 600, color: "#212121" }}>
          Actividad reciente
        </h2>
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
          {actividad.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              No hay actividad reciente.
            </div>
          ) : (
            actividad.map((ev, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 20px",
                  borderBottom: i < actividad.length - 1 ? "1px solid #f3f4f6" : "none",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "#f3f4f6", color: "#212121",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, fontSize: 12, fontWeight: 600,
                }}>
                  {iniciales(ev.actor)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#212121", lineHeight: 1.45 }}>
                    {ev.descripcion}
                  </div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                    {tiempoRelativo(ev.fecha)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
