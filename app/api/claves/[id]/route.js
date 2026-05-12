import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const TRANSICIONES_VALIDAS = {
  GERENTE: {
    BORRADOR: ["REVISION_INTERNA"],
    REVISION_INTERNA: ["REVISION_CLIENTE", "BORRADOR"],
    REVISION_CLIENTE: ["REVISION_INTERNA", "AUTORIZADO"],
    AUTORIZADO: ["LIBERADO", "REVISION_INTERNA"],
    LIBERADO: ["EN_PRODUCCION", "AUTORIZADO"],
    EN_PRODUCCION: ["COMPLETADO", "LIBERADO"],
    COMPLETADO: [],
  },
  PRODUCCION: {
    LIBERADO: ["EN_PRODUCCION"],
    EN_PRODUCCION: ["COMPLETADO"],
  },
};

export async function PATCH(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { rol } = sesion.user;
  if (rol !== "GERENTE" && rol !== "PRODUCCION") {
    return NextResponse.json({ error: "Sin permiso para cambiar el estatus de la clave" }, { status: 403 });
  }

  const { id: paramId } = await params;
  const id = parseInt(paramId);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const { estatus } = body;

    if (!estatus) return NextResponse.json({ error: "El campo estatus es requerido" }, { status: 400 });

    const clave = await prisma.clave.findUnique({
      where: { id },
      select: { id: true, estatus: true, proyectoId: true },
    });
    if (!clave) return NextResponse.json({ error: "Clave no encontrada" }, { status: 404 });

    const transiciones = TRANSICIONES_VALIDAS[rol]?.[clave.estatus] ?? [];
    if (!transiciones.includes(estatus)) {
      return NextResponse.json(
        { error: `Transición no permitida: ${clave.estatus} → ${estatus}` },
        { status: 400 }
      );
    }

    const claveActualizada = await prisma.clave.update({
      where: { id },
      data: { estatus },
    });

    return NextResponse.json(claveActualizada);
  } catch (error) {
    console.error("[PATCH /api/claves/[id]]", error);
    return NextResponse.json({ error: "Error al actualizar la clave" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") {
    return NextResponse.json({ error: "Solo gerentes pueden eliminar claves" }, { status: 403 });
  }

  const { id: paramId } = await params;
  const id = parseInt(paramId);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const clave = await prisma.clave.findUnique({
      where: { id },
      select: { estatus: true },
    });
    if (!clave) return NextResponse.json({ error: "Clave no encontrada" }, { status: 404 });

    if (clave.estatus !== "BORRADOR") {
      return NextResponse.json(
        { error: "Solo se pueden eliminar claves en estatus BORRADOR" },
        { status: 400 }
      );
    }

    await prisma.clave.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/claves/[id]]", error);
    return NextResponse.json({ error: "Error al eliminar la clave" }, { status: 500 });
  }
}
