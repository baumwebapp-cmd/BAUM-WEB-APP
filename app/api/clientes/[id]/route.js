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

export async function GET(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const clienteId = parseInt(id);
  if (isNaN(clienteId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: SELECT_CLIENTE });
    if (!cliente) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    return NextResponse.json(cliente);
  } catch (error) {
    console.error("[GET /api/clientes/[id]]", error);
    return NextResponse.json({ error: "Error al obtener cliente" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_PUEDEN_GESTIONAR.includes(sesion.user.rol)) {
    return NextResponse.json({ error: "Sin permiso para editar clientes" }, { status: 403 });
  }

  const { id } = await params;
  const clienteId = parseInt(id);
  if (isNaN(clienteId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const { nombre, nombreCorto, descripcion, razonSocial, rfc, activo } = body;

    const datos = {};
    if (nombre !== undefined) {
      if (!nombre.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
      datos.nombre = nombre.trim();
    }
    if (nombreCorto !== undefined) {
      if (!nombreCorto.trim()) return NextResponse.json({ error: "El nombre corto es requerido" }, { status: 400 });
      datos.nombreCorto = nombreCorto.trim();
    }
    if (descripcion !== undefined) datos.descripcion = descripcion?.trim() || null;
    if (razonSocial !== undefined) datos.razonSocial = razonSocial?.trim() || null;
    if (rfc !== undefined) {
      const rfcLimpio = rfc?.trim().toUpperCase() || null;
      if (rfcLimpio && rfcLimpio.length > 13) {
        return NextResponse.json({ error: "El RFC no puede tener más de 13 caracteres" }, { status: 400 });
      }
      datos.rfc = rfcLimpio;
    }
    if (activo !== undefined) datos.activo = !!activo;

    const cliente = await prisma.cliente.update({
      where: { id: clienteId },
      data: datos,
      select: SELECT_CLIENTE,
    });

    return NextResponse.json(cliente);
  } catch (error) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    console.error("[PATCH /api/clientes/[id]]", error);
    return NextResponse.json({ error: "Error al actualizar cliente" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_PUEDEN_GESTIONAR.includes(sesion.user.rol)) {
    return NextResponse.json({ error: "Sin permiso para desactivar clientes" }, { status: 403 });
  }

  const { id } = await params;
  const clienteId = parseInt(id);
  if (isNaN(clienteId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const cliente = await prisma.cliente.update({
      where: { id: clienteId },
      data: { activo: false },
      select: SELECT_CLIENTE,
    });
    return NextResponse.json(cliente);
  } catch (error) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    console.error("[DELETE /api/clientes/[id]]", error);
    return NextResponse.json({ error: "Error al desactivar cliente" }, { status: 500 });
  }
}
