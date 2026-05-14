"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Power, Search, Eye, X } from "lucide-react";

const VACIO_FORM = {
  nombre: "",
  nombreCorto: "",
  descripcion: "",
  razonSocial: "",
  rfc: "",
};

function puedeGestionar(rol) {
  return rol === "DUENO" || rol === "SUPERADMIN";
}

function rfcParcialValido(rfc) {
  if (!rfc) return true;
  return /^[A-ZÑ&]{3,4}[0-9]{0,6}[A-Z0-9]{0,3}$/.test(rfc);
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

function calcularEstado(cliente) {
  if (cliente.activo === false) return "INACTIVO";
  if (cliente.proyectos && cliente.proyectos.length > 0) return "ACTIVO";
  return "PENDIENTE";
}

function iniciales(nombre) {
  const palabras = (nombre || "").trim().split(/\s+/);
  return palabras.slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";
}

function formatearFecha(fecha) {
  if (!fecha) return "";
  return new Date(fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function truncar(texto, max) {
  if (!texto) return "—";
  return texto.length > max ? texto.slice(0, max) + "…" : texto;
}

const ESTILO_BADGE = {
  ACTIVO: { background: "#dcfce7", color: "#166534" },
  PENDIENTE: { background: "#fef9c3", color: "#854d0e" },
  INACTIVO: { background: "#f3f4f6", color: "#6b7280" },
};

export default function ClientesPage() {
  const { data: sesion } = useSession();
  const router = useRouter();
  const rol = sesion?.user?.rol;
  const puedoGestionar = puedeGestionar(rol);

  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");

  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalConfirmar, setModalConfirmar] = useState(null);

  const [form, setForm] = useState(VACIO_FORM);
  const [errForm, setErrForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/clientes?incluirInactivos=1");
      const data = await res.json();
      if (res.ok) setClientes(data);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function abrirCrear() {
    setForm(VACIO_FORM);
    setErrForm("");
    setModalCrear(true);
  }

  function abrirEditar(cliente) {
    setForm({
      nombre: cliente.nombre || "",
      nombreCorto: cliente.nombreCorto || "",
      descripcion: cliente.descripcion || "",
      razonSocial: cliente.razonSocial || "",
      rfc: cliente.rfc || "",
    });
    setErrForm("");
    setModalEditar(cliente);
  }

  function actualizarCampo(campo, valor) {
    if (campo === "rfc") {
      const upper = valor.toUpperCase().slice(0, 13);
      setForm((f) => ({ ...f, rfc: upper }));
    } else {
      setForm((f) => ({ ...f, [campo]: valor }));
    }
    setErrForm("");
  }

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return setErrForm("El nombre es requerido.");
    if (!form.nombreCorto.trim()) return setErrForm("El nombre corto es requerido.");
    if (form.rfc && !rfcParcialValido(form.rfc)) {
      return setErrForm("El RFC tiene un formato inválido.");
    }
    setGuardando(true);
    try {
      const url = modalEditar ? `/api/clientes/${modalEditar.id}` : "/api/clientes";
      const metodo = modalEditar ? "PATCH" : "POST";
      const res = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrForm(data.error || "Error al guardar");
        return;
      }
      setModalCrear(false);
      setModalEditar(null);
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarDesactivar() {
    if (!modalConfirmar) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/clientes/${modalConfirmar.id}`, { method: "DELETE" });
      if (res.ok) {
        setModalConfirmar(null);
        await cargar();
      }
    } finally {
      setGuardando(false);
    }
  }

  const clientesConEstado = clientes.map((c) => ({ ...c, _estado: calcularEstado(c) }));

  const totales = {
    total: clientesConEstado.length,
    activos: clientesConEstado.filter((c) => c._estado === "ACTIVO").length,
    pendientes: clientesConEstado.filter((c) => c._estado === "PENDIENTE").length,
    inactivos: clientesConEstado.filter((c) => c._estado === "INACTIVO").length,
  };

  const filtrados = clientesConEstado.filter((c) => {
    if (filtroEstado !== "TODOS" && c._estado !== filtroEstado) return false;
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.nombreCorto.toLowerCase().includes(q) ||
      (c.rfc && c.rfc.toLowerCase().includes(q)) ||
      (c.razonSocial && c.razonSocial.toLowerCase().includes(q))
    );
  });

  if (!rol) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Sistema de gestión</div>
          <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800, color: "#212121" }}>Clientes</h1>
        </div>
        {puedoGestionar && (
          <button onClick={abrirCrear} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#c9a84c", border: "none", borderRadius: 8, padding: "10px 18px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            <Plus size={15} /> Nuevo cliente
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
        <TarjetaStat etiqueta="Total clientes" valor={totales.total} color="#212121" />
        <TarjetaStat etiqueta="Activos" valor={totales.activos} color="#16a34a" />
        <TarjetaStat etiqueta="Pendientes" valor={totales.pendientes} color="#c9a84c" />
        <TarjetaStat etiqueta="Inactivos" valor={totales.inactivos} color="#6b7280" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Buscar por nombre, nombre corto, RFC o razón social..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: "100%", padding: "10px 14px 10px 36px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, color: "#212121", background: "#ffffff", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{ padding: "10px 14px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, color: "#212121", background: "#ffffff", outline: "none", cursor: "pointer", minWidth: 140 }}
        >
          <option value="TODOS">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="INACTIVO">Inactivo</option>
        </select>
      </div>

      <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#ffffff", borderBottom: "1px solid #e5e5e5" }}>
                <th style={sTh}>CLIENTE</th>
                <th style={sTh}>RAZÓN SOCIAL</th>
                <th style={sTh}>RFC</th>
                <th style={sTh}>PROYECTOS</th>
                <th style={{ ...sTh, textAlign: "center" }}>ESTADO</th>
                <th style={{ ...sTh, textAlign: "center", minWidth: 110 }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>Cargando…</td></tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: 14 }}>
                    {clientes.length === 0
                      ? "No hay clientes registrados aún."
                      : "No hay clientes que coincidan con los filtros."}
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => {
                  const ini = iniciales(c.nombre);
                  const bgAvatar = colorAvatar(ini[0]);
                  const numProyectos = c._count?.proyectos ?? c.proyectos?.length ?? 0;
                  const badge = ESTILO_BADGE[c._estado];
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ ...sTd, paddingLeft: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 38, height: 38, borderRadius: "50%", background: bgAvatar, color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
                            {ini}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#212121" }}>{c.nombre}</span>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>Registrado {formatearFecha(c.createdAt)}</span>
                          </div>
                        </div>
                      </td>
                      <td style={sTd}>
                        <span style={{ fontSize: 12, color: "#6b7280" }} title={c.razonSocial || ""}>{truncar(c.razonSocial, 20)}</span>
                      </td>
                      <td style={sTd}>
                        <span style={{ fontSize: 12, color: "#212121", fontFamily: "monospace", letterSpacing: 0.5 }}>{c.rfc || "—"}</span>
                      </td>
                      <td style={sTd}>
                        {numProyectos > 0 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/proyectos/${c.id}`); }}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              color: "#c9a84c",
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              textDecoration: "underline",
                              textUnderlineOffset: 2,
                            }}
                          >
                            {numProyectos} {numProyectos === 1 ? "proyecto" : "proyectos"}
                          </button>
                        ) : (
                          <span style={{ fontSize: 13, color: "#d1d5db" }}>—</span>
                        )}
                      </td>
                      <td style={{ ...sTd, textAlign: "center" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                          background: badge.background,
                          color: badge.color,
                          textTransform: "capitalize",
                        }}>
                          {c._estado.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ ...sTd, textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {puedoGestionar && (
                            <button onClick={() => abrirEditar(c)} style={sBtnIconoTabla} title="Editar">
                              <Pencil size={14} />
                            </button>
                          )}
                          <button style={sBtnIconoTabla} title="Ver">
                            <Eye size={14} />
                          </button>
                          {puedoGestionar && c.activo && (
                            <button onClick={() => setModalConfirmar(c)} style={{ ...sBtnIconoTabla, color: "#ef4444" }} title="Desactivar">
                              <Power size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(modalCrear || modalEditar) && (
        <ModalCliente
          modo={modalEditar ? "editar" : "crear"}
          form={form}
          err={errForm}
          guardando={guardando}
          onCampo={actualizarCampo}
          onGuardar={guardar}
          onCerrar={() => { setModalCrear(false); setModalEditar(null); }}
        />
      )}

      {modalConfirmar && (
        <ModalConfirmar
          titulo="Desactivar cliente"
          mensaje={`¿Confirmar desactivación de "${modalConfirmar.nombre}"? Los proyectos asociados no se eliminan.`}
          confirmar="Desactivar"
          guardando={guardando}
          onConfirmar={confirmarDesactivar}
          onCerrar={() => setModalConfirmar(null)}
        />
      )}
    </div>
  );
}

