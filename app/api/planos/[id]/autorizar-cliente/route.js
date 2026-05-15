import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { DIRECTORIO_PLANOS, leerArchivoPdf, decodificarFirmaPng } from "@/lib/archivos";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST(req, { params }) {
  const { id } = await params;
  const planoId = parseInt(id);
  if (isNaN(planoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { decision, firmadoPor, cargoFirmante, firmaBase64, comentarios } = body;

  if (!decision || !["APROBADO", "RECHAZADO"].includes(decision)) {
    return NextResponse.json({ error: "decision debe ser APROBADO o RECHAZADO" }, { status: 400 });
  }
  let firmaBuffer = null;
  if (decision === "APROBADO") {
    if (!firmadoPor?.trim() || firmadoPor.trim().split(/\s+/).length < 3) {
      return NextResponse.json({ error: "El nombre completo es obligatorio (mínimo 3 palabras)" }, { status: 400 });
    }
    if (!cargoFirmante?.trim() || cargoFirmante.trim().length < 2) {
      return NextResponse.json({ error: "El cargo o representación es obligatorio" }, { status: 400 });
    }
    if (!firmaBase64) {
      return NextResponse.json({ error: "La firma es obligatoria para aprobar" }, { status: 400 });
    }
    const firmaDecodificada = decodificarFirmaPng(firmaBase64);
    if (firmaDecodificada.error) {
      return NextResponse.json({ error: firmaDecodificada.error }, { status: 400 });
    }
    firmaBuffer = firmaDecodificada.buffer;
  }
  if (decision === "RECHAZADO") {
    if (!comentarios?.trim() || comentarios.trim().length < 10) {
      return NextResponse.json({ error: "Los comentarios son obligatorios (mínimo 10 caracteres)" }, { status: 400 });
    }
  }

  const ipCliente =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  try {
    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: {
        clave: {
          include: {
            proyecto: {
              select: {
                nombre: true,
                cliente: { select: { nombre: true, nombreCorto: true } },
                pinAcceso: true,
              },
            },
          },
        },
        autorizacionCliente: { select: { id: true } },
      },
    });

    if (!plano) return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });

    if (plano.clave.estatus !== "ENVIADO") {
      return NextResponse.json({ error: "La clave no está en estatus ENVIADO" }, { status: 400 });
    }

    if (plano.autorizacionCliente) {
      return NextResponse.json({ error: "Este plano ya tiene una respuesta del cliente" }, { status: 409 });
    }

    const nuevoEstatus = decision === "APROBADO" ? "AUTORIZADO" : "RECHAZADO";

    let urlPdfFirmado = null;

    if (decision === "APROBADO") {
      const pdfBytes = await leerArchivoPdf(plano.urlPdf);
      if (!pdfBytes) {
        return NextResponse.json({ error: "PDF original no disponible" }, { status: 500 });
      }
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const paginaAcuse = pdfDoc.addPage([612, 792]);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const { width, height } = paginaAcuse.getSize();

      const NEGRO = rgb(0.129, 0.129, 0.129);
      const DORADO = rgb(0.788, 0.659, 0.298);
      const GRIS = rgb(0.6, 0.6, 0.6);
      const GRIS_CLARO = rgb(0.898, 0.898, 0.898);
      const GRIS_OSCURO = rgb(0.25, 0.25, 0.25);
      const BLANCO = rgb(1, 1, 1);

      const textoCentrado = (texto, yPos, size, font, color) => {
        const w = font.widthOfTextAtSize(texto, size);
        paginaAcuse.drawText(texto, { x: (width - w) / 2, y: yPos, size, font, color });
      };

      let firmaImg;
      try {
        firmaImg = await pdfDoc.embedPng(firmaBuffer);
      } catch (errEmbed) {
        console.error("[autorizar-cliente] embedPng falló", errEmbed);
        return NextResponse.json({ error: "No se pudo procesar la firma" }, { status: 400 });
      }

      // 1. ENCABEZADO — franja negra superior
      paginaAcuse.drawRectangle({
        x: 0, y: height - 70,
        width, height: 70,
        color: NEGRO,
      });

      let logoEmbebido = null;
      try {
        const rutaLogo = path.join(process.cwd(), "public", "logo-acuse.png");
        const logoBytes = await readFile(rutaLogo);
        logoEmbebido = await pdfDoc.embedPng(logoBytes);
      } catch {
        logoEmbebido = null;
      }

      if (logoEmbebido) {
        const logoAlto = 40;
        const escala = logoAlto / logoEmbebido.height;
        const logoAncho = logoEmbebido.width * escala;
        paginaAcuse.drawImage(logoEmbebido, {
          x: 50,
          y: height - 35 - logoAlto / 2,
          width: logoAncho,
          height: logoAlto,
        });
      } else {
        paginaAcuse.drawText("BAUM", {
          x: 50, y: height - 50,
          size: 28, font: helveticaBold, color: BLANCO,
        });
      }

      textoCentrado("BAUM INDUSTRIA CARPINTERA", height - 28, 13, helveticaBold, BLANCO);
      textoCentrado("TEME GRUPO INDUSTRIAL SA DE CV", height - 43, 9, helvetica, BLANCO);
      textoCentrado("Acuse de Autorización de Plano", height - 56, 8, helvetica, BLANCO);

      const xDer = width - 150;
      paginaAcuse.drawText("NUM. PLANO", { x: xDer, y: height - 24, size: 8, font: helvetica, color: GRIS_CLARO });
      paginaAcuse.drawText(plano.clave.codigo, { x: xDer, y: height - 37, size: 11, font: helveticaBold, color: BLANCO });
      paginaAcuse.drawText("VERSIÓN", { x: xDer, y: height - 51, size: 8, font: helvetica, color: GRIS_CLARO });
      paginaAcuse.drawText(`v${plano.version}`, { x: xDer, y: height - 64, size: 11, font: helveticaBold, color: BLANCO });

      // 2. LÍNEA SEPARADORA dorada
      paginaAcuse.drawRectangle({
        x: 0, y: height - 73,
        width, height: 3,
        color: DORADO,
      });

      // 3. SECCIÓN DE DATOS — 3 columnas
      const fechaFormateada = new Date().toLocaleString("es-MX", {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
        timeZone: "America/Merida",
      });
      const clienteNombre =
        plano.clave.proyecto.cliente?.nombre ||
        plano.clave.proyecto.cliente?.nombreCorto ||
        "Sin cliente";

      const colX = [40, 240, 440];
      const yDatos = height - 130;

      const parDato = (x, yTop, l1, v1, l2, v2) => {
        paginaAcuse.drawText(l1, { x, y: yTop, size: 8, font: helvetica, color: GRIS });
        paginaAcuse.drawText(v1, { x, y: yTop - 13, size: 10, font: helveticaBold, color: NEGRO });
        paginaAcuse.drawText(l2, { x, y: yTop - 35, size: 8, font: helvetica, color: GRIS });
        paginaAcuse.drawText(v2, { x, y: yTop - 48, size: 10, font: helveticaBold, color: NEGRO });
      };

      parDato(colX[0], yDatos, "PROYECTO", plano.clave.proyecto.nombre, "CLIENTE", clienteNombre);
      parDato(colX[1], yDatos, "CLAVE", plano.clave.codigo, "VERSIÓN", `v${plano.version}`);
      parDato(colX[2], yDatos, "FECHA", fechaFormateada, "PÁGINAS", `${pdfDoc.getPageCount() - 1}`);

      // 4. LÍNEA SEPARADORA gris claro
      let y = yDatos - 70;
      paginaAcuse.drawLine({
        start: { x: 40, y }, end: { x: width - 40, y },
        thickness: 1, color: GRIS_CLARO,
      });

      // 5. SECCIÓN DESCRIPCIÓN
      y -= 26;
      paginaAcuse.drawText("DESCRIPCIÓN", { x: 40, y, size: 9, font: helveticaBold, color: NEGRO });
      y -= 18;

      const descripcion = plano.clave.descripcion || "Sin descripción.";
      const lineas = [];
      const palabras = descripcion.split(" ");
      let lineaActual = "";
      for (const palabra of palabras) {
        if ((lineaActual + " " + palabra).length > 90) {
          lineas.push(lineaActual);
          lineaActual = palabra;
        } else {
          lineaActual += (lineaActual ? " " : "") + palabra;
        }
      }
      if (lineaActual) lineas.push(lineaActual);

      lineas.forEach((linea, i) => {
        paginaAcuse.drawText(linea, {
          x: 40, y: y - i * 13,
          size: 9, font: helvetica, color: GRIS_OSCURO,
        });
      });
      y -= lineas.length * 13 + 12;

      // 6. LÍNEA SEPARADORA gris claro
      paginaAcuse.drawLine({
        start: { x: 40, y }, end: { x: width - 40, y },
        thickness: 1, color: GRIS_CLARO,
      });

      // 7. SECCIÓN FIRMA
      y -= 26;
      paginaAcuse.drawText("FIRMA DE AUTORIZACIÓN", { x: 40, y, size: 9, font: helveticaBold, color: NEGRO });

      const rectW = 280;
      const rectH = 130;
      const rectX = 40;
      const rectY = y - 12 - rectH;

      paginaAcuse.drawRectangle({
        x: rectX, y: rectY,
        width: rectW, height: rectH,
        borderColor: GRIS_CLARO, borderWidth: 1,
        color: BLANCO,
      });

      const imgW = 220, imgH = 80;
      paginaAcuse.drawImage(firmaImg, {
        x: rectX + (rectW - imgW) / 2,
        y: rectY + 38,
        width: imgW, height: imgH,
      });

      paginaAcuse.drawLine({
        start: { x: rectX + 25, y: rectY + 30 },
        end: { x: rectX + rectW - 25, y: rectY + 30 },
        thickness: 1, color: GRIS,
        dashArray: [3, 3],
      });

      let yf = rectY - 22;
      paginaAcuse.drawText(firmadoPor.trim(), {
        x: rectX, y: yf, size: 11, font: helveticaBold, color: NEGRO,
      });
      yf -= 17;
      paginaAcuse.drawText(`Fecha: ${fechaFormateada}`, {
        x: rectX, y: yf, size: 9, font: helvetica, color: GRIS,
      });
      yf -= 14;
      paginaAcuse.drawText(`IP: ${ipCliente}`, {
        x: rectX, y: yf, size: 8, font: helvetica, color: GRIS,
      });
      yf -= 13;
      paginaAcuse.drawText(`PIN del proyecto: ${plano.clave.proyecto.pinAcceso}`, {
        x: rectX, y: yf, size: 8, font: helvetica, color: GRIS,
      });

      // 8. PIE DE PÁGINA
      paginaAcuse.drawLine({
        start: { x: 40, y: 62 }, end: { x: width - 40, y: 62 },
        thickness: 0.5, color: GRIS_CLARO,
      });
      textoCentrado("BAUM Industria Carpintera · Documento con valor legal", 48, 8, helvetica, GRIS);
      textoCentrado("Este documento es confidencial y su alteración invalida la autorización.", 36, 7, helvetica, GRIS);

      const pdfFirmadoBytes = await pdfDoc.save();
      await mkdir(DIRECTORIO_PLANOS, { recursive: true });
      const nombreFirmado = `plano-${planoId}-firmado-${Date.now()}.pdf`;
      const rutaFirmado = path.join(DIRECTORIO_PLANOS, nombreFirmado);
      await writeFile(rutaFirmado, pdfFirmadoBytes);
      urlPdfFirmado = `/uploads/planos/${nombreFirmado}`;
    }

    await prisma.$transaction(async (tx) => {
      await tx.autorizacionCliente.create({
        data: {
          planoId,
          decision,
          firmadoPor: decision === "APROBADO" ? firmadoPor.trim() : "Cliente",
          cargoFirmante: decision === "APROBADO" ? cargoFirmante.trim() : null,
          firmaBase64: null,
          urlPdfFirmado,
          comentarios: comentarios?.trim() || null,
          ipCliente,
        },
      });
      await tx.clave.update({
        where: { id: plano.claveId },
        data: { estatus: nuevoEstatus, updatedAt: new Date() },
      });

      await registrarAuditoria(tx, {
        actor: decision === "APROBADO" ? `Cliente: ${firmadoPor.trim()}` : "Cliente",
        accion: decision === "APROBADO" ? "CLIENTE_APROBO" : "CLIENTE_RECHAZO",
        detalle: `Plano #${planoId} (clave ${plano.clave.codigo})${decision === "RECHAZADO" && comentarios ? ` — ${comentarios.trim()}` : ""}`,
        ip: ipCliente,
      });
    });

    return NextResponse.json({ ok: true, estatus: nuevoEstatus, urlPdfFirmado });
  } catch (error) {
    console.error("[POST /api/planos/[id]/autorizar-cliente]", error);
    return NextResponse.json({ error: "Error al procesar la autorización" }, { status: 500 });
  }
}
