import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { emailPlanoLiberado } from "@/lib/email";

export async function POST(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE" && sesion.user.rol !== "COSTOS") {
    return NextResponse.json({ error: "No tienes permiso para liberar planos" }, { status: 403 });
  }

  const { id } = await params;
  const planoId = parseInt(id);
  if (isNaN(planoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: {
        clave: {
          include: {
            proyecto: {
              select: { id: true, nombre: true, clienteNombre: true, pinAcceso: true },
            },
          },
        },
        autorizacionCliente: { select: { decision: true } },
      },
    });

    if (!plano) return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });

    if (plano.clave.estatus !== "AUTORIZADO") {
      return NextResponse.json(
        { error: "La clave debe estar en estatus AUTORIZADO para liberar" },
        { status: 400 }
      );
    }

    if (plano.autorizacionCliente?.decision !== "APROBADO") {
      return NextResponse.json(
        { error: "El cliente aún no ha aprobado este plano" },
        { status: 400 }
      );
    }

    await prisma.clave.update({
      where: { id: plano.claveId },
      data: { estatus: "LIBERADO" },
    });

    emailPlanoLiberado({
      proyecto: plano.clave.proyecto,
      clave: plano.clave,
      plano,
    }).catch((err) => console.error("[email planoLiberado]", err));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/planos/[id]/liberar]", error);
    return NextResponse.json({ error: "Error al liberar el plano" }, { status: 500 });
  }
}
