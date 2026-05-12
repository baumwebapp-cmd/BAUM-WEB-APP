"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Copy, Check, Shuffle, Search,
  ChevronLeft, ChevronRight, AlertCircle,
} from "lucide-react";

const POR_PAGINA = 10;

const ESTATUS_PROYECTO = {
  ACTIVO:     { color: "#166534", bg: "#dcfce7", label: "Activo" },
  PAUSADO:    { color: "#854d0e", bg: "#fef9c3", label: "Pausado" },
  COMPLETADO: { color: "#374151", bg: "#f3f4f6", label: "Completado" },
};

function colorClave(updatedAt) {
  const horas = (Date.now() - new Date(updatedAt)) / 3600000;
  if (horas < 24) return "#10b981";
  if (horas < 48) return "#f59e0b";
  return "#ef4444";
}

function agruparPorColor(claves) {
  const mapa = {};
  for (const c of claves) {
    const color = colorClave(c.updatedAt);
    mapa[color] = (mapa[color] || 0) + 1;
  }
  return mapa;
}

function colorAvatar(letra) {
  const c = (letra || "A").toUpperCase().charCodeAt(0);
  if (c >= 65 && c <= 68) return "#3b82f6";
  if (c >= 69 && c <= 72) return "#8b5cf6";
  if (c >= 73 && c <= 76) return "#10b981";
  if (c >= 77 && c <= 80) return "#f59e0b";
  if (c >= 81 && c <= 84) return "#ef4444";
  return "#c9a84c";
}

