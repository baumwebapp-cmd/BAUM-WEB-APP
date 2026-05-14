import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ROLES_PUEDEN_CREAR = ["DUENO", "SUPERADMIN"];

function generarPIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const INCLUDE_PROYECTO = {
  cliente: { select: { id: true, nombre: true, nombreCorto: true } },
  gerentes: { include: { usuario: { select: { id: true, nombre: true, email: true } } } },
  claves: { select: { id: true, estatus: true, codigo: true, updatedAt: true } },
};

export async function GET(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clienteIdParam = searchParams.get("clienteId");
  const where = {};
  if (clienteIdParam) {
    const clienteIdNum = parseInt(clienteIdParam);
    if (isNaN(clienteIdNum)) {
      return NextResponse.json({ error: "clienteId inválido" }, { status: 400 });
    }
    where.clienteId = clienteIdNum;
  }

  try {
    const proyectos = await prisma.proyecto.findMany({
      where,
      include: INCLUDE_PROYECTO,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(proyectos);
  } catch (error) {
    console.error("[GET /api/proyectos]", error);
    return NextResponse.json({ error: "Error al obtener proyectos" }, { status: 500 });
  }
}

export async function POST(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_PUEDEN_CREAR.includes(sesion.user.rol)) {
    return NextResponse.json({ error: "Sin permiso para crear proyectos" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, clienteId, clienteContacto, gerentesIds = [] } = body;

    if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    const clienteIdNum = clienteId != null ? parseInt(clienteId) : null;
    if (!clienteIdNum || isNaN(clienteIdNum)) {
      return NextResponse.json({ error: "Selecciona un cliente válido" }, { status: 400 });
    }
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteIdNum }, select: { id: true, activo: true } });
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    if (!cliente.activo) return NextResponse.json({ error: "El cliente está inactivo" }, { status: 400 });

    if (gerentesIds.length > 1) {
      return NextResponse.json({ error: "Solo se puede asignar un gerente por proyecto" }, { status: 400 });
    }

    let pinAcceso = generarPIN();
    let pinExiste = await prisma.proyecto.findUnique({ where: { pinAcceso } });
    while (pinExiste) {
      pinAcceso = generarPIN();
      pinExiste = await prisma.proyecto.findUnique({ where: { pinAcceso } });
    }

    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: nombre.trim(),
        clienteId: clienteIdNum,
        clienteContacto: clienteContacto?.trim() || null,
        pinAcceso,
        gerentes: {
          create: gerentesIds.map((id) => ({ usuarioId: parseInt(id) })),
        },
      },
      include: INCLUDE_PROYECTO,
    });

    return NextResponse.json(proyecto, { status: 201 });
  } catch (error) {
    console.error("[POST /api/proyectos]", error);
    return NextResponse.json({ error: "Error al crear el proyecto" }, { status: 500 });
  }
}
