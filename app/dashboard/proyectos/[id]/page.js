"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Pencil, RefreshCw, Plus, Upload, CheckCircle, X,
  Copy, ExternalLink, FileText, Clock, User, AlertTriangle, Link,
  Settings, Check, Minus,
} from "lucide-react";

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function formatFechaCorta(fecha) {
  if (!fecha) return null;
  return new Date(fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
}

const ESTATUS_CLAVE = {
  BORRADOR:         { label: "Borrador",         color: "#6b7280", bg: "#f3f4f6" },
  REVISION_INTERNA: { label: "Revisión interna", color: "#92400e", bg: "#fef3c7" },
  ENVIADO:          { label: "Enviado a cliente", color: "#1e40af", bg: "#dbeafe" },
  RECHAZADO:        { label: "Rechazado",         color: "#991b1b", bg: "#fee2e2" },
  AUTORIZADO:       { label: "Autorizado",        color: "#166534", bg: "#dcfce7" },
  LIBERADO:         { label: "Liberado",          color: "#155e75", bg: "#cffafe" },
  EN_PRODUCCION:    { label: "En producción",     color: "#7c2d12", bg: "#ffedd5" },
};

const ESTATUS_PROYECTO = {
  ACTIVO:     { label: "Activo",     color: "#22c55e" },
  PAUSADO:    { label: "Pausado",    color: "#f59e0b" },
  COMPLETADO: { label: "Completado", color: "#6b7280" },
};

function calcularPipeline(clave, plano) {
  const autInternas = plano?.autorizacionesInternas || [];
  const autCliente = plano?.autorizacionCliente || null;
  const rechazoInterno = autInternas.find((a) => a.decision === "RECHAZADO");
  const rechazoCliente = autCliente?.decision === "RECHAZADO";
  const aprobadosInternos = autInternas.filter((a) => a.decision === "APROBADO");

  const nodo = (estado, nombre = null, fecha = null, comentario = null) => ({ estado, nombre, fecha, comentario });

  switch (clave.estatus) {
    case "BORRADOR":
      return {
        jefe:      nodo("PENDIENTE"),
        cliente:   nodo("PENDIENTE"),
        costos:    nodo("PENDIENTE"),
        produccion: nodo("PENDIENTE"),
      };

    case "REVISION_INTERNA": {
      const progreso = aprobadosInternos.length;
      return {
        jefe:      nodo("EN_PROCESO", progreso > 0 ? `${progreso} aprobado` : null),
        cliente:   nodo("PENDIENTE"),
        costos:    nodo("PENDIENTE"),
        produccion: nodo("PENDIENTE"),
      };
    }

    case "ENVIADO": {
      const ultimo = aprobadosInternos.slice(-1)[0];
      return {
        jefe:      nodo("COMPLETADO", ultimo?.gerente?.nombre?.split(" ")[0] || null, formatFechaCorta(ultimo?.createdAt)),
        cliente:   nodo("EN_PROCESO"),
        costos:    nodo("PENDIENTE"),
        produccion: nodo("PENDIENTE"),
      };
    }

    case "RECHAZADO": {
      if (rechazoInterno) {
        return {
          jefe:      nodo("RECHAZADO", rechazoInterno.gerente?.nombre?.split(" ")[0], formatFechaCorta(rechazoInterno.createdAt), rechazoInterno.comentarios),
          cliente:   nodo("PENDIENTE"),
          costos:    nodo("PENDIENTE"),
          produccion: nodo("PENDIENTE"),
        };
      }
      if (rechazoCliente) {
        const ultimo = aprobadosInternos.slice(-1)[0];
        return {
          jefe:      nodo("COMPLETADO", ultimo?.gerente?.nombre?.split(" ")[0] || null, formatFechaCorta(ultimo?.createdAt)),
          cliente:   nodo("RECHAZADO", autCliente.firmadoPor, formatFechaCorta(autCliente.createdAt), autCliente.comentarios),
          costos:    nodo("PENDIENTE"),
          produccion: nodo("PENDIENTE"),
        };
      }
      return {
        jefe:      nodo("RECHAZADO"),
        cliente:   nodo("PENDIENTE"),
        costos:    nodo("PENDIENTE"),
        produccion: nodo("PENDIENTE"),
      };
    }

    case "AUTORIZADO": {
      const ultimo = aprobadosInternos.slice(-1)[0];
      return {
        jefe:      nodo("COMPLETADO", ultimo?.gerente?.nombre?.split(" ")[0] || null, formatFechaCorta(ultimo?.createdAt)),
        cliente:   nodo("COMPLETADO", autCliente?.firmadoPor, formatFechaCorta(autCliente?.createdAt)),
        costos:    nodo("EN_PROCESO"),
        produccion: nodo("PENDIENTE"),
      };
    }

    case "LIBERADO": {
      const ultimo = aprobadosInternos.slice(-1)[0];
      return {
        jefe:      nodo("COMPLETADO", ultimo?.gerente?.nombre?.split(" ")[0] || null, formatFechaCorta(ultimo?.createdAt)),
        cliente:   nodo("COMPLETADO", autCliente?.firmadoPor, formatFechaCorta(autCliente?.createdAt)),
        costos:    nodo("COMPLETADO"),
        produccion: nodo("EN_PROCESO"),
      };
    }

    case "EN_PRODUCCION": {
      const ultimo = aprobadosInternos.slice(-1)[0];
      return {
        jefe:      nodo("COMPLETADO", ultimo?.gerente?.nombre?.split(" ")[0] || null, formatFechaCorta(ultimo?.createdAt)),
        cliente:   nodo("COMPLETADO", autCliente?.firmadoPor, formatFechaCorta(autCliente?.createdAt)),
        costos:    nodo("COMPLETADO"),
        produccion: nodo("COMPLETADO"),
      };
    }

    default:
      return {
        jefe:      nodo("PENDIENTE"),
        cliente:   nodo("PENDIENTE"),
        costos:    nodo("PENDIENTE"),
        produccion: nodo("PENDIENTE"),
      };
  }
}

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
  const [esMobil, setEsMobil] = useState(false);

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

  useEffect(() => {
    function actualizar() { setEsMobil(window.innerWidth < 768); }
    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);

  if (cargando) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <div className="spinner" />
    </div>
  );
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
    <div style={{ maxWidth: 1300, margin: "0 auto" }}>
      {clienteUrl && (
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Link size={18} style={{ color: "#0369a1", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: "#0369a1" }}>¡Todos los gerentes autorizaron! Comparte este link con el cliente:</p>
            <span style={{ fontSize: 12, color: "#0369a1", wordBreak: "break-all" }}>{clienteUrl}</span>
          </div>
          <button onClick={() => navigator.clipboard.writeText(clienteUrl)}
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
      ) : esMobil ? (
        <div>
          {proyecto.claves.map((clave) => (
            <CardClave
              key={clave.id}
              clave={clave}
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
        </div>
      ) : (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#ffffff", borderBottom: "1px solid #e5e5e5" }}>
                  <th style={{ ...sTh, minWidth: 130 }}>CLAVE</th>
                  <th style={{ ...sTh, minWidth: 160 }}>DESCRIPCIÓN</th>
                  <th style={{ ...sTh, minWidth: 170 }}>PLANO</th>
                  <th style={{ ...sTh, minWidth: 420 }}>FLUJO</th>
                </tr>
              </thead>
              <tbody>
                {proyecto.claves.map((clave) => (
                  <FilaClave
                    key={clave.id}
                    clave={clave}
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

/* ── Pipeline simplificado para móvil ── */
function PipelineSimple({ pipeline, jefeClicable, costosClicable, produccionClicable, onClickJefe, onClickCostos, onClickProduccion, onVerComentario }) {
  const COLOR_NODO = { PENDIENTE: "#e5e7eb", EN_PROCESO: "#c9a84c", COMPLETADO: "#10b981", RECHAZADO: "#ef4444" };
  const NODOS = [
    { key: "jefe",       label: "Jefe área",  nodo: pipeline.jefe,       clicable: jefeClicable,       onClick: onClickJefe },
    { key: "cliente",    label: "Cliente",    nodo: pipeline.cliente,    clicable: false },
    { key: "costos",     label: "Costos",     nodo: pipeline.costos,     clicable: costosClicable,     onClick: onClickCostos },
    { key: "produccion", label: "Producción", nodo: pipeline.produccion, clicable: produccionClicable, onClick: onClickProduccion },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {NODOS.map(({ key, label, nodo, clicable, onClick }, idx) => (
        <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
          {idx > 0 && (
            <div style={{ position: "absolute", right: "50%", top: 9, left: 0, height: 2, background: NODOS[idx - 1].nodo.estado === "COMPLETADO" ? "#10b981" : "#e5e7eb" }} />
          )}
          {idx < 3 && (
            <div style={{ position: "absolute", left: "50%", top: 9, right: 0, height: 2, background: nodo.estado === "COMPLETADO" ? "#10b981" : "#e5e7eb" }} />
          )}
          <div
            onClick={clicable ? onClick : undefined}
            style={{
              width: 20, height: 20,
              borderRadius: "50%",
              background: COLOR_NODO[nodo.estado] || "#e5e7eb",
              border: clicable ? "2px solid #212121" : "2px solid transparent",
              cursor: clicable ? "pointer" : "default",
              position: "relative",
              zIndex: 1,
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 9, color: "#9ca3af", textAlign: "center", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", lineHeight: 1.2 }}>
            {label}
          </div>
          {nodo.comentario && (
            <button
              onClick={() => onVerComentario({ texto: nodo.comentario, autor: nodo.nombre, fecha: null })}
              style={{ marginTop: 2, background: "none", border: "none", color: "#ef4444", fontSize: 9, fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              Ver motivo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Card de clave para móvil ── */
function CardClave({ clave, rol, usuarioId, gerentesProyecto, pinAcceso, puedeSubir, onSubirPlano, onRefresh, onClienteUrl }) {
  const [accionando, setAccionando] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalComentario, setModalComentario] = useState(null);
  const [modalJefe, setModalJefe] = useState(false);
  const [modalCostos, setModalCostos] = useState(false);
  const [modalProduccion, setModalProduccion] = useState(false);

  const plano = clave.planos?.[0] || null;
  const autInternas = plano?.autorizacionesInternas || [];
  const autorizadoPorMi = autInternas.some((a) => a.gerente?.id === usuarioId && a.decision === "APROBADO");

  const pipeline = calcularPipeline(clave, plano);

  const jefeClicable = rol === "GERENTE" && pipeline.jefe.estado === "EN_PROCESO" && !autorizadoPorMi;
  const costosClicable = rol === "COSTOS" && pipeline.costos.estado === "EN_PROCESO";
  const produccionClicable = rol === "PRODUCCION" && pipeline.produccion.estado === "EN_PROCESO";

  async function ejecutarAccion(url, method, body, mensajeExito) {
    setAccionando(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setToast({ tipo: "error", titulo: "Error al procesar", mensaje: data.error || "Error" }); return false; }
      if (data.clienteUrl) onClienteUrl(data.clienteUrl);
      setToast({ tipo: "exito", titulo: mensajeExito });
      setTimeout(() => { setToast(null); onRefresh(); }, 2000);
      return true;
    } catch {
      setToast({ tipo: "error", titulo: "Error de conexión", mensaje: "" });
      return false;
    } finally { setAccionando(false); }
  }

  const puedeSubirPrimero = puedeSubir && !plano && clave.estatus === "BORRADOR";
  const puedeSubirNuevo = puedeSubir && plano && clave.estatus === "RECHAZADO";
  const cfg = ESTATUS_CLAVE[clave.estatus] || { label: clave.estatus, color: "#6b7280", bg: "#f3f4f6" };

  return (
    <>
      {toast && <Portal><ModalConfirmacion toast={toast} onCerrar={() => setToast(null)} /></Portal>}
      {modalComentario && (
        <Portal><ModalComentarioRechazo comentario={modalComentario} onCerrar={() => setModalComentario(null)} /></Portal>
      )}
      {modalJefe && plano && (
        <Portal>
          <ModalAccionJefe
            plano={plano}
            clave={clave}
            autorizadoPorMi={autorizadoPorMi}
            onCerrar={() => setModalJefe(false)}
            onAutorizar={async () => {
              const ok = await ejecutarAccion(`/api/planos/${plano.id}/autorizar-interno`, "POST", {}, "¡Plano autorizado internamente!");
              if (ok) setModalJefe(false);
            }}
            onRechazado={() => {
              setModalJefe(false);
              setToast({ tipo: "exito", titulo: "Plano rechazado. El diseñador deberá corregir." });
              setTimeout(() => { setToast(null); onRefresh(); }, 2500);
            }}
          />
        </Portal>
      )}
      {modalCostos && plano && (
        <Portal>
          <ModalAccionCostos
            clave={clave}
            ejecutando={accionando}
            onCerrar={() => setModalCostos(false)}
            onConfirmado={async () => {
              const ok = await ejecutarAccion(`/api/planos/${plano.id}/liberar`, "POST", {}, "¡Plano liberado a producción!");
              if (ok) setModalCostos(false);
            }}
          />
        </Portal>
      )}
      {modalProduccion && (
        <Portal>
          <ModalAccionProduccion
            clave={clave}
            ejecutando={accionando}
            onCerrar={() => setModalProduccion(false)}
            onConfirmado={async () => {
              const ok = await ejecutarAccion(`/api/claves/${clave.id}`, "PATCH", { estatus: "EN_PRODUCCION" }, "¡Marcado en producción!");
              if (ok) setModalProduccion(false);
            }}
          />
        </Portal>
      )}

      <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, marginBottom: 8 }}>
        {/* Fila 1: código + badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#212121" }}>{clave.codigo}</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>

        {/* Descripción */}
        {clave.descripcion && (
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.5 }}>
            {clave.descripcion}
          </p>
        )}

        {/* Info del plano */}
        {plano ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#212121" }}>v{plano.version}</span>
            {plano.subidoPor?.nombre && (
              <span style={{ fontSize: 11, color: "#6b7280" }}>{plano.subidoPor.nombre}</span>
            )}
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              {new Date(plano.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" })}
            </span>
            <a href={plano.urlPdf} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#c9a84c", textDecoration: "none", padding: "2px 8px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 5 }}>
              <ExternalLink size={10} /> Ver PDF
            </a>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 14px" }}>Sin plano</p>
        )}

        {/* Pipeline simplificado */}
        <PipelineSimple
          pipeline={pipeline}
          jefeClicable={jefeClicable}
          costosClicable={costosClicable}
          produccionClicable={produccionClicable}
          onClickJefe={() => setModalJefe(true)}
          onClickCostos={() => setModalCostos(true)}
          onClickProduccion={() => setModalProduccion(true)}
          onVerComentario={setModalComentario}
        />

        {/* Botón de acción */}
        {(puedeSubirPrimero || puedeSubirNuevo || jefeClicable || costosClicable || produccionClicable) && (
          <div style={{ marginTop: 14 }}>
            {puedeSubirPrimero && (
              <button onClick={onSubirPlano} style={{ ...sBtnPlano("#3b82f6"), width: "100%", justifyContent: "center", padding: "9px 0" }}>
                <Upload size={13} /> Subir plano
              </button>
            )}
            {puedeSubirNuevo && (
              <button onClick={onSubirPlano} style={{ ...sBtnPlano("#ef4444"), width: "100%", justifyContent: "center", padding: "9px 0" }}>
                <Upload size={13} /> Subir nuevo plano
              </button>
            )}
            {jefeClicable && (
              <button onClick={() => setModalJefe(true)} style={{ ...sBtnPlano("#c9a84c"), width: "100%", justifyContent: "center", padding: "9px 0", color: "#212121" }}>
                <CheckCircle size={13} /> Revisar plano
              </button>
            )}
            {costosClicable && (
              <button onClick={() => setModalCostos(true)} style={{ ...sBtnPlano("#c9a84c"), width: "100%", justifyContent: "center", padding: "9px 0", color: "#212121" }}>
                <CheckCircle size={13} /> Liberar a producción
              </button>
            )}
            {produccionClicable && (
              <button onClick={() => setModalProduccion(true)} style={{ ...sBtnPlano("#212121"), width: "100%", justifyContent: "center", padding: "9px 0" }}>
                <CheckCircle size={13} /> Marcar en producción
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Fila de clave rediseñada ── */
function FilaClave({ clave, rol, usuarioId, gerentesProyecto, pinAcceso, puedeSubir, onSubirPlano, onRefresh, onClienteUrl }) {
  const [accionando, setAccionando] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalComentario, setModalComentario] = useState(null);
  const [modalJefe, setModalJefe] = useState(false);
  const [modalCostos, setModalCostos] = useState(false);
  const [modalProduccion, setModalProduccion] = useState(false);

  const plano = clave.planos?.[0] || null;
  const autInternas = plano?.autorizacionesInternas || [];
  const autCliente = plano?.autorizacionCliente || null;
  const autorizadoPorMi = autInternas.some((a) => a.gerente?.id === usuarioId && a.decision === "APROBADO");

  const pipeline = calcularPipeline(clave, plano);

  const jefeClicable = rol === "GERENTE" && pipeline.jefe.estado === "EN_PROCESO" && !autorizadoPorMi;
  const costosClicable = rol === "COSTOS" && pipeline.costos.estado === "EN_PROCESO";
  const produccionClicable = rol === "PRODUCCION" && pipeline.produccion.estado === "EN_PROCESO";

  async function ejecutarAccion(url, method, body, mensajeExito) {
    setAccionando(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setToast({ tipo: "error", titulo: "Error al procesar", mensaje: data.error || "Error" });
        return false;
      }
      if (data.clienteUrl) onClienteUrl(data.clienteUrl);
      setToast({ tipo: "exito", titulo: mensajeExito });
      setTimeout(() => { setToast(null); onRefresh(); }, 2000);
      return true;
    } catch {
      setToast({ tipo: "error", titulo: "Error de conexión", mensaje: "" });
      return false;
    } finally {
      setAccionando(false);
    }
  }

  const puedeSubirPrimero = puedeSubir && !plano && clave.estatus === "BORRADOR";
  const puedeSubirNuevo = puedeSubir && plano && clave.estatus === "RECHAZADO";

  return (
    <>
      {toast && <Portal><ModalConfirmacion toast={toast} onCerrar={() => setToast(null)} /></Portal>}
      {modalComentario && (
        <Portal><ModalComentarioRechazo comentario={modalComentario} onCerrar={() => setModalComentario(null)} /></Portal>
      )}
      {modalJefe && plano && (
        <Portal>
          <ModalAccionJefe
            plano={plano}
            clave={clave}
            autorizadoPorMi={autorizadoPorMi}
            onCerrar={() => setModalJefe(false)}
            onAutorizar={async () => {
              const ok = await ejecutarAccion(`/api/planos/${plano.id}/autorizar-interno`, "POST", {}, "¡Plano autorizado internamente!");
              if (ok) setModalJefe(false);
            }}
            onRechazado={() => {
              setModalJefe(false);
              setToast({ tipo: "exito", titulo: "Plano rechazado. El diseñador deberá corregir." });
              setTimeout(() => { setToast(null); onRefresh(); }, 2500);
            }}
          />
        </Portal>
      )}
      {modalCostos && plano && (
        <Portal>
          <ModalAccionCostos
            clave={clave}
            ejecutando={accionando}
            onCerrar={() => setModalCostos(false)}
            onConfirmado={async () => {
              const ok = await ejecutarAccion(`/api/planos/${plano.id}/liberar`, "POST", {}, "¡Plano liberado a producción!");
              if (ok) setModalCostos(false);
            }}
          />
        </Portal>
      )}
      {modalProduccion && (
        <Portal>
          <ModalAccionProduccion
            clave={clave}
            ejecutando={accionando}
            onCerrar={() => setModalProduccion(false)}
            onConfirmado={async () => {
              const ok = await ejecutarAccion(`/api/claves/${clave.id}`, "PATCH", { estatus: "EN_PRODUCCION" }, "¡Marcado en producción!");
              if (ok) setModalProduccion(false);
            }}
          />
        </Portal>
      )}

      <tr style={{ background: "#ffffff", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" }}>
        {/* CLAVE */}
        <td style={{ ...sTd, paddingLeft: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#212121" }}>{clave.codigo}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
            {clave.descripcion}
          </div>
          <span style={{ display: "inline-block", marginTop: 6, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6, background: ESTATUS_CLAVE[clave.estatus]?.bg || "#f3f4f6", color: ESTATUS_CLAVE[clave.estatus]?.color || "#6b7280" }}>
            {ESTATUS_CLAVE[clave.estatus]?.label || clave.estatus}
          </span>
        </td>

        {/* DESCRIPCIÓN */}
        <td style={sTd}>
          <DescripcionClave texto={clave.descripcion} codigo={clave.codigo} />
        </td>

        {/* PLANO */}
        <td style={sTd}>
          {plano ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#212121" }}>v{plano.version}</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{plano.subidoPor?.nombre}</div>
              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                {new Date(plano.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" })}
              </div>
              <a href={plano.urlPdf} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11, color: "#c9a84c", textDecoration: "none", padding: "2px 8px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 5 }}>
                <ExternalLink size={10} /> Ver PDF
              </a>
              {puedeSubirNuevo && (
                <div style={{ marginTop: 6 }}>
                  <button onClick={onSubirPlano} style={sBtnPlano("#ef4444")}>
                    <Upload size={11} /> Subir nuevo
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <span style={{ color: "#9ca3af", fontSize: 13 }}>Sin plano</span>
              {puedeSubirPrimero && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={onSubirPlano} style={sBtnPlano("#3b82f6")}>
                    <Upload size={11} /> Subir plano
                  </button>
                </div>
              )}
            </div>
          )}
        </td>

        {/* FLUJO */}
        <td style={{ ...sTd, paddingRight: 20 }}>
          <PipelineVisual
            pipeline={pipeline}
            jefeClicable={jefeClicable}
            costosClicable={costosClicable}
            produccionClicable={produccionClicable}
            onClickJefe={() => setModalJefe(true)}
            onClickCostos={() => setModalCostos(true)}
            onClickProduccion={() => setModalProduccion(true)}
            onVerComentario={setModalComentario}
          />
        </td>
      </tr>
    </>
  );
}

/* ── Pipeline visual ── */
function PipelineVisual({ pipeline, jefeClicable, costosClicable, produccionClicable, onClickJefe, onClickCostos, onClickProduccion, onVerComentario }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "8px 0" }}>
      <NodoPipeline
        titulo="Jefe área"
        estado={pipeline.jefe.estado}
        nombre={pipeline.jefe.nombre}
        fecha={pipeline.jefe.fecha}
        comentario={pipeline.jefe.comentario}
        clicable={jefeClicable}
        onClick={onClickJefe}
        onVerComentario={pipeline.jefe.comentario ? () => onVerComentario({ texto: pipeline.jefe.comentario, autor: pipeline.jefe.nombre, fecha: null }) : null}
      />
      <Conector completado={pipeline.jefe.estado === "COMPLETADO"} />
      <NodoPipeline
        titulo="Cliente"
        estado={pipeline.cliente.estado}
        nombre={pipeline.cliente.nombre}
        fecha={pipeline.cliente.fecha}
        comentario={pipeline.cliente.comentario}
        clicable={false}
        onVerComentario={pipeline.cliente.comentario ? () => onVerComentario({ texto: pipeline.cliente.comentario, autor: pipeline.cliente.nombre, fecha: null }) : null}
      />
      <Conector completado={pipeline.cliente.estado === "COMPLETADO"} />
      <NodoPipeline
        titulo="Costos"
        estado={pipeline.costos.estado}
        nombre={pipeline.costos.nombre}
        fecha={pipeline.costos.fecha}
        clicable={costosClicable}
        onClick={onClickCostos}
      />
      <Conector completado={pipeline.costos.estado === "COMPLETADO"} />
      <NodoPipeline
        titulo="Producción"
        estado={pipeline.produccion.estado}
        nombre={pipeline.produccion.nombre}
        fecha={pipeline.produccion.fecha}
        clicable={produccionClicable}
        onClick={onClickProduccion}
      />
    </div>
  );
}

function Conector({ completado }) {
  return (
    <div style={{
      flex: 1,
      height: 2,
      background: completado ? "#10b981" : "#e5e7eb",
      marginTop: 17,
      minWidth: 16,
      flexShrink: 1,
    }} />
  );
}

const NODO_CONFIG = {
  PENDIENTE:  { bg: "#f3f4f6", border: "#e5e7eb", Icono: Minus,        colorIcono: "#d1d5db" },
  EN_PROCESO: { bg: "#fef9c3", border: "#c9a84c", Icono: Settings,     colorIcono: "#c9a84c" },
  COMPLETADO: { bg: "#dcfce7", border: "#10b981", Icono: Check,        colorIcono: "#10b981" },
  RECHAZADO:  { bg: "#fee2e2", border: "#ef4444", Icono: X,            colorIcono: "#ef4444" },
};

function NodoPipeline({ titulo, estado, nombre, fecha, comentario, clicable, onClick, onVerComentario }) {
  const [hov, setHov] = useState(false);
  const conf = NODO_CONFIG[estado] || NODO_CONFIG.PENDIENTE;
  const esInteractivo = clicable && onClick;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 72 }}>
      <div
        onClick={esInteractivo ? onClick : undefined}
        onMouseEnter={() => esInteractivo && setHov(true)}
        onMouseLeave={() => setHov(false)}
        title={esInteractivo ? `Acción: ${titulo}` : titulo}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: conf.bg,
          border: `2px solid ${hov ? "#212121" : conf.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: esInteractivo ? "pointer" : "default",
          transition: "border-color 0.15s, transform 0.15s",
          transform: hov ? "scale(1.1)" : "scale(1)",
          flexShrink: 0,
        }}
      >
        <conf.Icono size={15} style={{ color: conf.colorIcono }} />
      </div>
      <div style={{ marginTop: 6, textAlign: "center", width: 72 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
          {titulo}
        </div>
        {nombre && (
          <div style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nombre}
          </div>
        )}
        {fecha && (
          <div style={{ fontSize: 10, color: "#9ca3af" }}>{fecha}</div>
        )}
        {comentario && onVerComentario && (
          <button
            onClick={onVerComentario}
            style={{ marginTop: 2, background: "none", border: "none", color: "#ef4444", fontSize: 9, fontWeight: 600, cursor: "pointer", padding: 0, display: "block", width: "100%", textAlign: "center" }}
          >
            Ver motivo
          </button>
        )}
        {esInteractivo && (
          <div style={{ fontSize: 9, color: "#c9a84c", fontWeight: 600, marginTop: 2 }}>Acción</div>
        )}
      </div>
    </div>
  );
}

/* ── Descripción con Ver más (modal) ── */
function DescripcionClave({ texto, codigo }) {
  const [abierto, setAbierto] = useState(false);
  if (!texto) return <span style={{ color: "#d1d5db", fontSize: 13 }}>—</span>;
  const largo = texto.length > 80;
  const recortado = largo ? texto.slice(0, 80) + "..." : texto;
  return (
    <>
      <div>
        <span style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{recortado}</span>
        {largo && (
          <button
            onClick={() => setAbierto(true)}
            style={{ display: "block", marginTop: 3, background: "none", border: "none", color: "#c9a84c", fontSize: 12, cursor: "pointer", padding: 0 }}
          >
            Ver más
          </button>
        )}
      </div>
      {abierto && createPortal(
        <div
          onClick={() => setAbierto(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#ffffff", borderRadius: 12, padding: 24, maxWidth: 480, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, color: "#212121", marginBottom: 12 }}>{codigo}</div>
            <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{texto}</p>
            <button
              onClick={() => setAbierto(false)}
              style={{ marginTop: 20, background: "#212121", border: "none", borderRadius: 8, color: "#ffffff", fontSize: 13, fontWeight: 600, padding: "8px 20px", cursor: "pointer" }}
            >
              Cerrar
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ── Modales de acción del pipeline ── */
function ModalAccionJefe({ plano, clave, autorizadoPorMi, onCerrar, onAutorizar, onRechazado }) {
  const [mostrando, setMostrando] = useState("ver");
  const [comentarios, setComentarios] = useState("");
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmarRechazo(e) {
    e.preventDefault();
    if (comentarios.trim().length < 10) return setErr("Los comentarios deben tener al menos 10 caracteres.");
    setEnviando(true);
    try {
      const res = await fetch(`/api/planos/${plano.id}/rechazar-interno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comentarios: comentarios.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Error al rechazar."); return; }
      onRechazado();
    } catch {
      setErr("Error de conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: "#ffffff", borderRadius: 16, width: "92%", maxWidth: 760, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#212121" }}>
            {mostrando === "rechazar" ? "Rechazar plano" : "Revisar plano"} — {clave.codigo}
          </h2>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {mostrando === "ver" && (
          <>
            <div style={{ padding: "16px 24px", flex: 1 }}>
              <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", height: 420, background: "#f9fafb" }}>
                <iframe src={plano.urlPdf} width="100%" height="100%" style={{ border: "none", display: "block" }} title="Plano PDF" />
              </div>
              <a href={plano.urlPdf} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 12, color: "#c9a84c", textDecoration: "none" }}>
                <ExternalLink size={12} /> Abrir en nueva pestaña
              </a>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onCerrar}
                style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 20px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>
                Cerrar
              </button>
              {!autorizadoPorMi && (
                <>
                  <button onClick={() => setMostrando("rechazar")}
                    style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "9px 20px", color: "#991b1b", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <X size={14} /> Rechazar
                  </button>
                  <button onClick={onAutorizar}
                    style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "9px 20px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle size={14} /> Autorizar
                  </button>
                </>
              )}
              {autorizadoPorMi && (
                <span style={{ fontSize: 13, color: "#166534", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  <CheckCircle size={14} /> Ya autorizaste este plano
                </span>
              )}
            </div>
          </>
        )}

        {mostrando === "rechazar" && (
          <form onSubmit={confirmarRechazo} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
              Describe las correcciones que debe realizar el diseñador.
            </p>
            <textarea
              className="input-base"
              rows={5}
              style={{ width: "100%", resize: "vertical", boxSizing: "border-box" }}
              placeholder="Ej: Ajustar medidas de la puerta principal, corregir escala de la sección B... (mínimo 10 caracteres)"
              value={comentarios}
              onChange={(e) => { setComentarios(e.target.value); setErr(""); }}
              autoFocus
            />
            {err && <p style={{ margin: 0, color: "#ef4444", fontSize: 13 }}>{err}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setMostrando("ver")}
                style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 20px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>
                Volver
              </button>
              <button type="submit" disabled={enviando}
                style={{ background: "#ef4444", border: "none", borderRadius: 8, padding: "9px 20px", color: "#ffffff", fontWeight: 600, fontSize: 13, cursor: enviando ? "not-allowed" : "pointer", opacity: enviando ? 0.7 : 1 }}>
                {enviando ? "Rechazando…" : "Confirmar rechazo"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ModalAccionCostos({ clave, ejecutando, onCerrar, onConfirmado }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: "#ffffff", borderRadius: 16, width: "90%", maxWidth: 420, padding: "28px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#212121" }}>Liberar a producción</h2>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
          ¿Confirmas que el análisis de costos de la clave <strong style={{ color: "#212121" }}>{clave.codigo}</strong> está completo y el plano puede liberarse a producción?
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCerrar}
            style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 20px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={onConfirmado} disabled={ejecutando}
            style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "9px 20px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: ejecutando ? "not-allowed" : "pointer", opacity: ejecutando ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            {ejecutando ? "Liberando…" : <><CheckCircle size={14} /> Liberar a producción</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalAccionProduccion({ clave, ejecutando, onCerrar, onConfirmado }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: "#ffffff", borderRadius: 16, width: "90%", maxWidth: 420, padding: "28px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#212121" }}>Marcar en producción</h2>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer" }}><X size={20} /></button>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
          ¿Confirmas que la clave <strong style={{ color: "#212121" }}>{clave.codigo}</strong> ha entrado en proceso de producción?
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCerrar}
            style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 20px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={onConfirmado} disabled={ejecutando}
            style={{ background: "#212121", border: "none", borderRadius: 8, padding: "9px 20px", color: "#ffffff", fontWeight: 600, fontSize: 13, cursor: ejecutando ? "not-allowed" : "pointer", opacity: ejecutando ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            {ejecutando ? "Procesando…" : <><CheckCircle size={14} /> Confirmar producción</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modales existentes ── */
function ModalConfirmacion({ toast, onCerrar }) {
  const esExito = toast.tipo === "exito";
  const color = esExito ? "#10b981" : "#ef4444";
  const bgCirculo = esExito ? "#dcfce7" : "#fee2e2";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#ffffff", borderRadius: 16, padding: 40, textAlign: "center", maxWidth: 320, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: bgCirculo, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          {esExito ? <CheckCircle size={36} style={{ color }} /> : <span style={{ fontSize: 36, lineHeight: 1, color }}>✕</span>}
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "#212121" }}>{toast.titulo}</p>
        {toast.mensaje && <p style={{ margin: "0 0 20px", fontSize: 13, color: "#888888" }}>{toast.mensaje}</p>}
        {!esExito && (
          <button onClick={onCerrar}
            style={{ background: "#ef4444", border: "none", borderRadius: 8, padding: "9px 24px", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}

function ModalComentarioRechazo({ comentario, onCerrar }) {
  const fecha = comentario.fecha
    ? new Date(comentario.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }) + " · " + new Date(comentario.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) + " hrs"
    : null;
  return (
    <Modal titulo="Motivo de rechazo" onCerrar={onCerrar}>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "#212121", lineHeight: 1.65, fontStyle: "italic" }}>"{comentario.texto}"</p>
      {comentario.autor && <p style={{ margin: "0 0 4px", fontSize: 12, color: "#888888" }}>Por: <strong style={{ color: "#555555" }}>{comentario.autor}</strong></p>}
      {fecha && <p style={{ margin: "0 0 20px", fontSize: 11, color: "#aaaaaa" }}>{fecha}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secundario" onClick={onCerrar}>Cerrar</button>
      </div>
    </Modal>
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

/* ── Modales de gestión ── */
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
      <p style={{ color: "#888888", fontSize: 13, margin: "0 0 16px" }}>PIN actual: <strong style={{ color: "#c9a84c", letterSpacing: 2 }}>{pinActual}</strong></p>
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
  const gerenteActual = proyecto.gerentes?.[0]?.usuario?.id || "";
  const [form, setForm] = useState({ nombre: proyecto.nombre, clienteNombre: proyecto.clienteNombre, estatus: proyecto.estatus, gerenteId: gerenteActual });
  const [gerentes, setGerentes] = useState([]);
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((data) => setGerentes(Array.isArray(data) ? data.filter((u) => u.rol === "GERENTE" && u.activo) : []))
      .catch(() => {});
  }, []);

  function cambiar(campo, valor) { setForm((p) => ({ ...p, [campo]: valor })); setErr(""); }

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return setErr("El nombre es requerido.");
    if (!form.clienteNombre.trim()) return setErr("El nombre del cliente es requerido.");
    setGuardando(true);
    try {
      const gerentesIds = form.gerenteId ? [parseInt(form.gerenteId)] : [];
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: form.nombre.trim(), clienteNombre: form.clienteNombre.trim(), estatus: form.estatus, gerentesIds }),
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
        <Campo label="Gerente asignado">
          <select className="input-base" style={{ width: "100%" }} value={form.gerenteId} onChange={(e) => cambiar("gerenteId", e.target.value)}>
            <option value="">Sin gerente</option>
            {gerentes.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </Campo>
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
          style={{ border: "2px dashed #e5e5e5", borderRadius: 8, padding: 32, textAlign: "center", marginBottom: 14, cursor: "pointer", background: archivo ? "#f0fdf4" : "#fafafa" }}
          onClick={() => document.getElementById("input-pdf-modal").click()}
        >
          <Upload size={28} style={{ color: "#c9a84c", marginBottom: 8 }} />
          {archivo
            ? <p style={{ margin: 0, color: "#166534", fontSize: 13, fontWeight: 500 }}>{archivo.name}</p>
            : <p style={{ margin: 0, color: "#888888", fontSize: 13 }}>Haz clic para seleccionar o arrastra el PDF<br /><span style={{ fontSize: 11, opacity: 0.7 }}>Máximo 50 MB</span></p>}
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
  padding: "10px 16px",
  fontSize: 10,
  fontWeight: 700,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  textAlign: "left",
  whiteSpace: "nowrap",
  background: "#ffffff",
};

const sTd = {
  padding: "16px 16px",
  verticalAlign: "top",
  borderRight: "1px solid #f3f4f6",
};

function sBtnPlano(color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: color,
    border: "none",
    borderRadius: 6,
    padding: "5px 10px",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
