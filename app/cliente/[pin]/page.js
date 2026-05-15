"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, XCircle, FileText, Eye, RotateCcw, Pen, Check } from "lucide-react";
import { urlPdfCliente } from "@/lib/urlPdf";

const CHECKLIST_DISENADOR = [
  "Las medidas corresponden al levantamiento en sitio",
  "Los materiales y acabados coinciden con lo acordado",
  "Las herrajes y accesorios están especificados",
  "Los planos de detalle están completos",
  "La explosión de insumos fue revisada",
  "El plano está libre de observaciones internas",
];

export default function ClientePage() {
  const { pin } = useParams();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [pinInvalido, setPinInvalido] = useState(false);
  const [modal, setModal] = useState(null);
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
        if (res.status === 404 || res.status === 400) setPinInvalido(true);
        else setError(data.error || "Error al cargar el proyecto");
        return;
      }
      setDatos(data);
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
  if (!datos) return null;

  const { cliente, pendientes, autorizados, enProduccion } = datos;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", color: "#212121", overflowX: "hidden", userSelect: "none", WebkitUserSelect: "none" }}>
      <header style={{ background: "#212121", padding: "20px 24px" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <img src="/baum_logo_bco.svg" alt="BAUM" style={{ height: 38, width: "auto" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#888888" }}>Bienvenido</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff" }}>{cliente.nombre}</div>
          </div>
        </div>
      </header>
      <div style={{ height: 1, background: "#e5e5e5" }} />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 16px", display: "flex", flexDirection: "column", gap: 36 }}>
        <Seccion
          titulo={`Pendientes de firma (${pendientes.length})`}
          color="#dc4f5a"
          vacioMensaje="No tienes planos pendientes de firma ✓"
          vacioColor="#369378"
          items={pendientes}
          esMobil={esMobil}
          render={(c) => (
            <CardClave
              key={c.id}
              clave={c}
              boton={{
                texto: "Revisar y firmar",
                icono: <FileText size={16} />,
                color: "#dc4f5a",
                hover: "rgba(220,79,90,0.05)",
                onClick: () => c.plano && setModal({ modo: "firmar", clave: c }),
                disabled: !c.plano,
              }}
            />
          )}
        />

        <Seccion
          titulo={`Autorizados (${autorizados.length})`}
          color="#369378"
          vacioMensaje="No hay planos autorizados todavía."
          vacioColor="#6b7280"
          items={autorizados}
          esMobil={esMobil}
          render={(c) => (
            <CardClave
              key={c.id}
              clave={c}
              extra={c.plano?.autorizacionCliente?.createdAt && (
                <div style={{ fontSize: 12, color: "#888888" }}>
                  Autorizado el {formatearFecha(c.plano.autorizacionCliente.createdAt)}
                </div>
              )}
              boton={{
                texto: "Ver plano",
                icono: <Eye size={16} />,
                color: "#369378",
                hover: "rgba(54,147,120,0.05)",
                onClick: () => c.plano && setModal({ modo: "ver", clave: c }),
                disabled: !c.plano,
              }}
            />
          )}
        />

        <Seccion
          titulo={`En producción (${enProduccion.length})`}
          color="#dba03a"
          vacioMensaje="No hay planos en producción."
          vacioColor="#6b7280"
          items={enProduccion}
          esMobil={esMobil}
          render={(c) => (
            <CardClave
              key={c.id}
              clave={c}
              boton={{
                texto: "Ver plano",
                icono: <Eye size={16} />,
                color: "#dba03a",
                hover: "rgba(219,160,58,0.05)",
                onClick: () => c.plano && setModal({ modo: "ver", clave: c }),
                disabled: !c.plano,
              }}
            />
          )}
        />
      </main>

      {modal && modal.modo === "firmar" && (
        <ModalRevisar
          clave={modal.clave}
          plano={modal.clave.plano}
          pin={pin}
          esMobil={esMobil}
          onCerrar={() => setModal(null)}
          onCompletado={() => { setModal(null); cargar(); }}
        />
      )}

      {modal && modal.modo === "ver" && (
        <ModalVerPlano
          clave={modal.clave}
          plano={modal.clave.plano}
          pin={pin}
          esMobil={esMobil}
          onCerrar={() => setModal(null)}
        />
      )}

      <footer style={{ textAlign: "center", padding: "32px 16px 24px", color: "#aaaaaa", fontSize: 11 }}>
        BAUM Industria Carpintera · Portal seguro de aprobación de planos
      </footer>
    </div>
  );
}

function formatearFecha(fecha) {
  if (!fecha) return "";
  return new Date(fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

function Seccion({ titulo, color, vacioMensaje, vacioColor, items, render, esMobil }) {
  return (
    <section>
      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800, color: "#212121", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 4, height: 18, background: color, borderRadius: 2, display: "inline-block" }} />
        {titulo}
      </h2>
      {items.length === 0 ? (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "32px 20px", textAlign: "center", fontSize: 14, fontWeight: 600, color: vacioColor }}>
          {vacioMensaje}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: esMobil ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {items.map(render)}
        </div>
      )}
    </section>
  );
}

