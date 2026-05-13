import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  obtenerIp,
  verificarLimiteCliente,
  registrarIntentoCliente,
  respuestaBloqueado,
} from "@/lib/rateLimit";

export async function GET(req, { params }) {
  const { pin } = await params;
  const ip = obtenerIp(req);

  const limite = await verificarLimiteCliente(ip);
  if (limite.bloqueado) return respuestaBloqueado(limite.segundosRestantes);

  if (!/^\d{6}$/.test(pin)) {
    await registrarIntentoCliente(ip, pin, false);
    return NextResponse.json({ error: "PIN inválido" }, { status: 400 });
  }

  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { pinAcceso: pin },
      select: {
        id: true,
        nombre: true,
        cliente: { select: { nombre: true, nombreCorto: true } },
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
      await registrarIntentoCliente(ip, pin, false);
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    await registrarIntentoCliente(ip, pin, true);

    const ESTATUS_VISIBLES = ["ENVIADO", "AUTORIZADO", "LIBERADO", "EN_PRODUCCION"];
    const clavesVisibles = proyecto.claves.filter((c) => ESTATUS_VISIBLES.includes(c.estatus));

    const clienteNombre = proyecto.cliente?.nombre || proyecto.cliente?.nombreCorto || "Sin cliente";

    return NextResponse.json({ ...proyecto, clienteNombre, claves: clavesVisibles });
  } catch (error) {
    console.error("[GET /api/cliente/[pin]]", error);
    return NextResponse.json({ error: "Error al cargar el proyecto" }, { status: 500 });
  }
}