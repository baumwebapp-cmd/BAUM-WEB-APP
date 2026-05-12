import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const { pin } = await params;

  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "PIN inválido" }, { status: 400 });
  }

  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { pinAcceso: pin },
      select: {
        id: true,
        nombre: true,
        clienteNombre: true,
        clienteContacto: true,
        estatus: true,
        createdAt: true,
        claves: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            codigo: true,
            descripcion: true,
            estatus: true,
            planos: {
              take: 1,
              orderBy: { version: "desc" },
              select: {
                id: true,
                version: true,
                urlPdf: true,
                createdAt: true,
                subidoPor: { select: { nombre: true } },
                autorizacionCliente: {
                  select: {
                    id: true,
                    decision: true,
                    firmadoPor: true,
                    createdAt: true,
                    comentarios: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proyecto) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const ESTATUS_VISIBLES = ["ENVIADO", "AUTORIZADO", "LIBERADO", "EN_PRODUCCION"];
    const clavesVisibles = proyecto.claves.filter((c) => ESTATUS_VISIBLES.includes(c.estatus));

    return NextResponse.json({ ...proyecto, claves: clavesVisibles });
  } catch (error) {
    console.error("[GET /api/cliente/[pin]]", error);
    return NextResponse.json({ error: "Error al cargar el proyecto" }, { status: 500 });
  }
}