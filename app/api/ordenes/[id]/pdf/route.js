import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPO_LABEL = {
  cambio: "Orden de Cambio",
  extraordinaria: "Orden Extraordinaria",
  trabajo: "Orden de Trabajo",
};

const FIRMAS_LAYOUT = [
  { rol: "cliente", titulo: "Cliente" },
  { rol: "ventas", titulo: "Ventas Baum" },
  { rol: "adicional", titulo: "Firma Adicional" },
  { rol: "supervisor", titulo: "Supervisor Baum" },
];

const NEGRO = "#1a1a1a";
const GRIS = "#666666";
const GRIS_CLARO = "#999999";
const VERDE = "#1f8a4c";
const ROJO = "#c0392b";
const FILA_ALT = "#f7f7f5";

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function dinero(n) {
  const v = Number(n) || 0;
  return "$" + v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fechaLegible(valor) {
  if (!valor) return "—";
  try {
    const d = new Date(valor);
    if (isNaN(d.getTime())) return String(valor);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return String(valor);
  }
}

function buscarLogo() {
  const candidatos = [
    path.join(process.cwd(), "public", "img", "logo-baum.png"),
    path.join(process.cwd(), "public", "logo-baum.png"),
    path.join(process.cwd(), "public", "baum_logo.png"),
  ];
  for (const ruta of candidatos) {
    try {
      if (fs.existsSync(ruta)) return ruta;
    } catch {}
  }
  return null;
}

export async function GET(request, { params }) {
  const { id } = await params;

  const orden = await prisma.ordenCambio.findUnique({
    where: { id },
    include: { partidas: true, firmas: true, fotos: true },
  });

  if (!orden) {
    return new Response(JSON.stringify({ error: "Orden no encontrada" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  const stream = new PassThrough();
  doc.pipe(stream);

  const M = 40;
  const PW = doc.page.width;
  const PH = doc.page.height;
  const CW = PW - M * 2;
  const BOTTOM = PH - 60;

  // ---------- ENCABEZADO ----------
  const topY = M;
  const logo = buscarLogo();
  if (logo) {
    try {
      doc.image(logo, M, topY, { height: 56 });
    } catch {}
  } else {
    doc.fillColor(NEGRO).font("Helvetica-Bold").fontSize(20).text("BAUM", M, topY + 12);
  }

  doc
    .fillColor(NEGRO)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("BAUM INDUSTRIA CARPINTERA", M, topY + 6, { width: CW, align: "center" });
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(GRIS)
    .text("TEME GRUPO INDUSTRIAL SA DE CV", M, topY + 24, { width: CW, align: "center" });
  doc
    .fontSize(7)
    .fillColor(GRIS_CLARO)
    .text(
      "F-12 · Orden de Cambio / Orden Extraordinaria / Orden de Trabajo",
      M,
      topY + 38,
      { width: CW, align: "center" }
    );

  const colDerX = PW - M - 150;
  doc.font("Helvetica").fontSize(7).fillColor(GRIS_CLARO).text("NUM. ORDEN", colDerX, topY, { width: 150, align: "right" });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(NEGRO).text(orden.numOrden || "—", colDerX, topY + 9, { width: 150, align: "right" });
  doc.font("Helvetica").fontSize(7).fillColor(GRIS_CLARO).text("FECHA", colDerX, topY + 26, { width: 150, align: "right" });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NEGRO).text(fechaLegible(orden.fechaSolicitud), colDerX, topY + 35, { width: 150, align: "right" });

  let y = topY + 66;
  doc.moveTo(M, y).lineTo(PW - M, y).strokeColor("#dddddd").lineWidth(1).stroke();
  y += 16;

  // ---------- DATOS DE LA ORDEN (3 columnas) ----------
  function campo(x, w, label, valor) {
    doc.font("Helvetica").fontSize(6.5).fillColor(GRIS_CLARO).text(label.toUpperCase(), x, y, { width: w });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NEGRO).text(valor || "—", x, y + 9, { width: w });
  }
  const colW = CW / 3;
  const c1 = M;
  const c2 = M + colW;
  const c3 = M + colW * 2;

  campo(c1, colW - 10, "Proyecto", orden.proyectoNombre);
  campo(c2, colW - 10, "Solicitada por", orden.solicitadaPor);
  campo(c3, colW - 10, "Ventas Baum", orden.ventasBaum);
  y += 30;
  campo(c1, colW - 10, "Cliente", orden.clienteNombre);
  campo(c2, colW - 10, "Generada por", orden.generadaPor || "—");
  campo(c3, colW - 10, "Tipo", TIPO_LABEL[orden.tipo] || orden.tipo);
  y += 30;

  if (orden.contacto || orden.numeroContrato) {
    campo(c1, colW - 10, "Contacto", orden.contacto || "—");
    campo(c2, colW - 10, "Supervisor Baum", orden.supervisorBaum);
    campo(c3, colW - 10, "No. Contrato", orden.numeroContrato || "—");
    y += 30;
  }

  doc.moveTo(M, y).lineTo(PW - M, y).strokeColor("#eeeeee").lineWidth(1).stroke();
  y += 14;

  // ---------- helpers de página ----------
  function pieDePagina() {
    // se dibuja al final con bufferPages
  }

  function nuevaPagina() {
    doc.addPage();
    y = M;
  }

  function asegurarEspacio(alto) {
    if (y + alto > BOTTOM) {
      nuevaPagina();
    }
  }

  // ---------- CONCEPTO / JUSTIFICACIÓN ----------
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NEGRO).text("CONCEPTO / JUSTIFICACIÓN", M, y);
  y += 14;
  doc.font("Helvetica").fontSize(9).fillColor("#333333");
  const conceptoTexto = orden.concepto || "—";
  const altoConcepto = doc.heightOfString(conceptoTexto, { width: CW });
  asegurarEspacio(altoConcepto + 10);
  doc.text(conceptoTexto, M, y, { width: CW, align: "justify" });
  y = doc.y + 16;

  // ---------- TABLA DE PARTIDAS ----------
  const cols = [
    { k: "codigo", t: "CLAVE", w: 70, align: "left" },
    { k: "concepto", t: "CONCEPTO / UBICACIÓN", w: CW - 70 - 90 - 70 - 90, align: "left" },
    { k: "precio", t: "PRECIO", w: 90, align: "right" },
    { k: "cantidad", t: "CANTIDAD", w: 70, align: "right" },
    { k: "total", t: "TOTAL", w: 90, align: "right" },
  ];

  function encabezadoTabla() {
    const h = 20;
    doc.rect(M, y, CW, h).fill(NEGRO);
    let x = M + 6;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff");
    cols.forEach((c) => {
      doc.text(c.t, x, y + 6, { width: c.w - 8, align: c.align });
      x += c.w;
    });
    y += h;
  }

  asegurarEspacio(60);
  encabezadoTabla();

  const partidas = orden.partidas || [];
  doc.font("Helvetica").fontSize(8);
  partidas.forEach((p, i) => {
    const conceptoCol = cols[1];
    const altoTexto = doc.heightOfString(p.concepto || "—", { width: conceptoCol.w - 8 });
    const filaH = Math.max(20, altoTexto + 10);

    if (y + filaH > BOTTOM) {
      nuevaPagina();
      encabezadoTabla();
      doc.font("Helvetica").fontSize(8);
    }

    if (i % 2 === 1) {
      doc.rect(M, y, CW, filaH).fill(FILA_ALT);
    }

    let x = M + 6;
    doc.fillColor(NEGRO);
    const valores = {
      codigo: p.codigo || "—",
      concepto: p.concepto || "—",
      precio: dinero(p.precio),
      cantidad: String(p.cantidad ?? ""),
      total: dinero(p.total),
    };
    cols.forEach((c) => {
      doc.text(valores[c.k], x, y + 5, { width: c.w - 8, align: c.align });
      x += c.w;
    });
    y += filaH;
  });

  // ---------- TOTALES ----------
  asegurarEspacio(70);
  const totW = 200;
  const totX = PW - M - totW;
  function filaTotal(label, valor, resaltado) {
    const h = 20;
    if (resaltado) {
      doc.rect(totX, y, totW, h).fill(NEGRO);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
    } else {
      doc.fillColor(NEGRO).font("Helvetica").fontSize(8.5);
    }
    doc.text(label, totX + 8, y + 6, { width: totW / 2 - 8, align: "left" });
    doc.text(valor, totX + totW / 2, y + 6, { width: totW / 2 - 8, align: "right" });
    y += h;
  }
  y += 6;
  filaTotal("TOTAL", dinero(orden.total), false);
  filaTotal(`IVA ${orden.ivaPorcentaje}%`, dinero(orden.ivaImporte), false);
  filaTotal("TOTAL NETO", dinero(orden.neto), true);
  y += 16;

  // ---------- AFECTACIÓN EN DÍAS ----------
  asegurarEspacio(40);
  doc.rect(M, y, CW, 26).fill(FILA_ALT);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(GRIS).text("AFECTACIÓN EN DÍAS", M + 10, y + 5);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(NEGRO)
    .text(`${orden.afectacionDias || 0} día(s)`, M + 10, y + 13);
  y += 40;

  // ---------- FIRMAS DE AUTORIZACIÓN (2x2) ----------
  asegurarEspacio(230);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(NEGRO).text("FIRMAS DE AUTORIZACIÓN", M, y);
  y += 16;

  const firmaW = (CW - 20) / 2;
  const firmaH = 95;
  const firmasPorRol = {};
  (orden.firmas || []).forEach((f) => {
    firmasPorRol[f.rol] = f;
  });

  function celdaFirma(col, row, def) {
    const fx = M + col * (firmaW + 20);
    const fy = y + row * (firmaH + 14);
    doc.rect(fx, fy, firmaW, firmaH).strokeColor("#dddddd").lineWidth(1).stroke();

    doc.font("Helvetica-Bold").fontSize(7).fillColor(GRIS_CLARO).text(def.titulo.toUpperCase(), fx + 8, fy + 7);

    const noAplica = def.rol === "adicional" && !orden.requiereFirmaAdicional;
    const firma = firmasPorRol[def.rol];
    const tieneFirma = firma && firma.imagen && firma.nombre;

    if (noAplica) {
      doc.font("Helvetica").fontSize(11).fillColor(GRIS_CLARO).text("N/A", fx, fy + firmaH / 2 - 6, { width: firmaW, align: "center" });
      return;
    }

    if (tieneFirma) {
      try {
        if (firma.imagen.startsWith("data:image")) {
          const b64 = firma.imagen.split(",")[1];
          const buf = Buffer.from(b64, "base64");
          doc.image(buf, fx + 8, fy + 18, { fit: [firmaW - 16, 42], align: "center" });
        }
      } catch {}
      doc.moveTo(fx + 8, fy + 64).lineTo(fx + firmaW - 8, fy + 64).strokeColor("#cccccc").lineWidth(0.5).stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor(NEGRO).text(firma.nombre, fx + 8, fy + 68, { width: firmaW - 16 });
      doc.font("Helvetica").fontSize(7).fillColor(GRIS).text(
        `${firma.empresa || ""}${firma.empresa ? " · " : ""}${fechaLegible(firma.fecha)}`,
        fx + 8,
        fy + 80,
        { width: firmaW - 16 }
      );
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(VERDE).text("FIRMADO", fx + firmaW - 60, fy + 7, { width: 52, align: "right" });
    } else {
      // línea punteada
      doc.save();
      doc.dash(3, { space: 2 }).moveTo(fx + 8, fy + 62).lineTo(fx + firmaW - 8, fy + 62).strokeColor("#cccccc").stroke();
      doc.undash();
      doc.restore();
      doc.font("Helvetica-Bold").fontSize(8).fillColor(ROJO).text("PENDIENTE DE FIRMA", fx, fy + firmaH / 2 - 4, { width: firmaW, align: "center" });
    }
  }

  FIRMAS_LAYOUT.forEach((def, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    celdaFirma(col, row, def);
  });
  y += firmaH * 2 + 14 + 20;

  // ---------- LEYENDA LEGAL ----------
  asegurarEspacio(30);
  doc
    .font("Helvetica-Oblique")
    .fontSize(7.5)
    .fillColor(GRIS)
    .text("Este documento es una orden de cambio oficial.", M, y, { width: CW, align: "center" });

  // ---------- PIE DE PÁGINA + MARCA CANCELADA ----------
  const range = doc.bufferedPageRange();
  const totalPaginas = range.count;
  for (let i = 0; i < totalPaginas; i++) {
    doc.switchToPage(range.start + i);

    if (orden.cancelada === true) {
      doc.save();
      doc.rotate(-45, { origin: [PW / 2, PH / 2] });
      doc.font("Helvetica-Bold").fontSize(110).fillColor(ROJO).opacity(0.12);
      doc.text("CANCELADA", PW / 2 - 350, PH / 2 - 60, { width: 700, align: "center" });
      doc.opacity(1);
      doc.restore();
    }

    const py = PH - 40;
    doc.font("Helvetica").fontSize(7).fillColor(GRIS_CLARO);
    doc.text(orden.numOrden || "", M, py, { width: CW / 3, align: "left" });
    doc.text(`Página ${i + 1} de ${totalPaginas}`, M + CW / 3, py, { width: CW / 3, align: "center" });
    doc.text(fechaLegible(orden.fechaSolicitud), M + (CW / 3) * 2, py, { width: CW / 3, align: "right" });
  }

  doc.end();
  const buffer = await streamToBuffer(stream);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(orden.numOrden || "orden").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
