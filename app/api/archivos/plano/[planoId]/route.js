import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  leerArchivoPdf,
  puedeUsuarioAccederPlano,
  generarNombreDescarga,
  construirRespuestaPdf,
} from "@/lib/archivos";

export async function GET(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { planoId: paramId } = await params;
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
          include: {
            proyecto: {
              select: {
                id: true,
                gerentes: { select: { usuarioId: true } },
              },
            },
          },
        },
        autorizacionCliente: { select: { urlPdfFirmado: true, decision: true } },
      },
    });

    if (!plano) return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });

    if (!puedeUsuarioAccederPlano(sesion, plano, plano.clave)) {
      return NextResponse.json({ error: "Sin permiso para ver este plano" }, { status: 403 });
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
    console.error("[GET /api/archivos/plano/[planoId]]", error);
    return NextResponse.json({ error: "Error al obtener el archivo" }, { status: 500 });
  }
}
