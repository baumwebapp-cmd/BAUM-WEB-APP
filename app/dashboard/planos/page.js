"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Search, ChevronLeft, ChevronRight, AlertCircle,
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

function contarPorStatus(claves) {
  const conteo = {};
  for (const c of claves) conteo[c.estatus] = (conteo[c.estatus] || 0) + 1;
  return conteo;
}

export default function PlanosPage() {
  const { status: sesionStatus } = useSession();
  const router = useRouter();

  const [proyectos, setProyectos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("antiguo");
  const [filtroEstatus, setFiltroEstatus] = useState("TODOS");
  const [pagina, setPagina] = useState(1);
  const [esMobil, setEsMobil] = useState(false);

  useEffect(() => {
    function actualizar() { setEsMobil(window.innerWidth < 768); }
    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);

  const cargar = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/proyectos");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Error al cargar datos");
        return;
      }
      const data = await res.json();
      setProyectos(Array.isArray(data) ? data : []);
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
    }, 300000);
    return () => clearInterval(intervalo);
  }, [sesionStatus, cargar]);

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
      ? proyectosConConteo.filter((p) => {
          const cli = (p.cliente?.nombre || p.cliente?.nombreCorto || "").toLowerCase();
          return p.nombre.toLowerCase().includes(termino) || cli.includes(termino);
        })
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
    let claves = 0, produccion = 0;
    for (const p of filtrados) {
      claves     += (p.claves || []).length;
      produccion += (p.conteo["LIBERADO"] || 0) + (p.conteo["EN_PRODUCCION"] || 0);
    }
    return { claves, produccion };
  }, [filtrados]);

  const totalesSemaforo = useMemo(() => {
    const cols = { pendJefe: {}, pendCliente: {}, costos: {} };
    for (const p of filtrados) {
      for (const c of (p.claves || [])) {
        const color = colorClave(c.updatedAt);
        if (c.estatus === "REVISION_INTERNA") cols.pendJefe[color]    = (cols.pendJefe[color]    || 0) + 1;
        if (c.estatus === "ENVIADO")           cols.pendCliente[color] = (cols.pendCliente[color] || 0) + 1;
        if (c.estatus === "AUTORIZADO")        cols.costos[color]      = (cols.costos[color]      || 0) + 1;
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
        <div style={{ fontSize: 12, color: "#9ca3af" }}>Sistema de gestión</div>
        <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800, color: "#212121" }}>
          Centro de Control de Planos
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
          {filtrados.length} proyecto{filtrados.length !== 1 ? "s" : ""}
        </p>
      </div>

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

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 180 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Buscar proyecto o cliente..."
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
                <CardProyecto key={p.id} proyecto={p} onClick={() => router.push(`/dashboard/planos/${p.id}`)} />
              ))}
            </div>
          )}

          {filtrados.length > 0 && (
            <Paginador filtrados={filtrados} pagina={pagina} totalPaginas={totalPaginas} onCambio={setPagina} compact />
          )}
        </>
      ) : (
        <>
          <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#ffffff", borderBottom: "1px solid #e5e5e5" }}>
                    <th style={{ ...sTh, minWidth: 200 }}>PROYECTO</th>
                    <th style={{ ...sTh, minWidth: 160 }}>CLIENTE</th>
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
                      <FilaProyecto key={p.id} proyecto={p} onClick={() => router.push(`/dashboard/planos/${p.id}`)} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filtrados.length > 0 && (
            <Paginador filtrados={filtrados} pagina={pagina} totalPaginas={totalPaginas} onCambio={setPagina} />
          )}
        </>
      )}
    </div>
  );
}

function Paginador({ filtrados, pagina, totalPaginas, onCambio, compact = false }) {
  const desde = Math.min((pagina - 1) * POR_PAGINA + 1, filtrados.length);
  const hasta = Math.min(pagina * POR_PAGINA, filtrados.length);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: compact ? 8 : 16, flexWrap: "wrap", gap: 8 }}>
      <span style={{ fontSize: compact ? 12 : 13, color: "#6b7280" }}>
        {compact ? `${desde}–${hasta} de ${filtrados.length}` : `Mostrando ${desde}–${hasta} de ${filtrados.length} proyectos totales`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <BtnPag onClick={() => onCambio(Math.max(1, pagina - 1))} disabled={pagina === 1}>
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
              <BtnPag key={item} onClick={() => onCambio(item)} activo={pagina === item}>
                {item}
              </BtnPag>
            )
          )}
        <BtnPag onClick={() => onCambio(Math.min(totalPaginas, pagina + 1))} disabled={pagina === totalPaginas}>
          <ChevronRight size={15} />
        </BtnPag>
      </div>
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
  const cli = proyecto.cliente?.nombre || proyecto.cliente?.nombreCorto || "Sin cliente";
  const claves = proyecto.claves || [];
  const totalClaves = claves.length;
  const completadas = claves.filter((c) => c.estatus === "LIBERADO" || c.estatus === "EN_PRODUCCION").length;
  const porcentaje = totalClaves > 0 ? Math.round((completadas / totalClaves) * 100) : 0;

  function mapaCol(...estatuses) {
    return agruparPorColor(claves.filter((c) => estatuses.includes(c.estatus)));
  }

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "#f9fafb" : "#ffffff", cursor: onClick ? "pointer" : "default", transition: "background 0.1s", borderBottom: "1px solid #f3f4f6" }}
    >
      <td style={{ ...sTd, paddingLeft: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#212121" }}>{proyecto.nombre}</div>
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: est.bg, color: est.color }}>
            {est.label}
          </span>
        </div>
      </td>
      <td style={sTd}>
        <span style={{ fontSize: 13, color: "#6b7280" }}>{cli}</span>
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
  const cli = proyecto.cliente?.nombre || proyecto.cliente?.nombreCorto || "Sin cliente";
  const claves = proyecto.claves || [];
  const totalClaves = claves.length;
  const completadas = claves.filter((c) => c.estatus === "LIBERADO" || c.estatus === "EN_PRODUCCION").length;
  const porcentaje = totalClaves > 0 ? Math.round((completadas / totalClaves) * 100) : 0;

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
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "#212121", wordBreak: "break-word" }}>
          {proyecto.nombre}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: est.bg, color: est.color, flexShrink: 0, marginLeft: 8 }}>
          {est.label}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>{cli}</div>

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

const sTh = {
  padding: "10px 16px",
  fontWeight: 700,
  fontSize: 10,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  textAlign: "left",
  background: "#ffffff",
  whiteSpace: "nowrap",
};

const sTd = {
  padding: "14px 16px",
  verticalAlign: "middle",
};

const sTotalesCell = {
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  background: "#f9fafb",
  whiteSpace: "nowrap",
};

const sSelect = {
  padding: "10px 14px",
  border: "1px solid #e5e5e5",
  borderRadius: 8,
  fontSize: 13,
  color: "#212121",
  background: "#ffffff",
  outline: "none",
  cursor: "pointer",
};
