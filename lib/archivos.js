import path from "path";
import { readFile } from "fs/promises";

export const DIRECTORIO_PLANOS = path.join(process.cwd(), "private-uploads", "planos");

export function rutaFisicaDePlano(urlPdf) {
  if (!urlPdf || typeof urlPdf !== "string") return null;
  const nombreArchivo = path.basename(urlPdf);
  if (!nombreArchivo.toLowerCase().endsWith(".pdf")) return null;
  return path.join(DIRECTORIO_PLANOS, nombreArchivo);
}

export async function leerArchivoPdf(urlPdf) {
  const ruta = rutaFisicaDePlano(urlPdf);
  if (!ruta) return null;
  try {
    return await readFile(ruta);
  } catch {
    return null;
  }
}

export function puedeUsuarioAccederPlano(sesion, plano, clave) {
  if (!sesion?.user) return false;
  const rol = sesion.user.rol;
  const usuarioId = parseInt(sesion.user.id);

  if (rol === "DUENO" || rol === "SUPERADMIN") return true;

  if (rol === "GERENTE") {
    return (clave.proyecto?.gerentes || []).some((g) => g.usuarioId === usuarioId);
  }

  if (rol === "DISENADOR") {
    return plano.subidoPorId === usuarioId;
  }

  if (rol === "COSTOS") {
    return ["AUTORIZADO", "LIBERADO", "EN_PRODUCCION"].includes(clave.estatus);
  }

  return false;
}

export function clienteVePlano(pin, plano, clave) {
  if (!clave?.proyecto || clave.proyecto.pinAcceso !== pin) return false;
  return ["ENVIADO", "AUTORIZADO", "LIBERADO", "EN_PRODUCCION"].includes(clave.estatus);
}

export function generarNombreDescarga(plano, clave, tipo) {
  const codigoLimpio = (clave?.codigo || `plano-${plano.id}`).replace(/[^a-zA-Z0-9-]/g, "-");
  const sufijo = tipo === "firmado" ? "-firmado" : "";
  return `${codigoLimpio}-v${plano.version}${sufijo}.pdf`;
}

export function esPdfValido(buffer) {
  if (!buffer || buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  );
}

const PREFIJO_FIRMA = "data:image/png;base64,";
const MAX_FIRMA_BYTES = 200 * 1024;

export function decodificarFirmaPng(firmaBase64) {
  if (typeof firmaBase64 !== "string") return { error: "Firma con formato inválido" };
  if (!firmaBase64.startsWith(PREFIJO_FIRMA)) return { error: "La firma debe ser un PNG en base64" };

  const datos = firmaBase64.slice(PREFIJO_FIRMA.length);
  if (datos.length === 0) return { error: "Firma vacía" };
  if (datos.length > MAX_FIRMA_BYTES * 1.4) return { error: "La firma excede el tamaño máximo" };

  let buffer;
  try {
    buffer = Buffer.from(datos, "base64");
  } catch {
    return { error: "No se pudo decodificar la firma" };
  }

  if (buffer.length === 0) return { error: "Firma vacía" };
  if (buffer.length > MAX_FIRMA_BYTES) return { error: "La firma excede el tamaño máximo" };

  const esPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  if (!esPng) return { error: "La firma no es un PNG válido" };

  return { buffer };
}

export function construirRespuestaPdf(bytes, nombreDescarga, modo) {
  const disposition = modo === "descarga"
    ? `attachment; filename="${nombreDescarga}"`
    : `inline; filename="${nombreDescarga}"`;
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
