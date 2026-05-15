"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, Eye, FileText, X, Copy, Check, ChevronRight, ChevronDown,
  Pencil, Trash2, Download,
} from "lucide-react";

const ROLES_GESTION = ["DUENO", "SUPERADMIN", "GERENTE"];
const ROLES_ADMIN = ["DUENO", "SUPERADMIN"];

const TIPO_LABEL = {
  cambio: "Orden de cambio",
  extraordinaria: "Orden extraordinaria",
  trabajo: "Orden de trabajo",
};

const TIPO_ABREV = {
  cambio: "OC",
  extraordinaria: "OE",
  trabajo: "OT",
};

const ROL_FIRMA_LABEL = {
  cliente: "Cliente",
  ventas: "Ventas BAUM",
  supervisor: "Supervisor BAUM",
  adicional: "Firma adicional",
};

const ESTATUS_BADGE = {
  Pendiente:               { background: "#fef9c3", color: "#854d0e" },
  "Parcialmente firmada":  { background: "#dbeafe", color: "#1e40af" },
  Autorizada:              { background: "#dcfce7", color: "#166534" },
  Cancelada:               { background: "#fee2e2", color: "#991b1b" },
};

const COLUMNAS_FIRMA = ["cliente", "supervisor", "ventas", "adicional"];

function firmaCompleta(f) {
  return !!(f && (f.imagen || f.fecha));
}

function calcularEstatus(orden) {
  if (orden.cancelada) return "Cancelada";
  const firmas = orden.firmas || [];
  if (firmas.length === 0) return "Pendiente";
  const completas = firmas.filter(firmaCompleta).length;
  if (completas === 0) return "Pendiente";
  if (completas < firmas.length) return "Parcialmente firmada";
  return "Autorizada";
}

// editable = sin firma de cliente ni de ventas, y no cancelada
function esEditable(orden) {
  if (orden.cancelada) return false;
  const firmas = orden.firmas || [];
  const cli = firmas.find((f) => f.rol === "cliente");
  const ven = firmas.find((f) => f.rol === "ventas");
  if (cli && cli.fecha !== null) return false;
  if (ven && ven.fecha !== null) return false;
  return true;
}

function estadoFirma(orden, rolFirma) {
  if (rolFirma === "adicional" && orden.requiereFirmaAdicional === false) return "na";
  const firma = (orden.firmas || []).find((f) => f.rol === rolFirma);
  if (firma && firma.fecha !== null) return "firmado";
  return "pendiente";
}

function formatearMoneda(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha);
  if (isNaN(d)) return fecha;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function IconoFirma({ estado }) {
  if (estado === "firmado") return <span style={{ color: "#166534", fontWeight: 700, fontSize: 15 }}>✓</span>;
  if (estado === "na") return <span style={{ color: "#9ca3af", fontWeight: 600, fontSize: 14 }}>—</span>;
  return <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 15 }}>✗</span>;
}

