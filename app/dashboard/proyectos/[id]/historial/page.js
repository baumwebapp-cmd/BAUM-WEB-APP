"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Upload, CheckCircle, XCircle, Send,
  AlertTriangle, Download, Package,
} from "lucide-react";

/* ── Configuración de tipos de evento ────────────────── */
const TIPO_CONFIG = {
  PLANO_SUBIDO:          { Icon: Upload,      color: "#3b82f6", bg: "#eff6ff", label: "Plano subido"          },
  AUTH_INTERNA_APROBADA: { Icon: CheckCircle, color: "#10b981", bg: "#f0fdf4", label: "Autorización interna"   },
  AUTH_INTERNA_RECHAZADA:{ Icon: XCircle,     color: "#ef4444", bg: "#fef2f2", label: "Rechazo interno"        },
  ENVIADO_CLIENTE:       { Icon: Send,        color: "#8b5cf6", bg: "#f5f3ff", label: "Enviado al cliente"     },
  CLIENTE_APROBO:        { Icon: CheckCircle, color: "#10b981", bg: "#f0fdf4", label: "Cliente aprobó"         },
  CLIENTE_RECHAZO:       { Icon: XCircle,     color: "#ef4444", bg: "#fef2f2", label: "Cliente rechazó"        },
  LIBERADO:              { Icon: Send,        color: "#f59e0b", bg: "#fffbeb", label: "Liberado a producción"  },
  EN_PRODUCCION:         { Icon: Package,     color: "#10b981", bg: "#f0fdf4", label: "En producción"          },
};

