import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
  obtenerIp,
  verificarLimiteCliente,
  registrarIntentoCliente,
  respuestaBloqueado,
} from "@/lib/rateLimit";

const SELECT_PLANO = {
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
      cargoFirmante: true,
      createdAt: true,
      comentarios: true,
    },
  },
};

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
    const proyectoPin = await prisma.proyecto.findUnique({
      where: { pinAcceso: pin },
      select: { id: true, clienteId: true },
    });

    if (!proyectoPin) {
      await registrarIntentoCliente(ip, pin, false);
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    await registrarIntentoCliente(ip, pin, true);

    const cliente = proyectoPin.clienteId
      ? await prisma.cliente.findUnique({
          where: { id: proyectoPin.clienteId },
          select: { nombre: true, nombreCorto: true },
        })
      : null;

    const proyectos = proyectoPin.clienteId
      ? await prisma.proyecto.findMany({
          where: { clienteId: proyectoPin.clienteId, estatus: "ACTIVO" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            nombre: true,
            claves: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                codigo: true,
                descripcion: true,
                estatus: true,
                planos: { take: 1, orderBy: { version: "desc" }, select: SELECT_PLANO },
              },
            },
          },
        })
      : await prisma.proyecto.findMany({
          where: { id: proyectoPin.id },
          select: {
            id: true,
            nombre: true,
            claves: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                codigo: true,
                descripcion: true,
                estatus: true,
                planos: { take: 1, orderBy: { version: "desc" }, select: SELECT_PLANO },
              },
            },
          },
        });

    const pendientes = [];
    const autorizados = [];
    const enProduccion = [];

    for (const proy of proyectos) {
      for (const clave of proy.claves) {
        const item = {
          id: clave.id,
          codigo: clave.codigo,
          descripcion: clave.descripcion,
          estatus: clave.estatus,
          proyectoId: proy.id,
          proyectoNombre: proy.nombre,
          plano: clave.planos[0] || null,
        };
        if (clave.estatus === "ENVIADO") pendientes.push(item);
        else if (clave.estatus === "AUTORIZADO" || clave.estatus === "LIBERADO") autorizados.push(item);
        else if (clave.estatus === "EN_PRODUCCION") enProduccion.push(item);
      }
    }

    return NextResponse.json({
      cliente: {
        nombre: cliente?.nombre || cliente?.nombreCorto || "Cliente",
        nombreCorto: cliente?.nombreCorto || cliente?.nombre || "Cliente",
      },
      pendientes,
      autorizados,
      enProduccion,
    });
  } catch (error) {
    console.error("[GET /api/cliente/[pin]]", error);
    return NextResponse.json({ error: "Error al cargar el proyecto" }, { status: 500 });
  }
}
