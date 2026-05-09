"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Pencil, RefreshCw, Plus, Upload, CheckCircle, X,
  Send, Copy, ExternalLink, FileText, Clock, User, AlertTriangle, Link,
} from "lucide-react";

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

const ESTATUS_CLAVE = {
  BORRADOR:         { label: "Borrador",          color: "#6b7280", bg: "#f3f4f6" },
  REVISION_INTERNA: { label: "Revisión interna",  color: "#92400e", bg: "#fef3c7" },
  ENVIADO:          { label: "Enviado a cliente",  color: "#1e40af", bg: "#dbeafe" },
  RECHAZADO:        { label: "Rechazado",          color: "#991b1b", bg: "#fee2e2" },
  AUTORIZADO:       { label: "Autorizado",         color: "#166534", bg: "#dcfce7" },
  LIBERADO:         { label: "Liberado",           color: "#155e75", bg: "#cffafe" },
  EN_PRODUCCION:    { label: "En producción",      color: "#7c2d12", bg: "#ffedd5" },
};

const ESTATUS_PROYECTO = {
  ACTIVO:     { label: "Activo",     color: "#22c55e" },
  PAUSADO:    { label: "Pausado",    color: "#f59e0b" },
  COMPLETADO: { label: "Completado", color: "#6b7280" },
};

