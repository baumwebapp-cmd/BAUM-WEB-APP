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

export async function GET(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") {
    return NextResponse.json({ error: "Solo gerentes pueden ver usuarios" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rol = searchParams.get("rol");
  const soloActivos = searchParams.get("activos") === "true";

  try {
    const where = {};
    if (rol && ROLES_VALIDOS.includes(rol)) where.rol = rol;
    if (soloActivos) where.activo = true;

    const usuarios = await prisma.usuario.findMany({
      where,
      select: SELECT_USUARIO,
      orderBy: [{ rol: "asc" }, { nombre: "asc" }],
    });

    return NextResponse.json(usuarios);
  } catch (error) {
    console.error("[GET /api/usuarios]", error);
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}

export async function POST(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") {
    return NextResponse.json({ error: "Solo gerentes pueden crear usuarios" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, email, password, rol } = body;

    if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: "El email es requerido" }, { status: 400 });
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    if (!ROLES_VALIDOS.includes(rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const emailNorm = email.trim().toLowerCase();
    const existe = await prisma.usuario.findUnique({ where: { email: emailNorm } });
    if (existe) return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);

    const usuario = await prisma.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: emailNorm,
        password: passwordHash,
        rol,
      },
      select: SELECT_USUARIO,
    });

    return NextResponse.json(usuario, { status: 201 });
  } catch (error) {
    console.error("[POST /api/usuarios]", error);
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
