"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, FileText, Clock, ExternalLink, RotateCcw, Pen } from "lucide-react";

const ESTATUS_LABEL = {
  ENVIADO:      { label: "Pendiente de tu aprobación", color: "#f59e0b", punto: "#f59e0b" },
  AUTORIZADO:   { label: "Aprobado",                   color: "#16a34a", punto: "#22c55e" },
  LIBERADO:     { label: "En producción",              color: "#0e7490", punto: "#22d3ee" },
  EN_PRODUCCION:{ label: "En producción",              color: "#c2410c", punto: "#fb923c" },
};

export default function ClientePage() {
  const { pin } = useParams();
  const [proyecto, setProyecto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [claveActiva, setClaveActiva] = useState(null);
  const [modalAprobar, setModalAprobar] = useState(null);
  const [modalRechazar, setModalRechazar] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch(`/api/cliente/${pin}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Proyecto no encontrado"); return; }
      setProyecto(data);
      if (data.claves?.length > 0 && !claveActiva) setClaveActiva(data.claves[0].id);
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return <PantallaEstado tipo="cargando" />;
  if (error) return <PantallaEstado tipo="error" mensaje={error} />;
  if (!proyecto) return null;

  const claveSeleccionada = proyecto.claves.find((c) => c.id === claveActiva) || proyecto.claves[0] || null;
  const planoActivo = claveSeleccionada?.planos?.[0] || null;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", color: "#212121" }}>
      {/* Header */}
      <header style={{ background: "#212121", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/baum_logo_bco.svg" alt="BAUM" style={{ height: 32, width: "auto"}} />
          <div style={{ width: 1, height: 24, background: "#444444" }} />
          <span style={{ fontSize: 13, color: "#888888" }}>Portal de aprobación de planos</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>{proyecto.clienteNombre}</div>
          <div style={{ fontSize: 11, color: "#888888" }}>{proyecto.nombre}</div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {proyecto.claves.length === 0 ? (
          <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e5e5e5", textAlign: "center", padding: 64, color: "#888888" }}>
            <Clock size={40} style={{ opacity: 0.25, marginBottom: 14 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#555555" }}>Tu proyecto está siendo preparado.</p>
            <p style={{ margin: "8px 0 0", fontSize: 13 }}>Recibirás un aviso cuando haya planos listos para revisar.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>
            {/* Panel de claves */}
            <div style={{ background: "#ffffff", borderRadius: 12, border: "1px solid #e5e5e5", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #f0f0f0" }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#aaaaaa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Claves del proyecto</p>
              </div>
              <div>
                {proyecto.claves.map((c) => {
                  const conf = ESTATUS_LABEL[c.estatus] || { label: c.estatus, punto: "#6b7280" };
                  const activa = claveActiva === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setClaveActiva(c.id)}
                      style={{
                        width: "100%",
                        background: activa ? "#fffbeb" : "transparent",
                        border: "none",
                        borderBottom: "1px solid #f5f5f5",
                        borderLeft: `3px solid ${activa ? "#c9a84c" : "transparent"}`,
                        padding: "12px 14px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#212121", marginBottom: 4 }}>{c.codigo}</div>
                      <div style={{ fontSize: 11, color: "#666666", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.descripcion}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: conf.punto, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 11, color: conf.punto, fontWeight: 500 }}>{conf.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel principal */}
            <div>
              {claveSeleccionada && planoActivo ? (
                <DetalleClave
                  clave={claveSeleccionada}
                  plano={planoActivo}
                  onAprobar={() => setModalAprobar(planoActivo.id)}
                  onRechazar={() => setModalRechazar(planoActivo.id)}
                />
              ) : claveSeleccionada ? (
                <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, textAlign: "center", padding: 48, color: "#888888" }}>
                  <FileText size={32} style={{ opacity: 0.25, marginBottom: 10 }} />
                  <p style={{ margin: 0 }}>Sin plano disponible para esta clave.</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {modalAprobar !== null && (
        <ModalFirma planoId={modalAprobar} onCerrar={() => setModalAprobar(null)} onCompletado={cargar} />
      )}
      {modalRechazar !== null && (
        <ModalRechazar planoId={modalRechazar} onCerrar={() => setModalRechazar(null)} onCompletado={cargar} />
      )}

      <footer style={{ textAlign: "center", padding: "32px 16px 24px", color: "#aaaaaa", fontSize: 11 }}>
        BAUM Industria Carpintera · Portal seguro de aprobación de planos
      </footer>
    </div>
  );
}

/* ── Detalle de una clave con su plano ── */
function DetalleClave({ clave, plano, onAprobar, onRechazar }) {
  const conf = ESTATUS_LABEL[clave.estatus] || { label: clave.estatus, color: "#6b7280" };
  const autCliente = plano.autorizacionCliente;
  const yaRespondido = !!autCliente;
  const aprobo = autCliente?.decision === "APROBADO";
  const rechazo = autCliente?.decision === "RECHAZADO";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Info de la clave */}
      <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "#212121" }}>{clave.codigo}</h2>
            <p style={{ margin: "0 0 10px", fontSize: 14, color: "#555555" }}>{clave.descripcion}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: conf.punto, display: "inline-block" }} />
              <span style={{ color: conf.color, fontWeight: 600, fontSize: 13 }}>{conf.label}</span>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#888888" }}>
            <div style={{ fontWeight: 600, color: "#212121" }}>Versión {plano.version}</div>
            <div>Subido por {plano.subidoPor?.nombre}</div>
            <div>{new Date(plano.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</div>
          </div>
        </div>

        {aprobo && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle size={18} style={{ color: "#16a34a", flexShrink: 0 }} />
            <div>
              <div style={{ color: "#166534", fontWeight: 600, fontSize: 13 }}>Aprobado por {autCliente.firmadoPor}</div>
              <div style={{ color: "#4ade80", fontSize: 12 }}>{new Date(autCliente.createdAt).toLocaleString("es-MX")}</div>
            </div>
          </div>
        )}

        {rechazo && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <XCircle size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ color: "#991b1b", fontWeight: 600, fontSize: 13 }}>Rechazado — en revisión interna</div>
              {autCliente.comentarios && (
                <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4, fontStyle: "italic" }}>"{autCliente.comentarios}"</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Visor PDF */}
      <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#212121" }}>Plano v{plano.version}</span>
          <a href={plano.urlPdf} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#c9a84c", textDecoration: "none", padding: "4px 10px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6 }}>
            Abrir en nueva pestaña <ExternalLink size={12} />
          </a>
        </div>
        <iframe
          src={plano.urlPdf}
          title={`Plano ${clave.codigo} v${plano.version}`}
          style={{ width: "100%", height: 520, border: "none", display: "block", background: "#f5f5f5" }}
        />
      </div>

      {/* Botones de acción — solo si ENVIADO y sin respuesta */}
      {clave.estatus === "ENVIADO" && !yaRespondido && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button
            onClick={onRechazar}
            style={{ padding: "14px", borderRadius: 10, border: "2px solid #ef4444", background: "#ffffff", color: "#ef4444", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <XCircle size={18} /> Solicitar cambios
          </button>
          <button
            onClick={onAprobar}
            style={{ padding: "14px", borderRadius: 10, border: "2px solid #c9a84c", background: "#c9a84c", color: "#212121", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <CheckCircle size={18} /> Aprobar plano
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Modal de firma ── */
function ModalFirma({ planoId, onCerrar, onCompletado }) {
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const [firmadoPor, setFirmadoPor] = useState("");
  const [firmaTocada, setFirmaTocada] = useState(false);
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);

  function obtenerPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function iniciarDibujo(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = obtenerPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    dibujando.current = true; setFirmaTocada(true);
  }

  function dibujar(e) {
    e.preventDefault();
    if (!dibujando.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = obtenerPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#212121"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
  }

  function terminarDibujo(e) { e.preventDefault(); dibujando.current = false; }

  function limpiarFirma() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setFirmaTocada(false);
  }

  async function enviar() {
    if (!firmadoPor.trim()) return setErr("Ingresa tu nombre completo para firmar.");
    if (!firmaTocada) return setErr("Por favor dibuja tu firma antes de continuar.");
    const firmaBase64 = canvasRef.current.toDataURL("image/png");
    setEnviando(true); setErr("");
    try {
      const res = await fetch(`/api/planos/${planoId}/autorizar-cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APROBADO", firmadoPor: firmadoPor.trim(), firmaBase64 }),
      });
      const data = await res.json();
      if (!res.ok) return setErr(data.error || "Error al procesar la aprobación.");
      onCompletado(); onCerrar();
    } finally { setEnviando(false); }
  }

  return (
    <div style={sOverlay} onClick={onCerrar}>
      <div style={sModal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#212121", display: "flex", alignItems: "center", gap: 8 }}>
            <Pen size={16} /> Firmar y aprobar plano
          </h2>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#888888", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#666666", lineHeight: 1.6 }}>
          Al firmar confirmas que has revisado el plano y que apruebas su contenido para fabricación.
        </p>
        <div style={{ marginBottom: 14 }}>
          <label style={sLabel}>Tu nombre completo</label>
          <input
            className="input-base"
            style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="Como aparecerá en el documento"
            value={firmadoPor}
            onChange={(e) => { setFirmadoPor(e.target.value); setErr(""); }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={sLabel}>Firma</label>
            <button type="button" onClick={limpiarFirma}
              style={{ background: "transparent", border: "none", color: "#888888", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <RotateCcw size={12} /> Limpiar
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={460}
            height={160}
            onMouseDown={iniciarDibujo}
            onMouseMove={dibujar}
            onMouseUp={terminarDibujo}
            onMouseLeave={terminarDibujo}
            onTouchStart={iniciarDibujo}
            onTouchMove={dibujar}
            onTouchEnd={terminarDibujo}
            style={{
              width: "100%", height: 130,
              background: "#fafafa",
              border: `2px solid ${firmaTocada ? "#c9a84c" : "#e5e5e5"}`,
              borderRadius: 8, cursor: "crosshair", display: "block", touchAction: "none",
            }}
          />
          {!firmaTocada && (
            <p style={{ margin: "5px 0 0", fontSize: 11, color: "#aaaaaa", textAlign: "center" }}>
              Dibuja tu firma con el mouse o dedo
            </p>
          )}
        </div>
        {err && (
          <p style={{ margin: "0 0 10px", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#991b1b", fontSize: 13 }}>
            {err}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onCerrar} disabled={enviando}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #e5e5e5", background: "#ffffff", color: "#555555", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={enviar} disabled={enviando}
            style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#c9a84c", color: "#212121", fontWeight: 700, fontSize: 14, cursor: enviando ? "not-allowed" : "pointer", opacity: enviando ? 0.7 : 1 }}>
            {enviando ? "Procesando…" : "Confirmar aprobación"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal de rechazo ── */
function ModalRechazar({ planoId, onCerrar, onCompletado }) {
  const [comentarios, setComentarios] = useState("");
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!comentarios.trim() || comentarios.trim().length < 10) {
      return setErr("Los comentarios deben tener al menos 10 caracteres.");
    }
    setEnviando(true); setErr("");
    try {
      const res = await fetch(`/api/planos/${planoId}/autorizar-cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "RECHAZADO", comentarios: comentarios.trim(), firmadoPor: "Cliente" }),
      });
      const data = await res.json();
      if (!res.ok) return setErr(data.error || "Error al enviar.");
      onCompletado(); onCerrar();
    } finally { setEnviando(false); }
  }

  return (
    <div style={sOverlay} onClick={onCerrar}>
      <div style={sModal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
            <XCircle size={16} /> Solicitar cambios
          </h2>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#888888", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#666666", lineHeight: 1.6 }}>
          El plano regresará a revisión interna. Describe con detalle qué debe modificarse.
        </p>
        <div style={{ marginBottom: 14 }}>
          <label style={sLabel}>Comentarios <span style={{ color: "#ef4444" }}>*</span></label>
          <textarea
            className="input-base"
            style={{ width: "100%", boxSizing: "border-box", minHeight: 100, resize: "vertical", fontFamily: "inherit" }}
            placeholder="Ej. La medida de la gaveta central no corresponde al plano acordado…"
            value={comentarios}
            onChange={(e) => { setComentarios(e.target.value); setErr(""); }}
          />
          <p style={{ margin: "4px 0 0", fontSize: 11, color: comentarios.length < 10 ? "#ef4444" : "#22c55e" }}>
            {comentarios.trim().length} / 10 caracteres mínimo
          </p>
        </div>
        {err && <p style={{ margin: "0 0 10px", color: "#ef4444", fontSize: 13 }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCerrar} disabled={enviando}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #e5e5e5", background: "#ffffff", color: "#555555", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={enviar} disabled={enviando || comentarios.trim().length < 10}
            style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#ef4444", color: "#ffffff", fontWeight: 700, fontSize: 14, cursor: (enviando || comentarios.trim().length < 10) ? "not-allowed" : "pointer", opacity: (enviando || comentarios.trim().length < 10) ? 0.6 : 1 }}>
            {enviando ? "Enviando…" : "Solicitar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Pantallas de estado ── */
function PantallaEstado({ tipo, mensaje }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <img src="/isotipo_baum.svg" alt="BAUM" style={{ height: 80, marginBottom: 24, filter: "grayscale(1) opacity(0.4)" }} />
      {tipo === "cargando" && <div className="spinner" />}
      {tipo === "error" && (
        <>
          <p style={{ color: "#ef4444", fontWeight: 600, margin: "0 0 8px", fontSize: 15 }}>No se pudo cargar el proyecto</p>
          <p style={{ color: "#888888", margin: 0, fontSize: 13, textAlign: "center", maxWidth: 320 }}>{mensaje}</p>
        </>
      )}
    </div>
  );
}

const sOverlay = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50,
};

const sModal = {
  background: "#ffffff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
};

const sLabel = {
  display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "#888888", textTransform: "uppercase", letterSpacing: "0.05em",
};
