import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ESTATUS_POR_ROL = {
  DISENADOR: ["BORRADOR", "RECHAZADO"],
  COSTOS:    ["AUTORIZADO"],
};

export async function GET() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = sesion.user.rol;
  const estatuses = ESTATUS_POR_ROL[rol];
  if (!estatuses) return NextResponse.json([]);

  try {
    const claves = await prisma.clave.findMany({
      where: { estatus: { in: estatuses } },
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
            clienteId: true,
            cliente: { select: { nombre: true, nombreCorto: true } },
          },
        },
        planos: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            autorizacionCliente: {
              select: { decision: true, comentarios: true, firmadoPor: true, createdAt: true },
            },
          },
        },
      },
    });

    const respuesta = claves.map((c) => {
      const ultimoPlano = c.planos[0] || null;
      const rechazo = ultimoPlano?.autorizacionCliente?.decision === "RECHAZADO"
        ? ultimoPlano.autorizacionCliente
        : null;
      return {
        id: c.id,
        codigo: c.codigo,
        descripcion: c.descripcion,
        estatus: c.estatus,
        updatedAt: c.updatedAt,
        proyectoId: c.proyecto.id,
        proyectoNombre: c.proyecto.nombre,
        clienteId: c.proyecto.clienteId,
        clienteNombre: c.proyecto.cliente?.nombre || c.proyecto.cliente?.nombreCorto || "Sin cliente",
        comentariosRechazo: rechazo?.comentarios || null,
      };
    });

    return NextResponse.json(respuesta);
  } catch (error) {
    console.error("[GET /api/dashboard/pendientes]", error);
    return NextResponse.json({ error: "Error al obtener pendientes" }, { status: 500 });
  }
}