function contarPorStatus(claves) {
  const conteo = {};
  for (const c of claves) conteo[c.estatus] = (conteo[c.estatus] || 0) + 1;
  return conteo;
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
  const [orden, setOrden] = useState("antiguo");
  const [filtroEstatus, setFiltroEstatus] = useState("TODOS");
  const [modalCrear, setModalCrear] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [esMobil, setEsMobil] = useState(false);

  useEffect(() => {
    function actualizar() { setEsMobil(window.innerWidth < 768); }
    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);

  const rol = sesion?.user?.rol;
  const puedeCrear = rol === "DUENO" || rol === "SUPERADMIN";

  const cargar = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/proyectos");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Error al cargar datos");
        return;
      }
      setProyectos(await res.json());
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (sesionStatus === "authenticated") cargar();
  }, [sesionStatus, cargar]);

  useEffect(() => {
    const intervalo = setInterval(() => {
      if (sesionStatus === "authenticated") cargar();
    }, 30000);
    return () => clearInterval(intervalo);
  }, [sesionStatus, cargar]);

  useEffect(() => {
    if (modalCrear && puedeCrear && gerentes.length === 0) {
      fetch("/api/usuarios")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setGerentes(data.filter((u) => u.rol === "GERENTE" && u.activo));
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalCrear, puedeCrear]);

  const proyectosConConteo = useMemo(() =>
    proyectos.map((p) => ({ ...p, conteo: contarPorStatus(p.claves || []) })),
  [proyectos]);

  const metricas = useMemo(() => {
    let totalClaves = 0, pendJefe = 0, pendCliente = 0, liberacion = 0, autorizados = 0;
    for (const p of proyectosConConteo) {
      const c = p.conteo;
      totalClaves += (p.claves || []).length;
      pendJefe    += c["REVISION_INTERNA"] || 0;
      pendCliente += c["ENVIADO"] || 0;
      liberacion  += c["AUTORIZADO"] || 0;
      autorizados += (c["LIBERADO"] || 0) + (c["EN_PRODUCCION"] || 0);
    }
    return { totalClaves, pendJefe, pendCliente, liberacion, autorizados };
  }, [proyectosConConteo]);

  const filtrados = useMemo(() => {
    const termino = busqueda.toLowerCase();
    let lista = termino
      ? proyectosConConteo.filter(
          (p) => p.nombre.toLowerCase().includes(termino) || p.clienteNombre.toLowerCase().includes(termino)
        )
      : proyectosConConteo;

    if (filtroEstatus !== "TODOS") lista = lista.filter((p) => p.estatus === filtroEstatus);

    return [...lista].sort((a, b) => {
      if (orden === "antiguo")  return new Date(a.createdAt) - new Date(b.createdAt);
      if (orden === "reciente") return new Date(b.createdAt) - new Date(a.createdAt);
      if (orden === "nombre")   return a.nombre.localeCompare(b.nombre, "es");
      return 0;
    });
  }, [proyectosConConteo, busqueda, orden, filtroEstatus]);

  useEffect(() => { setPagina(1); }, [busqueda, orden, filtroEstatus]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginados = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const totalesTabla = useMemo(() => {
    let claves = 0, pendJefe = 0, pendCliente = 0, costos = 0, produccion = 0;
    for (const p of filtrados) {
      claves      += (p.claves || []).length;
      pendJefe    += p.conteo["REVISION_INTERNA"] || 0;
      pendCliente += p.conteo["ENVIADO"] || 0;
      costos      += p.conteo["AUTORIZADO"] || 0;
      produccion  += (p.conteo["LIBERADO"] || 0) + (p.conteo["EN_PRODUCCION"] || 0);
    }
    return { claves, pendJefe, pendCliente, costos, produccion };
  }, [filtrados]);

  const totalesSemaforo = useMemo(() => {
    const cols = { pendJefe: {}, pendCliente: {}, costos: {}, produccion: {} };
    for (const p of filtrados) {
      for (const c of (p.claves || [])) {
        const color = colorClave(c.updatedAt);
        if (c.estatus === "REVISION_INTERNA") cols.pendJefe[color]    = (cols.pendJefe[color]    || 0) + 1;
        if (c.estatus === "ENVIADO")           cols.pendCliente[color] = (cols.pendCliente[color] || 0) + 1;
        if (c.estatus === "AUTORIZADO")        cols.costos[color]      = (cols.costos[color]      || 0) + 1;
        if (c.estatus === "LIBERADO" || c.estatus === "EN_PRODUCCION")
          cols.produccion[color] = (cols.produccion[color] || 0) + 1;
      }
    }
    return cols;
  }, [filtrados]);

  if (sesionStatus === "loading" || (cargando && proyectos.length === 0)) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner" />
      </div>
    );
  }

  const METRICAS_CONFIG = [
    { label: "TOTALES",       valor: metricas.totalClaves, color: "#c9a84c" },
    { label: "PEND. JEFE",    valor: metricas.pendJefe,    color: "#ef4444" },
    { label: "PEND. CLIENTE", valor: metricas.pendCliente, color: "#f59e0b" },
    { label: "LIBERACIÓN",    valor: metricas.liberacion,  color: "#3b82f6" },
    { label: "AUTORIZADOS",   valor: metricas.autorizados, color: "#10b981" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#212121" }}>Centro de Control de Planos</h1>
        <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6b7280" }}>
          {filtrados.length} proyecto{filtrados.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Métricas */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {METRICAS_CONFIG.map(({ label, valor, color }) => (
          <div
            key={label}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: "16px 20px 20px",
              minWidth: 130,
              flex: "1 1 130px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#212121", lineHeight: 1 }}>{valor}</div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: color, borderRadius: "0 0 2px 2px" }} />
          </div>
        ))}
      </div>

      {/* Barra de herramientas */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Buscar cliente o proyecto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: "100%", padding: "10px 14px 10px 36px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, color: "#212121", background: "#ffffff", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <select value={filtroEstatus} onChange={(e) => setFiltroEstatus(e.target.value)} style={sSelect}>
            <option value="TODOS">Todos</option>
            <option value="ACTIVO">Activos</option>
            <option value="PAUSADO">Pausados</option>
            <option value="COMPLETADO">Completados</option>
          </select>

          <select value={orden} onChange={(e) => setOrden(e.target.value)} style={sSelect}>
            <option value="antiguo">Más antiguo primero</option>
            <option value="reciente">Más reciente</option>
            <option value="nombre">Nombre A-Z</option>
          </select>

          {puedeCrear && (
            <button
              onClick={() => setModalCrear(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#c9a84c", border: "none", borderRadius: 8, padding: "10px 18px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <Plus size={15} /> Nuevo proyecto
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Estado de atención:</span>
          {[
            { color: "#10b981", label: "Activo (< 24h)" },
            { color: "#f59e0b", label: "Alerta (< 48h)" },
            { color: "#ef4444", label: "Crítico (> 48h)" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
              <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48, gap: 12 }}>
          <AlertCircle size={32} style={{ color: "#ef4444" }} />
          <p style={{ margin: 0, color: "#6b7280" }}>{error}</p>
          <button
            onClick={() => { setCargando(true); cargar(); }}
            style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, cursor: "pointer", color: "#212121" }}
          >
            Reintentar
          </button>
        </div>
      ) : esMobil ? (
        <>
          {paginados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: 14 }}>
              {proyectos.length === 0 ? "No hay proyectos registrados." : "No hay proyectos que coincidan con la búsqueda."}
            </div>
          ) : (
            <div>
              {paginados.map((p) => (
                <CardProyecto
                  key={p.id}
                  proyecto={p}
                  onClick={() => router.push(`/dashboard/proyectos/${p.id}`)}
                />
              ))}
            </div>
          )}

          {filtrados.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {Math.min((pagina - 1) * POR_PAGINA + 1, filtrados.length)}–{Math.min(pagina * POR_PAGINA, filtrados.length)} de {filtrados.length}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <BtnPag onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>
                  <ChevronLeft size={15} />
                </BtnPag>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPaginas || Math.abs(n - pagina) <= 1)
                  .reduce((acc, n, idx, arr) => {
                    if (idx > 0 && n - arr[idx - 1] > 1) acc.push("...");
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === "..." ? (
                      <span key={`em-${i}`} style={{ padding: "0 4px", color: "#9ca3af", fontSize: 13 }}>…</span>
                    ) : (
                      <BtnPag key={item} onClick={() => setPagina(item)} activo={pagina === item}>
                        {item}
                      </BtnPag>
                    )
                  )}
                <BtnPag onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
                  <ChevronRight size={15} />
                </BtnPag>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#ffffff", borderBottom: "1px solid #e5e5e5" }}>
                    <th style={{ ...sTh, minWidth: 180 }}>CLIENTE</th>
                    <th style={{ ...sTh, minWidth: 200 }}>PROYECTO</th>
                    <th style={{ ...sTh, minWidth: 80,  textAlign: "center" }}>CLAVES</th>
                    <th style={{ ...sTh, minWidth: 100, textAlign: "center" }}>PEND. JEFE</th>
                    <th style={{ ...sTh, minWidth: 115, textAlign: "center" }}>PEND. CLIENTE</th>
                    <th style={{ ...sTh, minWidth: 80,  textAlign: "center" }}>COSTOS</th>
                    <th style={{ ...sTh, minWidth: 105, textAlign: "center" }}>PRODUCCIÓN</th>
                    <th style={{ ...sTh, minWidth: 150 }}>PROGRESO</th>
                  </tr>
                  <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e5e5" }}>
                    <td style={{ ...sTotalesCell, paddingLeft: 20 }} colSpan={2}>
                      TOTALES · {filtrados.length} proyecto{filtrados.length !== 1 ? "s" : ""}
                    </td>
                    <td style={{ ...sTotalesCell, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: totalesTabla.claves > 0 ? "#212121" : "#d1d5db" }}>
                        {totalesTabla.claves || "—"}
                      </span>
                    </td>
                    {(["pendJefe", "pendCliente", "costos"]).map((col) => (
                      <td key={col} style={{ ...sTotalesCell, textAlign: "center" }}>
                        <CeldaSemTotales mapa={totalesSemaforo[col]} horizontal />
                      </td>
                    ))}
                    <td style={{ ...sTotalesCell, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: totalesTabla.produccion > 0 ? "#10b981" : "#d1d5db" }}>
                        {totalesTabla.produccion || "—"}
                      </span>
                    </td>
                    <td style={sTotalesCell} />
                  </tr>
                </thead>
                <tbody>
                  {paginados.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: 14 }}>
                        {proyectos.length === 0 ? "No hay proyectos registrados." : "No hay proyectos que coincidan con la búsqueda."}
                      </td>
                    </tr>
                  ) : (
                    paginados.map((p) => (
                      <FilaProyecto
                        key={p.id}
                        proyecto={p}
                        onClick={() => router.push(`/dashboard/proyectos/${p.id}`)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filtrados.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, filtrados.length)}–{Math.min(pagina * POR_PAGINA, filtrados.length)} de {filtrados.length} proyectos totales
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <BtnPag onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1}>
                  <ChevronLeft size={15} />
                </BtnPag>
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPaginas || Math.abs(n - pagina) <= 1)
                  .reduce((acc, n, idx, arr) => {
                    if (idx > 0 && n - arr[idx - 1] > 1) acc.push("...");
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === "..." ? (
                      <span key={`elipsis-${i}`} style={{ padding: "0 4px", color: "#9ca3af", fontSize: 13 }}>…</span>
                    ) : (
                      <BtnPag key={item} onClick={() => setPagina(item)} activo={pagina === item}>
                        {item}
                      </BtnPag>
                    )
                  )}
                <BtnPag onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas}>
                  <ChevronRight size={15} />
                </BtnPag>
              </div>
            </div>
          )}
        </>
      )}

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

