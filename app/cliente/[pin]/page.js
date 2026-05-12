"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, FileText, Clock, RotateCcw, Pen, ShieldCheck } from "lucide-react";

const ETIQUETA_CLIENTE = {
  ENVIADO: "Pendiente de revisión",
  AUTORIZADO: "Autorizado",
  RECHAZADO: "Rechazado",
  LIBERADO: "Liberado",
  EN_PRODUCCION: "En producción",
};

const ESTATUS_FINALES = ["AUTORIZADO", "LIBERADO", "EN_PRODUCCION"];

export default function ClientePage() {
  const { pin } = useParams();
  const [proyecto, setProyecto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pinInvalido, setPinInvalido] = useState(false);
  const [modalRevisar, setModalRevisar] = useState(null);
  const [esMobil, setEsMobil] = useState(false);

  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey && ["s", "p", "u"].includes(e.key.toLowerCase())) ||
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && e.key === "I")
      ) {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function actualizar() { setEsMobil(window.innerWidth < 768); }
    actualizar();
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    setPinInvalido(false);
    try {
      const res = await fetch(`/api/cliente/${pin}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404 || res.status === 400) {
          setPinInvalido(true);
        } else {
          setError(data.error || "Error al cargar el proyecto");
        }
        return;
      }
      setProyecto(data);
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }, [pin]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return <PantallaEstado tipo="cargando" />;
  if (pinInvalido) return <PantallaEstado tipo="pin-invalido" />;
  if (error) return <PantallaEstado tipo="error" mensaje={error} />;
  if (!proyecto) return null;

  const claves = proyecto.claves || [];
  const clavesPendientes = claves.filter((c) => c.estatus === "ENVIADO");
  const todasFinales = claves.length > 0 && claves.every((c) => ESTATUS_FINALES.includes(c.estatus));

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", color: "#212121", overflowX: "hidden", userSelect: "none", WebkitUserSelect: "none" }}>
      <header style={{ background: "#212121", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/baum_logo_bco.svg" alt="BAUM" style={{ height: 32, width: "auto" }} />
          <div style={{ width: 1, height: 24, background: "#444444" }} />
          <span style={{ fontSize: 13, color: "#888888" }}>Portal de aprobación de planos</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>{proyecto.clienteNombre}</div>
          <div style={{ fontSize: 11, color: "#888888" }}>{proyecto.nombre}</div>
        </div>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 16px" }}>
        {claves.length === 0 ? (
          <BloqueEstado
            icono={<Clock size={42} style={{ opacity: 0.3, color: "#888888" }} />}
            titulo="Tu proyecto está siendo preparado."
            mensaje="Recibirás un aviso cuando haya planos listos para revisar."
          />
        ) : todasFinales ? (
          <BloqueEstado
            icono={<ShieldCheck size={48} style={{ color: "#16a34a" }} />}
            titulo="Proyecto completado"
            mensaje="Has autorizado todos los planos de este proyecto. Gracias por tu colaboración."
            color="#166534"
          />
        ) : clavesPendientes.length === 0 ? (
          <BloqueEstado
            icono={<CheckCircle size={42} style={{ opacity: 0.4, color: "#888888" }} />}
            titulo="No tienes planos pendientes de revisión en este momento."
          />
        ) : (
          <>
            <div style={{ marginBottom: 22 }}>
              <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#212121" }}>Planos pendientes de revisión</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#666666" }}>{proyecto.nombre} · {proyecto.clienteNombre}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: esMobil ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {clavesPendientes.map((c) => {
                const planoActivo = c.planos?.[0] || null;
                return (
                  <CardClavePendiente
                    key={c.id}
                    clave={c}
                    plano={planoActivo}
                    onRevisar={() => planoActivo && setModalRevisar({ clave: c, plano: planoActivo })}
                  />
                );
              })}
            </div>
          </>
        )}
      </main>

      {modalRevisar && (
        <ModalRevisar
          clave={modalRevisar.clave}
          plano={modalRevisar.plano}
          esMobil={esMobil}
          clienteContacto={proyecto.clienteContacto}
          onCerrar={() => setModalRevisar(null)}
          onCompletado={() => { setModalRevisar(null); cargar(); }}
        />
      )}

      <footer style={{ textAlign: "center", padding: "32px 16px 24px", color: "#aaaaaa", fontSize: 11 }}>
        BAUM Industria Carpintera · Portal seguro de aprobación de planos
      </footer>
    </div>
  );
}

function BloqueEstado({ icono, titulo, mensaje, color }) {
  return (
    <div style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e5e5e5", textAlign: "center", padding: "64px 24px" }}>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>{icono}</div>
      <p style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: color || "#212121" }}>{titulo}</p>
      {mensaje && (
        <p style={{ margin: "0 auto", fontSize: 13, color: "#666666", maxWidth: 460, lineHeight: 1.55 }}>{mensaje}</p>
      )}
    </div>
  );
}

function CardClavePendiente({ clave, plano, onRevisar }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#212121" }}>{clave.codigo}</h3>
        <span style={{ background: "#fef9c3", color: "#854d0e", padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
          {ETIQUETA_CLIENTE.ENVIADO}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "#555555", lineHeight: 1.55, overflowWrap: "break-word", wordBreak: "break-word" }}>
        {clave.descripcion}
      </p>
      {plano && (
        <div style={{ fontSize: 12, color: "#888888" }}>
          Versión v{plano.version}
        </div>
      )}
      <button
        onClick={onRevisar}
        disabled={!plano}
        style={{
          marginTop: 6,
          background: "#c9a84c", color: "#212121",
          border: "none", borderRadius: 10, padding: "12px",
          fontSize: 14, fontWeight: 700,
          cursor: plano ? "pointer" : "not-allowed",
          opacity: plano ? 1 : 0.5,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <FileText size={16} /> Revisar y firmar
      </button>
    </div>
  );
}

function ModalRevisar({ clave, plano, esMobil, clienteContacto, onCerrar, onCompletado }) {
  const [vista, setVista] = useState("ver");

  return (
    <div style={sOverlay} onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: "#ffffff", borderRadius: 14, width: esMobil ? "96%" : "92%", maxWidth: 900, maxHeight: "94vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "#212121" }}>{clave.codigo} — v{plano.version}</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#666666", overflowWrap: "break-word", wordBreak: "break-word" }}>{clave.descripcion}</p>
          </div>
          <button onClick={onCerrar} style={{ background: "transparent", border: "none", color: "#888888", cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 4, flexShrink: 0 }}>×</button>
        </div>

        {vista === "ver" && (
          <>
            <div style={{ padding: 14, userSelect: "none", WebkitUserSelect: "none" }}>
              <iframe
                src={`${plano.urlPdf}#toolbar=0&navpanes=0&scrollbar=0`}
                style={{ width: "100%", height: esMobil ? 400 : 500, border: "none", display: "block" }}
                title={`Plano ${clave.codigo}`}
              />
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid #f0f0f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, position: esMobil ? "sticky" : "static", bottom: 0, background: "#ffffff", zIndex: 5 }}>
              <button
                onClick={() => setVista("rechazar")}
                style={{ padding: "14px", borderRadius: 10, border: "2px solid #ef4444", background: "#ffffff", color: "#ef4444", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <XCircle size={18} /> Solicitar cambios
              </button>
              <button
                onClick={() => setVista("aprobar")}
                style={{ padding: "14px", borderRadius: 10, border: "2px solid #c9a84c", background: "#c9a84c", color: "#212121", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <CheckCircle size={18} /> Aprobar plano
              </button>
            </div>
          </>
        )}

        {vista === "aprobar" && (
          <FormaFirma planoId={plano.id} clienteContacto={clienteContacto} onCancelar={() => setVista("ver")} onCompletado={onCompletado} />
        )}

        {vista === "rechazar" && (
          <FormaRechazo planoId={plano.id} onCancelar={() => setVista("ver")} onCompletado={onCompletado} />
        )}
      </div>
    </div>
  );
}

function FormaFirma({ planoId, clienteContacto, onCancelar, onCompletado }) {
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const contactoFijo = (clienteContacto || "").trim();
  const [firmadoPor, setFirmadoPor] = useState(contactoFijo);
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
      onCompletado();
    } finally { setEnviando(false); }
  }

  return (
    <div style={{ padding: "20px 22px" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#212121", display: "flex", alignItems: "center", gap: 8 }}>
        <Pen size={16} /> Firmar y aprobar plano
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#666666", lineHeight: 1.55 }}>
        Al firmar confirmas que has revisado el plano y que apruebas su contenido para fabricación.
      </p>
      <div style={{ marginBottom: 14 }}>
        <label style={sLabel}>Tu nombre completo</label>
        {contactoFijo ? (
          <div style={{ background: "#f9f9f9", padding: 10, borderRadius: 8, fontSize: 14, fontWeight: 500, color: "#212121" }}>
            Firmado por: {contactoFijo}
          </div>
        ) : (
          <input
            className="input-base"
            style={{ width: "100%", boxSizing: "border-box" }}
            placeholder="Como aparecerá en el documento"
            value={firmadoPor}
            onChange={(e) => { setFirmadoPor(e.target.value); setErr(""); }}
          />
        )}
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
            width: "100%", height: 140,
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
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={onCancelar} disabled={enviando}
          style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #e5e5e5", background: "#ffffff", color: "#555555", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          Volver
        </button>
        <button onClick={enviar} disabled={enviando}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#c9a84c", color: "#212121", fontWeight: 700, fontSize: 14, cursor: enviando ? "not-allowed" : "pointer", opacity: enviando ? 0.7 : 1 }}>
          {enviando ? "Procesando…" : "Confirmar aprobación"}
        </button>
      </div>
    </div>
  );
}

function FormaRechazo({ planoId, onCancelar, onCompletado }) {
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
      onCompletado();
    } finally { setEnviando(false); }
  }

  return (
    <div style={{ padding: "20px 22px" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
        <XCircle size={16} /> Solicitar cambios
      </h3>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#666666", lineHeight: 1.55 }}>
        El plano regresará a revisión interna. Describe con detalle qué debe modificarse.
      </p>
      <div style={{ marginBottom: 14 }}>
        <label style={sLabel}>Comentarios <span style={{ color: "#ef4444" }}>*</span></label>
        <textarea
          className="input-base"
          style={{ width: "100%", boxSizing: "border-box", minHeight: 110, resize: "vertical", fontFamily: "inherit" }}
          placeholder="Ej. La medida de la gaveta central no corresponde al plano acordado…"
          value={comentarios}
          onChange={(e) => { setComentarios(e.target.value); setErr(""); }}
        />
        <p style={{ margin: "4px 0 0", fontSize: 11, color: comentarios.trim().length < 10 ? "#ef4444" : "#22c55e" }}>
          {comentarios.trim().length} / 10 caracteres mínimo
        </p>
      </div>
      {err && <p style={{ margin: "0 0 10px", color: "#ef4444", fontSize: 13 }}>{err}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button onClick={onCancelar} disabled={enviando}
          style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #e5e5e5", background: "#ffffff", color: "#555555", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          Volver
        </button>
        <button onClick={enviar} disabled={enviando || comentarios.trim().length < 10}
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#ef4444", color: "#ffffff", fontWeight: 700, fontSize: 14, cursor: (enviando || comentarios.trim().length < 10) ? "not-allowed" : "pointer", opacity: (enviando || comentarios.trim().length < 10) ? 0.6 : 1 }}>
          {enviando ? "Enviando…" : "Solicitar cambios"}
        </button>
      </div>
    </div>
  );
}

function LogoCargando() {
  const [porcentaje, setPorcentaje] = useState(100);

  useEffect(() => {
    const duracion = 1800;
    const intervalo = 16;
    const decremento = 100 / (duracion / intervalo);
    const id = setInterval(() => {
      setPorcentaje((p) => {
        const siguiente = p - decremento;
        return siguiente <= 0 ? 100 : siguiente;
      });
    }, intervalo);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: "relative", height: 80, width: "auto", marginBottom: 24 }}>
      <img
        src="/isotipo_baum.svg"
        alt="BAUM"
        style={{ height: 80, display: "block", filter: "grayscale(1) opacity(0.2)" }}
      />
      <img
        src="/isotipo_baum.svg"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          height: 80,
          filter: "grayscale(1) opacity(1)",
          clipPath: `inset(${porcentaje}% 0 0 0)`,
          WebkitClipPath: `inset(${porcentaje}% 0 0 0)`,
        }}
      />
    </div>
  );
}

function PantallaEstado({ tipo, mensaje }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {tipo === "cargando" ? (
        <LogoCargando />
      ) : (
        <img src="/isotipo_baum.svg" alt="BAUM" style={{ height: 80, marginBottom: 24, filter: "grayscale(1) opacity(0.4)" }} />
      )}
      {tipo === "pin-invalido" && (
        <>
          <p style={{ color: "#ef4444", fontWeight: 700, margin: "0 0 8px", fontSize: 16 }}>PIN inválido</p>
          <p style={{ color: "#888888", margin: 0, fontSize: 13, textAlign: "center", maxWidth: 340 }}>
            El PIN ingresado no corresponde a ningún proyecto. Verifica el código que recibiste.
          </p>
        </>
      )}
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
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50,
};

const sLabel = {
  display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "#888888", textTransform: "uppercase", letterSpacing: "0.05em",
};
