import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const FILTRO_POR_ROL = {
  DISENADOR:  { claves: { some: { estatus: { in: ["BORRADOR", "REVISION_INTERNA"] } } } },
  COSTOS:     { claves: { some: { estatus: "AUTORIZADO" } } },
  PRODUCCION: { claves: { some: { estatus: { in: ["LIBERADO", "EN_PRODUCCION"] } } } },
};

export async function GET() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rol = sesion.user.rol;
  const where = FILTRO_POR_ROL[rol] || {};

  try {
    const proyectos = await prisma.proyecto.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        claves: {
          select: {
            estatus: true,
            updatedAt: true,
            planos: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
          },
        },
      },
    });

    const ahora = Date.now();

    const resultado = proyectos.map((p) => {
      const conteo = {
        BORRADOR: 0,
        REVISION_INTERNA: 0,
        ENVIADO: 0,
        RECHAZADO: 0,
        AUTORIZADO: 0,
        LIBERADO: 0,
        EN_PRODUCCION: 0,
      };
      const conteoPorColor = {};

      for (const clave of p.claves) {
        conteo[clave.estatus] = (conteo[clave.estatus] || 0) + 1;

        const fechaClave = new Date(clave.updatedAt);
        const fechaPlano = clave.planos[0] ? new Date(clave.planos[0].createdAt) : null;
        const fechaRef = fechaPlano && fechaPlano > fechaClave ? fechaPlano : fechaClave;

        const hrs = (ahora - fechaRef.getTime()) / 3600000;
        const color = hrs < 24 ? "verde" : hrs < 48 ? "amarillo" : "rojo";

        if (!conteoPorColor[clave.estatus]) {
          conteoPorColor[clave.estatus] = { verde: 0, amarillo: 0, rojo: 0 };
        }
        conteoPorColor[clave.estatus][color]++;
      }

      return {
        id: p.id,
        nombre: p.nombre,
        clienteNombre: p.clienteNombre,
        estatus: p.estatus,
        createdAt: p.createdAt,
        conteo,
        conteoPorColor,
      };
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return NextResponse.json({ error: "Error al obtener datos del dashboard" }, { status: 500 });
  }
}