function BtnPag({ onClick, disabled, activo, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32,
        height: 32,
        borderRadius: 6,
        border: activo ? "1.5px solid #c9a84c" : "1px solid #e5e5e5",
        background: activo ? "#c9a84c" : "#ffffff",
        color: activo ? "#212121" : disabled ? "#d1d5db" : "#212121",
        fontWeight: activo ? 700 : 400,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6px",
      }}
    >
      {children}
    </button>
  );
}

const ORDEN_SEM = ["#10b981", "#f59e0b", "#ef4444"];

function CeldaSemTotales({ mapa, horizontal = false }) {
  const entradas = ORDEN_SEM.map((color) => [color, mapa?.[color] || 0]).filter(([, n]) => n > 0);
  if (entradas.length === 0) return <span style={{ color: "#d1d5db", fontSize: 14 }}>—</span>;
  return (
    <div style={{
      display: "flex",
      flexDirection: horizontal ? "row" : "column",
      gap: horizontal ? 6 : 2,
      alignItems: horizontal ? "center" : "flex-start",
      justifyContent: horizontal ? "center" : undefined,
    }}>
      {entradas.map(([color, n]) => (
        <div key={color} style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#212121" }}>{String(n).padStart(2, "0")}</span>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0, marginLeft: 4 }} />
        </div>
      ))}
    </div>
  );
}

