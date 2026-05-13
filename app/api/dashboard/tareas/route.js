import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ESTATUS_POR_ROL = {
  DISENADOR:  ["BORRADOR", "RECHAZADO"],
  COSTOS:     ["AUTORIZADO"],
  PRODUCCION: ["LIBERADO"],
};

export async function GET() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = sesion.user.rol;
  const estatusFiltro = ESTATUS_POR_ROL[rol];
  if (!estatusFiltro) return NextResponse.json([], { status: 200 });

  try {
    const claves = await prisma.clave.findMany({
      where: {
        estatus: { in: estatusFiltro },
        proyecto: { estatus: "ACTIVO" },
      },
      orderBy: { updatedAt: "asc" },
      select: {
        id: true,
        codigo: true,
        descripcion: true,
        estatus: true,
        updatedAt: true,
        proyecto: {
          select: {
            id: true,
            nombre: true,
            cliente: { select: { nombre: true, nombreCorto: true } },
          },
        },
      },
    });

    const respuesta = claves.map((c) => ({
      ...c,
      proyecto: {
        ...c.proyecto,
        clienteNombre: c.proyecto?.cliente?.nombre || c.proyecto?.cliente?.nombreCorto || "Sin cliente",
      },
    }));

    return NextResponse.json(respuesta);
  } catch (error) {
    console.error("[GET /api/dashboard/tareas]", error);
    return NextResponse.json({ error: "Error al obtener tareas" }, { status: 500 });
  }
}
