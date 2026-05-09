"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  FolderOpen, Package, AlertCircle, CheckCircle,
  Upload, X, ChevronRight, Clock, RefreshCw,
} from "lucide-react";

/* ── Helpers ── */

function tiempoRelativo(fecha) {
  const diff = Date.now() - new Date(fecha).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 2) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const dias = Math.floor(hrs / 24);
  return `hace ${dias} día${dias !== 1 ? "s" : ""}`;
}

function iniciales(nombre) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}

const TIPO_EVENTO = {
  PLANO_SUBIDO:          { Icono: Upload,      color: "#3b82f6", label: "Plano subido" },
  AUTH_INTERNA_APROBADA: { Icono: CheckCircle, color: "#10b981", label: "Autorizado" },
  AUTH_INTERNA_RECHAZADA:{ Icono: X,           color: "#ef4444", label: "Rechazado" },
  CLIENTE_APROBO:        { Icono: CheckCircle, color: "#10b981", label: "Cliente aprobó" },
  CLIENTE_RECHAZO:       { Icono: X,           color: "#ef4444", label: "Cliente rechazó" },
};

const ESTATUS_CLAVE_LABEL = {
  BORRADOR:         { label: "Sin plano",              color: "#6b7280", bg: "#f3f4f6" },
  RECHAZADO:        { label: "Rechazado — corregir",   color: "#991b1b", bg: "#fee2e2" },
  AUTORIZADO:       { label: "Pendiente de liberar",   color: "#92400e", bg: "#fef3c7" },
  LIBERADO:         { label: "Listo para producción",  color: "#155e75", bg: "#cffafe" },
};

const TITULO_POR_ROL = {
  DISENADOR:  "Planos pendientes de subir o corregir",
  COSTOS:     "Planos pendientes de liberar",
  PRODUCCION: "Planos listos para producción",
};

/* ── Componente principal ── */

