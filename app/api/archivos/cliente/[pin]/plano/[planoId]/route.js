import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  leerArchivoPdf,
  clienteVePlano,
  generarNombreDescarga,
  construirRespuestaPdf,
} from "@/lib/archivos";
import {
  obtenerIp,
  verificarLimiteCliente,
  registrarIntentoCliente,
  respuestaBloqueado,
} from "@/lib/rateLimit";

export async function GET(req, { params }) {
  const { pin, planoId: paramId } = await params;
  const ip = obtenerIp(req);

  const limite = await verificarLimiteCliente(ip);
  if (limite.bloqueado) return respuestaBloqueado(limite.segundosRestantes);

  if (!/^\d{6}$/.test(pin)) {
    await registrarIntentoCliente(ip, pin, false);
    return NextResponse.json({ error: "PIN inválido" }, { status: 400 });
  }
  const planoId = parseInt(paramId);
  if (isNaN(planoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") || "original";
  const modo = searchParams.get("modo") || "inline";

  if (!["original", "firmado"].includes(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }
  if (!["inline", "descarga"].includes(modo)) {
    return NextResponse.json({ error: "modo inválido" }, { status: 400 });
  }

  try {
    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: {
        clave: {
          include: { proyecto: { select: { pinAcceso: true } } },
        },
        autorizacionCliente: { select: { urlPdfFirmado: true, decision: true } },
      },
    });

    if (!plano) {
      await registrarIntentoCliente(ip, pin, false);
      return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });
    }
    if (!clienteVePlano(pin, plano, plano.clave)) {
      await registrarIntentoCliente(ip, pin, false);
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }

    let urlBuscada;
    if (tipo === "firmado") {
      if (
        plano.autorizacionCliente?.decision !== "APROBADO" ||
        !plano.autorizacionCliente?.urlPdfFirmado
      ) {
        return NextResponse.json({ error: "PDF firmado no disponible" }, { status: 404 });
      }
      urlBuscada = plano.autorizacionCliente.urlPdfFirmado;
    } else {
      urlBuscada = plano.urlPdf;
    }

    const bytes = await leerArchivoPdf(urlBuscada);
    if (!bytes) return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });

    const nombre = generarNombreDescarga(plano, plano.clave, tipo);
    return construirRespuestaPdf(bytes, nombre, modo);
  } catch (error) {
    console.error("[GET /api/archivos/cliente/[pin]/plano/[planoId]]", error);
    return NextResponse.json({ error: "Error al obtener el archivo" }, { status: 500 });
  }
}
