import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const DORADO = rgb(0.788, 0.659, 0.298);
const NEGRO = rgb(0.129, 0.129, 0.129);
const GRIS = rgb(0.533, 0.533, 0.533);
const LINEA = rgb(0.878, 0.878, 0.878);

function formatearFecha(date) {
  const d = new Date(date);
  const fecha = d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "2-digit" });
  const hora = d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return { fecha, hora };
}

export async function descargarPdfDesdeUrl(url) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No se pudo descargar el PDF original (${respuesta.status})`);
  }
  return new Uint8Array(await respuesta.arrayBuffer());
}

export async function incrustarFirmaEnPdf({
  pdfBytesOriginales,
  firmaBase64,
  firmadoPor,
  proyecto,
  claveCodigo,
  ipCliente,
  userAgent,
  comentarios,
  fechaFirma = new Date(),
}) {
  const pdfDoc = await PDFDocument.load(pdfBytesOriginales);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const dataUriLimpio = firmaBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
  const firmaBytes = Uint8Array.from(atob(dataUriLimpio), (c) => c.charCodeAt(0));
  const firmaImg = await pdfDoc.embedPng(firmaBytes);

  const pagina = pdfDoc.addPage([612, 792]);
  const { width, height } = pagina.getSize();
  const { fecha, hora } = formatearFecha(fechaFirma);

  pagina.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: NEGRO });
  pagina.drawText("BAUM", {
    x: 48, y: height - 42,
    size: 22, font: fontBold, color: DORADO,
  });
  pagina.drawText("INDUSTRIA CARPINTERA", {
    x: 48, y: height - 60,
    size: 9, font: fontRegular, color: rgb(0.6, 0.6, 0.6),
  });
  pagina.drawText("CONSTANCIA DE APROBACIÓN", {
    x: width - 48 - fontBold.widthOfTextAtSize("CONSTANCIA DE APROBACIÓN", 11),
    y: height - 50,
    size: 11, font: fontBold, color: rgb(1, 1, 1),
  });

  let y = height - 130;

  pagina.drawText("Aprobación digital del plano", {
    x: 48, y, size: 16, font: fontBold, color: NEGRO,
  });
  y -= 20;
  pagina.drawText(
    "Este documento certifica que el cliente abajo identificado revisó y aprobó",
    { x: 48, y, size: 10, font: fontRegular, color: GRIS }
  );
  y -= 14;
  pagina.drawText(
    "el plano correspondiente, mediante firma capturada en el sistema BAUM.",
    { x: 48, y, size: 10, font: fontRegular, color: GRIS }
  );

  y -= 30;
  pagina.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 1, color: LINEA });

  const filas = [
    ["Proyecto", proyecto || "—"],
    ["Clave", claveCodigo || "—"],
    ["Firmado por", firmadoPor || "—"],
    ["Fecha", fecha],
    ["Hora", hora],
    ["Dirección IP", ipCliente || "No registrada"],
  ];

  y -= 20;
  for (const [etiqueta, valor] of filas) {
    pagina.drawText(etiqueta.toUpperCase(), { x: 48, y, size: 8, font: fontBold, color: GRIS });
    pagina.drawText(String(valor), { x: 180, y, size: 11, font: fontRegular, color: NEGRO });
    y -= 22;
  }

  if (userAgent) {
    pagina.drawText("DISPOSITIVO", { x: 48, y, size: 8, font: fontBold, color: GRIS });
    const uaCorto = userAgent.length > 70 ? userAgent.slice(0, 70) + "…" : userAgent;
    pagina.drawText(uaCorto, { x: 180, y, size: 9, font: fontRegular, color: NEGRO });
    y -= 22;
  }

  if (comentarios) {
    pagina.drawText("COMENTARIOS", { x: 48, y, size: 8, font: fontBold, color: GRIS });
    y -= 14;
    const lineas = ajustarTexto(comentarios, fontRegular, 10, width - 96);
    for (const linea of lineas) {
      pagina.drawText(linea, { x: 48, y, size: 10, font: fontRegular, color: NEGRO });
      y -= 14;
    }
    y -= 8;
  }

  y -= 10;
  pagina.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 1, color: LINEA });

  y -= 30;
  pagina.drawText("FIRMA DEL CLIENTE", { x: 48, y, size: 9, font: fontBold, color: GRIS });

  const firmaMaxWidth = 280;
  const firmaMaxHeight = 100;
  const escalada = firmaImg.scaleToFit(firmaMaxWidth, firmaMaxHeight);
  y -= firmaMaxHeight + 10;
  pagina.drawImage(firmaImg, {
    x: 48, y,
    width: escalada.width, height: escalada.height,
  });
  pagina.drawLine({
    start: { x: 48, y: y - 4 },
    end: { x: 48 + firmaMaxWidth, y: y - 4 },
    thickness: 1, color: NEGRO,
  });
  pagina.drawText(firmadoPor || "", {
    x: 48, y: y - 18,
    size: 10, font: fontBold, color: NEGRO,
  });

  pagina.drawRectangle({ x: 0, y: 0, width, height: 32, color: rgb(0.96, 0.96, 0.96) });
  const pie = `Documento generado el ${fecha} a las ${hora}. Sistema BAUM — Trazabilidad legal de aprobación.`;
  pagina.drawText(pie, {
    x: 48, y: 12,
    size: 8, font: fontRegular, color: GRIS,
  });

  return await pdfDoc.save();
}

function ajustarTexto(texto, font, fontSize, maxWidth) {
  const palabras = String(texto).split(/\s+/);
  const lineas = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (font.widthOfTextAtSize(prueba, fontSize) > maxWidth) {
      if (actual) lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}
