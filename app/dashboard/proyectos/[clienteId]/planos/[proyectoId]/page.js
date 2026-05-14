"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Pencil, RefreshCw, Plus, Upload, CheckCircle, X,
  ExternalLink, FileText, Clock, User, AlertTriangle, Link,
  Settings, Check, Minus,
} from "lucide-react";
import { urlPdfPlano } from "@/lib/urlPdf";


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
          jefe:      nodo("RECHAZADO", ultimo?.gerente?.nombre?.split(" ")[0] || null, formatFechaCorta(ultimo?.createdAt)),
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
        produccion: nodo("COMPLETADO"),
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
  const { clienteId, proyectoId } = useParams();
  const id = proyectoId;
  const router = useRouter();
  const { data: sesion } = useSession();
  const rol = sesion?.user?.rol;
  const usuarioId = parseInt(sesion?.user?.id);

  const [proyecto, setProyecto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
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
      <button className="btn-secundario" onClick={() => router.push(`/dashboard/planos/${clienteId}`)}>Volver</button>
    </div>
  );
  if (!proyecto) return null;

  const esGerente = rol === "GERENTE" || rol === "DUENO" || rol === "SUPERADMIN";
  const puedeCrearClave = rol === "GERENTE" || rol === "DISENADOR" || rol === "DUENO" || rol === "SUPERADMIN";
  const puedeSubir = rol === "DISENADOR";
  const gerentesProyecto = proyecto.gerentes?.map((g) => g.usuario) || [];

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto" }}>

      {/* Barra superior */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => router.push(`/dashboard/planos/${clienteId}`)}
          style={{ background: "#ffffff", border: "1px solid #e5e5e5", color: "#555555", borderRadius: 8, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <ArrowLeft size={14} /> Volver
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={cargar}
          style={{ background: "#ffffff", border: "1px solid #e5e5e5", color: "#555555", borderRadius: 8, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <RefreshCw size={14} /> Actualizar
        </button>
        {esGerente && (
          <button onClick={() => router.push(`/dashboard/proyectos/${clienteId}/planos/${id}/historial`)}
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
      <div style={{
        background: "#ffffff",
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        marginBottom: 20,
        padding: "12px 20px",
        display: "flex",
        alignItems: esMobil ? "stretch" : "center",
        flexDirection: esMobil ? "column" : "row",
        gap: esMobil ? 8 : 16,
        flexWrap: "wrap",
      }}>
        <div style={{ flex: esMobil ? "none" : 1, minWidth: 0, width: esMobil ? "100%" : "auto" }}>
          <h1 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 800, color: "#212121" }}>{proyecto.nombre}</h1>
          <div style={{ fontSize: 12, color: "#555555", overflow: "hidden", textOverflow: "ellipsis" }}>
            <span style={{ color: "#999999" }}>Cliente: </span>
            <strong style={{ color: "#212121", fontWeight: 600 }}>{proyecto.cliente?.nombre || proyecto.cliente?.nombreCorto || "Sin cliente"}</strong>
            <span style={{ color: "#cccccc" }}> · </span>
            <span style={{ fontSize: 11, color: "#aaaaaa" }}>
              {new Date(proyecto.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>

        {esGerente && gerentesProyecto.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", width: esMobil ? "100%" : "auto" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>Gerente:</span>
            {gerentesProyecto.map((u) => (
              <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#212121", background: "#f5f5f5", padding: "4px 10px", borderRadius: 20, border: "1px solid #e5e5e5" }}>
                <User size={10} style={{ color: "#c9a84c" }} /> {u.nombre}
              </span>
            ))}
          </div>
        )}

        {esGerente && proyecto.pinAcceso && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: esMobil ? "100%" : "auto" }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>PIN:</span>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", color: "#212121", fontVariantNumeric: "tabular-nums" }}>{proyecto.pinAcceso}</span>
            <button
              onClick={() => setModalPin(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 6, padding: "4px 8px", color: "#6b7280", fontSize: 11, cursor: "pointer" }}
            >
              <RefreshCw size={11} /> Cambiar
            </button>
            <CopiarLinkCliente
              pin={proyecto.pinAcceso}
              habilitado={proyecto.claves?.some(c => ["ENVIADO","AUTORIZADO","LIBERADO","EN_PRODUCCION"].includes(c.estatus)) ?? false}
            />
          </div>
        )}
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
function PipelineSimple({ pipeline, jefeClicable, clienteClicable, costosClicable, produccionClicable, onClickJefe, onClickCliente, onClickCostos, onClickProduccion, onVerComentario }) {
  const COLOR_NODO = {
    PENDIENTE:  "#b1b0ac",
    EN_PROCESO: "#dba03a",
    COMPLETADO: "#369378",
    RECHAZADO:  "#dc4f5a",
  };
  const NODOS = [
    { key: "jefe",       label: "Jefe área",  nodo: pipeline.jefe,       clicable: jefeClicable,       onClick: onClickJefe },
    { key: "cliente",    label: "Cliente",    nodo: pipeline.cliente,    clicable: clienteClicable,    onClick: onClickCliente },
    { key: "costos",     label: "Costos",     nodo: pipeline.costos,     clicable: costosClicable,     onClick: onClickCostos },
    { key: "produccion", label: "Producción", nodo: pipeline.produccion, clicable: produccionClicable, onClick: onClickProduccion },
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {NODOS.map(({ key, label, nodo, clicable, onClick }, idx) => {
        const colorIzq = idx > 0
          ? (nodo.estado === "RECHAZADO" ? "#ef4444" : NODOS[idx - 1].nodo.estado === "COMPLETADO" ? "#10b981" : "#e5e7eb")
          : null;
        const colorDer = idx < 3
          ? (NODOS[idx + 1].nodo.estado === "RECHAZADO" ? "#ef4444" : nodo.estado === "COMPLETADO" ? "#10b981" : "#e5e7eb")
          : null;
        return (
        <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
          {idx > 0 && (
            <div style={{ position: "absolute", right: "50%", top: 9, left: 0, height: 2, background: colorIzq }} />
          )}
          {idx < 3 && (
            <div style={{ position: "absolute", left: "50%", top: 9, right: 0, height: 2, background: colorDer }} />
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
      );
      })}
    </div>
  );
}

/* ── Card de clave para móvil ── */
function CardClave({ clave, rol, usuarioId, gerentesProyecto, pinAcceso, puedeSubir, onSubirPlano, onRefresh }) {
  const [accionando, setAccionando] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalComentario, setModalComentario] = useState(null);
  const [modalJefe, setModalJefe] = useState(false);
  const [modalCostos, setModalCostos] = useState(false);
  const [modalProduccion, setModalProduccion] = useState(false);
  const [modalLectura, setModalLectura] = useState(null);

  const plano = clave.planos?.[0] || null;
  const autInternas = plano?.autorizacionesInternas || [];
  const autCliente = plano?.autorizacionCliente || null;
  const autorizadoPorMi = autInternas.some((a) => a.gerente?.id === usuarioId && a.decision === "APROBADO");

  const pipeline = calcularPipeline(clave, plano);
  const cli = calcularClicabilidad(rol, clave, autorizadoPorMi);

  function onClickJefe()       { if (cli.jefeAccion) setModalJefe(true);             else if (cli.jefeClicable) setModalLectura("jefe"); }
  function onClickCliente()    { if (cli.clienteClicable) setModalLectura("cliente"); }
  function onClickCostos()     { if (cli.costosAccion) setModalCostos(true);          else if (cli.costosClicable) setModalLectura("costos"); }
  function onClickProduccion() { if (cli.produccionAccion) setModalProduccion(true);  else if (cli.produccionClicable) setModalLectura("produccion"); }

  async function ejecutarAccion(url, method, body, mensajeExito) {
    setAccionando(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setToast({ tipo: "error", titulo: "Error al procesar", mensaje: data.error || "Error" }); return false; }
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
            plano={plano}
            clave={clave}
            ejecutando={accionando}
            onCerrar={() => setModalCostos(false)}
            onConfirmado={async () => {
              const ok = await ejecutarAccion(`/api/planos/${plano.id}/liberar`, "POST", {}, "¡Plano liberado a producción!");
              if (ok) setModalCostos(false);
            }}
            onRechazado={() => {
              setModalCostos(false);
              setToast({ tipo: "exito", titulo: "Plano rechazado por Costos. El diseñador deberá corregir." });
              setTimeout(() => { setToast(null); onRefresh(); }, 2500);
            }}
          />
        </Portal>
      )}
      {modalProduccion && (
        <Portal>
          <ModalAccionProduccion
            plano={plano}
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
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#212121" }}>{clave.codigo}</span>
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
            <a href={urlPdfPlano(plano.id)} target="_blank" rel="noopener noreferrer"
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
          jefeClicable={cli.jefeClicable}
          clienteClicable={cli.clienteClicable}
          costosClicable={cli.costosClicable}
          produccionClicable={cli.produccionClicable}
          onClickJefe={onClickJefe}
          onClickCliente={onClickCliente}
          onClickCostos={onClickCostos}
          onClickProduccion={onClickProduccion}
          onVerComentario={setModalComentario}
        />

        {/* Botón de acción */}
        {(puedeSubirPrimero || puedeSubirNuevo || cli.jefeAccion || cli.costosAccion || cli.produccionAccion) && (
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
            {cli.jefeAccion && (
              <button onClick={() => setModalJefe(true)} style={{ ...sBtnPlano("#c9a84c"), width: "100%", justifyContent: "center", padding: "9px 0", color: "#212121" }}>
                <CheckCircle size={13} /> Revisar plano
              </button>
            )}
            {cli.costosAccion && (
              <button onClick={() => setModalCostos(true)} style={{ ...sBtnPlano("#c9a84c"), width: "100%", justifyContent: "center", padding: "9px 0", color: "#212121" }}>
                <CheckCircle size={13} /> Liberar a producción
              </button>
            )}
            {cli.produccionAccion && (
              <button onClick={() => setModalProduccion(true)} style={{ ...sBtnPlano("#212121"), width: "100%", justifyContent: "center", padding: "9px 0" }}>
                <CheckCircle size={13} /> Marcar en producción
              </button>
            )}
          </div>
        )}
      </div>
      {modalLectura && (
        <Portal>
          <ModalLectura
            nodo={modalLectura}
            clave={clave}
            plano={plano}
            autInternas={autInternas}
            autCliente={autCliente}
            gerentesProyecto={gerentesProyecto}
            onCerrar={() => setModalLectura(null)}
          />
        </Portal>
      )}
    </>
  );
}

const ROLES_GESTION = ["GERENTE", "DUENO", "SUPERADMIN"];

function calcularClicabilidad(rol, clave, autorizadoPorMi) {
  const esGestion = ROLES_GESTION.includes(rol);
  const jefeAccion = rol === "GERENTE" && clave.estatus === "REVISION_INTERNA" && !autorizadoPorMi;
  const costosAccion = rol === "COSTOS" && clave.estatus === "AUTORIZADO";
  return {
    esGestion,
    jefeAccion,
    jefeClicable: jefeAccion || rol === "DUENO" || rol === "SUPERADMIN",
    clienteClicable: esGestion,
    costosAccion,
    costosClicable: costosAccion || esGestion,
    produccionAccion: false,
    produccionClicable: false,
  };
}

/* ── Fila de clave rediseñada ── */
function FilaClave({ clave, rol, usuarioId, gerentesProyecto, pinAcceso, puedeSubir, onSubirPlano, onRefresh }) {
  const [accionando, setAccionando] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalComentario, setModalComentario] = useState(null);
  const [modalJefe, setModalJefe] = useState(false);
  const [modalCostos, setModalCostos] = useState(false);
  const [modalProduccion, setModalProduccion] = useState(false);
  const [modalLectura, setModalLectura] = useState(null);

  const plano = clave.planos?.[0] || null;
  const autInternas = plano?.autorizacionesInternas || [];
  const autCliente = plano?.autorizacionCliente || null;
  const autorizadoPorMi = autInternas.some((a) => a.gerente?.id === usuarioId && a.decision === "APROBADO");

  const pipeline = calcularPipeline(clave, plano);
  const cli = calcularClicabilidad(rol, clave, autorizadoPorMi);

  function onClickJefe()       { if (cli.jefeAccion) setModalJefe(true);             else if (cli.jefeClicable) setModalLectura("jefe"); }
  function onClickCliente()    { if (cli.clienteClicable) setModalLectura("cliente"); }
  function onClickCostos()     { if (cli.costosAccion) setModalCostos(true);          else if (cli.costosClicable) setModalLectura("costos"); }
  function onClickProduccion() { if (cli.produccionAccion) setModalProduccion(true);  else if (cli.produccionClicable) setModalLectura("produccion"); }

  async function ejecutarAccion(url, method, body, mensajeExito) {
    setAccionando(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setToast({ tipo: "error", titulo: "Error al procesar", mensaje: data.error || "Error" });
        return false;
      }
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
            plano={plano}
            clave={clave}
            ejecutando={accionando}
            onCerrar={() => setModalCostos(false)}
            onConfirmado={async () => {
              const ok = await ejecutarAccion(`/api/planos/${plano.id}/liberar`, "POST", {}, "¡Plano liberado a producción!");
              if (ok) setModalCostos(false);
            }}
            onRechazado={() => {
              setModalCostos(false);
              setToast({ tipo: "exito", titulo: "Plano rechazado por Costos. El diseñador deberá corregir." });
              setTimeout(() => { setToast(null); onRefresh(); }, 2500);
            }}
          />
        </Portal>
      )}
      {modalProduccion && (
        <Portal>
          <ModalAccionProduccion
            plano={plano}
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
              <a href={urlPdfPlano(plano.id)} target="_blank" rel="noopener noreferrer"
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
            jefeClicable={cli.jefeClicable}
            clienteClicable={cli.clienteClicable}
            costosClicable={cli.costosClicable}
            produccionClicable={cli.produccionClicable}
            onClickJefe={onClickJefe}
            onClickCliente={onClickCliente}
            onClickCostos={onClickCostos}
            onClickProduccion={onClickProduccion}
            onVerComentario={setModalComentario}
          />
        </td>
      </tr>
      {modalLectura && (
        <Portal>
          <ModalLectura
            nodo={modalLectura}
            clave={clave}
            plano={plano}
            autInternas={autInternas}
            autCliente={autCliente}
            gerentesProyecto={gerentesProyecto}
            onCerrar={() => setModalLectura(null)}
          />
        </Portal>
      )}
    </>
  );
}

/* ── Pipeline visual ── */
function PipelineVisual({ pipeline, jefeClicable, clienteClicable, costosClicable, produccionClicable, onClickJefe, onClickCliente, onClickCostos, onClickProduccion, onVerComentario }) {
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
      <Conector completado={pipeline.jefe.estado === "COMPLETADO"} destinoRechazado={pipeline.cliente.estado === "RECHAZADO"} />
      <NodoPipeline
        titulo="Cliente"
        estado={pipeline.cliente.estado}
        nombre={pipeline.cliente.nombre}
        fecha={pipeline.cliente.fecha}
        comentario={pipeline.cliente.comentario}
        clicable={clienteClicable}
        onClick={onClickCliente}
        onVerComentario={pipeline.cliente.comentario ? () => onVerComentario({ texto: pipeline.cliente.comentario, autor: pipeline.cliente.nombre, fecha: null }) : null}
      />
      <Conector completado={pipeline.cliente.estado === "COMPLETADO"} destinoRechazado={pipeline.costos.estado === "RECHAZADO"} />
      <NodoPipeline
        titulo="Costos"
        estado={pipeline.costos.estado}
        nombre={pipeline.costos.nombre}
        fecha={pipeline.costos.fecha}
        clicable={costosClicable}
        onClick={onClickCostos}
      />
      <Conector completado={pipeline.costos.estado === "COMPLETADO"} destinoRechazado={pipeline.produccion.estado === "RECHAZADO"} />
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

function Conector({ completado, destinoRechazado }) {
  const background = destinoRechazado ? "#dc4f5a" : completado ? "#369378" : "#dedede";
  return (
    <div style={{
      flex: 1,
      height: 2,
      background,
      marginTop: 17,
      minWidth: 16,
      flexShrink: 1,
    }} />
  );
}

const NODO_CONFIG = {
  PENDIENTE:  { bg: "#f5f5ea", border: "#b1b0ac", Icono: Minus,    colorIcono: "#a2a29a" },
  EN_PROCESO: { bg: "#fbefd9", border: "#dba03a", Icono: Settings, colorIcono: "#74551d" },
  COMPLETADO: { bg: "#e4f2ed", border: "#369378", Icono: Check,    colorIcono: "#467564" },
  RECHAZADO:  { bg: "#fce5ef", border: "#dc4f5a", Icono: X,        colorIcono: "#9d2937" },
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
    if (comentarios.trim().length < 20) return setErr("Los comentarios deben tener al menos 20 caracteres.");
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
              <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", height: 400, background: "#f9fafb" }}>
                <iframe src={urlPdfPlano(plano.id)} width="100%" height="100%" style={{ border: "none", display: "block" }} title="Plano PDF" />
              </div>
              <a href={urlPdfPlano(plano.id)} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 12, color: "#c9a84c", textDecoration: "none" }}>
                <ExternalLink size={12} /> Abrir en nueva pestaña
              </a>

              {/* Checklist completado por diseñador */}
              <div style={{ marginTop: 18, padding: "14px 16px", background: "#f9fafb", border: "1px solid #e5e5e5", borderRadius: 8 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#212121" }}>
                  Checklist completado por diseñador
                </h4>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {ITEMS_CHECKLIST.map((texto, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#374151", lineHeight: 1.45 }}>
                      <Check size={14} style={{ color: "#10b981", flexShrink: 0, marginTop: 1 }} />
                      <span>{texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onCerrar}
                style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 20px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>
                Cerrar
              </button>
              {!autorizadoPorMi && (
                <>
                  <button onClick={() => setMostrando("rechazar")}
                    style={{ background: "#ef4444", border: "none", borderRadius: 8, padding: "9px 20px", color: "#ffffff", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <X size={14} /> Rechazar
                  </button>
                  <button onClick={onAutorizar}
                    style={{ background: "#10b981", border: "none", borderRadius: 8, padding: "9px 20px", color: "#ffffff", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
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
              placeholder="Describe qué debe corregir el diseñador... (mínimo 20 caracteres)"
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

function ModalAccionCostos({ plano, clave, ejecutando, onCerrar, onConfirmado, onRechazado }) {
  const [mostrando, setMostrando] = useState("ver");
  const [comentarios, setComentarios] = useState("");
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmarRechazo(e) {
    e.preventDefault();
    if (comentarios.trim().length < 20) return setErr("Los comentarios deben tener al menos 20 caracteres.");
    setEnviando(true);
    try {
      const res = await fetch(`/api/planos/${plano.id}/rechazar-costos`, {
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
            {mostrando === "rechazar" ? "Rechazar plano" : "Liberación a producción"} — {clave.codigo}
          </h2>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {mostrando === "ver" && (
          <>
            <div style={{ padding: "16px 24px", flex: 1 }}>
              {plano && (
                <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden", height: 350, background: "#f9fafb" }}>
                  <iframe src={urlPdfPlano(plano.id, { tipo: plano.autorizacionCliente?.urlPdfFirmado ? "firmado" : "original" })} width="100%" height="100%" style={{ border: "none", display: "block" }} title="Plano PDF" />
                </div>
              )}

              {plano?.autorizacionCliente?.urlPdfFirmado && (
                <a
                  href={urlPdfPlano(plano.id, { tipo: "firmado" })}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, fontWeight: 600, color: "#c9a84c", textDecoration: "none", padding: "8px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8 }}
                >
                  <FileText size={14} /> Ver PDF firmado por cliente
                </a>
              )}

              {plano?.comentariosCostos && (
                <div style={{ marginTop: 16, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    Notas del diseñador
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>
                    {plano.comentariosCostos}
                  </p>
                </div>
              )}
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button onClick={onCerrar}
                style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 20px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>
                Cerrar
              </button>
              <button onClick={() => setMostrando("rechazar")}
                style={{ background: "#ef4444", border: "none", borderRadius: 8, padding: "9px 20px", color: "#ffffff", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <X size={14} /> Rechazar
              </button>
              <button onClick={onConfirmado} disabled={ejecutando}
                style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "9px 20px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: ejecutando ? "not-allowed" : "pointer", opacity: ejecutando ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                {ejecutando ? "Liberando…" : <><CheckCircle size={14} /> Liberar a producción</>}
              </button>
            </div>
          </>
        )}

        {mostrando === "rechazar" && (
          <form onSubmit={confirmarRechazo} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
              Describe los motivos del rechazo para que el diseñador pueda corregir.
            </p>
            <textarea
              className="input-base"
              rows={5}
              style={{ width: "100%", resize: "vertical", boxSizing: "border-box" }}
              placeholder="Describe los problemas detectados desde Costos... (mínimo 20 caracteres)"
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

function ModalAccionProduccion({ plano, clave, ejecutando, onCerrar, onConfirmado }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: "#ffffff", borderRadius: 16, width: "92%", maxWidth: 520, padding: 28, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
        <button onClick={onCerrar} style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600, color: "#212121" }}>
          Marcar en producción — {clave.codigo}
        </h2>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Clave</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#212121" }}>{clave.codigo}</div>
          {clave.descripcion && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{clave.descripcion}</p>
          )}
        </div>

        {plano && (
          <div style={{ marginBottom: 18, padding: "12px 14px", background: "#f9fafb", border: "1px solid #e5e5e5", borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Plano</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#212121" }}>Versión {plano.version}</span>
              {plano.subidoPor?.nombre && (
                <span style={{ fontSize: 12, color: "#6b7280" }}>· Subido por {plano.subidoPor.nombre}</span>
              )}
            </div>
            <a href={urlPdfPlano(plano.id)} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: "#c9a84c", textDecoration: "none", padding: "5px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6 }}>
              <ExternalLink size={12} /> Ver PDF
            </a>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCerrar}
            style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "9px 20px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={onConfirmado} disabled={ejecutando}
            style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "9px 20px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: ejecutando ? "not-allowed" : "pointer", opacity: ejecutando ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            {ejecutando ? "Procesando…" : <><CheckCircle size={14} /> Confirmar en producción</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal de lectura unificado ── */
function LineaTexto({ children }) {
  return <p style={{ margin: "0 0 12px", fontSize: 14, color: "#212121", lineHeight: 1.6 }}>{children}</p>;
}

function CajaTextoLectura({ label, children }) {
  return (
    <div style={{ marginTop: 8, background: "#f9fafb", border: "1px solid #e5e5e5", borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
      <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.5, fontStyle: "italic" }}>"{children}"</p>
    </div>
  );
}

function CajaNotasCostos({ children }) {
  return (
    <div style={{ marginBottom: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Notas del diseñador</div>
      <p style={{ margin: 0, fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>{children}</p>
    </div>
  );
}

function ModalLectura({ nodo, clave, plano, autInternas, autCliente, gerentesProyecto, onCerrar }) {
  const fmt = (f) => f ? new Date(f).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  const TITULOS = {
    jefe: "Estado — Jefe de área",
    cliente: "Respuesta del cliente",
    costos: "Estado — Costos",
    produccion: "Estado — Producción",
  };

  function renderContenido() {
    if (nodo === "jefe") {
      const aprobada = (autInternas || []).find((a) => a.decision === "APROBADO");
      const rechazada = (autInternas || []).find((a) => a.decision === "RECHAZADO");
      const gerenteAsignado = gerentesProyecto?.[0];
      if (rechazada) {
        return (
          <>
            <LineaTexto>Rechazado por <strong>{rechazada.gerente?.nombre || "—"}</strong> el {fmt(rechazada.createdAt)}</LineaTexto>
            {rechazada.comentarios && <CajaTextoLectura label="Motivo">{rechazada.comentarios}</CajaTextoLectura>}
          </>
        );
      }
      if (aprobada) {
        return <LineaTexto>Autorizado por <strong>{aprobada.gerente?.nombre || "—"}</strong> el {fmt(aprobada.createdAt)}</LineaTexto>;
      }
      return <LineaTexto>Pendiente de autorización por <strong>{gerenteAsignado?.nombre || "el gerente asignado"}</strong></LineaTexto>;
    }

    if (nodo === "cliente") {
      if (!autCliente) return <LineaTexto>Pendiente de respuesta del cliente</LineaTexto>;
      if (autCliente.decision === "APROBADO") {
        return (
          <>
            <LineaTexto>Aprobado por: <strong>{autCliente.firmadoPor}</strong></LineaTexto>
            <LineaTexto>Fecha: {fmt(autCliente.createdAt)}</LineaTexto>
            {autCliente.urlPdfFirmado && plano?.id && (
              <a
                href={urlPdfPlano(plano.id, { tipo: "firmado" })}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#212121",
                  color: "#c9a84c",
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: "none",
                  marginTop: 12,
                }}
              >
                <FileText size={14} /> Ver PDF firmado por cliente
              </a>
            )}
          </>
        );
      }
      return (
        <>
          <LineaTexto>Rechazado el {fmt(autCliente.createdAt)}</LineaTexto>
          {autCliente.comentarios && <CajaTextoLectura label="Comentarios del cliente">{autCliente.comentarios}</CajaTextoLectura>}
        </>
      );
    }

    if (nodo === "costos") {
      const liberado = clave.estatus === "LIBERADO" || clave.estatus === "EN_PRODUCCION";
      return (
        <>
          {plano?.comentariosCostos && <CajaNotasCostos>{plano.comentariosCostos}</CajaNotasCostos>}
          {liberado
            ? <LineaTexto>Liberado a producción</LineaTexto>
            : <LineaTexto>Pendiente de liberación a producción</LineaTexto>}
        </>
      );
    }

    if (nodo === "produccion") {
      if (clave.estatus === "EN_PRODUCCION") {
        return <LineaTexto>En producción desde {fmt(clave.updatedAt)}</LineaTexto>;
      }
      return <LineaTexto>Pendiente</LineaTexto>;
    }
    return null;
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: "#ffffff", borderRadius: 16, padding: 28, maxWidth: 560, width: "90%", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
        <button onClick={onCerrar} style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 600, color: "#212121" }}>{TITULOS[nodo]}</h2>
        {renderContenido()}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onCerrar} className="btn-secundario">Cerrar</button>
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

function CopiarLinkCliente({ pin, habilitado }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    if (!habilitado) return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
    const url = `${appUrl}/cliente/${pin}`;
    navigator.clipboard.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  }
  return (
    <div>
      <button
        onClick={copiar}
        disabled={!habilitado}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: copiado ? "#dcfce7" : "#f5f5f5",
          border: `1px solid ${copiado ? "#86efac" : "#e5e5e5"}`,
          borderRadius: 8, padding: "5px 12px",
          color: !habilitado ? "#9ca3af" : copiado ? "#166534" : "#555555",
          fontSize: 12,
          cursor: habilitado ? "pointer" : "not-allowed",
          opacity: habilitado ? 1 : 0.4,
          transition: "all 0.2s",
        }}
      >
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
  const [form, setForm] = useState({
    nombre: proyecto.nombre,
    clienteId: proyecto.clienteId ? String(proyecto.clienteId) : (proyecto.cliente?.id ? String(proyecto.cliente.id) : ""),
    clienteContacto: proyecto.clienteContacto || "",
    estatus: proyecto.estatus,
    gerenteId: gerenteActual,
  });
  const [gerentes, setGerentes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [modalNuevoCliente, setModalNuevoCliente] = useState(false);
  const [err, setErr] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((data) => setGerentes(Array.isArray(data) ? data.filter((u) => u.rol === "GERENTE" && u.activo) : []))
      .catch(() => {});
  }, []);

  const cargarClientes = useCallback(async () => {
    setCargandoClientes(true);
    try {
      const res = await fetch("/api/clientes");
      const data = await res.json();
      if (Array.isArray(data)) setClientes(data);
    } finally {
      setCargandoClientes(false);
    }
  }, []);

  useEffect(() => { cargarClientes(); }, [cargarClientes]);

  function cambiar(campo, valor) { setForm((p) => ({ ...p, [campo]: valor })); setErr(""); }

  async function guardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return setErr("El nombre es requerido.");
    if (!form.clienteId) return setErr("Selecciona un cliente.");
    setGuardando(true);
    try {
      const gerentesIds = form.gerenteId ? [parseInt(form.gerenteId)] : [];
      const res = await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          clienteId: parseInt(form.clienteId),
          clienteContacto: form.clienteContacto.trim(),
          estatus: form.estatus,
          gerentesIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setErr(data.error || "Error al actualizar.");
      onGuardado(); onCerrar();
    } finally { setGuardando(false); }
  }

  return (
    <>
      <Modal titulo="Editar proyecto" onCerrar={onCerrar}>
        <form onSubmit={guardar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Campo label="Nombre del proyecto">
            <input className="input-base" style={{ width: "100%" }} value={form.nombre} onChange={(e) => cambiar("nombre", e.target.value)} />
          </Campo>
          <Campo label="Cliente">
            {cargandoClientes ? (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Cargando clientes…</div>
            ) : clientes.length === 0 ? (
              <div style={{ padding: "10px 14px", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8, color: "#9a3412", fontSize: 12 }}>
                No hay clientes registrados.
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
                  onCambio={(id) => cambiar("clienteId", id)}
                  disabled={guardando}
                />
                <button
                  type="button"
                  onClick={() => setModalNuevoCliente(true)}
                  style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "0 12px", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center" }}
                  title="Crear cliente"
                >
                  <Plus size={15} />
                </button>
              </div>
            )}
          </Campo>
          <Campo label="Nombre del contacto que firmará">
            <input className="input-base" style={{ width: "100%" }} placeholder="Ej. Juan Pérez García" value={form.clienteContacto} onChange={(e) => cambiar("clienteContacto", e.target.value)} />
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
      {modalNuevoCliente && (
        <MiniModalCliente
          onCerrar={() => setModalNuevoCliente(false)}
          onCreado={async (nuevo) => {
            await cargarClientes();
            cambiar("clienteId", String(nuevo.id));
            setModalNuevoCliente(false);
          }}
        />
      )}
    </>
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
          <textarea
            placeholder="Ej. Cocina principal torre B"
            value={descripcion}
            onChange={(e) => { setDescripcion(e.target.value); setErr(""); }}
            style={{
              width: "100%",
              minHeight: 80,
              maxHeight: 200,
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
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => e.target.style.borderColor = "#c9a84c"}
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
          />
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

const ITEMS_CHECKLIST = [
  "Confirmo que se siguieron los procesos establecidos por la empresa.",
  "Confirmo que se revisaron y validaron los instructivos de trabajo aplicables.",
  "Confirmo que se verificaron los planos del cliente, presupuesto y explosiones/despieces correspondientes.",
  "Confirmo que se colocaron los comentarios y observaciones necesarios para el área de costos.",
  "Confirmo que se verificaron electrodomésticos, cubierta, iluminación LED y demás elementos complementarios.",
  "Confirmo que los planos incluyen correctamente los elementos físicos de obra civil.",
];

function ModalSubirPlano({ claveId, onCerrar, onGuardado }) {
  const [marcados, setMarcados] = useState(Array(ITEMS_CHECKLIST.length).fill(false));
  const [archivo, setArchivo] = useState(null);
  const [comentarios, setComentarios] = useState("");
  const [err, setErr] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  const completados = marcados.filter(Boolean).length;
  const todosMarcados = completados === ITEMS_CHECKLIST.length;
  const comentariosOk = comentarios.trim().length >= 10;
  const archivoOk = !!archivo;
  const puedeSubir = todosMarcados && comentariosOk && archivoOk;
  const progresoPct = (completados / ITEMS_CHECKLIST.length) * 100;

  function toggleItem(idx) {
    setMarcados((prev) => prev.map((v, i) => (i === idx ? !v : v)));
    setErr("");
  }

  async function subir(e) {
    e.preventDefault();
    if (!archivoOk) return setErr("Selecciona un archivo PDF.");
    if (archivo.type !== "application/pdf") return setErr("Solo se permiten archivos PDF.");
    if (archivo.size > 50 * 1024 * 1024) return setErr("El archivo no puede superar 50 MB.");
    if (!todosMarcados) return setErr("Debes marcar todos los puntos del checklist.");
    if (!comentariosOk) return setErr("Los comentarios para Costos deben tener al menos 10 caracteres.");
    setSubiendo(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", archivo);
      fd.append("claveId", claveId);
      fd.append("comentariosCostos", comentarios.trim());
      const res = await fetch("/api/planos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) return setErr(data.error || "Error al subir el plano.");
      onGuardado(); onCerrar();
    } catch { setErr("Error de conexión."); }
    finally { setSubiendo(false); }
  }

  return (
    <Modal titulo="Subir plano" onCerrar={onCerrar}>
      <form onSubmit={subir} style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Sección 1 — Checklist */}
        <section>
          <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#212121" }}>Checklist de revisión técnica</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#888888" }}>Debes confirmar todos los puntos antes de continuar</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ITEMS_CHECKLIST.map((texto, i) => (
              <label
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  background: marcados[i] ? "rgba(201,168,76,0.05)" : "#ffffff",
                  borderLeft: marcados[i] ? "3px solid #c9a84c" : "3px solid #e5e5e5",
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={marcados[i]}
                  onChange={() => toggleItem(i)}
                  style={{ accentColor: "#c9a84c", marginTop: 2, flexShrink: 0, width: 16, height: 16, cursor: "pointer" }}
                />
                <span style={{ fontSize: 13, color: "#212121", lineHeight: 1.45 }}>{texto}</span>
              </label>
            ))}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#888888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {completados}/{ITEMS_CHECKLIST.length} completados
              </span>
            </div>
            <div style={{ height: 4, background: "#f0f0f0", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${progresoPct}%`, height: "100%", background: "#c9a84c", transition: "width 0.25s" }} />
            </div>
          </div>
        </section>

        {/* Sección 2 — Archivo */}
        <section>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "#212121" }}>Archivo PDF</h3>
          <div
            style={{ border: "2px dashed #e5e5e5", borderRadius: 8, padding: 24, textAlign: "center", cursor: "pointer", background: archivo ? "#f0fdf4" : "#fafafa" }}
            onClick={() => document.getElementById("input-pdf-modal").click()}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
              <Upload size={26} style={{ color: "#c9a84c" }} />
            </div>
            {archivo
              ? <p style={{ margin: 0, color: "#166534", fontSize: 13, fontWeight: 500 }}>{archivo.name}</p>
              : <p style={{ margin: 0, color: "#888888", fontSize: 13 }}>Haz clic para seleccionar el PDF<br /><span style={{ fontSize: 11, opacity: 0.7 }}>Máximo 50 MB</span></p>}
          </div>
          <input id="input-pdf-modal" type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => { setArchivo(e.target.files[0] || null); setErr(""); }} />
        </section>

        {/* Sección 3 — Comentarios para Costos */}
        <section>
          <h3 style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "#212121" }}>Comentarios para el área de Costos</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#888888" }}>Solo el área de Costos puede ver estos comentarios</p>
          <textarea
            rows={4}
            value={comentarios}
            onChange={(e) => { setComentarios(e.target.value); setErr(""); }}
            placeholder="Describe aspectos importantes que Costos debe revisar..."
            style={{
              width: "100%",
              padding: 12,
              border: "1.5px solid #e0e0e0",
              borderRadius: 8,
              fontSize: 14,
              color: "#212121",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              fontFamily: "inherit",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => e.target.style.borderColor = "#c9a84c"}
            onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
          />
          <p style={{ margin: "4px 0 0", fontSize: 11, color: comentariosOk ? "#10b981" : "#888888" }}>
            {comentarios.trim().length} caracteres {comentariosOk ? "✓" : "(mínimo 10)"}
          </p>
        </section>

        {err && <p style={{ margin: 0, color: "#ef4444", fontSize: 13 }}>{err}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn-secundario" onClick={onCerrar} disabled={subiendo}>Cancelar</button>
          <button
            type="submit"
            disabled={subiendo || !puedeSubir}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 22px",
              background: "#c9a84c",
              color: "#212121",
              fontWeight: 600,
              fontSize: 14,
              borderRadius: 8,
              border: "none",
              cursor: (subiendo || !puedeSubir) ? "not-allowed" : "pointer",
              opacity: (subiendo || !puedeSubir) ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {subiendo ? "Subiendo…" : "Subir plano"}
          </button>
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
        <span style={{ color: "#9ca3af", flexShrink: 0, marginLeft: 8 }}>▾</span>
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
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Nombre *</label>
            <input className="input-base" style={{ width: "100%" }} value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={guardando} autoFocus />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Nombre corto *</label>
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