function TarjetaStat({ etiqueta, valor, color }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>{etiqueta}</div>
      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color, lineHeight: 1.1 }}>{valor}</div>
    </div>
  );
}

function ModalCliente({ modo, form, err, guardando, onCampo, onGuardar, onCerrar }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-contenido" style={{ padding: 0, maxWidth: 480 }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#212121" }}>
            {modo === "editar" ? "Editar cliente" : "Nuevo cliente"}
          </h2>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onGuardar} style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {err && (
            <div style={{ padding: "10px 14px", background: "#fee2e2", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
              {err}
            </div>
          )}

          <div>
            <label style={sLabel}>Nombre <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="input-base" style={{ width: "100%" }} placeholder="Ej. Desarrolladora Nativa SA de CV" value={form.nombre} onChange={(e) => onCampo("nombre", e.target.value)} disabled={guardando} autoFocus />
          </div>

          <div>
            <label style={sLabel}>Nombre corto <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="input-base" style={{ width: "100%" }} placeholder="Ej. Nativa" value={form.nombreCorto} onChange={(e) => onCampo("nombreCorto", e.target.value)} disabled={guardando} />
          </div>

          <div>
            <label style={sLabel}>Descripción</label>
            <textarea
              placeholder="Notas internas del cliente"
              value={form.descripcion}
              onChange={(e) => onCampo("descripcion", e.target.value)}
              disabled={guardando}
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
            <label style={sLabel}>Razón social</label>
            <input className="input-base" style={{ width: "100%" }} placeholder="Razón social legal" value={form.razonSocial} onChange={(e) => onCampo("razonSocial", e.target.value)} disabled={guardando} />
          </div>

          <div>
            <label style={sLabel}>RFC</label>
            <input
              className="input-base"
              style={{ width: "100%", fontFamily: "monospace", letterSpacing: 1 }}
              placeholder="XAXX010101000"
              value={form.rfc}
              onChange={(e) => onCampo("rfc", e.target.value)}
              disabled={guardando}
              maxLength={13}
            />
            <p style={{ margin: "4px 0 0", fontSize: 11, color: form.rfc && !rfcParcialValido(form.rfc) ? "#ef4444" : "#9ca3af" }}>
              {form.rfc && !rfcParcialValido(form.rfc)
                ? "Formato inválido — el RFC mexicano usa letras y números."
                : "Máximo 13 caracteres, formato mexicano."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button type="button" onClick={onCerrar} disabled={guardando} style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 18px", color: "#6b7280", fontSize: 14, cursor: "pointer" }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardando} style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "8px 18px", color: "#212121", fontWeight: 600, fontSize: 14, cursor: guardando ? "not-allowed" : "pointer", opacity: guardando ? 0.7 : 1 }}>
              {guardando ? "Guardando…" : modo === "editar" ? "Guardar cambios" : "Crear cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalConfirmar({ titulo, mensaje, confirmar, guardando, onConfirmar, onCerrar }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-contenido" style={{ maxWidth: 420, padding: 24 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#212121" }}>{titulo}</h3>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#555555", lineHeight: 1.5 }}>{mensaje}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCerrar} disabled={guardando} style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 16px", color: "#6b7280", fontSize: 14, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={onConfirmar} disabled={guardando} style={{ background: "#ef4444", border: "none", borderRadius: 8, padding: "8px 16px", color: "#ffffff", fontWeight: 600, fontSize: 14, cursor: guardando ? "not-allowed" : "pointer", opacity: guardando ? 0.7 : 1 }}>
            {guardando ? "Procesando…" : confirmar}
          </button>
        </div>
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

const sBtnIconoTabla = {
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

const sLabel = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};
