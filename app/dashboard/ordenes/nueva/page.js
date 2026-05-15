"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X, Upload } from "lucide-react";

const ROLES_GESTION = ["DUENO", "SUPERADMIN", "GERENTE"];

const TIPOS = [
  { value: "cambio", label: "Orden de cambio" },
  { value: "extraordinaria", label: "Orden extraordinaria" },
  { value: "trabajo", label: "Orden de trabajo" },
];

function formatearMoneda(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n) || 0);
}

export default function NuevaOrdenPage() {
  const { data: sesion, status: sesionStatus } = useSession();
  const router = useRouter();
  const rol = sesion?.user?.rol;
  const fileRef = useRef(null);

  const [proyectos, setProyectos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [editId, setEditId] = useState(null);
  const [cargandoOrden, setCargandoOrden] = useState(false);
  const [bloqueada, setBloqueada] = useState(false);
  const esEdicion = !!editId;

  const [tipo, setTipo] = useState("cambio");
  const [proyectoId, setProyectoId] = useState("");
  const [fechaSolicitud, setFechaSolicitud] = useState("");
  const [solicitadaPor, setSolicitadaPor] = useState("");
  const [generadaPor, setGeneradaPor] = useState("");
  const [ventasBaum, setVentasBaum] = useState("");
  const [supervisorBaum, setSupervisorBaum] = useState("");
  const [concepto, setConcepto] = useState("");
  const [partidas, setPartidas] = useState([{ codigo: "", concepto: "", precio: "", cantidad: "" }]);
  const [ivaPorcentaje, setIvaPorcentaje] = useState(16);
  const [afectacionDias, setAfectacionDias] = useState(0);
  const [requiereFirmaAdicional, setRequiereFirmaAdicional] = useState(false);
  const [nombreFirmaAdicional, setNombreFirmaAdicional] = useState("");
  const [fotos, setFotos] = useState([]);

  const cargarProyectos = useCallback(async () => {
    const res = await fetch("/api/proyectos");
    const data = await res.json();
    if (res.ok && Array.isArray(data)) setProyectos(data);
  }, []);

  useEffect(() => {
    if (sesionStatus === "authenticated") cargarProyectos();
  }, [sesionStatus, cargarProyectos]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setEditId(id);
  }, []);

  useEffect(() => {
    if (!editId || sesionStatus !== "authenticated") return;
    let cancelado = false;
    setCargandoOrden(true);
    fetch(`/api/ordenes/${editId}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelado) return;
        if (!ok) {
          setError(d.error || "No se pudo cargar la orden");
          return;
        }
        const tieneFirmaClienteVentas = (d.firmas || []).some(
          (f) => (f.rol === "cliente" || f.rol === "ventas") && (f.imagen || f.fecha)
        );
        if (d.cancelada || tieneFirmaClienteVentas) {
          setBloqueada(true);
          setError(
            d.cancelada
              ? "Esta orden está cancelada y no puede editarse."
              : "Esta orden ya tiene firmas de cliente o ventas y no puede editarse."
          );
        }
        setTipo(d.tipo || "cambio");
        setProyectoId(String(d.proyectoId ?? ""));
        setFechaSolicitud(d.fechaSolicitud || "");
        setSolicitadaPor(d.solicitadaPor || "");
        setGeneradaPor(d.generadaPor || "");
        setVentasBaum(d.ventasBaum || "");
        setSupervisorBaum(d.supervisorBaum || "");
        setConcepto(d.concepto || "");
        setPartidas(
          (d.partidas || []).length > 0
            ? d.partidas.map((p) => ({
                codigo: p.codigo || "",
                concepto: p.concepto || "",
                precio: String(p.precio ?? ""),
                cantidad: String(p.cantidad ?? ""),
              }))
            : [{ codigo: "", concepto: "", precio: "", cantidad: "" }]
        );
        setIvaPorcentaje(Number(d.ivaPorcentaje) || 16);
        setAfectacionDias(d.afectacionDias ?? 0);
        setRequiereFirmaAdicional(!!d.requiereFirmaAdicional);
        setNombreFirmaAdicional(d.nombreFirmaAdicional || "");
        setFotos((d.fotos || []).map((f) => ({ dataUrl: f.dataUrl, nota: f.nota || "" })));
      })
      .catch(() => !cancelado && setError("Error de conexión al cargar la orden"))
      .finally(() => !cancelado && setCargandoOrden(false));
    return () => { cancelado = true; };
  }, [editId, sesionStatus]);

  if (sesionStatus === "loading" || !rol) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div className="spinner" /></div>;
  }

  if (!ROLES_GESTION.includes(rol)) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
        No tienes permiso para crear órdenes.
      </div>
    );
  }

  if (cargandoOrden) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div className="spinner" /></div>;
  }

  const subtotal = partidas.reduce((acc, p) => acc + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0);
  const ivaImporte = subtotal * (Number(ivaPorcentaje) / 100);
  const neto = subtotal + ivaImporte;

  function actualizarPartida(idx, campo, valor) {
    setPartidas((prev) => prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  }
  function agregarPartida() {
    setPartidas((prev) => [...prev, { codigo: "", concepto: "", precio: "", cantidad: "" }]);
  }
  function eliminarPartida(idx) {
    setPartidas((prev) => prev.filter((_, i) => i !== idx));
  }

  function manejarArchivos(lista) {
    const archivos = Array.from(lista || []).filter((f) => f.type.startsWith("image/"));
    archivos.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        setFotos((prev) => [...prev, { dataUrl: reader.result, nota: "" }]);
      };
      reader.readAsDataURL(f);
    });
  }

  function onDrop(e) {
    e.preventDefault();
    manejarArchivos(e.dataTransfer.files);
  }

  async function guardar() {
    setError("");
    if (bloqueada) return setError("Esta orden no puede editarse.");
    if (!esEdicion && !proyectoId) return setError("Selecciona un proyecto.");
    if (!fechaSolicitud) return setError("Indica la fecha de solicitud.");
    if (!solicitadaPor.trim()) return setError("Indica quién solicita la orden.");
    if (!concepto.trim()) return setError("El concepto es obligatorio.");
    const partidasValidas = partidas.filter((p) => p.concepto.trim());
    if (partidasValidas.length === 0) return setError("Agrega al menos una partida con concepto.");

    setGuardando(true);
    try {
      const res = await fetch(esEdicion ? `/api/ordenes/${editId}` : "/api/ordenes", {
        method: esEdicion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          ...(esEdicion ? {} : { proyectoId: parseInt(proyectoId) }),
          fechaSolicitud,
          solicitadaPor: solicitadaPor.trim(),
          generadaPor: generadaPor.trim(),
          ventasBaum: ventasBaum.trim(),
          supervisorBaum: supervisorBaum.trim(),
          concepto: concepto.trim(),
          partidas: partidasValidas.map((p) => ({
            codigo: p.codigo.trim(),
            concepto: p.concepto.trim(),
            precio: Number(p.precio) || 0,
            cantidad: Number(p.cantidad) || 0,
          })),
          ivaPorcentaje: Number(ivaPorcentaje),
          afectacionDias: parseInt(afectacionDias) || 0,
          requiereFirmaAdicional,
          nombreFirmaAdicional: requiereFirmaAdicional ? nombreFirmaAdicional.trim() : null,
          fotos,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (esEdicion ? "Error al actualizar la orden" : "Error al guardar la orden"));
        return;
      }
      router.push("/dashboard/ordenes");
    } catch {
      setError("Error de conexión");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Sistema de gestión</div>
          <h1 style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 800, color: "#212121" }}>{esEdicion ? "Editar orden de cambio" : "Nueva orden de cambio"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => router.push("/dashboard/ordenes")}
            disabled={guardando}
            style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "10px 18px", color: "#6b7280", fontSize: 13, cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || bloqueada || cargandoOrden}
            style={{ background: "#c9a84c", border: "none", borderRadius: 8, padding: "10px 18px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: (guardando || bloqueada || cargandoOrden) ? "not-allowed" : "pointer", opacity: (guardando || bloqueada || cargandoOrden) ? 0.7 : 1 }}
          >
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Guardar"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fee2e2", borderRadius: 8, color: "#991b1b", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        <div style={sCard}>
          <h2 style={sCardTitulo}>Orden</h2>

          <Campo label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={sInput}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Campo>

          <Campo label="Proyecto">
            <select
              value={proyectoId}
              onChange={(e) => setProyectoId(e.target.value)}
              disabled={esEdicion}
              style={{ ...sInput, ...(esEdicion ? { background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" } : {}) }}
            >
              <option value="">Selecciona un proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
            {esEdicion && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                El proyecto no puede modificarse al editar una orden.
              </div>
            )}
          </Campo>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Campo label="Fecha de solicitud">
              <input type="date" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)} style={sInput} />
            </Campo>
            <Campo label="Solicitada por">
              <input type="text" value={solicitadaPor} onChange={(e) => setSolicitadaPor(e.target.value)} style={sInput} />
            </Campo>
            <Campo label="Generada por">
              <input type="text" value={generadaPor} onChange={(e) => setGeneradaPor(e.target.value)} style={sInput} />
            </Campo>
            <Campo label="Ventas BAUM">
              <input type="text" value={ventasBaum} onChange={(e) => setVentasBaum(e.target.value)} style={sInput} />
            </Campo>
            <Campo label="Supervisor BAUM">
              <input type="text" value={supervisorBaum} onChange={(e) => setSupervisorBaum(e.target.value)} style={sInput} />
            </Campo>
            <Campo label="Afectación en días">
              <input type="number" min={0} value={afectacionDias} onChange={(e) => setAfectacionDias(e.target.value)} style={sInput} />
            </Campo>
          </div>

          <Campo label="Concepto / Justificación">
            <textarea
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              style={{ ...sInput, minHeight: 90, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              placeholder="Describe el motivo de la orden"
            />
          </Campo>

          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={sLabel}>Partidas</span>
              <button onClick={agregarPartida} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "5px 10px", color: "#92400e", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Plus size={12} /> Agregar partida
              </button>
            </div>
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#fafafa" }}>
                      <th style={sThMini}>Clave</th>
                      <th style={sThMini}>Concepto</th>
                      <th style={{ ...sThMini, textAlign: "right" }}>Precio</th>
                      <th style={{ ...sThMini, textAlign: "right" }}>Cantidad</th>
                      <th style={{ ...sThMini, textAlign: "right" }}>Total</th>
                      <th style={sThMini}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {partidas.map((p, idx) => {
                      const totalP = (Number(p.precio) || 0) * (Number(p.cantidad) || 0);
                      return (
                        <tr key={idx} style={{ borderTop: "1px solid #f3f4f6" }}>
                          <td style={sTdInput}><input value={p.codigo} onChange={(e) => actualizarPartida(idx, "codigo", e.target.value)} style={sInputCelda} /></td>
                          <td style={sTdInput}><input value={p.concepto} onChange={(e) => actualizarPartida(idx, "concepto", e.target.value)} style={sInputCelda} /></td>
                          <td style={sTdInput}><input type="number" min={0} value={p.precio} onChange={(e) => actualizarPartida(idx, "precio", e.target.value)} style={{ ...sInputCelda, textAlign: "right" }} /></td>
                          <td style={sTdInput}><input type="number" min={0} value={p.cantidad} onChange={(e) => actualizarPartida(idx, "cantidad", e.target.value)} style={{ ...sInputCelda, textAlign: "right" }} /></td>
                          <td style={{ ...sTdInput, textAlign: "right", padding: "8px 10px", color: "#212121" }}>{formatearMoneda(totalP)}</td>
                          <td style={{ ...sTdInput, textAlign: "center" }}>
                            <button onClick={() => eliminarPartida(idx)} disabled={partidas.length === 1} style={{ background: "transparent", border: "none", color: partidas.length === 1 ? "#d1d5db" : "#ef4444", cursor: partidas.length === 1 ? "not-allowed" : "pointer", padding: 4 }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12, alignItems: "flex-end", fontSize: 13 }}>
              <div style={{ color: "#6b7280" }}>Subtotal: <strong style={{ color: "#212121" }}>{formatearMoneda(subtotal)}</strong></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7280" }}>
                IVA
                <select value={ivaPorcentaje} onChange={(e) => setIvaPorcentaje(Number(e.target.value))} style={{ ...sInput, width: "auto", padding: "5px 8px" }}>
                  <option value={8}>8%</option>
                  <option value={16}>16%</option>
                </select>
                <strong style={{ color: "#212121" }}>{formatearMoneda(ivaImporte)}</strong>
              </div>
              <div style={{ color: "#212121", fontWeight: 700, fontSize: 16 }}>Total neto: {formatearMoneda(neto)}</div>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f0f0f0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#212121", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={requiereFirmaAdicional}
                onChange={(e) => setRequiereFirmaAdicional(e.target.checked)}
                style={{ accentColor: "#c9a84c", width: 16, height: 16, cursor: "pointer" }}
              />
              Requiere firma adicional
            </label>
            {requiereFirmaAdicional && (
              <div style={{ marginTop: 10 }}>
                <Campo label="Nombre del firmante adicional">
                  <input type="text" value={nombreFirmaAdicional} onChange={(e) => setNombreFirmaAdicional(e.target.value)} style={sInput} />
                </Campo>
              </div>
            )}
          </div>
        </div>

        <div style={sCard}>
          <h2 style={sCardTitulo}>Evidencia fotográfica</h2>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            style={{
              border: "2px dashed #e5e5e5",
              borderRadius: 10,
              padding: "28px 16px",
              textAlign: "center",
              cursor: "pointer",
              background: "#fafafa",
            }}
          >
            <Upload size={24} style={{ color: "#9ca3af" }} />
            <p style={{ margin: "10px 0 2px", fontSize: 13, fontWeight: 600, color: "#212121" }}>Arrastra fotos aquí</p>
            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>o haz clic para seleccionar</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => manejarArchivos(e.target.files)}
              style={{ display: "none" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            {fotos.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>Sin fotos agregadas.</p>
            ) : (
              fotos.map((f, idx) => (
                <div key={idx} style={{ border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ position: "relative" }}>
                    <img src={f.dataUrl} alt={`Foto ${idx + 1}`} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
                    <button
                      onClick={() => setFotos((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 6, color: "#ffffff", cursor: "pointer", padding: 5, display: "flex" }}
                      title="Eliminar foto"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Nota de la foto"
                    value={f.nota}
                    onChange={(e) => setFotos((prev) => prev.map((x, i) => (i === idx ? { ...x, nota: e.target.value } : x)))}
                    style={{ width: "100%", border: "none", borderTop: "1px solid #f3f4f6", padding: "8px 10px", fontSize: 12, color: "#212121", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={sLabel}>{label}</label>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

const sCard = { background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "20px 22px" };
const sCardTitulo = { margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#212121" };

const sLabel = { display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" };

const sInput = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e5e5e5",
  borderRadius: 8,
  fontSize: 13,
  color: "#212121",
  background: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
};

const sThMini = { padding: "8px 10px", fontWeight: 700, fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left" };
const sTdInput = { padding: 0, verticalAlign: "middle" };
const sInputCelda = { width: "100%", border: "none", padding: "8px 10px", fontSize: 12, color: "#212121", outline: "none", background: "transparent", boxSizing: "border-box" };
