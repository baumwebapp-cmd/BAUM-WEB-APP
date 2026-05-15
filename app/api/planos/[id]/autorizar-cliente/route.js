import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { writeFile, mkdir } from "fs/promises";
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

      paginaAcuse.drawRectangle({
        x: 0, y: height - 8,
        width: width, height: 8,
        color: rgb(0.788, 0.659, 0.298),
      });

      paginaAcuse.drawText("ACUSE DE AUTORIZACION", {
        x: 72, y: height - 80,
        size: 22, font: helveticaBold,
        color: rgb(0.129, 0.129, 0.129),
      });

      paginaAcuse.drawLine({
        start: { x: 72, y: height - 95 },
        end: { x: width - 72, y: height - 95 },
        thickness: 1,
        color: rgb(0.898, 0.898, 0.898),
      });

      paginaAcuse.drawText(
        "El presente documento ha sido revisado y autorizado en su totalidad.",
        { x: 72, y: height - 130, size: 11, font: helvetica, color: rgb(0.4, 0.4, 0.4) }
      );

      let y = height - 170;
      const colorDato = rgb(0.129, 0.129, 0.129);

      function escribirCampo(label, valor) {
        paginaAcuse.drawText(label, { x: 72, y, size: 10, font: helveticaBold, color: colorDato });
        paginaAcuse.drawText(valor, { x: 160, y, size: 10, font: helvetica, color: colorDato });
        y -= 20;
      }

      escribirCampo("PROYECTO:", plano.clave.proyecto.nombre);
      escribirCampo("CLAVE:", plano.clave.codigo);
      escribirCampo("VERSION:", `v${plano.version}`);
      escribirCampo("CLIENTE:", plano.clave.proyecto.cliente?.nombre || plano.clave.proyecto.cliente?.nombreCorto || "Sin cliente");

      paginaAcuse.drawText("DESCRIPCION:", { x: 72, y, size: 10, font: helveticaBold, color: colorDato });
      const descripcion = plano.clave.descripcion || "";
      const lineas = [];
      const palabras = descripcion.split(" ");
      let lineaActual = "";
      for (const palabra of palabras) {
        if ((lineaActual + " " + palabra).length > 80) {
          lineas.push(lineaActual);
          lineaActual = palabra;
        } else {
          lineaActual += (lineaActual ? " " : "") + palabra;
        }
      }
      if (lineaActual) lineas.push(lineaActual);

      lineas.forEach((linea, i) => {
        paginaAcuse.drawText(linea, {
          x: 160, y: y - (i * 14),
          size: 9, font: helvetica, color: colorDato,
        });
      });
      y -= Math.max(20, lineas.length * 14 + 6);

      escribirCampo("PAGINAS AUTORIZADAS:", `${pdfDoc.getPageCount() - 1} paginas`);

      y -= 10;
      paginaAcuse.drawLine({
        start: { x: 72, y },
        end: { x: width - 72, y },
        thickness: 1,
        color: rgb(0.898, 0.898, 0.898),
      });
      y -= 25;

      let firmaImg;
      try {
        firmaImg = await pdfDoc.embedPng(firmaBuffer);
      } catch (errEmbed) {
        console.error("[autorizar-cliente] embedPng falló", errEmbed);
        return NextResponse.json({ error: "No se pudo procesar la firma" }, { status: 400 });
      }

      paginaAcuse.drawText("FIRMA DEL CLIENTE:", {
        x: 72, y, size: 10, font: helveticaBold, color: colorDato,
      });
      y -= 90;

      paginaAcuse.drawImage(firmaImg, { x: 72, y, width: 200, height: 80 });
      y -= 10;

      paginaAcuse.drawLine({
        start: { x: 72, y },
        end: { x: 272, y },
        thickness: 0.5,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= 18;

      paginaAcuse.drawText(firmadoPor.trim(), {
        x: 72, y, size: 11, font: helveticaBold, color: colorDato,
      });
      y -= 18;

      const fechaFormateada = new Date().toLocaleString("es-MX", {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
        timeZone: "America/Merida",
      });
      paginaAcuse.drawText(`Fecha: ${fechaFormateada}`, {
        x: 72, y, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4),
      });
      y -= 14;

      paginaAcuse.drawText(`PIN del proyecto: ${plano.clave.proyecto.pinAcceso}`, {
        x: 72, y, size: 9, font: helvetica, color: rgb(0.6, 0.6, 0.6),
      });

      paginaAcuse.drawLine({
        start: { x: 50, y: 60 },
        end: { x: width - 50, y: 60 },
        thickness: 0.5,
        color: rgb(0.898, 0.898, 0.898),
      });
      paginaAcuse.drawText("BAUM Industria Carpintera - Documento con valor legal", {
        x: 50, y: 45, size: 8, font: helvetica,
        color: rgb(0.6, 0.6, 0.6),
      });
      paginaAcuse.drawText("Este documento es confidencial y su alteracion invalida la autorizacion.", {
        x: 50, y: 32, size: 8, font: helvetica,
        color: rgb(0.6, 0.6, 0.6),
      });

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