function formatFecha(iso) {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const hora  = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${fecha} · ${hora} hrs`;
}

/* ── Generación de PDF con pdf-lib ───────────────────── */
async function generarPDF(data, sesion) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdfDoc        = await PDFDocument.create();
  const helvetica     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ANCHO   = 612;
  const ALTO    = 792;
  const MARGEN  = 45;
  const CONTENT = ANCHO - MARGEN * 2;
  const ACENTO  = rgb(0.788, 0.659, 0.298); // #c9a84c
  const OSCURO  = rgb(0.129, 0.129, 0.129);
  const GRIS    = rgb(0.533, 0.533, 0.533);
  const BLANCO  = rgb(1, 1, 1);

  /* ── PORTADA ── */
  const portada = pdfDoc.addPage([ANCHO, ALTO]);

  // Logo
  try {
    const logoRes = await fetch("/logo-baum.jpeg");
    if (logoRes.ok) {
      const logoBytes = await logoRes.arrayBuffer();
      const logoImg   = await pdfDoc.embedJpg(logoBytes);
      const escala    = Math.min(110 / logoImg.width, 110 / logoImg.height);
      portada.drawImage(logoImg, {
        x: MARGEN, y: ALTO - MARGEN - logoImg.height * escala,
        width: logoImg.width * escala, height: logoImg.height * escala,
      });
    }
  } catch { /* logo opcional */ }

  // Línea dorada
  portada.drawRectangle({ x: MARGEN, y: ALTO - MARGEN - 140, width: CONTENT, height: 3, color: ACENTO });

  // Títulos
  portada.drawText("Reporte de Actividad", {
    x: MARGEN, y: ALTO - MARGEN - 180, size: 26, font: helveticaBold, color: OSCURO,
  });
  portada.drawText(data.nombre, {
    x: MARGEN, y: ALTO - MARGEN - 214, size: 16, font: helvetica, color: GRIS, maxWidth: CONTENT,
  });

  // Metadata
  const hoy = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const meta = [
    ["Cliente:",             data.clienteNombre],
    ["Fecha de generación:", hoy],
    ["Generado por:",        sesion?.user?.nombre || sesion?.user?.email || "Gerente"],
    ["Total de eventos:",    String(data.eventos.length)],
  ];
  let metaY = ALTO - MARGEN - 275;
  for (const [etiqueta, valor] of meta) {
    portada.drawText(etiqueta, { x: MARGEN,       y: metaY, size: 10, font: helveticaBold, color: GRIS });
    portada.drawText(valor,    { x: MARGEN + 145, y: metaY, size: 10, font: helvetica,     color: OSCURO, maxWidth: CONTENT - 145 });
    metaY -= 22;
  }

  // Footer portada
  portada.drawText("BAUM Industria Carpintera — Documento confidencial", {
    x: MARGEN, y: MARGEN, size: 8, font: helvetica, color: rgb(0.7, 0.7, 0.7),
  });

  /* ── PÁGINAS DE CONTENIDO ── */
  // Anchos de columnas (total = CONTENT)
  const COL = { fecha: 62, hora: 44, clave: 62, evento: 115, resp: 105, coment: CONTENT - 62 - 44 - 62 - 115 - 105 };
  const HEADER_H = 22;
  const ROW_H    = 19;
  const PIE_Y    = MARGEN + 18;

  const TIPO_LABEL = {
    PLANO_SUBIDO:          "Plano subido",
    AUTH_INTERNA_APROBADA: "Aut. interna",
    AUTH_INTERNA_RECHAZADA:"Rechazo interno",
    ENVIADO_CLIENTE:       "Enviado cliente",
    CLIENTE_APROBO:        "Cliente aprobó",
    CLIENTE_RECHAZO:       "Cliente rechazó",
    LIBERADO:              "Liberado",
    EN_PRODUCCION:         "En producción",
  };

  function nuevaPagina() {
    const pg = pdfDoc.addPage([ANCHO, ALTO]);
    let y = ALTO - MARGEN;

    // Encabezado de página
    pg.drawText(`Historial — ${data.nombre}`, {
      x: MARGEN, y, size: 10, font: helveticaBold, color: OSCURO, maxWidth: CONTENT,
    });
    y -= 16;

    // Cabecera de tabla
    pg.drawRectangle({ x: MARGEN, y: y - HEADER_H + 5, width: CONTENT, height: HEADER_H, color: OSCURO });
    let hx = MARGEN + 4;
    for (const [col, ancho] of Object.entries(COL)) {
      const lbl = { fecha:"FECHA", hora:"HORA", clave:"CLAVE", evento:"EVENTO", resp:"RESPONSABLE", coment:"COMENTARIOS" }[col];
      pg.drawText(lbl, { x: hx, y: y - HEADER_H + 9, size: 7, font: helveticaBold, color: BLANCO });
      hx += ancho;
    }
    y -= HEADER_H;

    return { pg, y };
  }

  let { pg, y } = nuevaPagina();

  for (let i = 0; i < data.eventos.length; i++) {
    const ev    = data.eventos[i];
    const fecha = new Date(ev.fecha);
    const fechaStr   = fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" });
    const horaStr    = fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const comentStr  = ev.comentarios ? ev.comentarios.slice(0, 55) + (ev.comentarios.length > 55 ? "..." : "") : "";
    const bgFila     = i % 2 === 0 ? rgb(1, 1, 1) : rgb(0.976, 0.976, 0.976);

    if (y - ROW_H < PIE_Y) {
      // Footer página actual
      pg.drawText("BAUM Industria Carpintera — Documento confidencial", {
        x: MARGEN, y: MARGEN, size: 8, font: helvetica, color: rgb(0.7, 0.7, 0.7),
      });
      ({ pg, y } = nuevaPagina());
    }

    pg.drawRectangle({ x: MARGEN, y: y - ROW_H + 4, width: CONTENT, height: ROW_H, color: bgFila });

    const celdas = [
      { texto: fechaStr,                          ancho: COL.fecha   },
      { texto: horaStr,                           ancho: COL.hora    },
      { texto: ev.clave,                          ancho: COL.clave   },
      { texto: TIPO_LABEL[ev.tipo] || ev.tipo,    ancho: COL.evento  },
      { texto: ev.responsable || "",              ancho: COL.resp    },
      { texto: comentStr,                         ancho: COL.coment  },
    ];

    let cx = MARGEN + 4;
    for (const celda of celdas) {
      if (celda.texto) {
        pg.drawText(celda.texto, {
          x: cx, y: y - 13, size: 7.5, font: helvetica, color: OSCURO,
          maxWidth: celda.ancho - 6,
        });
      }
      cx += celda.ancho;
    }
    y -= ROW_H;
  }

  // Footer última página
  pg.drawText("BAUM Industria Carpintera — Documento confidencial", {
    x: MARGEN, y: MARGEN, size: 8, font: helvetica, color: rgb(0.7, 0.7, 0.7),
  });

  // Descarga
  const pdfBytes        = await pdfDoc.save();
  const blob            = new Blob([pdfBytes], { type: "application/pdf" });
  const url             = URL.createObjectURL(blob);
  const a               = document.createElement("a");
  const fechaArchivo    = new Date().toISOString().slice(0, 10);
  const nombreLimpio    = data.nombre.replace(/[^a-zA-Z0-9]/g, "-");
  a.href                = url;
  a.download            = `Historial-${nombreLimpio}-${fechaArchivo}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Componente principal ────────────────────────────── */
export default function HistorialPage() {
  const { id }                            = useParams();
  const router                            = useRouter();
  const { data: sesion, status: sesionStatus } = useSession();

  const [data, setData]         = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState("");
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    if (sesionStatus !== "authenticated") return;
    fetch(`/api/proyectos/${id}/historial`)
      .then((r) => r.json())
      .then((d) => { setData(d); setCargando(false); })
      .catch(() => { setError("Error de conexión"); setCargando(false); });
  }, [id, sesionStatus]);

  async function handleExportarPDF() {
    if (!data) return;
    setExportando(true);
    try {
      await generarPDF(data, sesion);
    } catch (e) {
      console.error("Error al generar PDF:", e);
    } finally {
      setExportando(false);
    }
  }

  if (sesionStatus === "loading" || cargando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (sesion?.user?.rol !== "GERENTE") {
    return <div style={{ padding: 48, textAlign: "center", color: "#888888" }}>Sin acceso a esta sección.</div>;
  }

  if (error || !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: 300, justifyContent: "center", gap: 16 }}>
        <AlertTriangle size={36} style={{ color: "#ef4444" }} />
        <p style={{ color: "#888888", margin: 0 }}>{error || "No se pudo cargar el historial."}</p>
        <button
          onClick={() => router.push(`/dashboard/proyectos/${id}`)}
          style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 18px", color: "#555555", fontSize: 13, cursor: "pointer" }}
        >
          Volver al proyecto
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* ── Encabezado ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push(`/dashboard/proyectos/${id}`)}
            style={{ background: "#ffffff", border: "1px solid #e5e5e5", color: "#555555", borderRadius: 8, padding: "7px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, flexShrink: 0 }}
          >
            <ArrowLeft size={14} /> Volver al proyecto
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#212121" }}>Historial de actividad</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#555555", fontWeight: 500 }}>{data.nombre}</p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: "#888888" }}>Cliente: {data.clienteNombre}</p>
          </div>
        </div>
        <button
          onClick={handleExportarPDF}
          disabled={exportando || data.eventos.length === 0}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "#c9a84c", border: "none", borderRadius: 8,
            padding: "8px 16px", color: "#212121", fontWeight: 600,
            fontSize: 13, cursor: exportando ? "not-allowed" : "pointer",
            opacity: exportando ? 0.75 : 1, flexShrink: 0,
          }}
        >
          <Download size={14} />
          {exportando ? "Generando…" : "Exportar PDF"}
        </button>
      </div>

      {/* ── Timeline ── */}
      {data.eventos.length === 0 ? (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, textAlign: "center", padding: 56, color: "#aaaaaa" }}>
          <p style={{ margin: 0, fontSize: 14 }}>No hay actividad registrada aún.</p>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Línea vertical */}
          <div style={{ position: "absolute", left: 23, top: 0, bottom: 0, width: 2, background: "#e5e5e5", zIndex: 0 }} />

          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.eventos.map((ev, i) => {
              const conf = TIPO_CONFIG[ev.tipo] || { Icon: Send, color: "#888888", bg: "#f5f5f5", label: ev.tipo };
              const { Icon } = conf;
              return (
                <div key={i} style={{ display: "flex", gap: 16, paddingBottom: 16, position: "relative" }}>
                  {/* Círculo con ícono */}
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: conf.bg,
                    border: `2px solid ${conf.color}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, zIndex: 1,
                  }}>
                    <Icon size={18} style={{ color: conf.color }} />
                  </div>

                  {/* Card */}
                  <div style={{
                    flex: 1, background: "#ffffff", border: "1px solid #e5e5e5",
                    borderRadius: 8, padding: "13px 16px", marginTop: 4,
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: conf.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {conf.label}
                      </span>
                      <span style={{ fontSize: 11, color: "#aaaaaa", whiteSpace: "nowrap" }}>
                        {formatFecha(ev.fecha)}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 2px", fontSize: 14, color: "#212121", lineHeight: 1.4 }}>
                      {ev.descripcion}
                    </p>
                    {ev.comentarios && (
                      <p style={{ margin: "6px 0 0", fontSize: 13, color: "#666666", fontStyle: "italic", lineHeight: 1.5, borderLeft: "3px solid #fca5a5", paddingLeft: 10 }}>
                        "{ev.comentarios}"
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
