"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, FileText, ClipboardList } from "lucide-react";

const ESTATUS_PROYECTO = {
  ACTIVO:     { label: "Activo",     background: "#dcfce7", color: "#166534" },
  PAUSADO:    { label: "Pausado",    background: "#fef9c3", color: "#854d0e" },
  COMPLETADO: { label: "Completado", background: "#f3f4f6", color: "#374151" },
};

function formatearFecha(fecha) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

export default function ProyectoDetallePage() {
  const { status: sesionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const proyectoId = parseInt(params.proyectoId);

  const [proyecto, setProyecto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Error al cargar el proyecto");
        return;
      }
      setProyecto(await res.json());
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  }, [proyectoId]);

  useEffect(() => {
    if (sesionStatus === "authenticated" && !isNaN(proyectoId)) cargar();
  }, [sesionStatus, proyectoId, cargar]);

  if (sesionStatus === "loading" || cargando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !proyecto) {
    return (
      <div>
        <button onClick={() => router.push("/dashboard/proyectos")} style={sBotonVolver}>
          <ArrowLeft size={15} /> Proyectos
        </button>
        <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
          {error || "Proyecto no encontrado"}
        </div>
      </div>
    );
  }

  const cli = proyecto.cliente?.nombre || proyecto.cliente?.nombreCorto || "Sin cliente";
  const est = ESTATUS_PROYECTO[proyecto.estatus] || { label: proyecto.estatus, background: "#f3f4f6", color: "#374151" };
  const numClaves = proyecto._count?.claves ?? 0;
  const numOrdenes = proyecto._count?.ordenes ?? 0;

  const modulos = [];
  if (numClaves > 0) {
    modulos.push({
      clave: "planos",
      icono: FileText,
      titulo: "Planos",
      subtitulo: `${numClaves} clave${numClaves !== 1 ? "s" : ""} activa${numClaves !== 1 ? "s" : ""}`,
      onClick: () => router.push(`/dashboard/planos/${proyectoId}`),
    });
  }
  if (numOrdenes > 0) {
    modulos.push({
      clave: "ordenes",
      icono: ClipboardList,
      titulo: "Órdenes de Cambio",
      subtitulo: `${numOrdenes} orden${numOrdenes !== 1 ? "es" : ""} activa${numOrdenes !== 1 ? "s" : ""}`,
      onClick: () => router.push(`/dashboard/ordenes-cambio/${proyectoId}`),
    });
  }

  return (
    <div>
      <button onClick={() => router.push("/dashboard/proyectos")} style={sBotonVolver}>
        <ArrowLeft size={15} /> Proyectos
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#212121" }}>{proyecto.nombre}</h1>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: est.background, color: est.color }}>
              {est.label}
            </span>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 8, fontSize: 13, color: "#6b7280" }}>
            <span><strong style={{ fontWeight: 600, color: "#9ca3af" }}>Cliente: </strong>{cli}</span>
            <span><strong style={{ fontWeight: 600, color: "#9ca3af" }}>Creado: </strong>{formatearFecha(proyecto.createdAt)}</span>
          </div>
        </div>
      </div>

      {modulos.length === 0 ? (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 14 }}>
            Este proyecto no tiene módulos activos aún.
          </p>
          <button
            disabled
            style={{ background: "#f3f4f6", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 18px", color: "#9ca3af", fontWeight: 600, fontSize: 13, cursor: "not-allowed" }}
          >
            Agregar módulo
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {modulos.map((m) => (
            <TarjetaModulo key={m.clave} icono={m.icono} titulo={m.titulo} subtitulo={m.subtitulo} onClick={m.onClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaModulo({ icono: Icono, titulo, subtitulo, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: "left",
        background: "#ffffff",
        border: `1px solid ${hover ? "#c9a84c" : "#e5e5e5"}`,
        borderRadius: 12,
        padding: 24,
        cursor: "pointer",
        transition: "border-color 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: "#f3f4f6", color: "#212121",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icono size={22} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#212121" }}>{titulo}</div>
        <div style={{ marginTop: 2, fontSize: 13, color: "#6b7280" }}>{subtitulo}</div>
      </div>
    </button>
  );
}

const sBotonVolver = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "none",
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  padding: "4px 0",
  marginBottom: 12,
};
