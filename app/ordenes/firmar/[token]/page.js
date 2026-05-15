"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle, RotateCcw, Pen } from "lucide-react";

const TIPO_LABEL = {
  cambio: "Orden de cambio",
  extraordinaria: "Orden extraordinaria",
  trabajo: "Orden de trabajo",
};

const ROLES = ["cliente", "ventas", "supervisor", "adicional"];
const ROL_LABEL = {
  cliente: "Cliente",
  ventas: "Ventas BAUM",
  supervisor: "Supervisor BAUM",
  adicional: "Firma adicional",
};

function formatearMoneda(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
}

function formatearFecha(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha);
  if (isNaN(d)) return fecha;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

export default function FirmarOrdenPage() {
  const { token } = useParams();
  const [estado, setEstado] = useState("cargando");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const res = await fetch(`/api/ordenes/firmar/${token}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Este enlace ya fue utilizado o no es válido.");
        setEstado("invalido");
        return;
      }
      setDatos(data);
      setEstado("firmar");
    } catch {
      setError("Este enlace ya fue utilizado o no es válido.");
      setEstado("invalido");
    }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", color: "#212121" }}>
      <header style={{ background: "#212121", height: 56, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
        <img src="/baum_logo_bco.svg" alt="BAUM" style={{ height: 30, width: "auto" }} />
      </header>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px" }}>
        {estado === "cargando" && (
          <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
            <div className="spinner" />
          </div>
        )}

        {estado === "invalido" && (
          <Tarjeta>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <AlertTriangle size={42} style={{ color: "#ef4444" }} />
              <p style={{ margin: "16px 0 0", fontSize: 16, fontWeight: 700, color: "#212121" }}>
                Enlace no válido
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
                {error || "Este enlace ya fue utilizado o no es válido."}
              </p>
            </div>
          </Tarjeta>
        )}

        {estado === "exito" && datos && (
          <Tarjeta>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <CheckCircle size={48} style={{ color: "#16a34a" }} />
              <p style={{ margin: "16px 0 0", fontSize: 18, fontWeight: 800, color: "#212121" }}>
                ¡Firma registrada exitosamente!
              </p>
              <p style={{ margin: "8px 0 16px", fontSize: 14, color: "#6b7280" }}>
                Orden <strong style={{ color: "#212121", fontFamily: "monospace" }}>{datos.orden.numOrden}</strong>
              </p>
              <EstadoFirmas orden={datos.orden} firmas={datos.firmas} rolActual={null} />
            </div>
          </Tarjeta>
        )}

        {estado === "firmar" && datos && (
          <VistaFirma
            datos={datos}
            token={token}
            onExito={(nuevasFirmas) => {
              setDatos((d) => ({ ...d, firmas: nuevasFirmas }));
              setEstado("exito");
            }}
          />
        )}
      </main>
    </div>
  );
}

function Tarjeta({ children }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
      {children}
    </div>
  );
}

function EstadoFirmas({ orden, firmas, rolActual }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
      {ROLES.map((r) => {
        const f = (firmas || []).find((x) => x.rol === r);
        const aplica = r !== "adicional" || orden.requiereFirmaAdicional;
        const esActual = r === rolActual;
        let badge;
        if (!aplica) badge = { texto: "No aplica", bg: "#f3f4f6", color: "#6b7280" };
        else if (f?.firmada) badge = { texto: "Firmado", bg: "#dcfce7", color: "#166534" };
        else badge = { texto: "Pendiente", bg: "#fef9c3", color: "#854d0e" };
        return (
          <div
            key={r}
            style={{
              border: `1px solid ${esActual ? "#c9a84c" : "#e5e5e5"}`,
              borderRadius: 8,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#212121" }}>
              {ROL_LABEL[r]}
              {r === "adicional" && orden.nombreFirmaAdicional ? ` — ${orden.nombreFirmaAdicional}` : ""}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: badge.bg, color: badge.color, whiteSpace: "nowrap" }}>
              {f?.firmada ? `${badge.texto} · ${f.nombre || ""} · ${formatearFecha(f.fecha)}` : badge.texto}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function VistaFirma({ datos, token, onExito }) {
  const { orden, rol, firmas } = datos;
  const canvasRef = useRef(null);
  const dibujando = useRef(false);
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
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
    if (!nombre.trim()) return setErr("Ingresa tu nombre completo para firmar.");
    if (!firmaTocada) return setErr("Por favor dibuja tu firma antes de continuar.");
    const imagen = canvasRef.current.toDataURL("image/png");
    setEnviando(true); setErr("");
    try {
      const res = await fetch(`/api/ordenes/firmar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), empresa: empresa.trim(), imagen }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "No se pudo registrar la firma."); return; }
      const nuevas = (firmas || []).map((x) =>
        x.rol === rol ? { ...x, firmada: true, nombre: nombre.trim(), fecha: new Date().toISOString() } : x
      );
      onExito(nuevas);
    } catch {
      setErr("Error de conexión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Tarjeta>
        <div style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {TIPO_LABEL[orden.tipo] || orden.tipo}
          </div>
          <h1 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 800, color: "#212121", fontFamily: "monospace" }}>
            {orden.numOrden}
          </h1>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
            <Dato label="Proyecto" valor={orden.proyectoNombre} />
            <Dato label="Cliente" valor={orden.clienteNombre} />
            <Dato label="Fecha de solicitud" valor={formatearFecha(orden.fechaSolicitud)} />
            <Dato label="Afectación" valor={`${orden.afectacionDias ?? 0} día(s)`} />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={sMiniLabel}>Concepto</div>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#212121", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {orden.concepto}
            </p>
          </div>

          {(orden.partidas || []).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={sMiniLabel}>Partidas</div>
              <div style={{ marginTop: 6, border: "1px solid #e5e5e5", borderRadius: 8, overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse", fontSize: 12 }}>
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
                <div style={{ color: "#212121", fontWeight: 800, fontSize: 16 }}>Neto: {formatearMoneda(orden.neto)}</div>
              </div>
            </div>
          )}
        </div>
      </Tarjeta>

      <Tarjeta>
        <div style={{ padding: "20px 22px" }}>
          <div style={sMiniLabel}>Estado de firmas</div>
          <div style={{ marginTop: 10 }}>
            <EstadoFirmas orden={orden} firmas={firmas} rolActual={rol} />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta>
        <div style={{ padding: "20px 22px" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#212121", display: "flex", alignItems: "center", gap: 8 }}>
            <Pen size={16} /> Firmar como {ROL_LABEL[rol] || rol}
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#666666", lineHeight: 1.55 }}>
            Al firmar confirmas que revisaste y autorizas esta orden.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label style={sLabel}>Tu nombre completo <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              className="input-base"
              style={{ width: "100%", boxSizing: "border-box" }}
              placeholder="Como aparecerá en el documento"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setErr(""); }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={sLabel}>Empresa</label>
            <input
              className="input-base"
              style={{ width: "100%", boxSizing: "border-box" }}
              placeholder="Opcional"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
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
              width={620}
              height={180}
              onMouseDown={iniciarDibujo}
              onMouseMove={dibujar}
              onMouseUp={terminarDibujo}
              onMouseLeave={terminarDibujo}
              onTouchStart={iniciarDibujo}
              onTouchMove={dibujar}
              onTouchEnd={terminarDibujo}
              style={{
                width: "100%", height: 160,
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

          <button
            onClick={enviar}
            disabled={enviando}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "#c9a84c", color: "#212121", fontWeight: 700, fontSize: 15, cursor: enviando ? "not-allowed" : "pointer", opacity: enviando ? 0.7 : 1 }}
          >
            {enviando ? "Procesando…" : "Firmar y confirmar"}
          </button>
        </div>
      </Tarjeta>
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

const sMiniLabel = { fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" };
const sLabel = { display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "#888888", textTransform: "uppercase", letterSpacing: "0.05em" };
const sThMini = { padding: "8px 10px", fontWeight: 700, fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" };
const sTdMini = { padding: "8px 10px", color: "#212121" };
