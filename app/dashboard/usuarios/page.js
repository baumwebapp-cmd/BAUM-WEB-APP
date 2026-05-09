"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, Pencil, UserX, UserCheck, Search, ChevronDown } from "lucide-react";

const ROLES = ["GERENTE", "DISENADOR", "COSTOS", "PRODUCCION"];
const ETIQUETA_ROL = {
  GERENTE: "Gerente",
  DISENADOR: "Diseñador",
  COSTOS: "Costos",
  PRODUCCION: "Producción",
};
const COLOR_ROL = {
  GERENTE: { background: "#1a1a1a", color: "#c9a84c" },
  DISENADOR: { background: "#1e3a5f", color: "#93c5fd" },
  COSTOS: { background: "#14532d", color: "#86efac" },
  PRODUCCION: { background: "#4a1d1d", color: "#fca5a5" },
};

const VACIO_FORM = {
  nombre: "",
  email: "",
  rol: "DISENADOR",
  password: "",
  passwordConfirm: "",
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("");

  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalConfirmar, setModalConfirmar] = useState(null);

  const [form, setForm] = useState(VACIO_FORM);
  const [errForm, setErrForm] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [mostrarPass, setMostrarPass] = useState(false);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/usuarios");
      const data = await res.json();
      if (res.ok) setUsuarios(data);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  const usuariosFiltrados = usuarios.filter((u) => {
    const texto = busqueda.toLowerCase();
    const coincideTexto =
      !texto || u.nombre.toLowerCase().includes(texto) || u.email.toLowerCase().includes(texto);
    const coincideRol = !filtroRol || u.rol === filtroRol;
    const coincideActivo =
      filtroActivo === "" ||
      (filtroActivo === "activos" && u.activo) ||
      (filtroActivo === "inactivos" && !u.activo);
    return coincideTexto && coincideRol && coincideActivo;
  });

  function abrirCrear() {
    setForm(VACIO_FORM);
    setErrForm("");
    setMostrarPass(false);
    setModalCrear(true);
  }

  function abrirEditar(usuario) {
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      password: "",
      passwordConfirm: "",
    });
    setErrForm("");
    setMostrarPass(false);
    setModalEditar(usuario);
  }

  function cerrarModales() {
    setModalCrear(false);
    setModalEditar(null);
    setModalConfirmar(null);
  }

  function cambiarForm(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrForm("");
  }

  async function guardarCrear(e) {
    e.preventDefault();
    const { nombre, email, rol, password, passwordConfirm } = form;
    if (!nombre.trim()) return setErrForm("El nombre es requerido.");
    if (!email.trim()) return setErrForm("El email es requerido.");
    if (!password) return setErrForm("La contraseña es requerida.");
    if (password.length < 8) return setErrForm("La contraseña debe tener al menos 8 caracteres.");
    if (password !== passwordConfirm) return setErrForm("Las contraseñas no coinciden.");

    setGuardando(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), email: email.trim(), rol, password }),
      });
      const data = await res.json();
      if (!res.ok) return setErrForm(data.error || "Error al crear usuario.");
      await cargarUsuarios();
      cerrarModales();
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEditar(e) {
    e.preventDefault();
    const { nombre, email, rol, password, passwordConfirm } = form;
    if (!nombre.trim()) return setErrForm("El nombre es requerido.");
    if (!email.trim()) return setErrForm("El email es requerido.");
    if (password && password.length < 8) return setErrForm("La contraseña debe tener al menos 8 caracteres.");
    if (password && password !== passwordConfirm) return setErrForm("Las contraseñas no coinciden.");

    const body = { nombre: nombre.trim(), email: email.trim(), rol };
    if (password) body.passwordNuevo = password;

    setGuardando(true);
    try {
      const res = await fetch(`/api/usuarios/${modalEditar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return setErrForm(data.error || "Error al actualizar usuario.");
      await cargarUsuarios();
      cerrarModales();
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(usuario) {
    setGuardando(true);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !usuario.activo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalConfirmar(null);
        setErrForm(data.error || "Error al cambiar estado.");
        return;
      }
      await cargarUsuarios();
      cerrarModales();
    } finally {
      setGuardando(false);
    }
  }

  /* Conteo por rol para la barra de resumen */
  const conteoRol = ROLES.reduce((acc, r) => {
    acc[r] = usuarios.filter((u) => u.rol === r).length;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#212121", margin: 0 }}>Usuarios</h1>
          <p style={{ color: "#888888", fontSize: 13, margin: "4px 0 0" }}>
            {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""} registrado{usuarios.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button className="btn-primario" onClick={abrirCrear} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <UserPlus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Resumen por rol */}
      {!cargando && usuarios.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {ROLES.map((r) => {
            const { background, color } = COLOR_ROL[r];
            return (
              <button
                key={r}
                onClick={() => setFiltroRol(filtroRol === r ? "" : r)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 14px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${filtroRol === r ? color : "transparent"}`,
                  background: filtroRol === r ? background : "#f5f5f5",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: filtroRol === r ? color : "#212121", lineHeight: 1 }}>
                  {conteoRol[r]}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                  background: "transparent",
                  color: filtroRol === r ? color : "#666666",
                  border: `1px solid ${filtroRol === r ? color : "#d4d4d4"}`,
                }}>
                  {ETIQUETA_ROL[r]}
                </span>
              </button>
            );
          })}
          {filtroRol && (
            <button
              onClick={() => setFiltroRol("")}
              style={{ fontSize: 12, color: "#888888", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: "0 6px" }}
            >
              × Limpiar filtro
            </button>
          )}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#cccccc" }} />
          <input
            className="input-base"
            style={{ paddingLeft: 32, width: "100%" }}
            placeholder="Buscar por nombre o email…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <SelectFiltro value={filtroRol} onChange={setFiltroRol} placeholder="Todos los roles">
          {ROLES.map((r) => (
            <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
          ))}
        </SelectFiltro>
        <SelectFiltro value={filtroActivo} onChange={setFiltroActivo} placeholder="Todos">
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </SelectFiltro>
      </div>

      {/* Grid de tarjetas */}
      {cargando ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 64 }}>
          <div className="spinner" />
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 64, color: "#888888", fontSize: 14 }}>
          No se encontraron usuarios con ese criterio.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {usuariosFiltrados.map((u) => (
            <TarjetaUsuario
              key={u.id}
              usuario={u}
              onEditar={() => abrirEditar(u)}
              onToggle={() => setModalConfirmar(u)}
            />
          ))}
        </div>
      )}

      {/* Modal crear */}
      {modalCrear && (
        <Modal titulo="Nuevo usuario" onCerrar={cerrarModales}>
          <form onSubmit={guardarCrear}>
            <FormUsuario
              form={form}
              onChange={cambiarForm}
              mostrarPass={mostrarPass}
              setMostrarPass={setMostrarPass}
              esEdicion={false}
              errForm={errForm}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" className="btn-secundario" onClick={cerrarModales} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primario" disabled={guardando}>
                {guardando ? "Creando…" : "Crear usuario"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal editar */}
      {modalEditar && (
        <Modal titulo={`Editar: ${modalEditar.nombre}`} onCerrar={cerrarModales}>
          <form onSubmit={guardarEditar}>
            <FormUsuario
              form={form}
              onChange={cambiarForm}
              mostrarPass={mostrarPass}
              setMostrarPass={setMostrarPass}
              esEdicion={true}
              errForm={errForm}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" className="btn-secundario" onClick={cerrarModales} disabled={guardando}>
                Cancelar
              </button>
              <button type="submit" className="btn-primario" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal confirmar toggle activo */}
      {modalConfirmar && (
        <Modal titulo={modalConfirmar.activo ? "Desactivar usuario" : "Activar usuario"} onCerrar={cerrarModales}>
          <p style={{ color: "var(--texto-suave)", marginBottom: 20, lineHeight: 1.6 }}>
            {modalConfirmar.activo
              ? `¿Desactivar la cuenta de ${modalConfirmar.nombre}? No podrá iniciar sesión, pero su historial se conserva.`
              : `¿Reactivar la cuenta de ${modalConfirmar.nombre}? Podrá volver a iniciar sesión.`}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn-secundario" onClick={cerrarModales} disabled={guardando}>
              Cancelar
            </button>
            <button
              className={modalConfirmar.activo ? "btn-peligro" : "btn-primario"}
              onClick={() => toggleActivo(modalConfirmar)}
              disabled={guardando}
            >
              {guardando ? "Procesando…" : modalConfirmar.activo ? "Desactivar" : "Activar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Componentes auxiliares ── */

function TarjetaUsuario({ usuario: u, onEditar, onToggle }) {
  const [hov, setHov] = useState(false);
  const { background: rolBg, color: rolColor } = COLOR_ROL[u.rol] || { background: "#333", color: "#fff" };

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#ffffff",
        border: `1.5px solid ${hov ? "#e0d5b8" : "#e5e5e5"}`,
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        opacity: u.activo ? 1 : 0.55,
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: hov ? "0 4px 18px rgba(0,0,0,0.07)" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Fila superior: avatar + info + badge rol */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <AvatarGrande nombre={u.nombre} rolBg={rolBg} rolColor={rolColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#212121", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {u.nombre}
          </div>
          <div style={{ fontSize: 12, color: "#888888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {u.email}
          </div>
        </div>
        <span style={{
          flexShrink: 0,
          display: "inline-block",
          padding: "3px 10px",
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          background: "transparent",
          color: "#666666",
          border: "1px solid #d4d4d4",
        }}>
          {ETIQUETA_ROL[u.rol]}
        </span>
      </div>

      {/* Divisor */}
      <div style={{ height: 1, background: "#f0f0f0" }} />

      {/* Fila inferior: estado + fecha + acciones */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Estado */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 12, fontWeight: 600,
          color: u.activo ? "#16a34a" : "#888888",
          background: u.activo ? "#dcfce7" : "#f3f4f6",
          padding: "3px 10px", borderRadius: 20,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.activo ? "#22c55e" : "#aaaaaa", display: "inline-block" }} />
          {u.activo ? "Activo" : "Inactivo"}
        </span>

        {/* Fecha */}
        <span style={{ fontSize: 11, color: "#aaaaaa", marginLeft: "auto" }}>
          Alta: {new Date(u.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
        </span>

        {/* Botones */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            title="Editar"
            onClick={onEditar}
            style={{
              background: "#f5f5f5", border: "none", borderRadius: 7,
              padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center",
              color: "#555555", transition: "background 0.1s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#e8e8e8"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#f5f5f5"}
          >
            <Pencil size={13} />
          </button>
          <button
            title={u.activo ? "Desactivar usuario" : "Activar usuario"}
            onClick={onToggle}
            style={{
              background: u.activo ? "#fff1f1" : "#f0fdf4",
              border: "none", borderRadius: 7,
              padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center",
              color: u.activo ? "#ef4444" : "#22c55e",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = u.activo ? "#fde8e8" : "#dcfce7"}
            onMouseLeave={(e) => e.currentTarget.style.background = u.activo ? "#fff1f1" : "#f0fdf4"}
          >
            {u.activo ? <UserX size={13} /> : <UserCheck size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function AvatarGrande({ nombre, rolBg, rolColor }) {
  const iniciales = nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div style={{
      width: 44, height: 44, borderRadius: "50%",
      background: rolBg,
      border: `2px solid ${rolColor}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 800, color: rolColor,
      flexShrink: 0, letterSpacing: "0.02em",
    }}>
      {iniciales}
    </div>
  );
}

function SelectFiltro({ value, onChange, placeholder, children }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        className="input-base"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ paddingRight: 30, appearance: "none", minWidth: 150 }}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--texto-suave)" }} />
    </div>
  );
}

function Avatar({ nombre }) {
  const iniciales = nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      background: "#1a1a1a", border: "1px solid var(--acento)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, color: "var(--acento)",
      flexShrink: 0,
    }}>
      {iniciales}
    </div>
  );
}

function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--texto)" }}>{titulo}</h2>
          <button
            onClick={onCerrar}
            style={{ background: "transparent", border: "none", color: "var(--texto-suave)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormUsuario({ form, onChange, mostrarPass, setMostrarPass, esEdicion, errForm }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={estiloLabel}>Nombre completo</label>
        <input
          className="input-base"
          style={{ width: "100%" }}
          value={form.nombre}
          onChange={(e) => onChange("nombre", e.target.value)}
          placeholder="Ej. Ana González"
          autoFocus
        />
      </div>
      <div>
        <label style={estiloLabel}>Email</label>
        <input
          className="input-base"
          style={{ width: "100%" }}
          type="email"
          value={form.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="correo@empresa.com"
        />
      </div>
      <div>
        <label style={estiloLabel}>Rol</label>
        <div style={{ position: "relative" }}>
          <select
            className="input-base"
            style={{ width: "100%", appearance: "none", paddingRight: 30 }}
            value={form.rol}
            onChange={(e) => onChange("rol", e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
            ))}
          </select>
          <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--texto-suave)" }} />
        </div>
      </div>
      <div>
        <label style={estiloLabel}>{esEdicion ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}</label>
        <div style={{ position: "relative" }}>
          <input
            className="input-base"
            style={{ width: "100%", paddingRight: 80 }}
            type={mostrarPass ? "text" : "password"}
            value={form.password}
            onChange={(e) => onChange("password", e.target.value)}
            placeholder={esEdicion ? "••••••••" : "Mínimo 8 caracteres"}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setMostrarPass(!mostrarPass)}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "transparent", border: "none", color: "var(--texto-suave)",
              cursor: "pointer", fontSize: 12, padding: "2px 4px",
            }}
          >
            {mostrarPass ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </div>
      {(form.password || !esEdicion) && (
        <div>
          <label style={estiloLabel}>Confirmar contraseña</label>
          <input
            className="input-base"
            style={{ width: "100%" }}
            type={mostrarPass ? "text" : "password"}
            value={form.passwordConfirm}
            onChange={(e) => onChange("passwordConfirm", e.target.value)}
            placeholder="Repite la contraseña"
            autoComplete="new-password"
          />
        </div>
      )}
      {errForm && (
        <p style={{ margin: 0, padding: "8px 12px", background: "#2d1515", border: "1px solid #f87171", borderRadius: 6, color: "#fca5a5", fontSize: 13 }}>
          {errForm}
        </p>
      )}
    </div>
  );
}

const estiloLabel = {
  display: "block",
  marginBottom: 5,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--texto-suave)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