function FilaProyecto({ proyecto, onClick }) {
  const [hov, setHov] = useState(false);
  const est = ESTATUS_PROYECTO[proyecto.estatus] || { color: "#374151", bg: "#f3f4f6", label: proyecto.estatus };
  const claves = proyecto.claves || [];
  const totalClaves = claves.length;
  const completadas = claves.filter((c) => c.estatus === "LIBERADO" || c.estatus === "EN_PRODUCCION").length;
  const porcentaje = totalClaves > 0 ? Math.round((completadas / totalClaves) * 100) : 0;

  const palabras = proyecto.clienteNombre ? proyecto.clienteNombre.trim().split(/\s+/) : [];
  const iniciales = palabras.slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
  const bgAvatar = colorAvatar(iniciales[0]);

  function mapaCol(...estatuses) {
    return agruparPorColor(claves.filter((c) => estatuses.includes(c.estatus)));
  }

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "#f9fafb" : "#ffffff", cursor: "pointer", transition: "background 0.1s", borderBottom: "1px solid #f3f4f6" }}
    >
      <td style={{ ...sTd, paddingLeft: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: bgAvatar, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ffffff", fontSize: 13, fontWeight: 600,
          }}>
            {iniciales}
          </div>
          <span style={{ fontSize: 13, color: "#212121", fontWeight: 500 }}>{proyecto.clienteNombre}</span>
        </div>
      </td>
      <td style={sTd}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#212121" }}>{proyecto.nombre}</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: est.bg, color: est.color }}>
            {est.label}
          </span>
        </div>
      </td>
      <td style={{ ...sTd, textAlign: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: totalClaves > 0 ? "#212121" : "#d1d5db" }}>
          {totalClaves || "—"}
        </span>
      </td>
      <td style={{ ...sTd, textAlign: "center" }}>
        <CeldaSemTotales mapa={mapaCol("REVISION_INTERNA")} />
      </td>
      <td style={{ ...sTd, textAlign: "center" }}>
        <CeldaSemTotales mapa={mapaCol("ENVIADO")} />
      </td>
      <td style={{ ...sTd, textAlign: "center" }}>
        <CeldaSemTotales mapa={mapaCol("AUTORIZADO")} />
      </td>
      <td style={{ ...sTd, textAlign: "center" }}>
        {(() => {
          const n = claves.filter((c) => c.estatus === "LIBERADO" || c.estatus === "EN_PRODUCCION").length;
          return <span style={{ fontSize: 13, fontWeight: 700, color: n > 0 ? "#10b981" : "#d1d5db" }}>{n || "—"}</span>;
        })()}
      </td>
      <td style={{ ...sTd, minWidth: 150 }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{porcentaje}% Completado</div>
        <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 3, background: "#c9a84c", width: `${porcentaje}%`, transition: "width 0.3s ease" }} />
        </div>
      </td>
    </tr>
  );
}

