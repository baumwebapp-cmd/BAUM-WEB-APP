import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ROLES_PUEDEN_GESTIONAR = ["DUENO", "SUPERADMIN"];

const SELECT_CLIENTE = {
  id: true,
  nombre: true,
  nombreCorto: true,
  descripcion: true,
  razonSocial: true,
  rfc: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      select: SELECT_CLIENTE,
      orderBy: { nombre: "asc" },
    });
    return NextResponse.json(clientes);
  } catch (error) {
    console.error("[GET /api/clientes]", error);
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
  }
}

export async function POST(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_PUEDEN_GESTIONAR.includes(sesion.user.rol)) {
    return NextResponse.json({ error: "Sin permiso para crear clientes" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, nombreCorto, descripcion, razonSocial, rfc } = body;

    if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    if (!nombreCorto?.trim()) return NextResponse.json({ error: "El nombre corto es requerido" }, { status: 400 });

    const rfcLimpio = rfc?.trim().toUpperCase() || null;
    if (rfcLimpio && rfcLimpio.length > 13) {
      return NextResponse.json({ error: "El RFC no puede tener más de 13 caracteres" }, { status: 400 });
    }

    const cliente = await prisma.cliente.create({
      data: {
        nombre: nombre.trim(),
        nombreCorto: nombreCorto.trim(),
        descripcion: descripcion?.trim() || null,
        razonSocial: razonSocial?.trim() || null,
        rfc: rfcLimpio,
      },
      select: SELECT_CLIENTE,
    });

    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    console.error("[POST /api/clientes]", error);
    return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 });
  }
}
