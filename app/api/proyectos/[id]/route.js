import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const INCLUDE_DETALLE = {
  gerentes: { include: { usuario: { select: { id: true, nombre: true, email: true } } } },
  claves: {
    include: {
      planos: {
        include: {
          subidoPor: { select: { nombre: true } },
          autorizacionesInternas: { include: { gerente: { select: { id: true, nombre: true } } } },
          autorizacionCliente: true,
        },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  },
};

async function verificarAcceso(proyectoId, rol) {
  if (rol === "GERENTE") return true;

  if (rol === "DISENADOR") {
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyectoId },
    });
    return !!proyecto;
  }

  if (rol === "COSTOS") {
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyectoId, claves: { some: { estatus: "AUTORIZADO" } } },
    });
    return !!proyecto;
  }

  if (rol === "PRODUCCION") {
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: proyectoId, claves: { some: { estatus: { in: ["LIBERADO", "EN_PRODUCCION"] } } } },
    });
    return !!proyecto;
  }

  return false;
}

export async function GET(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { rol } = sesion.user;
  const { id } = await params;
  const proyectoId = parseInt(id);

  if (isNaN(proyectoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const tieneAcceso = await verificarAcceso(proyectoId, rol);
  if (!tieneAcceso) return NextResponse.json({ error: "Sin acceso a este proyecto" }, { status: 403 });

  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: INCLUDE_DETALLE,
    });

    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    return NextResponse.json(proyecto);
  } catch (error) {
    console.error("[GET /api/proyectos/[id]]", error);
    return NextResponse.json({ error: "Error al obtener proyecto" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") return NextResponse.json({ error: "Solo gerentes pueden editar proyectos" }, { status: 403 });

  const { id } = await params;
  const proyectoId = parseInt(id);
  if (isNaN(proyectoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const { nombre, clienteNombre, estatus, gerentesIds, pinAcceso } = body;

    const datos = {};
    if (nombre !== undefined) datos.nombre = nombre.trim();
    if (clienteNombre !== undefined) datos.clienteNombre = clienteNombre.trim();
    if (estatus !== undefined) datos.estatus = estatus;
    if (pinAcceso !== undefined) {
      const pinExistente = await prisma.proyecto.findFirst({
        where: { pinAcceso, NOT: { id: proyectoId } },
      });
      if (pinExistente) return NextResponse.json({ error: "Ese PIN ya está en uso" }, { status: 409 });
      datos.pinAcceso = pinAcceso;
    }

    const proyecto = await prisma.$transaction(async (tx) => {
      if (gerentesIds !== undefined) {
        await tx.proyectoGerente.deleteMany({ where: { proyectoId } });
        await tx.proyectoGerente.createMany({
          data: gerentesIds.map((uid) => ({ proyectoId, usuarioId: parseInt(uid) })),
        });
      }
      return tx.proyecto.update({
        where: { id: proyectoId },
        data: datos,
        include: INCLUDE_DETALLE,
      });
    });

    return NextResponse.json(proyecto);
  } catch (error) {
    console.error("[PATCH /api/proyectos/[id]]", error);
    return NextResponse.json({ error: "Error al actualizar proyecto" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") return NextResponse.json({ error: "Solo gerentes pueden eliminar proyectos" }, { status: 403 });

  const { id } = await params;
  const proyectoId = parseInt(id);
  if (isNaN(proyectoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    await prisma.proyecto.delete({ where: { id: proyectoId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/proyectos/[id]]", error);
    return NextResponse.json({ error: "Error al eliminar proyecto" }, { status: 500 });
  }
}