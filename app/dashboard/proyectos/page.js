"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, RefreshCw, ChevronRight, AlertCircle, X, Copy, Check, Shuffle, Search,
} from "lucide-react";

const COLUMNAS = [
  { key: "borrador",    label: "CLAVES SIN DISEÑO",       statusKeys: ["BORRADOR", "RECHAZADO"] },
  { key: "rev_interna", label: "PEND. AUTOR. JEFE",       statusKeys: ["REVISION_INTERNA"] },
  { key: "enviado",     label: "PEND. AUTOR. CLIENTE",    statusKeys: ["ENVIADO"] },
  { key: "autorizado",  label: "PEND. LIBERACIÓN COSTOS", statusKeys: ["AUTORIZADO"] },
  { key: "produccion",  label: "EN PRODUCCIÓN",           statusKeys: ["LIBERADO", "EN_PRODUCCION"] },
];

const ESTATUS_PROYECTO = {
  ACTIVO:     { color: "#22c55e", bg: "#dcfce7", label: "Activo" },
  PAUSADO:    { color: "#f59e0b", bg: "#fef3c7", label: "Pausado" },
  COMPLETADO: { color: "#6b7280", bg: "#f3f4f6", label: "Completado" },
};

const COLORES_SEM = [
  { key: "rojo",    hex: "#ef4444" },
  { key: "amarillo", hex: "#f59e0b" },
  { key: "verde",   hex: "#10b981" },
];

function celdaColores(proyecto, statusKeys) {
  const totales = { rojo: 0, amarillo: 0, verde: 0 };
  for (const k of statusKeys) {
    const c = proyecto.conteoPorColor?.[k] || {};
    totales.rojo    += c.rojo    || 0;
    totales.amarillo += c.amarillo || 0;
    totales.verde   += c.verde   || 0;
  }
  return totales;
}

function urgenciaProyecto(proyecto) {
  let rojo = 0, amarillo = 0;
  for (const col of COLUMNAS) {
    for (const k of col.statusKeys) {
      const c = proyecto.conteoPorColor?.[k] || {};
      rojo     += c.rojo     || 0;
      amarillo += c.amarillo || 0;
    }
  }
  if (rojo > 0)     return 2000000 + rojo * 1000 + amarillo;
  if (amarillo > 0) return 1000000 + amarillo;
  return 0;
}

function generarPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function ProyectosPage() {
  const { data: sesion, status: sesionStatus } = useSession();
  const router = useRouter();
  const [proyectos, setProyectos] = useState([]);
  const [gerentes, setGerentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("urgencia");
  const [filtroEstatus, setFiltroEstatus] = useState("TODOS");
  const [modalCrear, setModalCrear] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const esGerente = sesion?.user?.rol === "GERENTE";

  const cargar = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Error al cargar datos");
        return;
      }
      setProyectos(await res.json());
      setUltimaActualizacion(new Date());
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (sesionStatus === "authenticated") {
      cargar();
      if (esGerente) {
        fetch("/api/usuarios?rol=GERENTE")
          .then((r) => r.json())
          .then(setGerentes)
          .catch(() => {});
      }
    }
  }, [sesionStatus, cargar, esGerente]);

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (sesionStatus === "authenticated") cargar();
    }, 300000);
    return () => clearInterval(intervalo);
  }, [sesionStatus, cargar]);

  const filtrados = useMemo(() => {
    const termino = busqueda.toLowerCase();
    let lista = termino
      ? proyectos.filter(
          (p) =>
            p.nombre.toLowerCase().includes(termino) ||
            p.clienteNombre.toLowerCase().includes(termino)
        )
      : proyectos;

    if (filtroEstatus !== "TODOS") {
      lista = lista.filter((p) => p.estatus === filtroEstatus);
    }

    return [...lista].sort((a, b) => {
      if (orden === "urgencia") return urgenciaProyecto(b) - urgenciaProyecto(a);
      if (orden === "reciente") return new Date(b.createdAt) - new Date(a.createdAt);
      if (orden === "antiguo")  return new Date(a.createdAt) - new Date(b.createdAt);
      if (orden === "nombre")   return a.nombre.localeCompare(b.nombre, "es");
      return 0;
    });
  }, [proyectos, busqueda, orden, filtroEstatus]);

  const totales = useMemo(() => {
    const t = { BORRADOR: 0, RECHAZADO: 0, REVISION_INTERNA: 0, ENVIADO: 0, AUTORIZADO: 0, LIBERADO: 0, EN_PRODUCCION: 0 };
    for (const p of filtrados) {
      for (const k of Object.keys(t)) t[k] += p.conteo[k] || 0;
    }
    return t;
  }, [filtrados]);

  if (sesionStatus === "loading" || (cargando && proyectos.length === 0)) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner" />
      </div>
    );
  }

  const totalActivos = filtrados.filter((p) => p.estatus === "ACTIVO").length;

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#212121" }}>Centro de Control de Planos</h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "#888888" }}>
            {totalActivos} proyecto{totalActivos !== 1 ? "s" : ""} activo{totalActivos !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setCargando(true); cargar(); }}
            disabled={cargando}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "7px 14px", color: "#555555", fontSize: 13, cursor: "pointer" }}
          >
            <RefreshCw size={14} style={{ animation: cargando ? "spin 1s linear infinite" : "none" }} />
            Actualizar
          </button>
          {esGerente && (
            <button
              onClick={() => setModalCrear(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#c9a84c", border: "none", borderRadius: 8, padding: "7px 14px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              <Plus size={14} /> Nuevo proyecto
            </button>
          )}
        </div>
      </div>

      {/* Controles: búsqueda + orden + filtro estatus */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {/* Buscador */}
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 320 }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#cccccc", pointerEvents: "none" }}
          />
          <input
            type="text"
            placeholder="Buscar cliente o proyecto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: "100%", padding: "8px 10px 8px 30px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, color: "#212121", background: "#ffffff", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Selector de orden */}
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #e5e5e5", borderRadius: 8, background: "#ffffff", fontSize: 13, color: "#212121", cursor: "pointer", outline: "none" }}
        >
          <option value="urgencia">Mayor urgencia</option>
          <option value="reciente">Más reciente</option>
          <option value="antiguo">Más antiguo</option>
          <option value="nombre">Nombre A–Z</option>
        </select>

        {/* Tabs de estatus */}
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { value: "TODOS",     label: "Todos" },
            { value: "ACTIVO",    label: "Activos" },
            { value: "PAUSADO",   label: "Pausados" },
            { value: "COMPLETADO", label: "Completados" },
          ].map(({ value, label }) => {
            const activo = filtroEstatus === value;
            return (
              <button
                key={value}
                onClick={() => setFiltroEstatus(value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  background: activo ? "#c9a84c" : "#ffffff",
                  color: activo ? "#212121" : "#555555",
                  fontSize: 13,
                  fontWeight: activo ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, gap: 12 }}>
          <AlertCircle size={32} style={{ color: "#ef4444" }} />
          <p style={{ margin: 0, color: "#555555" }}>{error}</p>
          <button
            onClick={() => { setCargando(true); cargar(); }}
            style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, cursor: "pointer", color: "#212121" }}
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 860, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}>
                  <th style={{ ...sTh, minWidth: 140, top: 0 }}>CLIENTE</th>
                  <th style={{ ...sTh, minWidth: 180, top: 0 }}>PROYECTO</th>
                  {COLUMNAS.map((col) => (
                    <th key={col.key} style={{ ...sTh, minWidth: 120, textAlign: "center", top: 0, fontSize: 9.5 }}>
                      {col.label}
                    </th>
                  ))}
                  <th style={{ ...sTh, width: 36, top: 0 }} />
                </tr>
                <tr style={{ background: "#f5f5f5", borderBottom: "2px solid #e5e5e5" }}>
                  <th style={{ ...sTotales, textAlign: "left", paddingLeft: 16, color: "#888888", top: 45 }}>
                    TOTALES · {filtrados.length} proyecto{filtrados.length !== 1 ? "s" : ""}
                  </th>
                  <th style={{ ...sTotales, top: 45 }} />
                  {COLUMNAS.map((col) => {
                    const n = col.statusKeys.reduce((s, k) => s + (totales[k] || 0), 0);
                    return (
                      <th key={col.key} style={{ ...sTotales, textAlign: "center", top: 45 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: n > 0 ? "#212121" : "#dddddd" }}>{n}</span>
                      </th>
                    );
                  })}
                  <th style={{ ...sTotales, top: 45 }} />
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "48px 20px", color: "#aaaaaa", fontSize: 14 }}>
                      {proyectos.length === 0
                        ? "No hay proyectos registrados."
                        : "No hay proyectos que coincidan con la búsqueda."}
                    </td>
                  </tr>
                ) : (
                  filtrados.map((p, i) => (
                    <FilaProyecto
                      key={p.id}
                      proyecto={p}
                      par={i % 2 === 0}
                      onClick={() => router.push(`/dashboard/proyectos/${p.id}`)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 11, color: "#aaaaaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Semáforo:
          </span>
          {[
            { color: "#10b981", label: "< 24h sin acción" },
            { color: "#f59e0b", label: "24–48h sin acción" },
            { color: "#ef4444", label: "> 48h sin acción" },
          ].map(({ color, label }) => (
            <div key={color} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#888888" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
        {ultimaActualizacion && (
          <span style={{ fontSize: 11, color: "#aaaaaa" }}>
            Última actualización:{" "}
            {ultimaActualizacion.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {modalCrear && (
        <ModalCrearProyecto
          onCerrar={() => setModalCrear(false)}
          onCreado={() => cargar()}
          gerentes={gerentes}
        />
      )}
    </div>
  );
}

function FilaProyecto({ proyecto, par, onClick }) {
  const [hov, setHov] = useState(false);
  const est = ESTATUS_PROYECTO[proyecto.estatus] || { color: "#888888", bg: "#f3f4f6", label: proyecto.estatus };

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#fffbeb" : par ? "#ffffff" : "#fafafa",
        cursor: "pointer",
        transition: "background 0.1s",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <td style={sTd}>
        <span style={{ fontSize: 13, color: "#212121", fontWeight: 500 }}>{proyecto.clienteNombre}</span>
      </td>
      <td style={sTd}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#212121" }}>{proyecto.nombre}</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: est.bg, color: est.color }}>
            {est.label}
          </span>
        </div>
      </td>
      {COLUMNAS.map((col) => {
        const colores = celdaColores(proyecto, col.statusKeys);
        const segmentos = COLORES_SEM.filter((s) => colores[s.key] > 0);
        const total = colores.rojo + colores.amarillo + colores.verde;
        return (
          <td key={col.key} style={{ ...sTd, textAlign: "center" }}>
            {total > 0 ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {segmentos.map(({ key, hex }) => (
                  <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#212121" }}>{colores[key]}</span>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: hex, display: "inline-block", flexShrink: 0 }} />
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ color: "#e0e0e0", fontSize: 14 }}>—</span>
            )}
          </td>
        );
      })}
      <td style={{ ...sTd, width: 36, textAlign: "right", paddingRight: 12 }}>
        <ChevronRight size={15} style={{ color: "#cccccc" }} />
      </td>
    </tr>
  );
}

function ModalCrearProyecto({ onCerrar, onCreado, gerentes }) {
  const [form, setForm] = useState({
    nombre: "",
    clienteNombre: "",
    pinAcceso: generarPin(),
    gerentesIds: [],
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [pinCopiado, setPinCopiado] = useState(false);

  function copiarPin() {
    navigator.clipboard.writeText(form.pinAcceso);
    setPinCopiado(true);
    setTimeout(() => setPinCopiado(false), 2000);
  }

  function toggleGerente(id) {
    setForm((f) => ({
      ...f,
      gerentesIds: f.gerentesIds.includes(id)
        ? f.gerentesIds.filter((g) => g !== id)
        : [...f.gerentesIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) return setError("El nombre del proyecto es requerido.");
    if (!form.clienteNombre.trim()) return setError("El nombre del cliente es requerido.");
    if (!/^\d{6}$/.test(form.pinAcceso)) return setError("El PIN debe ser de exactamente 6 dígitos.");
    setCargando(true);
    try {
      const res = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear proyecto");
      onCreado(data);
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-contenido" style={{ padding: 0 }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#212121" }}>Nuevo proyecto</h2>
          <button
            onClick={onCerrar}
            style={{ background: "transparent", border: "none", color: "#888888", cursor: "pointer", display: "flex", padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#888888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Nombre del proyecto <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              className="input-base"
              placeholder="Ej: Torre Zafiro — Fase 2"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              disabled={cargando}
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#888888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              Cliente (desarrolladora) <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              className="input-base"
              placeholder="Ej: Grupo Inmobiliario ZAG"
              value={form.clienteNombre}
              onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })}
              disabled={cargando}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#888888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              PIN de acceso del cliente <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input-base"
                placeholder="6 dígitos"
                value={form.pinAcceso}
                onChange={(e) => setForm({ ...form, pinAcceso: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                disabled={cargando}
                maxLength={6}
                style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: 4, flex: 1, textAlign: "center" }}
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, pinAcceso: generarPin() })}
                style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "0 12px", color: "#555555", cursor: "pointer", display: "flex", alignItems: "center" }}
                title="Generar PIN aleatorio"
              >
                <Shuffle size={15} />
              </button>
              <button
                type="button"
                onClick={copiarPin}
                style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "0 12px", color: "#555555", cursor: "pointer", display: "flex", alignItems: "center" }}
                title="Copiar PIN"
              >
                {pinCopiado ? <Check size={15} style={{ color: "#22c55e" }} /> : <Copy size={15} />}
              </button>
            </div>
            <p style={{ color: "#888888", fontSize: 12, marginTop: 6 }}>
              El cliente usa este PIN para acceder al portal y aprobar planos.
            </p>
          </div>

          {gerentes.length > 0 && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#888888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Gerentes asignados
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {gerentes.map((g) => (
                  <label
                    key={g.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: `1.5px solid ${form.gerentesIds.includes(g.id) ? "#c9a84c" : "#e5e5e5"}`,
                      background: form.gerentesIds.includes(g.id) ? "rgba(201,168,76,0.06)" : "#ffffff",
                      transition: "all 0.15s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.gerentesIds.includes(g.id)}
                      onChange={() => toggleGerente(g.id)}
                      style={{ accentColor: "#c9a84c", width: 16, height: 16 }}
                    />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#212121" }}>{g.nombre}</div>
                      <div style={{ fontSize: 12, color: "#888888" }}>{g.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button
              type="button"
              onClick={onCerrar}
              disabled={cargando}
              style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 18px", color: "#555555", fontSize: 14, cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "8px 18px", color: "#212121", fontWeight: 600, fontSize: 14, cursor: cargando ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6, opacity: cargando ? 0.7 : 1 }}
            >
              {cargando
                ? <><span className="spinner" style={{ borderTopColor: "#212121", width: 14, height: 14, borderWidth: 2 }} /> Creando…</>
                : <><Plus size={14} /> Crear proyecto</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const sTh = {
  padding: "10px 14px",
  fontWeight: 700,
  fontSize: 10,
  color: "#aaaaaa",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  textAlign: "left",
  borderRight: "1px solid #eeeeee",
  position: "sticky",
  zIndex: 2,
  background: "#fafafa",
  whiteSpace: "nowrap",
};

const sTotales = {
  padding: "8px 14px",
  fontWeight: 700,
  fontSize: 11,
  borderRight: "1px solid #eeeeee",
  position: "sticky",
  zIndex: 2,
  background: "#f5f5f5",
};

const sTd = {
  padding: "12px 14px",
  verticalAlign: "middle",
  borderRight: "1px solid #f5f5f5",
};