export default function DashboardPage() {
  const { data: sesion } = useSession();
  const router = useRouter();
  const rol = sesion?.user?.rol;

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!rol) return;
    setCargando(true);
    try {
      const url = rol === "GERENTE" ? "/api/dashboard/resumen" : "/api/dashboard/tareas";
      const res = await fetch(url);
      if (res.ok) setDatos(await res.json());
    } finally {
      setCargando(false);
    }
  }, [rol]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const intervalo = setInterval(cargar, 300000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  if (!rol || cargando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (rol === "GERENTE") {
    return <PanelGerente datos={datos} onRefresh={cargar} router={router} />;
  }

  return <PanelTareas rol={rol} tareas={datos || []} onRefresh={cargar} router={router} />;
}

/* ── Vista GERENTE ── */

function PanelGerente({ datos, onRefresh, router }) {
  if (!datos) return null;
  const { metricas, proyectos, actividadReciente } = datos;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#212121" }}>Dashboard ejecutivo</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888888" }}>Vista general del sistema BAUM</p>
        </div>
        <button
          onClick={onRefresh}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "7px 14px", fontSize: 13, color: "#555555", cursor: "pointer" }}
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* Sección 1 — Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <TarjetaMetrica
          label="Proyectos activos"
          valor={metricas.proyectosActivos}
          Icono={FolderOpen}
          color="#c9a84c"
        />
        <TarjetaMetrica
          label="En producción hoy"
          valor={metricas.enProduccion}
          Icono={Package}
          color="#10b981"
        />
        <TarjetaMetrica
          label="Pendientes de acción"
          valor={metricas.pendientesAccion}
          Icono={AlertCircle}
          color="#f59e0b"
        />
        <TarjetaMetrica
          label="Completadas este mes"
          valor={metricas.completadasEsteMes}
          Icono={CheckCircle}
          color="#10b981"
        />
      </div>

      {/* Secciones 2 y 3 en dos columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, alignItems: "start" }}>
        {/* Sección 2 — Proyectos */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#212121" }}>Estado de proyectos</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#aaaaaa" }}>ordenados por urgencia</p>
          </div>
          {proyectos.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#aaaaaa", fontSize: 13 }}>Sin proyectos activos</div>
          ) : (
            proyectos.map((p) => <FilaProyecto key={p.id} proyecto={p} router={router} />)
          )}
        </div>

        {/* Sección 3 — Actividad reciente */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#212121" }}>Actividad reciente</p>
          </div>
          {actividadReciente.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#aaaaaa", fontSize: 13 }}>Sin actividad registrada</div>
          ) : (
            <div style={{ padding: "8px 0" }}>
              {actividadReciente.map((ev, i) => <EventoActividad key={i} evento={ev} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaMetrica({ label, valor, Icono, color }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#aaaaaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {label}
          </p>
          <p style={{ margin: 0, fontSize: 34, fontWeight: 500, color: "#212121", lineHeight: 1 }}>{valor}</p>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icono size={20} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

const COLOR_SEMAFORO = { rojo: "#ef4444", amarillo: "#f59e0b", verde: "#10b981" };

function FilaProyecto({ proyecto, router }) {
  const { id, nombre, clienteNombre, total, completadas, semaforo, etapa } = proyecto;
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;

  return (
    <div
      onClick={() => router.push(`/dashboard/proyectos/${id}`)}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid #f5f5f5", cursor: "pointer", transition: "background 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Semáforo */}
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLOR_SEMAFORO[semaforo], flexShrink: 0, display: "block" }} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#212121", whiteSpace: "nowrap" }}>{nombre}</span>
          <span style={{ fontSize: 11, color: "#aaaaaa", whiteSpace: "nowrap" }}>{clienteNombre}</span>
        </div>

        {/* Barra de progreso */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <div style={{ flex: 1, background: "#f0f0f0", borderRadius: 4, height: 6 }}>
            <div style={{ background: "#c9a84c", height: 6, borderRadius: 4, width: `${pct}%`, transition: "width 0.4s" }} />
          </div>
          <span style={{ fontSize: 10, color: "#aaaaaa", whiteSpace: "nowrap" }}>{completadas}/{total}</span>
        </div>

        <span style={{ fontSize: 11, color: "#888888", marginTop: 3, display: "block" }}>{etapa}</span>
      </div>

      <ChevronRight size={14} style={{ color: "#cccccc", flexShrink: 0 }} />
    </div>
  );
}

function EventoActividad({ evento }) {
  const conf = TIPO_EVENTO[evento.tipo] || { Icono: Clock, color: "#888888" };
  const { Icono, color } = conf;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", borderBottom: "1px solid #f5f5f5" }}>
      {/* Avatar */}
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#212121", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#c9a84c" }}>{iniciales(evento.responsable)}</span>
      </div>

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#212121", lineHeight: 1.45 }}>{evento.descripcion}</p>
        <p style={{ margin: "3px 0 0", fontSize: 11, color: "#aaaaaa" }}>{evento.proyecto}</p>
      </div>

      {/* Icono tipo + tiempo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <Icono size={13} style={{ color }} />
        <span style={{ fontSize: 10, color: "#cccccc", whiteSpace: "nowrap" }}>{tiempoRelativo(evento.fecha)}</span>
      </div>
    </div>
  );
}

/* ── Vista otros roles ── */

function PanelTareas({ rol, tareas, onRefresh, router }) {
  const titulo = TITULO_POR_ROL[rol] || "Tareas pendientes";

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#212121" }}>{titulo}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#888888" }}>
            {tareas.length} tarea{tareas.length !== 1 ? "s" : ""} pendiente{tareas.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onRefresh}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "7px 14px", fontSize: 13, color: "#555555", cursor: "pointer" }}
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {tareas.length === 0 ? (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: 48, textAlign: "center" }}>
          <CheckCircle size={36} style={{ color: "#10b981", marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#212121" }}>Sin tareas pendientes</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#888888" }}>Todo está al día</p>
        </div>
      ) : (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          {tareas.map((clave) => {
            const conf = ESTATUS_CLAVE_LABEL[clave.estatus] || { label: clave.estatus, color: "#888888", bg: "#f3f4f6" };
            return (
              <div
                key={clave.id}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid #f5f5f5" }}
              >
                {/* Estatus badge */}
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: conf.bg, color: conf.color, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {conf.label}
                </span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#212121" }}>{clave.codigo}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 11, color: "#888888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {clave.descripcion}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: "#aaaaaa" }}>
                    {clave.proyecto.nombre} · {clave.proyecto.clienteNombre}
                  </p>
                </div>

                {/* Tiempo + botón */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: "#cccccc" }}>{tiempoRelativo(clave.updatedAt)}</span>
                  <button
                    onClick={() => router.push(`/dashboard/proyectos/${clave.proyecto.id}`)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#212121", border: "none", borderRadius: 6, padding: "5px 10px", color: "#c9a84c", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Ir al proyecto <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