export default function OrdenesPage() {
  const { data: sesion, status: sesionStatus } = useSession();
  const router = useRouter();
  const rol = sesion?.user?.rol;
  const puedeGestionar = ROLES_GESTION.includes(rol);
  const esAdmin = ROLES_ADMIN.includes(rol);

  const [ordenes, setOrdenes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroProyecto, setFiltroProyecto] = useState("TODOS");
  const [filtroEstatus, setFiltroEstatus] = useState("TODOS");
  const [expandidas, setExpandidas] = useState({});
  const [detalle, setDetalle] = useState(null);
  const [esMovil, setEsMovil] = useState(false);

  useEffect(() => {
    function actualizar() { setEsMovil(window.innerWidth < 860); }
    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/ordenes");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setOrdenes(data);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (sesionStatus === "authenticated") cargar();
  }, [sesionStatus, cargar]);

  useEffect(() => {
    if (sesionStatus !== "authenticated") return;
    fetch("/api/proyectos")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (Array.isArray(d)) setProyectos(d); })
      .catch(() => {});
  }, [sesionStatus]);

  const conEstatus = useMemo(
    () => ordenes.map((o) => ({ ...o, _estatus: calcularEstatus(o) })),
    [ordenes]
  );

  const totales = useMemo(() => ({
    total: conEstatus.length,
    pendientes: conEstatus.filter((o) => o._estatus === "Pendiente").length,
    parciales: conEstatus.filter((o) => o._estatus === "Parcialmente firmada").length,
    autorizadas: conEstatus.filter((o) => o._estatus === "Autorizada").length,
  }), [conEstatus]);

  const filtradas = useMemo(() => {
    return conEstatus.filter((o) => {
      if (filtroProyecto !== "TODOS" && String(o.proyectoId) !== String(filtroProyecto)) return false;
      if (filtroEstatus !== "TODOS" && o._estatus !== filtroEstatus) return false;
      return true;
    });
  }, [conEstatus, filtroProyecto, filtroEstatus]);

  const proyectoSel = useMemo(
    () => proyectos.find((p) => String(p.id) === String(filtroProyecto)) || null,
    [proyectos, filtroProyecto]
  );

  const resumenProyecto = useMemo(() => {
    if (filtroProyecto === "TODOS") return null;
    const autorizadas = conEstatus.filter(
      (o) => String(o.proyectoId) === String(filtroProyecto) && o._estatus === "Autorizada"
    );
    const total = autorizadas.reduce((acc, o) => acc + (Number(o.neto) || 0), 0);
    const nombre =
      proyectoSel?.nombre ||
      conEstatus.find((o) => String(o.proyectoId) === String(filtroProyecto))?.proyectoNombre ||
      "Proyecto";
    return { nombre, cantidad: autorizadas.length, total };
  }, [conEstatus, filtroProyecto, proyectoSel]);

  function toggleExpandir(id) {
    setExpandidas((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function cancelarOrden(id) {
    if (!confirm("¿Confirmar cancelación de esta orden? No se puede revertir.")) return;
    const res = await fetch(`/api/ordenes/${id}/cancelar`, { method: "POST" });
    if (res.ok) cargar();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "No se pudo cancelar la orden");
    }
  }

  async function eliminarOrden(id) {
    if (!confirm("¿Eliminar esta orden de forma permanente? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/ordenes/${id}`, { method: "DELETE" });
    if (res.ok) cargar();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "No se pudo eliminar la orden");
    }
  }

  if (!rol) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Sistema de gestión</div>
          <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800, color: "#212121" }}>Órdenes de cambio</h1>
        </div>
        {puedeGestionar && (
          <button
            onClick={() => router.push("/dashboard/ordenes/nueva")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#c9a84c", border: "none", borderRadius: 8, padding: "10px 18px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <Plus size={15} /> Nueva orden
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
        <Stat etiqueta="Total" valor={totales.total} color="#212121" />
        <Stat etiqueta="Pendientes" valor={totales.pendientes} color="#854d0e" />
        <Stat etiqueta="Parcialmente firmadas" valor={totales.parciales} color="#1e40af" />
        <Stat etiqueta="Autorizadas" valor={totales.autorizadas} color="#166534" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filtroProyecto} onChange={(e) => setFiltroProyecto(e.target.value)} style={{ ...sSelect, minWidth: 220 }}>
          <option value="TODOS">Todos los proyectos</option>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <select value={filtroEstatus} onChange={(e) => setFiltroEstatus(e.target.value)} style={sSelect}>
          <option value="TODOS">Todos los estatus</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Parcialmente firmada">Parcialmente firmada</option>
          <option value="Autorizada">Autorizada</option>
          <option value="Cancelada">Cancelada</option>
        </select>
      </div>

      {resumenProyecto && (
        <div style={{ background: "#212121", borderRadius: 12, padding: "18px 24px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#ffffff", fontSize: 15, fontWeight: 700 }}>{resumenProyecto.nombre}</div>
            <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
              {resumenProyecto.cantidad} {resumenProyecto.cantidad === 1 ? "orden autorizada" : "órdenes autorizadas"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#9ca3af", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total autorizado</div>
            <div style={{ color: "#c9a84c", fontSize: 24, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>
              {formatearMoneda(resumenProyecto.total)}
            </div>
          </div>
        </div>
      )}

      {esMovil ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cargando ? (
            <div style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>Cargando…</div>
          ) : filtradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: 14, background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12 }}>
              {ordenes.length === 0 ? "No hay órdenes registradas aún." : "No hay órdenes que coincidan con los filtros."}
            </div>
          ) : (
            filtradas.map((o) => (
              <CardMovil
                key={o.id}
                orden={o}
                abierta={!!expandidas[o.id]}
                onToggle={() => toggleExpandir(o.id)}
                puedeGestionar={puedeGestionar}
                esAdmin={esAdmin}
                onEditar={() => router.push(`/dashboard/ordenes/nueva?id=${o.id}`)}
                onCancelar={() => cancelarOrden(o.id)}
                onEliminar={() => eliminarOrden(o.id)}
              />
            ))
          )}
        </div>
      ) : (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 1080, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#ffffff", borderBottom: "1px solid #e5e5e5" }}>
                  <th style={{ ...sTh, width: 36 }}></th>
                  <th style={sTh}>NUM. ORDEN</th>
                  <th style={sTh}>PROYECTO</th>
                  <th style={{ ...sTh, textAlign: "center" }}>TIPO</th>
                  <th style={{ ...sTh, textAlign: "right" }}>NETO</th>
                  <th style={{ ...sTh, textAlign: "center" }}>ESTATUS</th>
                  <th style={{ ...sTh, textAlign: "center" }}>CLIENTE</th>
                  <th style={{ ...sTh, textAlign: "center" }}>SUPERVISOR</th>
                  <th style={{ ...sTh, textAlign: "center" }}>VENTAS</th>
                  <th style={{ ...sTh, textAlign: "center" }}>ADICIONAL</th>
                  <th style={{ ...sTh, textAlign: "center" }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr><td colSpan={11} style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>Cargando…</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: 14 }}>
                      {ordenes.length === 0 ? "No hay órdenes registradas aún." : "No hay órdenes que coincidan con los filtros."}
                    </td>
                  </tr>
                ) : (
                  filtradas.map((o) => {
                    const badge = ESTATUS_BADGE[o._estatus];
                    const abierta = !!expandidas[o.id];
                    const editable = esEditable(o);
                    return (
                      <FilaOrden
                        key={o.id}
                        orden={o}
                        badge={badge}
                        abierta={abierta}
                        editable={editable}
                        puedeGestionar={puedeGestionar}
                        esAdmin={esAdmin}
                        onToggle={() => toggleExpandir(o.id)}
                        onVer={() => setDetalle(o)}
                        onEditar={() => router.push(`/dashboard/ordenes/nueva?id=${o.id}`)}
                        onCancelar={() => cancelarOrden(o.id)}
                        onEliminar={() => eliminarOrden(o.id)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detalle && <ModalDetalle orden={detalle} onCerrar={() => setDetalle(null)} />}
    </div>
  );
}

function FilaOrden({ orden, badge, abierta, editable, puedeGestionar, esAdmin, onToggle, onVer, onEditar, onCancelar, onEliminar }) {
  return (
    <>
      <tr style={{ borderBottom: abierta ? "none" : "1px solid #f3f4f6", background: abierta ? "#fafafa" : "#ffffff" }}>
        <td style={{ ...sTd, paddingLeft: 14, paddingRight: 0 }}>
          <button onClick={onToggle} style={{ ...sBtnIcono, padding: 4 }} title={abierta ? "Contraer" : "Expandir"}>
            {abierta ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        </td>
        <td style={{ ...sTd, fontWeight: 600, color: "#212121", fontFamily: "monospace", cursor: "pointer" }} onClick={onVer}>{orden.numOrden}</td>
        <td style={{ ...sTd, cursor: "pointer" }} onClick={onVer}>
          <div style={{ fontSize: 13, color: "#212121" }}>{orden.proyectoNombre}</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>{orden.clienteNombre}</div>
        </td>
        <td style={{ ...sTd, textAlign: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#f3f4f6", color: "#374151", border: "1px solid #e5e5e5" }} title={TIPO_LABEL[orden.tipo] || orden.tipo}>
            {TIPO_ABREV[orden.tipo] || "—"}
          </span>
        </td>
        <td style={{ ...sTd, textAlign: "right", fontWeight: 600, color: "#212121" }}>{formatearMoneda(orden.neto)}</td>
        <td style={{ ...sTd, textAlign: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: badge.background, color: badge.color, whiteSpace: "nowrap" }}>
            {orden._estatus}
          </span>
        </td>
        {COLUMNAS_FIRMA.map((rf) => (
          <td key={rf} style={{ ...sTd, textAlign: "center" }}>
            <IconoFirma estado={estadoFirma(orden, rf)} />
          </td>
        ))}
        <td style={{ ...sTd, textAlign: "center" }}>
          <div style={{ display: "inline-flex", gap: 6 }}>
            <button onClick={onVer} style={sBtnIcono} title="Ver detalle"><Eye size={14} /></button>
            {puedeGestionar && editable && (
              <button onClick={onEditar} style={sBtnIcono} title="Editar"><Pencil size={14} /></button>
            )}
            {esAdmin && editable && (
              <button onClick={onEliminar} style={{ ...sBtnIcono, color: "#ef4444" }} title="Eliminar"><Trash2 size={14} /></button>
            )}
            {!editable && !orden.cancelada && esAdmin && (
              <button onClick={onCancelar} style={{ ...sBtnIcono, color: "#ef4444" }} title="Cancelar"><X size={14} /></button>
            )}
            <a href={`/api/ordenes/${orden.id}/pdf`} target="_blank" rel="noopener noreferrer" style={{ ...sBtnIcono, textDecoration: "none" }} title="Descargar PDF">
              <Download size={14} />
            </a>
          </div>
        </td>
      </tr>
      {abierta && (
        <tr style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
          <td colSpan={11} style={{ padding: "4px 24px 20px 50px" }}>
            <DetalleExpandido orden={orden} />
          </td>
        </tr>
      )}
    </>
  );
}

function DetalleExpandido({ orden }) {
  const [copiado, setCopiado] = useState(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const pendientes = (orden.tokens || [])
    .map((t) => {
      const firma = (orden.firmas || []).find((f) => f.rol === t.rol);
      const firmada = firma && firma.fecha !== null;
      return { ...t, firmada };
    })
    .filter((t) => !t.firmada && !orden.cancelada);

  async function copiar(texto, clave) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 2000);
    } catch { /* noop */ }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, paddingTop: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <DatoMini label="Cliente" valor={orden.clienteNombre} />
        <DatoMini label="Supervisor BAUM" valor={orden.supervisorBaum || "—"} />
        <DatoMini label="Ventas BAUM" valor={orden.ventasBaum || "—"} />
        <DatoMini label="Fecha" valor={formatearFecha(orden.fechaSolicitud)} />
        <DatoMini label="Solicitada por" valor={orden.solicitadaPor} />
      </div>
      <div>
        <div style={sMiniLabel}>Links de firma pendientes</div>
        {pendientes.length === 0 ? (
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
            {orden.cancelada ? "Orden cancelada." : "Todas las firmas están completas."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {pendientes.map((t) => {
              const link = `${origin}/ordenes/firmar/${t.token}`;
              return (
                <div key={t.rol}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#212121", marginBottom: 4 }}>{ROL_FIRMA_LABEL[t.rol] || t.rol}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      readOnly
                      value={link}
                      style={{ flex: 1, fontSize: 11, padding: "6px 8px", border: "1px solid #e5e5e5", borderRadius: 6, color: "#6b7280", background: "#ffffff", outline: "none" }}
                    />
                    <button onClick={() => copiar(link, t.rol)} style={{ ...sBtnIcono, flexShrink: 0, border: "1px solid #e5e5e5" }} title="Copiar link">
                      {copiado === t.rol ? <Check size={14} style={{ color: "#16a34a" }} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CardMovil({ orden, abierta, onToggle, puedeGestionar, esAdmin, onEditar, onCancelar, onEliminar }) {
  const badge = ESTATUS_BADGE[orden._estatus];
  const editable = esEditable(orden);
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#212121", fontSize: 14 }}>{orden.numOrden}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{formatearMoneda(orden.neto)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: badge.background, color: badge.color, whiteSpace: "nowrap" }}>
            {orden._estatus}
          </span>
          {abierta ? <ChevronDown size={16} style={{ color: "#9ca3af" }} /> : <ChevronRight size={16} style={{ color: "#9ca3af" }} />}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px 12px" }}>
        {COLUMNAS_FIRMA.map((rf) => (
          <span key={rf} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#f3f4f6", color: "#374151" }}>
            {ROL_FIRMA_LABEL[rf] || rf} <IconoFirma estado={estadoFirma(orden, rf)} />
          </span>
        ))}
      </div>

      {abierta && (
        <div style={{ borderTop: "1px solid #f3f4f6", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <DetalleExpandido orden={orden} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {puedeGestionar && editable && (
              <button onClick={onEditar} style={sBtnAccionMovil}><Pencil size={14} /> Editar</button>
            )}
            {esAdmin && editable && (
              <button onClick={onEliminar} style={{ ...sBtnAccionMovil, color: "#ef4444", borderColor: "#fecaca" }}><Trash2 size={14} /> Eliminar</button>
            )}
            {!editable && !orden.cancelada && esAdmin && (
              <button onClick={onCancelar} style={{ ...sBtnAccionMovil, color: "#ef4444", borderColor: "#fecaca" }}><X size={14} /> Cancelar</button>
            )}
            <a href={`/api/ordenes/${orden.id}/pdf`} target="_blank" rel="noopener noreferrer" style={{ ...sBtnAccionMovil, textDecoration: "none" }}>
              <Download size={14} /> PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ etiqueta, valor, color }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{etiqueta}</div>
      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{valor}</div>
    </div>
  );
}

function DatoMini({ label, valor }) {
  return (
    <div>
      <div style={sMiniLabel}>{label}</div>
      <div style={{ fontSize: 13, color: "#212121", marginTop: 2 }}>{valor}</div>
    </div>
  );
}

function ModalDetalle({ orden, onCerrar }) {
  const [copiado, setCopiado] = useState(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function tokenDeRol(rolFirma) {
    return (orden.tokens || []).find((t) => t.rol === rolFirma);
  }
  function firmaDeRol(rolFirma) {
    return (orden.firmas || []).find((f) => f.rol === rolFirma);
  }

  async function copiar(texto, clave) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* noop */
    }
  }

  const rolesOrden = (orden.firmas || []).map((f) => f.rol);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-contenido" style={{ padding: 0, maxWidth: 640, maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#ffffff", zIndex: 2 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#212121", fontFamily: "monospace" }}>{orden.numOrden}</h2>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{TIPO_LABEL[orden.tipo] || orden.tipo}</div>
          </div>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Dato label="Proyecto" valor={orden.proyectoNombre} />
            <Dato label="Cliente" valor={orden.clienteNombre} />
            <Dato label="Fecha de solicitud" valor={formatearFecha(orden.fechaSolicitud)} />
            <Dato label="Solicitada por" valor={orden.solicitadaPor} />
            <Dato label="Generada por" valor={orden.generadaPor || "—"} />
            <Dato label="Ventas BAUM" valor={orden.ventasBaum || "—"} />
            <Dato label="Supervisor BAUM" valor={orden.supervisorBaum || "—"} />
            <Dato label="Afectación (días)" valor={String(orden.afectacionDias ?? 0)} />
          </div>

          <div>
            <div style={sMiniLabel}>Concepto / Justificación</div>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#212121", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{orden.concepto}</p>
          </div>

          {(orden.partidas || []).length > 0 && (
            <div>
              <div style={sMiniLabel}>Partidas</div>
              <div style={{ marginTop: 6, border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#fafafa" }}>
                      <th style={sThMini}>Clave</th>
                      <th style={sThMini}>Concepto</th>
                      <th style={{ ...sThMini, textAlign: "right" }}>Precio</th>
                      <th style={{ ...sThMini, textAlign: "right" }}>Cant.</th>
                      <th style={{ ...sThMini, textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orden.partidas.map((p) => (
                      <tr key={p.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={sTdMini}>{p.codigo || "—"}</td>
                        <td style={sTdMini}>{p.concepto}</td>
                        <td style={{ ...sTdMini, textAlign: "right" }}>{formatearMoneda(p.precio)}</td>
                        <td style={{ ...sTdMini, textAlign: "right" }}>{p.cantidad}</td>
                        <td style={{ ...sTdMini, textAlign: "right" }}>{formatearMoneda(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10, alignItems: "flex-end", fontSize: 13 }}>
                <div style={{ color: "#6b7280" }}>Subtotal: <strong style={{ color: "#212121" }}>{formatearMoneda(orden.total)}</strong></div>
                <div style={{ color: "#6b7280" }}>IVA ({orden.ivaPorcentaje}%): <strong style={{ color: "#212121" }}>{formatearMoneda(orden.ivaImporte)}</strong></div>
                <div style={{ color: "#212121", fontWeight: 700, fontSize: 15 }}>Neto: {formatearMoneda(orden.neto)}</div>
              </div>
            </div>
          )}

          <div>
            <div style={sMiniLabel}>Firmas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {rolesOrden.map((r) => {
                const firma = firmaDeRol(r);
                const token = tokenDeRol(r);
                const completa = firmaCompleta(firma);
                const link = token ? `${origin}/ordenes/firmar/${token.token}` : null;
                return (
                  <div key={r} style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#212121" }}>{ROL_FIRMA_LABEL[r] || r}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                        background: completa ? "#dcfce7" : "#fef9c3",
                        color: completa ? "#166534" : "#854d0e",
                      }}>
                        {completa ? "Firmada" : "Pendiente"}
                      </span>
                    </div>
                    {completa ? (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                        {firma?.nombre}{firma?.empresa ? ` · ${firma.empresa}` : ""} · {formatearFecha(firma?.fecha)}
                      </div>
                    ) : link && !orden.cancelada ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <input
                          readOnly
                          value={link}
                          style={{ flex: 1, fontSize: 11, padding: "6px 8px", border: "1px solid #e5e5e5", borderRadius: 6, color: "#6b7280", background: "#fafafa", outline: "none" }}
                        />
                        <button onClick={() => copiar(link, r)} style={{ ...sBtnIcono, flexShrink: 0 }} title="Copiar link">
                          {copiado === r ? <Check size={14} style={{ color: "#16a34a" }} /> : <Copy size={14} />}
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>Sin enlace disponible</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <a
            href={`/api/ordenes/${orden.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#212121", color: "#c9a84c", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            <FileText size={15} /> Ver PDF
          </a>
        </div>
      </div>
    </div>
  );
}

function Dato({ label, valor }) {
  return (
    <div>
      <div style={sMiniLabel}>{label}</div>
      <div style={{ fontSize: 13, color: "#212121", marginTop: 2 }}>{valor}</div>
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

const sTd = { padding: "14px 16px", verticalAlign: "middle" };

const sThMini = { padding: "8px 10px", fontWeight: 700, fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" };
const sTdMini = { padding: "8px 10px", color: "#212121" };

const sMiniLabel = { fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" };

const sBtnIcono = {
  background: "transparent",
  border: "1px solid transparent",
  color: "#6b7280",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 6,
  borderRadius: 6,
};

const sBtnAccionMovil = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#ffffff",
  border: "1px solid #e5e5e5",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 600,
  color: "#374151",
  cursor: "pointer",
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
  minWidth: 140,
};