function CardClave({ clave, boton, extra }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#212121", overflowWrap: "break-word", wordBreak: "break-word" }}>
        {clave.proyectoNombre} — {clave.codigo}
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: "#555555", lineHeight: 1.55, overflowWrap: "break-word", wordBreak: "break-word" }}>
        {clave.descripcion}
      </p>
      {extra}
      <button
        onClick={boton.onClick}
        disabled={boton.disabled}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          marginTop: 4,
          background: hover && !boton.disabled ? boton.hover : "transparent",
          border: `2px solid ${boton.color}`,
          color: boton.color,
          borderRadius: 8, padding: "10px 20px",
          fontSize: 14, fontWeight: 600,
          cursor: boton.disabled ? "not-allowed" : "pointer",
          opacity: boton.disabled ? 0.5 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "background 0.15s",
        }}
      >
        {boton.icono} {boton.texto}
      </button>
    </div>
  );
}

function VisorPdf({ pin, planoId, codigo, esMobil }) {
  return (
    <div style={{ padding: 14, userSelect: "none", WebkitUserSelect: "none" }}>
      <iframe
        src={`${urlPdfCliente(pin, planoId)}#toolbar=0&navpanes=0&scrollbar=0`}
        style={{ width: "100%", height: esMobil ? 400 : 500, border: "none", display: "block" }}
        title={`Plano ${codigo}`}
      />
    </div>
  );
}

