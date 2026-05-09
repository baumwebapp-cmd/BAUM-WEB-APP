import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: usuarioId, rol } = sesion.user;

  if (rol !== "GERENTE" && rol !== "DISENADOR") {
    return NextResponse.json({ error: "No autorizado para crear claves" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { proyectoId, codigo, descripcion } = body;

    if (!proyectoId || isNaN(parseInt(proyectoId))) {
      return NextResponse.json({ error: "proyectoId inválido" }, { status: 400 });
    }
    if (!codigo?.trim()) {
      return NextResponse.json({ error: "El código es requerido" }, { status: 400 });
    }
    if (!descripcion?.trim()) {
      return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
    }

    const pid = parseInt(proyectoId);

    const proyecto = await prisma.proyecto.findUnique({ where: { id: pid }, select: { id: true } });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const codigoNorm = codigo.trim().toUpperCase();

    const existe = await prisma.clave.findFirst({
      where: { proyectoId: pid, codigo: codigoNorm },
    });
    if (existe) {
      return NextResponse.json({ error: "Ya existe una clave con ese código en este proyecto" }, { status: 409 });
    }

    const clave = await prisma.clave.create({
      data: {
        proyectoId: pid,
        codigo: codigoNorm,
        descripcion: descripcion.trim(),
        creadoPorId: parseInt(usuarioId),
      },
    });

    return NextResponse.json(clave, { status: 201 });
  } catch (error) {
    console.error("[POST /api/claves]", error);
    return NextResponse.json({ error: "Error al crear la clave" }, { status: 500 });
  }
}