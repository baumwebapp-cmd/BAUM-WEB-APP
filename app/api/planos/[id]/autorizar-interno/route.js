import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") {
    return NextResponse.json({ error: "Solo gerentes pueden autorizar internamente" }, { status: 403 });
  }

  const { id } = await params;
  const planoId = parseInt(id);
  if (isNaN(planoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const gerenteId = parseInt(sesion.user.id);

  try {
    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: {
        clave: {
          include: {
            proyecto: {
              include: {
                gerentes: { select: { usuarioId: true } },
              },
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

    const yaAutorizo = plano.autorizacionesInternas.some((a) => a.gerenteId === gerenteId);
    if (yaAutorizo) {
      return NextResponse.json({ error: "Ya autorizaste este plano" }, { status: 409 });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const auth = await tx.autorizacionInterna.create({
        data: {
          planoId,
          gerenteId,
          decision: "APROBADO",
        },
      });

      const totalGerentes = plano.clave.proyecto.gerentes.length;
      const totalAutorizados = plano.autorizacionesInternas.length + 1;
      const todosAutorizaron = totalAutorizados >= totalGerentes;

      if (todosAutorizaron) {
        await tx.clave.update({
          where: { id: plano.claveId },
          data: { estatus: "ENVIADO" },
        });
      }

      return {
        auth,
        totalAutorizados,
        totalGerentes,
        ...(todosAutorizaron
          ? { clienteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/cliente/${plano.clave.proyecto.pinAcceso}` }
          : {}),
      };
    });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[POST /api/planos/[id]/autorizar-interno]", error);
    return NextResponse.json({ error: "Error al autorizar el plano" }, { status: 500 });
  }
}