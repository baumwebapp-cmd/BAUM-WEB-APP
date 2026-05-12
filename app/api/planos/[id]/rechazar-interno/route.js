import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") {
    return NextResponse.json({ error: "Solo gerentes pueden rechazar internamente" }, { status: 403 });
  }

  const { id } = await params;
  const planoId = parseInt(id);
  if (isNaN(planoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const gerenteId = parseInt(sesion.user.id);

  try {
    const body = await req.json();
    const { comentarios } = body;
    if (!comentarios || comentarios.trim().length < 10) {
      return NextResponse.json({ error: "Los comentarios deben tener al menos 10 caracteres" }, { status: 400 });
    }

    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: {
        clave: {
          include: {
            proyecto: {
              include: { gerentes: { select: { usuarioId: true } } },
            },
          },
        },
        autorizacionesInternas: { select: { gerenteId: true } },
      },
    });

    if (!plano) return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });

    if (plano.clave.estatus !== "REVISION_INTERNA") {
      return NextResponse.json({ error: "La clave no está en revisión interna" }, { status: 400 });
    }

    const asignado = plano.clave.proyecto.gerentes.some((g) => g.usuarioId === gerenteId);
    if (!asignado) {
      return NextResponse.json({ error: "No estás asignado como gerente de este proyecto" }, { status: 403 });
    }

    const yaActuo = plano.autorizacionesInternas.some((a) => a.gerenteId === gerenteId);
    if (yaActuo) {
      return NextResponse.json({ error: "Ya tomaste una decisión sobre este plano" }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.autorizacionInterna.create({
        data: {
          planoId,
          gerenteId,
          decision: "RECHAZADO",
          comentarios: comentarios.trim(),
        },
      });

      await tx.clave.update({
        where: { id: plano.claveId },
        data: { estatus: "RECHAZADO", updatedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true, estatus: "RECHAZADO" });
  } catch (error) {
    console.error("[POST /api/planos/[id]/rechazar-interno]", error);
    return NextResponse.json({ error: "Error al rechazar el plano" }, { status: 500 });
  }
}
