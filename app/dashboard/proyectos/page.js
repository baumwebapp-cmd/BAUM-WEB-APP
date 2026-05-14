"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Copy, Check, Shuffle, Search, ChevronDown,
} from "lucide-react";

function colorAvatar(letra) {
  const c = (letra || "A").toUpperCase().charCodeAt(0);
  if (c >= 65 && c <= 68) return "#3b82f6";
  if (c >= 69 && c <= 72) return "#8b5cf6";
  if (c >= 73 && c <= 76) return "#10b981";
  if (c >= 77 && c <= 80) return "#f59e0b";
  if (c >= 81 && c <= 84) return "#ef4444";
  return "#c9a84c";
}

function iniciales(nombre) {
  const palabras = (nombre || "").trim().split(/\s+/);
  return palabras.slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
}

function generarPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function ProyectosPage() {
  const { data: sesion, status: sesionStatus } = useSession();
  const router = useRouter();
  const [clientes, setClientes] = useState([]);
  const [gerentes, setGerentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [modalCrear, setModalCrear] = useState(false);

  const rol = sesion?.user?.rol;
  const puedeCrear = rol === "DUENO" || rol === "SUPERADMIN";

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/clientes?incluirInactivos=1");
      const data = await res.json();
      if (Array.isArray(data)) setClientes(data);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (sesionStatus === "authenticated") cargar();
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

  const clientesConProyectos = useMemo(
    () => clientes.filter((c) => (c._count?.proyectos || 0) > 0),
    [clientes]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.nombreCorto || "").toLowerCase().includes(q)
    );
  }, [clientes, busqueda]);

  if (sesionStatus === "loading" || cargando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Sistema de gestión</div>
          <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800, color: "#212121" }}>Proyectos</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
            {clientesConProyectos.length} cliente{clientesConProyectos.length !== 1 ? "s" : ""} con proyectos activos
          </p>
        </div>
        {puedeCrear && (
          <button
            onClick={() => setModalCrear(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#c9a84c", border: "none", borderRadius: 8, padding: "10px 18px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <Plus size={15} /> Nuevo proyecto
          </button>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ position: "relative", maxWidth: 420 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Buscar cliente por nombre o nombre corto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: "100%", padding: "10px 14px 10px 36px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, color: "#212121", background: "#ffffff", outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#ffffff", borderBottom: "1px solid #e5e5e5" }}>
                <th style={sTh}>CLIENTE</th>
                <th style={sTh}>NOMBRE CORTO</th>
                <th style={sTh}>MÓDULOS ACTIVOS</th>
                <th style={{ ...sTh, textAlign: "center" }}>PROYECTOS ACTIVOS</th>
                <th style={{ ...sTh, textAlign: "center" }}>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: 14 }}>
                    {clientes.length === 0
                      ? "No hay clientes registrados aún."
                      : "No hay clientes que coincidan con la búsqueda."}
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <FilaCliente key={c.id} cliente={c} onClick={() => router.push(`/dashboard/proyectos/${c.id}`)} />
                ))
              )}
            </tbody>
          </table>
        </div>
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

function FilaCliente({ cliente, onClick }) {
  const [hov, setHov] = useState(false);
  const numProyectos = cliente._count?.proyectos || 0;
  const ini = iniciales(cliente.nombre);
  const bgAvatar = colorAvatar(ini[0]);
  const activo = cliente.activo !== false;

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: hov ? "#f9fafb" : "#ffffff", cursor: "pointer", transition: "background 0.1s", borderBottom: "1px solid #f3f4f6" }}
    >
      <td style={{ ...sTd, paddingLeft: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: bgAvatar, color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
            {ini}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#212121" }}>{cliente.nombre}</span>
        </div>
      </td>
      <td style={sTd}>
        <span style={{ fontSize: 13, color: "#212121" }}>{cliente.nombreCorto || "—"}</span>
      </td>
      <td style={sTd}>
        {numProyectos > 0 ? (
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: "#c9a84c", color: "#212121" }}>
            Planos
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "#d1d5db" }}>—</span>
        )}
      </td>
      <td style={{ ...sTd, textAlign: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: numProyectos > 0 ? "#212121" : "#d1d5db" }}>
          {numProyectos || "—"}
        </span>
      </td>
      <td style={{ ...sTd, textAlign: "center" }}>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
          background: activo ? "#dcfce7" : "#f3f4f6",
          color: activo ? "#166534" : "#6b7280",
        }}>
          {activo ? "Activo" : "Inactivo"}
        </span>
      </td>
    </tr>
  );
}

