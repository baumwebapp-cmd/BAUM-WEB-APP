import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const ROLES_VALIDOS = ["GERENTE", "DISENADOR", "COSTOS", "PRODUCCION"];

const SELECT_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id }, select: SELECT_USUARIO });
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    return NextResponse.json(usuario);
  } catch (error) {
    console.error("[GET /api/usuarios/[id]]", error);
    return NextResponse.json({ error: "Error al obtener usuario" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const { nombre, email, rol, activo, passwordNuevo } = body;

    const datos = {};

    if (nombre !== undefined) datos.nombre = nombre.trim();

    if (email !== undefined) {
      const emailNorm = email.trim().toLowerCase();
      const existe = await prisma.usuario.findFirst({
        where: { email: emailNorm, NOT: { id } },
      });
      if (existe) return NextResponse.json({ error: "Ese email ya está en uso" }, { status: 409 });
      datos.email = emailNorm;
    }

    if (rol !== undefined) {
      if (!ROLES_VALIDOS.includes(rol)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      datos.rol = rol;
    }

    if (activo !== undefined) {
      if (activo === false && id === parseInt(sesion.user.id)) {
        return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
      }
      datos.activo = activo;
    }

    if (passwordNuevo !== undefined) {
      if (passwordNuevo.length < 8) {
        return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
      }
      datos.password = await bcrypt.hash(passwordNuevo, 12);
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: datos,
      select: SELECT_USUARIO,
    });

    return NextResponse.json(usuario);
  } catch (error) {
    console.error("[PATCH /api/usuarios/[id]]", error);
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  if (id === parseInt(sesion.user.id)) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  try {
    const usuario = await prisma.usuario.update({
      where: { id },
      data: { activo: false },
      select: SELECT_USUARIO,
    });
    return NextResponse.json(usuario);
  } catch (error) {
    console.error("[DELETE /api/usuarios/[id]]", error);
    return NextResponse.json({ error: "Error al desactivar usuario" }, { status: 500 });
  }
}