export default function ProyectoDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: sesion } = useSession();
  const rol = sesion?.user?.rol;
  const usuarioId = parseInt(sesion?.user?.id);

  const [proyecto, setProyecto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [clienteUrl, setClienteUrl] = useState(null);

  const [modalPin, setModalPin] = useState(false);
  const [modalEditarProyecto, setModalEditarProyecto] = useState(false);
  const [modalCrearClave, setModalCrearClave] = useState(false);
  const [modalSubirPlano, setModalSubirPlano] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch(`/api/proyectos/${id}`);
      if (!res.ok) { const d = await res.json(); setError(d.error || "Error al cargar proyecto"); return; }
      setProyecto(await res.json());
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    const intervalo = setInterval(() => { cargar(); }, 300000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  if (cargando) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}><div className="spinner" /></div>;
  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: 300, justifyContent: "center", gap: 16 }}>
      <AlertTriangle size={36} style={{ color: "#ef4444" }} />
      <p style={{ color: "#888888", margin: 0 }}>{error}</p>
      <button className="btn-secundario" onClick={() => router.push("/dashboard/proyectos")}>Volver</button>
    </div>
  );
  if (!proyecto) return null;

  const esGerente = rol === "GERENTE";
  const puedeCrearClave = rol === "GERENTE" || rol === "DISENADOR";
  const puedeSubir = rol === "DISENADOR";
  const gerentesProyecto = proyecto.gerentes?.map((g) => g.usuario) || [];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Banner link cliente */}
      {clienteUrl && (
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Link size={18} style={{ color: "#0369a1", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#0369a1" }}>¡Todos los gerentes autorizaron! Comparte este link con el cliente:</p>
            <span style={{ fontSize: 12, color: "#0369a1", wordBreak: "break-all" }}>{clienteUrl}</span>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(clienteUrl); }}
            style={{ background: "#0369a1", border: "none", borderRadius: 6, padding: "7px 14px", color: "#ffffff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <Copy size={13} /> Copiar
          </button>
          <button onClick={() => setClienteUrl(null)}
            style={{ background: "transparent", border: "none", color: "#0369a1", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 4, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* Barra superior */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => router.push("/dashboard/proyectos")}
          style={{ background: "#ffffff", border: "1px solid #e5e5e5", color: "#555555", borderRadius: 8, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> Proyectos
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={cargar}
          style={{ background: "#ffffff", border: "1px solid #e5e5e5", color: "#555555", borderRadius: 8, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <RefreshCw size={14} /> Actualizar
        </button>
        {esGerente && (
          <button onClick={() => router.push(`/dashboard/proyectos/${id}/historial`)}
            style={{ background: "#ffffff", border: "1px solid #e5e5e5", color: "#555555", borderRadius: 8, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Clock size={14} /> Historial
          </button>
        )}
        {esGerente && (
          <button onClick={() => setModalEditarProyecto(true)}
            style={{ background: "#ffffff", border: "1px solid #e5e5e5", color: "#555555", borderRadius: 8, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Pencil size={14} /> Editar proyecto
          </button>
        )}
      </div>

      {/* Header del proyecto */}
      <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "22px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#212121" }}>{proyecto.nombre}</h1>
              <EstatusBadge estatus={proyecto.estatus} />
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 14, color: "#555555" }}>
              <span style={{ color: "#999999" }}>Cliente: </span>
              <strong style={{ color: "#212121", fontWeight: 600 }}>{proyecto.clienteNombre}</strong>
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#aaaaaa" }}>
              Creado el {new Date(proyecto.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          {esGerente && proyecto.pinAcceso && (
            <PinDisplay pin={proyecto.pinAcceso} onCambiar={() => setModalPin(true)} />
          )}
        </div>

        <div style={{ height: 1, background: "#f0f0f0" }} />

        <div style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <GrupoUsuarios titulo="Gerentes" usuarios={gerentesProyecto} />
          {esGerente && proyecto.pinAcceso && (
            <CopiarLinkCliente pin={proyecto.pinAcceso} />
          )}
        </div>
      </div>

      {/* Sección de claves */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        {puedeCrearClave && (
          <button className="btn-primario" onClick={() => setModalCrearClave(true)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <Plus size={14} /> Nueva clave
          </button>
        )}
        <span style={{ fontSize: 14, color: "#888888", marginLeft: "auto" }}>
          {proyecto.claves?.length || 0} clave{proyecto.claves?.length !== 1 ? "s" : ""}
        </span>
      </div>

      {proyecto.claves?.length === 0 ? (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, textAlign: "center", padding: 48, color: "#aaaaaa" }}>
          <FileText size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
          <p style={{ margin: 0 }}>Sin claves registradas aún.</p>
        </div>
      ) : (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr style={{ background: "#fafafa", borderBottom: "2px solid #e5e5e5" }}>
                  <th style={sTh}>CLAVE</th>
                  <th style={sTh}>PLANO</th>
                  <th style={sTh}>JEFE DE ÁREA</th>
                  <th style={sTh}>CLIENTE</th>
                  <th style={sTh}>COSTOS</th>
                  <th style={sTh}>PRODUCCIÓN</th>
                  <th style={{ ...sTh, textAlign: "right", paddingRight: 16 }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {proyecto.claves.map((clave, i) => (
                  <FilaClave
                    key={clave.id}
                    clave={clave}
                    par={i % 2 === 0}
                    rol={rol}
                    usuarioId={usuarioId}
                    gerentesProyecto={gerentesProyecto}
                    pinAcceso={proyecto.pinAcceso}
                    puedeSubir={puedeSubir}
                    onSubirPlano={() => setModalSubirPlano(clave.id)}
                    onRefresh={cargar}
                    onClienteUrl={setClienteUrl}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalPin && (
        <ModalCambiarPin proyectoId={proyecto.id} pinActual={proyecto.pinAcceso} onCerrar={() => setModalPin(false)} onGuardado={cargar} />
      )}
      {modalEditarProyecto && (
        <ModalEditarProyecto proyecto={proyecto} onCerrar={() => setModalEditarProyecto(false)} onGuardado={cargar} />
      )}
      {modalCrearClave && (
        <ModalCrearClave proyectoId={proyecto.id} onCerrar={() => setModalCrearClave(false)} onGuardado={cargar} />
      )}
      {modalSubirPlano !== null && (
        <ModalSubirPlano claveId={modalSubirPlano} onCerrar={() => setModalSubirPlano(null)} onGuardado={cargar} />
      )}
    </div>
  );
}

/* ── Fila de clave en tabla ── */
function FilaClave({ clave, par, rol, usuarioId, gerentesProyecto, pinAcceso, puedeSubir, onSubirPlano, onRefresh, onClienteUrl }) {
  const [accionando, setAccionando] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalRechazo, setModalRechazo] = useState(false);
  const [modalComentario, setModalComentario] = useState(null);

  const plano = clave.planos?.[0] || null;
  const estConf = ESTATUS_CLAVE[clave.estatus] || ESTATUS_CLAVE.BORRADOR;
  const autInternas = plano?.autorizacionesInternas || [];
  const totalGerentes = gerentesProyecto.length;
  const totalAutorizados = autInternas.length;
  const autorizadoPorMi = autInternas.some((a) => a.gerente?.id === usuarioId);

  const autCliente = plano?.autorizacionCliente || null;
  const clienteAprobo = autCliente?.decision === "APROBADO";

  async function accion(url, method = "POST", body = {}, mensajeExito = "¡Acción completada!") {
    setAccionando(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setToast({ tipo: "error", titulo: "Error al procesar", mensaje: data.error || "Error" });
        return;
      }
      if (data.clienteUrl) onClienteUrl(data.clienteUrl);
      setToast({ tipo: "exito", titulo: mensajeExito });
      setTimeout(() => { setToast(null); onRefresh(); }, 2000);
    } catch {
      setToast({ tipo: "error", titulo: "Error al procesar", mensaje: "Error de conexión" });
    } finally {
      setAccionando(false);
    }
  }

  /* Columna JEFE DE ÁREA */
  function CeldaJefe() {
    if (!plano) return <span style={sVacio}>—</span>;
    if (clave.estatus === "REVISION_INTERNA") {
      return (
        <div>
          <Badge color="#991b1b" bg="#fee2e2">PENDIENTE {totalAutorizados}/{totalGerentes}</Badge>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {gerentesProyecto.map((g) => {
              const ok = autInternas.some((a) => a.gerente?.id === g.id);
              return (
                <span key={g.id} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: ok ? "#dcfce7" : "#f3f4f6", color: ok ? "#166534" : "#888888", border: `1px solid ${ok ? "#86efac" : "#e5e5e5"}` }}>
                  {g.nombre.split(" ")[0]}
                </span>
              );
            })}
          </div>
        </div>
      );
    }
    if (clave.estatus === "RECHAZADO") {
      const rechazoInterno = autInternas.find((a) => a.decision === "RECHAZADO");
      if (rechazoInterno) {
        return (
          <div>
            <Badge color="#991b1b" bg="#fee2e2">RECHAZADO INTERNAMENTE</Badge>
            <span style={{ fontSize: 10, color: "#555555", display: "block", marginTop: 3 }}>
              por {rechazoInterno.gerente?.nombre}
            </span>
            {rechazoInterno.comentarios && (
              <ComentarioRechazo
                texto={rechazoInterno.comentarios}
                onVerMas={() => setModalComentario({ texto: rechazoInterno.comentarios, autor: rechazoInterno.gerente?.nombre, fecha: rechazoInterno.createdAt })}
              />
            )}
          </div>
        );
      }
      return (
        <div>
          <Badge color="#991b1b" bg="#fee2e2">RECHAZADO POR CLIENTE</Badge>
          {autCliente?.comentarios && (
            <ComentarioRechazo
              texto={autCliente.comentarios}
              onVerMas={() => setModalComentario({ texto: autCliente.comentarios, autor: autCliente.firmadoPor, fecha: autCliente.createdAt })}
            />
          )}
        </div>
      );
    }
    return <Badge color="#166534" bg="#dcfce7"><CheckCircle size={10} style={{ display: "inline", marginRight: 3 }} />Autorizado {totalAutorizados}/{totalGerentes}</Badge>;
  }

  /* Columna CLIENTE */
  function CeldaCliente() {
    const visibles = ["ENVIADO", "RECHAZADO", "AUTORIZADO", "LIBERADO", "EN_PRODUCCION"];
    if (!visibles.includes(clave.estatus)) return <span style={sVacio}>—</span>;
    if (clave.estatus === "ENVIADO") return <Badge color="#1e40af" bg="#dbeafe"><Clock size={10} style={{ display: "inline", marginRight: 3 }} />Pendiente</Badge>;
    if (clave.estatus === "RECHAZADO") {
      return (
        <div>
          <Badge color="#991b1b" bg="#fee2e2">Rechazado</Badge>
          {autCliente?.comentarios && (
            <ComentarioRechazo
              texto={autCliente.comentarios}
              onVerMas={() => setModalComentario({ texto: autCliente.comentarios, autor: autCliente.firmadoPor, fecha: autCliente.createdAt })}
            />
          )}
          {autCliente?.firmadoPor && <span style={{ fontSize: 10, color: "#888888", display: "block", marginTop: 3 }}>{autCliente.firmadoPor}</span>}
        </div>
      );
    }
    return (
      <div>
        <Badge color="#166534" bg="#dcfce7"><CheckCircle size={10} style={{ display: "inline", marginRight: 3 }} />Autorizado</Badge>
        {clienteAprobo && autCliente?.firmadoPor && (
          <span style={{ fontSize: 10, color: "#888888", display: "block", marginTop: 3 }}>{autCliente.firmadoPor}</span>
        )}
      </div>
    );
  }

  /* Columna COSTOS */
  function CeldaCostos() {
    const visibles = ["AUTORIZADO", "LIBERADO", "EN_PRODUCCION"];
    if (!visibles.includes(clave.estatus)) return <span style={sVacio}>—</span>;
    if (clave.estatus === "AUTORIZADO") return <Badge color="#92400e" bg="#fef3c7"><Clock size={10} style={{ display: "inline", marginRight: 3 }} />Pendiente</Badge>;
    return <Badge color="#155e75" bg="#cffafe"><CheckCircle size={10} style={{ display: "inline", marginRight: 3 }} />Liberado</Badge>;
  }

  /* Columna PRODUCCIÓN */
  function CeldaProduccion() {
    if (!["LIBERADO", "EN_PRODUCCION"].includes(clave.estatus)) return <span style={sVacio}>—</span>;
    if (clave.estatus === "LIBERADO") return <Badge color="#155e75" bg="#cffafe">Liberado</Badge>;
    return <Badge color="#7c2d12" bg="#ffedd5">En producción</Badge>;
  }

  /* Botones de acción */
  const botones = [];

  if (puedeSubir && !plano && clave.estatus === "BORRADOR") {
    botones.push(
      <BtnAccion key="subir" color="#ffffff" bg="#3b82f6" onClick={onSubirPlano} disabled={accionando}>
        <Upload size={12} /> Subir diseño
      </BtnAccion>
    );
  }
  if (puedeSubir && plano && (clave.estatus === "REVISION_INTERNA" || clave.estatus === "RECHAZADO")) {
    botones.push(
      <BtnAccion key="resubir" color="#ffffff" bg="#ef4444" onClick={onSubirPlano} disabled={accionando}>
        <Upload size={12} /> Subir nuevo
      </BtnAccion>
    );
  }
  if (rol === "GERENTE" && plano && clave.estatus === "REVISION_INTERNA" && !autorizadoPorMi) {
    botones.push(
      <BtnAccion key="auth" color="#212121" bg="#c9a84c" onClick={() => accion(`/api/planos/${plano.id}/autorizar-interno`, "POST", {}, "¡Plano autorizado internamente!")} disabled={accionando}>
        <CheckCircle size={12} /> Autorizar
      </BtnAccion>
    );
    botones.push(
      <BtnAccion key="rechazar" color="#ffffff" bg="#ef4444" onClick={() => setModalRechazo(true)} disabled={accionando}>
        <X size={12} /> Rechazar
      </BtnAccion>
    );
  }
  if (rol === "COSTOS" && clave.estatus === "AUTORIZADO") {
    botones.push(
      <BtnAccion key="liberar" color="#ffffff" bg="#0e7490" onClick={() => accion(`/api/planos/${plano?.id}/liberar`, "POST", {}, "¡Plano liberado a producción!")} disabled={accionando}>
        <Send size={12} /> Liberar
      </BtnAccion>
    );
  }
  if (rol === "PRODUCCION" && clave.estatus === "LIBERADO") {
    botones.push(
      <BtnAccion key="prod" color="#ffffff" bg="#ea580c" onClick={() => accion(`/api/claves/${clave.id}`, "PATCH", { estatus: "EN_PRODUCCION" }, "¡Marcado en producción!")} disabled={accionando}>
        <CheckCircle size={12} /> En producción
      </BtnAccion>
    );
  }

  return (
    <>
      {toast && <Portal><ModalConfirmacion toast={toast} onCerrar={() => setToast(null)} /></Portal>}
      {modalComentario && (
        <Portal><ModalComentarioRechazo comentario={modalComentario} onCerrar={() => setModalComentario(null)} /></Portal>
      )}
      {modalRechazo && plano && (
        <Portal>
          <ModalRechazoInterno
            planoId={plano.id}
            claveCodigo={clave.codigo}
            onCerrar={() => setModalRechazo(false)}
            onConfirmado={() => {
              setModalRechazo(false);
              setToast({ tipo: "exito", titulo: "Plano rechazado. El diseñador deberá subir una nueva versión." });
              setTimeout(() => { setToast(null); onRefresh(); }, 2500);
            }}
          />
        </Portal>
      )}
      <tr style={{ background: par ? "#ffffff" : "#fafafa", borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
        {/* CLAVE */}
        <td style={sTd}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#212121" }}>{clave.codigo}</div>
          <div style={{ fontSize: 11, color: "#888888", marginTop: 2 }}>{clave.descripcion}</div>
          <span style={{ display: "inline-block", marginTop: 5, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 8, background: estConf.bg, color: estConf.color }}>
            {estConf.label}
          </span>
        </td>

        {/* PLANO */}
        <td style={sTd}>
          {plano ? (
            <div>
              <div style={{ fontSize: 12, color: "#212121", fontWeight: 600 }}>v{plano.version}</div>
              <div style={{ fontSize: 11, color: "#888888" }}>{plano.subidoPor?.nombre}</div>
              <div style={{ fontSize: 10, color: "#aaaaaa", marginTop: 2 }}>
                {new Date(plano.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" })}
              </div>
              <a href={plano.urlPdf} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 11, color: "#c9a84c", textDecoration: "none", padding: "2px 8px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 5 }}>
                <ExternalLink size={10} /> Ver PDF
              </a>
            </div>
          ) : (
            <span style={sVacio}>Sin plano</span>
          )}
        </td>

        {/* JEFE DE ÁREA */}
        <td style={sTd}><CeldaJefe /></td>

        {/* CLIENTE */}
        <td style={sTd}>
          <CeldaCliente />
          {clave.estatus === "ENVIADO" && pinAcceso && (
            <a href={`${getAppUrl()}/cliente/${pinAcceso}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 5, fontSize: 10, color: "#0369a1", textDecoration: "none" }}>
              <Link size={9} /> Ver portal
            </a>
          )}
        </td>

        {/* COSTOS */}
        <td style={sTd}><CeldaCostos /></td>

        {/* PRODUCCIÓN */}
        <td style={sTd}><CeldaProduccion /></td>

        {/* ACCIÓN */}
        <td style={{ ...sTd, textAlign: "right", paddingRight: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
            {botones}
            {accionando && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
          </div>
        </td>
      </tr>
    </>
  );
}

function ModalConfirmacion({ toast, onCerrar }) {
  const esExito = toast.tipo === "exito";
  const color = esExito ? "#10b981" : "#ef4444";
  const bgCirculo = esExito ? "#dcfce7" : "#fee2e2";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#ffffff", borderRadius: 16, padding: 40, textAlign: "center", maxWidth: 320, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: bgCirculo, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", animation: "popIn 0.3s ease-out" }}>
          {esExito
            ? <CheckCircle size={36} style={{ color }} />
            : <span style={{ fontSize: 36, lineHeight: 1, color }}>✕</span>
          }
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#212121" }}>{toast.titulo}</p>
        {toast.mensaje && <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888888" }}>{toast.mensaje}</p>}
        {!esExito && (
          <button
            onClick={onCerrar}
            style={{ background: "#ef4444", border: "none", borderRadius: 8, padding: "9px 24px", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}

function ModalRechazoInterno({ planoId, claveCodigo, onCerrar, onConfirmado }) {
  const [comentarios, setComentarios] = useState("");
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar(e) {
    e.preventDefault();
    if (comentarios.trim().length < 10) return setErr("Los comentarios deben tener al menos 10 caracteres.");
    setEnviando(true);
    try {
      const res = await fetch(`/api/planos/${planoId}/rechazar-interno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentarios: comentarios.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Error al rechazar."); return; }
      onConfirmado();
    } catch {
      setErr("Error de conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Rechazar plano internamente" onCerrar={onCerrar}>
      <form onSubmit={confirmar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#888888" }}>
          Clave: <strong style={{ color: "#212121" }}>{claveCodigo}</strong>
        </p>
        <Campo label="¿Qué debe corregir el diseñador?">
          <textarea
            className="input-base"
            rows={4}
            style={{ width: "100%", resize: "vertical" }}
            placeholder="Describe las correcciones necesarias (mínimo 10 caracteres)"
            value={comentarios}
            onChange={(e) => { setComentarios(e.target.value); setErr(""); }}
            autoFocus
          />
        </Campo>
        {err && <p style={{ margin: 0, color: "#ef4444", fontSize: 13 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn-secundario" onClick={onCerrar} disabled={enviando}>Cancelar</button>
          <button
            type="submit"
            disabled={enviando}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", background: "#ef4444", color: "#ffffff", fontWeight: 600, fontSize: 14, borderRadius: 8, border: "none", cursor: enviando ? "not-allowed" : "pointer", opacity: enviando ? 0.7 : 1 }}
          >
            {enviando ? "Rechazando…" : "Rechazar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ComentarioRechazo({ texto, onVerMas }) {
  const largo = texto.length > 40;
  const resumen = largo ? texto.slice(0, 40) + "…" : texto;
  return (
    <div style={{ marginTop: 5, borderLeft: "2px solid #fca5a5", paddingLeft: 6 }}>
      <span style={{ fontSize: 11, color: "#555555", fontStyle: "italic", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        "{resumen}"
      </span>
      {largo && (
        <button
          onClick={onVerMas}
          style={{ marginTop: 2, background: "none", border: "none", color: "#c9a84c", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}
        >
          Ver comentario
        </button>
      )}
    </div>
  );
}

function ModalComentarioRechazo({ comentario, onCerrar }) {
  const fecha = comentario.fecha
    ? new Date(comentario.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }) +
      " · " +
      new Date(comentario.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + " hrs"
    : null;

  return (
    <Modal titulo="Comentarios de rechazo" onCerrar={onCerrar}>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "#212121", lineHeight: 1.65, fontStyle: "italic" }}>
        "{comentario.texto}"
      </p>
      {comentario.autor && (
        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#888888" }}>
          Por: <strong style={{ color: "#555555" }}>{comentario.autor}</strong>
        </p>
      )}
      {fecha && (
        <p style={{ margin: "0 0 20px", fontSize: 11, color: "#aaaaaa" }}>{fecha}</p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
  );
}

function Badge({ color, bg, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: bg, color, gap: 3 }}>
      {children}
    </span>
  );
}

function BtnAccion({ color, bg, onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, border: "none", borderRadius: 6, padding: "5px 10px", color, fontSize: 11, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

/* ── Componentes del header ── */

function EstatusBadge({ estatus }) {
  const conf = ESTATUS_PROYECTO[estatus] || { label: estatus, color: "#888888" };
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: conf.color, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: conf.color, display: "inline-block" }} />
      {conf.label}
    </span>
  );
}

function PinDisplay({ pin, onCambiar }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard.writeText(pin).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800); });
  }
  return (
    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 170 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.12em" }}>PIN de acceso</span>
      <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 8, color: "#c9a84c", fontVariantNumeric: "tabular-nums" }}>{pin}</span>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={copiar} style={{ display: "flex", alignItems: "center", gap: 4, background: "#c9a84c", border: "none", borderRadius: 6, padding: "5px 11px", color: "#212121", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Copy size={12} /> {copiado ? "¡Copiado!" : "Copiar"}
        </button>
        <button onClick={onCambiar} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "1px solid #fde68a", borderRadius: 6, padding: "5px 11px", color: "#92400e", fontSize: 12, cursor: "pointer" }}>
          <RefreshCw size={12} /> Cambiar
        </button>
      </div>
    </div>
  );
}

function GrupoUsuarios({ titulo, usuarios }) {
  if (!usuarios.length) return null;
  return (
    <div>
      <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 700, color: "#aaaaaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>{titulo}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {usuarios.map((u) => (
          <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#212121", background: "#f5f5f5", padding: "4px 10px", borderRadius: 20, border: "1px solid #e5e5e5" }}>
            <User size={10} style={{ color: "#c9a84c" }} /> {u.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}

function CopiarLinkCliente({ pin }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    const url = `${getAppUrl()}/cliente/${pin}`;
    navigator.clipboard.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  }
  return (
    <div>
      <p style={{ margin: "0 0 5px", fontSize: 10, fontWeight: 700, color: "#aaaaaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Link del cliente</p>
      <button onClick={copiar} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: copiado ? "#dcfce7" : "#f5f5f5", border: `1px solid ${copiado ? "#86efac" : "#e5e5e5"}`, borderRadius: 8, padding: "5px 12px", color: copiado ? "#166534" : "#555555", fontSize: 12, cursor: "pointer", transition: "all 0.2s" }}>
        {copiado ? <><CheckCircle size={12} /> ¡Copiado!</> : <><Link size={12} /> Copiar link del cliente</>}
      </button>
    </div>
  );
}

/* ── Modales ── */

function ModalCambiarPin({ proyectoId, pinActual, onCerrar, onGuardado }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);

  function generarPin() { setPin(String(Math.floor(100000 + Math.random() * 900000))); setErr(""); }

  async function guardar(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) return setErr("El PIN debe ser exactamente 6 dígitos.");
    setGuardando(true);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinAcceso: pin }) });
      const data = await res.json();
      if (!res.ok) return setErr(data.error || "Error al cambiar el PIN.");
      onGuardado(); onCerrar();
    } finally { setGuardando(false); }
  }

  return (
    <Modal titulo="Cambiar PIN de acceso" onCerrar={onCerrar}>
      <p style={{ color: "#888888", fontSize: 13, margin: "0 0 16px" }}>
        PIN actual: <strong style={{ color: "#c9a84c", letterSpacing: 2 }}>{pinActual}</strong>
      </p>
      <form onSubmit={guardar}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input className="input-base" style={{ flex: 1, letterSpacing: 4, textAlign: "center", fontSize: 18, fontWeight: 700 }}
            maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }} placeholder="000000" />
          <button type="button" className="btn-secundario" onClick={generarPin}><RefreshCw size={14} /></button>
        </div>
        {err && <p style={{ margin: "0 0 12px", color: "#ef4444", fontSize: 13 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn-secundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn-primario" disabled={guardando || pin.length !== 6}>{guardando ? "Guardando…" : "Cambiar PIN"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalEditarProyecto({ proyecto, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
    nombre: proyecto.nombre,
    clienteNombre: proyecto.clienteNombre,
    estatus: proyecto.estatus,
    gerentesIds: proyecto.gerentes?.map((g) => g.usuario.id) || [],
  });
  const [gerentes, setGerentes] = useState([]);
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/usuarios?rol=GERENTE")
      .then((r) => r.json())
      .then((data) => setGerentes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function cambiar(campo, valor) { setForm((p) => ({ ...p, [campo]: valor })); setErr(""); }

  function toggleGerente(id) {
    setForm((f) => ({
      ...f,
      gerentesIds: f.gerentesIds.includes(id)
        ? f.gerentesIds.filter((g) => g !== id)
        : [...f.gerentesIds, id],
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return setErr("El nombre es requerido.");
    if (!form.clienteNombre.trim()) return setErr("El nombre del cliente es requerido.");
    setGuardando(true);
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          clienteNombre: form.clienteNombre.trim(),
          estatus: form.estatus,
          gerentesIds: form.gerentesIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setErr(data.error || "Error al actualizar.");
      onGuardado(); onCerrar();
    } finally { setGuardando(false); }
  }

  return (
    <Modal titulo="Editar proyecto" onCerrar={onCerrar}>
      <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Campo label="Nombre del proyecto">
          <input className="input-base" style={{ width: "100%" }} value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)} />
        </Campo>
        <Campo label="Nombre del cliente">
          <input className="input-base" style={{ width: "100%" }} value={form.clienteNombre} onChange={(e) => cambiar("clienteNombre", e.target.value)} />
        </Campo>
        <Campo label="Estatus del proyecto">
          <select className="input-base" style={{ width: "100%" }} value={form.estatus} onChange={(e) => cambiar("estatus", e.target.value)}>
            {Object.keys(ESTATUS_PROYECTO).map((s) => <option key={s} value={s}>{ESTATUS_PROYECTO[s].label}</option>)}
          </select>
        </Campo>
        {gerentes.length > 0 && (
          <Campo label="Gerentes asignados">
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
          </Campo>
        )}
        {err && <p style={{ margin: 0, color: "#ef4444", fontSize: 13 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="btn-secundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn-primario" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalCrearClave({ proyectoId, onCerrar, onGuardado }) {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    if (!codigo.trim()) return setErr("El código es requerido.");
    if (!descripcion.trim()) return setErr("La descripción es requerida.");
    setGuardando(true);
    try {
      const res = await fetch("/api/claves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proyectoId, codigo: codigo.trim().toUpperCase(), descripcion: descripcion.trim() }) });
      const data = await res.json();
      if (!res.ok) return setErr(data.error || "Error al crear la clave.");
      onGuardado(); onCerrar();
    } finally { setGuardando(false); }
  }

  return (
    <Modal titulo="Nueva clave" onCerrar={onCerrar}>
      <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Campo label="Código">
          <input className="input-base" style={{ width: "100%", textTransform: "uppercase", letterSpacing: "0.08em" }}
            placeholder="Ej. COCINA-01" value={codigo} onChange={(e) => { setCodigo(e.target.value); setErr(""); }} autoFocus />
        </Campo>
        <Campo label="Descripción">
          <input className="input-base" style={{ width: "100%" }}
            placeholder="Ej. Cocina principal torre B" value={descripcion} onChange={(e) => { setDescripcion(e.target.value); setErr(""); }} />
        </Campo>
        {err && <p style={{ margin: 0, color: "#ef4444", fontSize: 13 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn-secundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn-primario" disabled={guardando}>{guardando ? "Creando…" : "Crear clave"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ModalSubirPlano({ claveId, onCerrar, onGuardado }) {
  const [archivo, setArchivo] = useState(null);
  const [err, setErr] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  async function subir(e) {
    e.preventDefault();
    if (!archivo) return setErr("Selecciona un archivo PDF.");
    if (archivo.type !== "application/pdf") return setErr("Solo se permiten archivos PDF.");
    if (archivo.size > 50 * 1024 * 1024) return setErr("El archivo no puede superar 50 MB.");
    setSubiendo(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("claveId", claveId);
      const res = await fetch("/api/planos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) return setErr(data.error || "Error al subir el plano.");
      onGuardado(); onCerrar();
    } catch { setErr("Error de conexión."); }
    finally { setSubiendo(false); }
  }

  return (
    <Modal titulo="Subir plano (PDF)" onCerrar={onCerrar}>
      <form onSubmit={subir}>
        <div
          style={{ border: "2px dashed #e5e5e5", borderRadius: 8, padding: 32, textAlign: "center", marginBottom: 14, cursor: "pointer", background: archivo ? "#f0fdf4" : "#fafafa", transition: "background 0.2s" }}
          onClick={() => document.getElementById("input-pdf-modal").click()}
        >
          <Upload size={28} style={{ color: "#c9a84c", marginBottom: 8 }} />
          {archivo ? (
            <p style={{ margin: 0, color: "#166534", fontSize: 13, fontWeight: 500 }}>{archivo.name}</p>
          ) : (
            <p style={{ margin: 0, color: "#888888", fontSize: 13 }}>Haz clic para seleccionar o arrastra el PDF<br /><span style={{ fontSize: 11, opacity: 0.7 }}>Máximo 50 MB</span></p>
          )}
        </div>
        <input id="input-pdf-modal" type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => { setArchivo(e.target.files[0] || null); setErr(""); }} />
        {err && <p style={{ margin: "0 0 10px", color: "#ef4444", fontSize: 13 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn-secundario" onClick={onCerrar} disabled={subiendo}>Cancelar</button>
          <button type="submit" className="btn-primario" disabled={subiendo || !archivo}>{subiendo ? "Subiendo…" : "Subir plano"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Primitivos ── */

function Portal({ children }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  if (!montado) return null;
  return createPortal(children, document.body);
}

function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#212121" }}>{titulo}</h2>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#888888", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "#888888", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      {children}
    </div>
  );
}

const sTh = {
  padding: "10px 14px",
  fontSize: 10,
  fontWeight: 700,
  color: "#aaaaaa",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  textAlign: "left",
  borderRight: "1px solid #eeeeee",
  whiteSpace: "nowrap",
};

const sTd = {
  padding: "12px 14px",
  verticalAlign: "top",
  borderRight: "1px solid #f5f5f5",
  overflow: "hidden",
  wordBreak: "break-word",
};

const sVacio = {
  color: "#dddddd",
  fontSize: 14,
};