export function ModalCrearProyecto({ onCerrar, onCreado, gerentes = [], clientePreseleccionado = null }) {
  const [form, setForm] = useState({
    nombre: "",
    nombreCorto: "",
    descripcion: "",
    clienteId: clientePreseleccionado ? String(clientePreseleccionado.id) : "",
    clienteContacto: "",
    pinAcceso: generarPin(),
    gerenteId: "",
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [pinCopiado, setPinCopiado] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [cargandoClientes, setCargandoClientes] = useState(!clientePreseleccionado);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);

  const cargarClientes = useCallback(async () => {
    if (clientePreseleccionado) return;
    setCargandoClientes(true);
    try {
      const res = await fetch("/api/clientes");
      const data = await res.json();
      if (Array.isArray(data)) setClientes(data);
    } finally {
      setCargandoClientes(false);
    }
  }, [clientePreseleccionado]);

  useEffect(() => { cargarClientes(); }, [cargarClientes]);

  function copiarPin() {
    navigator.clipboard.writeText(form.pinAcceso);
    setPinCopiado(true);
    setTimeout(() => setPinCopiado(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim()) return setError("El nombre del proyecto es requerido.");
    if (!form.nombreCorto.trim()) return setError("El nombre corto es requerido.");
    if (!form.clienteId) return setError("Selecciona un cliente.");
    if (!/^\d{6}$/.test(form.pinAcceso)) return setError("El PIN debe ser de exactamente 6 dígitos.");
    setCargando(true);
    try {
      const gerentesIds = form.gerenteId ? [parseInt(form.gerenteId)] : [];
      const res = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          nombreCorto: form.nombreCorto,
          descripcion: form.descripcion,
          clienteId: parseInt(form.clienteId),
          clienteContacto: form.clienteContacto,
          pinAcceso: form.pinAcceso,
          gerentesIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear proyecto");
      onCreado?.(data);
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
            <label style={sLabel}>Cliente <span style={{ color: "#ef4444" }}>*</span></label>
            {clientePreseleccionado ? (
              <div style={{ padding: "11px 14px", background: "#fafafa", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 14, color: "#212121" }}>
                <strong style={{ fontWeight: 600 }}>{clientePreseleccionado.nombreCorto}</strong>
                <span style={{ color: "#6b7280" }}> — {clientePreseleccionado.nombre}</span>
              </div>
            ) : cargandoClientes ? (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Cargando clientes…</div>
            ) : clientes.length === 0 ? (
              <div style={{ padding: "10px 14px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8, color: "#9a3412", fontSize: 12 }}>
                No hay clientes registrados. Crea uno primero con el botón "+".
                <div style={{ marginTop: 8 }}>
                  <button type="button" onClick={() => setModalNuevoCliente(true)} style={{ background: "#c9a84c", border: "none", borderRadius: 6, padding: "6px 12px", color: "#212121", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                    <Plus size={12} style={{ verticalAlign: "middle", marginRight: 4 }} /> Nuevo cliente
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <SelectorCliente
                  clientes={clientes}
                  valor={form.clienteId}
                  onCambio={(id) => setForm({ ...form, clienteId: id })}
                  disabled={cargando}
                />
                <button type="button" onClick={() => setModalNuevoCliente(true)} style={sBtnIcono} title="Crear cliente">
                  <Plus size={15} />
                </button>
              </div>
            )}
          </div>

          <div>
            <label style={sLabel}>Módulo</label>
            <select
              value="planos"
              disabled
              style={{ ...sSelect, width: "100%", opacity: 0.7, cursor: "not-allowed" }}
            >
              <option value="planos">Planos</option>
            </select>
          </div>

          <div>
            <label style={sLabel}>Nombre del proyecto <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="input-base" style={{ width: "100%" }} placeholder="Ej: Torre Zafiro — Fase 2" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} disabled={cargando} autoFocus />
          </div>

          <div>
            <label style={sLabel}>Nombre corto <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="input-base" style={{ width: "100%" }} placeholder="Ej: Torre Zafiro F2" value={form.nombreCorto} onChange={(e) => setForm({ ...form, nombreCorto: e.target.value })} disabled={cargando} />
          </div>

          <div>
            <label style={sLabel}>Descripción</label>
            <textarea
              placeholder="Notas internas del proyecto"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              disabled={cargando}
              style={{
                width: "100%",
                minHeight: 70,
                maxHeight: 160,
                resize: "vertical",
                padding: "11px 14px",
                borderRadius: 8,
                border: "1.5px solid #e0e0e0",
                fontSize: 14,
                color: "#212121",
                background: "#fafafa",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.5,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={sLabel}>Contacto del cliente que firmará</label>
            <input className="input-base" style={{ width: "100%" }} placeholder="Ej. Juan Pérez García" value={form.clienteContacto} onChange={(e) => setForm({ ...form, clienteContacto: e.target.value })} disabled={cargando} />
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

      {modalNuevoCliente && (
        <MiniModalCliente
          onCerrar={() => setModalNuevoCliente(false)}
          onCreado={async (nuevo) => {
            await cargarClientes();
            setForm((f) => ({ ...f, clienteId: String(nuevo.id) }));
            setModalNuevoCliente(false);
          }}
        />
      )}
    </div>
  );
}

function SelectorCliente({ clientes, valor, onCambio, disabled }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const seleccionado = clientes.find((c) => String(c.id) === String(valor));

  const filtrados = busqueda.trim()
    ? clientes.filter((c) => {
        const q = busqueda.toLowerCase();
        return c.nombre.toLowerCase().includes(q) || c.nombreCorto.toLowerCase().includes(q);
      })
    : clientes;

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <button
        type="button"
        onClick={() => !disabled && setAbierto((a) => !a)}
        disabled={disabled}
        style={{
          width: "100%",
          textAlign: "left",
          background: "#ffffff",
          border: "1.5px solid #e0e0e0",
          borderRadius: 8,
          padding: "11px 14px",
          fontSize: 14,
          color: seleccionado ? "#212121" : "#9ca3af",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {seleccionado ? `${seleccionado.nombreCorto} — ${seleccionado.nombre}` : "Selecciona un cliente"}
        </span>
        <ChevronDown size={15} style={{ color: "#9ca3af", flexShrink: 0, marginLeft: 8 }} />
      </button>
      {abierto && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", maxHeight: 260, overflowY: "auto", zIndex: 30 }}>
          <div style={{ padding: 8, borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, background: "#ffffff" }}>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente..."
              autoFocus
              style={{ width: "100%", padding: "7px 10px", border: "1px solid #e5e5e5", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          {filtrados.length === 0 ? (
            <div style={{ padding: 14, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>Sin coincidencias</div>
          ) : (
            filtrados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onCambio(String(c.id)); setAbierto(false); setBusqueda(""); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: String(c.id) === String(valor) ? "#fffbeb" : "transparent",
                  border: "none",
                  padding: "9px 12px",
                  fontSize: 13,
                  color: "#212121",
                  cursor: "pointer",
                }}
              >
                <strong style={{ fontWeight: 600 }}>{c.nombreCorto}</strong>
                <span style={{ color: "#6b7280" }}> — {c.nombre}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MiniModalCliente({ onCerrar, onCreado }) {
  const [nombre, setNombre] = useState("");
  const [nombreCorto, setNombreCorto] = useState("");
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim()) return setErr("Nombre requerido");
    if (!nombreCorto.trim()) return setErr("Nombre corto requerido");
    setGuardando(true);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, nombreCorto }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Error al crear");
        return;
      }
      onCreado(data);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()} style={{ zIndex: 60 }}>
      <div className="modal-contenido" style={{ maxWidth: 380, padding: 22 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#212121" }}>Nuevo cliente</h3>
        <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {err && <div style={{ padding: "8px 12px", background: "#fee2e2", borderRadius: 6, color: "#991b1b", fontSize: 12 }}>{err}</div>}
          <div>
            <label style={sLabel}>Nombre <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="input-base" style={{ width: "100%" }} value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={guardando} autoFocus />
          </div>
          <div>
            <label style={sLabel}>Nombre corto <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="input-base" style={{ width: "100%" }} value={nombreCorto} onChange={(e) => setNombreCorto(e.target.value)} disabled={guardando} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onCerrar} disabled={guardando} style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "7px 14px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
            <button type="submit" disabled={guardando} style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "7px 14px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: guardando ? "not-allowed" : "pointer", opacity: guardando ? 0.7 : 1 }}>
              {guardando ? "Guardando…" : "Crear"}
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
  background: "#ffffff",
  whiteSpace: "nowrap",
};

const sTd = {
  padding: "14px 16px",
  verticalAlign: "middle",
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
  border: "1.5px solid #e0e0e0",
  borderRadius: 8,
  width: 42,
  height: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  color: "#6b7280",
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
