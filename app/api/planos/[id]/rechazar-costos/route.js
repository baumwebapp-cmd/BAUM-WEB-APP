import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "COSTOS") {
    return NextResponse.json({ error: "Solo el área de Costos puede rechazar en esta etapa" }, { status: 403 });
  }

  const { id } = await params;
  const planoId = parseInt(id);
  if (isNaN(planoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const usuarioId = parseInt(sesion.user.id);

  try {
    const body = await req.json();
    const { comentarios } = body;
    if (!comentarios || comentarios.trim().length < 20) {
      return NextResponse.json({ error: "Los comentarios deben tener al menos 20 caracteres" }, { status: 400 });
    }

    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: { clave: true },
    });

    if (!plano) return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });

    if (plano.clave.estatus !== "AUTORIZADO") {
      return NextResponse.json({ error: "La clave no está autorizada por el cliente" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.clave.update({
        where: { id: plano.claveId },
        data: { estatus: "RECHAZADO" },
      });

      await tx.auditoriaAdmin.create({
        data: {
          usuarioId,
          accion: "RECHAZO_COSTOS",
          detalle: `Plano #${planoId} (clave ${plano.claveId}): ${comentarios.trim()}`,
        },
      });
    });

    return NextResponse.json({ ok: true, estatus: "RECHAZADO" });
  } catch (error) {
    console.error("[POST /api/planos/[id]/rechazar-costos]", error);
    return NextResponse.json({ error: "Error al rechazar desde costos" }, { status: 500 });
  }
}