function ModalVerPlano({ clave, plano, pin, esMobil, onCerrar }) {
  return (
    <div style={sOverlay} onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: "#ffffff", borderRadius: 14, width: esMobil ? "96%" : "92%", maxWidth: 900, maxHeight: "94vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "#212121" }}>{clave.proyectoNombre} — {clave.codigo}</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#666666", overflowWrap: "break-word", wordBreak: "break-word" }}>{clave.descripcion}</p>
          </div>
          <button onClick={onCerrar} style={sBtnCerrar}>×</button>
        </div>
        <VisorPdf pin={pin} planoId={plano.id} codigo={clave.codigo} esMobil={esMobil} />
        <div style={{ padding: "14px 20px", borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onCerrar}
            style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e5e5e5", background: "#ffffff", color: "#555555", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalRevisar({ clave, plano, pin, esMobil, onCerrar, onCompletado }) {
  const [vista, setVista] = useState("ver");

  return (
    <div style={sOverlay} onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div style={{ background: "#ffffff", borderRadius: 14, width: esMobil ? "96%" : "92%", maxWidth: 900, maxHeight: "94vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "#212121" }}>{clave.proyectoNombre} — {clave.codigo}</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#666666", overflowWrap: "break-word", wordBreak: "break-word" }}>{clave.descripcion}</p>
          </div>
          <button onClick={onCerrar} style={sBtnCerrar}>×</button>
        </div>

        {vista === "ver" && (
          <>
            <VisorPdf pin={pin} planoId={plano.id} codigo={clave.codigo} esMobil={esMobil} />

            <div style={{ padding: "0 20px 14px" }}>
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px 16px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#166534" }}>
                  El diseñador confirmó los siguientes puntos:
                </p>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
                  {CHECKLIST_DISENADOR.map((item) => (
                    <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#15803d", lineHeight: 1.45 }}>
                      <Check size={15} style={{ color: "#16a34a", flexShrink: 0, marginTop: 2 }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ padding: "14px 20px", borderTop: "1px solid #f0f0f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, position: esMobil ? "sticky" : "static", bottom: 0, background: "#ffffff", zIndex: 5 }}>
              <button
                onClick={() => setVista("rechazar")}
                style={{ padding: "14px", borderRadius: 10, border: "none", background: "#ef4444", color: "#ffffff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <XCircle size={18} /> Rechazar
              </button>
              <button
                onClick={() => setVista("aprobar")}
                style={{ padding: "14px", borderRadius: 10, border: "none", background: "#10b981", color: "#ffffff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <CheckCircle size={18} /> Aprobar y firmar
              </button>
            </div>
          </>
        )}

        {vista === "aprobar" && (
          <FormaFirma planoId={plano.id} onCancelar={() => setVista("ver")} onCompletado={onCompletado} />
        )}

        {vista === "rechazar" && (
          <FormaRechazo planoId={plano.id} onCancelar={() => setVista("ver")} onCompletado={onCompletado} />
        )}
      </div>
    </div>
  );
}

function FormaFirma({ planoId, onCancelar, onCompletado }) {
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const [firmadoPor, setFirmadoPor] = useState("");
  const [cargoFirmante, setCargoFirmante] = useState("");
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
    if (firmadoPor.trim().split(/\s+/).filter(Boolean).length < 3) {
      return setErr("Ingresa tu nombre completo (mínimo 3 palabras).");
    }
    if (cargoFirmante.trim().length < 2) {
      return setErr("Indica tu cargo o representación.");
    }
    if (!firmaTocada) return setErr("Por favor dibuja tu firma antes de continuar.");
    const firmaBase64 = canvasRef.current.toDataURL("image/png");
    setEnviando(true); setErr("");
    try {
      const res = await fetch(`/api/planos/${planoId}/autorizar-cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "APROBADO", firmadoPor: firmadoPor.trim(), cargoFirmante: cargoFirmante.trim(), firmaBase64 }),
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
        <label style={sLabel}>Nombre completo <span style={{ color: "#ef4444" }}>*</span></label>
        <input
          className="input-base"
          style={{ width: "100%", boxSizing: "border-box" }}
          placeholder="Nombre y apellidos como aparecerá en el documento"
          value={firmadoPor}
          onChange={(e) => { setFirmadoPor(e.target.value); setErr(""); }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={sLabel}>Cargo o representación <span style={{ color: "#ef4444" }}>*</span></label>
        <input
          className="input-base"
          style={{ width: "100%", boxSizing: "border-box" }}
          placeholder="Ej. Propietario, Arquitecto responsable…"
          value={cargoFirmante}
          onChange={(e) => { setCargoFirmante(e.target.value); setErr(""); }}
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
            width: "100%", height: 140,
            background: "#fafafa",
            border: `2px solid ${firmaTocada ? "#10b981" : "#e5e5e5"}`,
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
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#10b981", color: "#ffffff", fontWeight: 700, fontSize: 14, cursor: enviando ? "not-allowed" : "pointer", opacity: enviando ? 0.7 : 1 }}>
          {enviando ? "Procesando…" : "Aprobar y firmar"}
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
        <XCircle size={16} /> Rechazar plano
      </h3>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#666666", lineHeight: 1.55 }}>
        El plano regresará a revisión interna. Describe qué debe corregir.
      </p>
      <div style={{ marginBottom: 14 }}>
        <label style={sLabel}>Describe qué debe corregir <span style={{ color: "#ef4444" }}>*</span></label>
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
          {enviando ? "Enviando…" : "Rechazar"}
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
      <img src="/isotipo_baum.svg" alt="BAUM" style={{ height: 80, display: "block", filter: "grayscale(1) opacity(0.2)" }} />
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

const sBtnCerrar = {
  background: "transparent", border: "none", color: "#888888", cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 4, flexShrink: 0,
};