function CardProyecto({ proyecto, onClick }) {
  const est = ESTATUS_PROYECTO[proyecto.estatus] || { color: "#374151", bg: "#f3f4f6", label: proyecto.estatus };
  const claves = proyecto.claves || [];
  const totalClaves = claves.length;
  const completadas = claves.filter((c) => c.estatus === "LIBERADO" || c.estatus === "EN_PRODUCCION").length;
  const porcentaje = totalClaves > 0 ? Math.round((completadas / totalClaves) * 100) : 0;

  const palabras = proyecto.clienteNombre ? proyecto.clienteNombre.trim().split(/\s+/) : [];
  const iniciales = palabras.slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
  const bgAvatar = colorAvatar(iniciales[0]);

  function mapaCol(...estatuses) {
    return agruparPorColor(claves.filter((c) => estatuses.includes(c.estatus)));
  }

  const totalProduccion = claves.filter((c) => c.estatus === "LIBERADO" || c.estatus === "EN_PRODUCCION").length;
  const INDICADORES = [
    { label: "PEND. JEFE",    mapa: mapaCol("REVISION_INTERNA") },
    { label: "PEND. CLIENTE", mapa: mapaCol("ENVIADO") },
    { label: "COSTOS",        mapa: mapaCol("AUTORIZADO") },
    { label: "PRODUCCIÓN",    tipo: "numero", valor: totalProduccion },
  ];

  return (
    <div
      onClick={onClick}
      style={{
        background: "#ffffff",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: bgAvatar, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ffffff", fontSize: 13, fontWeight: 600,
          }}>
            {iniciales}
          </div>
          <span style={{ fontSize: 13, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {proyecto.clienteNombre}
          </span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: est.bg, color: est.color, flexShrink: 0, marginLeft: 8 }}>
          {est.label}
        </span>
      </div>

      <div style={{ fontSize: 16, fontWeight: 600, color: "#212121", marginBottom: 12, wordBreak: "break-word", whiteSpace: "normal" }}>
        {proyecto.nombre}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{porcentaje}% Completado</div>
        <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 3, background: "#c9a84c", width: `${porcentaje}%`, transition: "width 0.3s ease" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {INDICADORES.map(({ label, mapa, tipo, valor }) => (
          <div key={label} style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {label}
            </div>
            {tipo === "numero" ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: valor > 0 ? "#10b981" : "#d1d5db" }}>{valor || "—"}</span>
            ) : (
              <CeldaSemTotales mapa={mapa} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalCrearProyecto({ onCerrar, onCreado, gerentes }) {
  const [form, setForm] = useState({ nombre: "", clienteNombre: "", clienteContacto: "", pinAcceso: generarPin(), gerenteId: "" });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [pinCopiado, setPinCopiado] = useState(false);

  function copiarPin() {
    navigator.clipboard.writeText(form.pinAcceso);
    setPinCopiado(true);
    setTimeout(() => setPinCopiado(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) return setError("El nombre del proyecto es requerido.");
    if (!form.clienteNombre.trim()) return setError("El nombre del cliente es requerido.");
    if (!/^\d{6}$/.test(form.pinAcceso)) return setError("El PIN debe ser de exactamente 6 dígitos.");
    setCargando(true);
    try {
      const gerentesIds = form.gerenteId ? [parseInt(form.gerenteId)] : [];
      const res = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: form.nombre, clienteNombre: form.clienteNombre, clienteContacto: form.clienteContacto, pinAcceso: form.pinAcceso, gerentesIds }),
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
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", padding: 4 }}>
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
            <label style={sLabel}>Nombre del proyecto <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="input-base" placeholder="Ej: Torre Zafiro — Fase 2" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} disabled={cargando} autoFocus />
          </div>

          <div>
            <label style={sLabel}>Cliente (desarrolladora) <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="input-base" placeholder="Ej: Grupo Inmobiliario ZAG" value={form.clienteNombre} onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })} disabled={cargando} />
          </div>

          <div>
            <label style={sLabel}>Nombre del contacto que firmará</label>
            <input className="input-base" placeholder="Ej. Juan Pérez García" value={form.clienteContacto} onChange={(e) => setForm({ ...form, clienteContacto: e.target.value })} disabled={cargando} />
          </div>

          <div>
            <label style={sLabel}>PIN de acceso del cliente <span style={{ color: "#ef4444" }}>*</span></label>
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
              <button type="button" onClick={() => setForm({ ...form, pinAcceso: generarPin() })} style={sBtnIcono} title="Generar PIN aleatorio">
                <Shuffle size={15} />
              </button>
              <button type="button" onClick={copiarPin} style={sBtnIcono} title="Copiar PIN">
                {pinCopiado ? <Check size={15} style={{ color: "#22c55e" }} /> : <Copy size={15} />}
              </button>
            </div>
            <p style={{ color: "#6b7280", fontSize: 12, marginTop: 6, marginBottom: 0 }}>
              El cliente usa este PIN para acceder al portal y aprobar planos.
            </p>
          </div>

          {gerentes.length > 0 && (
            <div>
              <label style={sLabel}>Gerente asignado</label>
              <select
                value={form.gerenteId}
                onChange={(e) => setForm({ ...form, gerenteId: e.target.value })}
                disabled={cargando}
                style={{ ...sSelect, width: "100%" }}
              >
                <option value="">— Sin gerente —</option>
                {gerentes.map((g) => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button type="button" onClick={onCerrar} disabled={cargando} style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 18px", color: "#6b7280", fontSize: 14, cursor: "pointer" }}>
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
  padding: "10px 16px",
  fontWeight: 700,
  fontSize: 10,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  textAlign: "left",
  position: "sticky",
  top: 0,
  zIndex: 2,
  background: "#ffffff",
  whiteSpace: "nowrap",
};

const sTotalesCell = {
  padding: "8px 16px",
  fontWeight: 700,
  fontSize: 11,
  color: "#6b7280",
  position: "sticky",
  top: 41,
  zIndex: 2,
  background: "#f9fafb",
  textAlign: "left",
};

const sTd = {
  padding: "16px 16px",
  verticalAlign: "middle",
  borderRight: "1px solid #f3f4f6",
};

const sSelect = {
  padding: "10px 12px",
  border: "1px solid #e5e5e5",
  borderRadius: 8,
  background: "#ffffff",
  fontSize: 13,
  color: "#212121",
  cursor: "pointer",
  outline: "none",
};

const sLabel = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};

const sBtnIcono = {
  background: "#ffffff",
  border: "1px solid #e5e5e5",
  borderRadius: 8,
  padding: "0 12px",
  color: "#6b7280",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};
