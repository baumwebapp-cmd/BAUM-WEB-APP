import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ROLES_CANCELAR = ["DUENO", "SUPERADMIN"];

export async function POST(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_CANCELAR.includes(sesion.user.rol)) {
    return NextResponse.json({ error: "Sin permiso para cancelar órdenes" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const orden = await prisma.ordenCambio.findUnique({ where: { id }, select: { id: true, cancelada: true } });
    if (!orden) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    if (orden.cancelada) {
      return NextResponse.json({ error: "La orden ya está cancelada" }, { status: 409 });
    }

    const actualizada = await prisma.ordenCambio.update({
      where: { id },
      data: { cancelada: true },
    });

    return NextResponse.json({ ok: true, orden: actualizada });
  } catch (error) {
    console.error("[POST /api/ordenes/[id]/cancelar]", error);
    return NextResponse.json({ error: "Error al cancelar la orden" }, { status: 500 });
  }
}
