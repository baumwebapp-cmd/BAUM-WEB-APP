import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ROLES_PUEDEN_CREAR = ["DUENO", "SUPERADMIN", "GERENTE"];

function generarPIN() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const INCLUDE_PROYECTO = {
  gerentes: { include: { usuario: { select: { id: true, nombre: true, email: true } } } },
  claves: { select: { id: true, estatus: true, codigo: true, updatedAt: true } },
};

export async function GET(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const proyectos = await prisma.proyecto.findMany({
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
    const { nombre, clienteNombre, gerentesIds = [] } = body;

    if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    if (!clienteNombre?.trim()) return NextResponse.json({ error: "El nombre del cliente es requerido" }, { status: 400 });
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
        clienteNombre: clienteNombre.trim(),
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
