import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const ROLES_VALIDOS_TODOS = ["DUENO", "SUPERADMIN", "GERENTE", "DISENADOR", "COSTOS"];
const ROLES_GESTIONABLES_POR_SUPERADMIN = ["GERENTE", "DISENADOR", "COSTOS"];

const SELECT_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
};

function puedeGestionarUsuarios(rol) {
  return rol === "DUENO" || rol === "SUPERADMIN";
}

function rolesVisiblesParaRol(rol) {
  if (rol === "DUENO") return ROLES_VALIDOS_TODOS;
  if (rol === "SUPERADMIN") return ROLES_GESTIONABLES_POR_SUPERADMIN;
  return null;
}

export async function GET(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rolActual = sesion.user.rol;
  const rolesVisibles = rolesVisiblesParaRol(rolActual);

  if (!rolesVisibles) {
    return NextResponse.json({ error: "Sin permiso para ver usuarios" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rolFiltro = searchParams.get("rol");
  const soloActivos = searchParams.get("activos") === "true";

  try {
    const where = { rol: { in: rolesVisibles } };
    if (rolFiltro && rolesVisibles.includes(rolFiltro)) where.rol = rolFiltro;
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

  const rolActual = sesion.user.rol;
  if (!puedeGestionarUsuarios(rolActual)) {
    return NextResponse.json({ error: "Sin permiso para crear usuarios" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || null;

  try {
    const body = await req.json();
    const { nombre, email, password, rol } = body;

    if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: "El email es requerido" }, { status: 400 });
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const rolesPermitidos = rolActual === "DUENO"
      ? ROLES_VALIDOS_TODOS.filter((r) => r !== "DUENO")
      : ROLES_GESTIONABLES_POR_SUPERADMIN;

    if (!rolesPermitidos.includes(rol)) {
      return NextResponse.json({ error: "Rol inválido o sin permiso para asignarlo" }, { status: 400 });
    }

    if (rol === "SUPERADMIN" && rolActual !== "DUENO") {
      return NextResponse.json({ error: "Solo el dueño puede crear superadmins" }, { status: 403 });
    }

    const emailNorm = email.trim().toLowerCase();
    const existe = await prisma.usuario.findUnique({ where: { email: emailNorm } });
    if (existe) return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);

    const usuario = await prisma.$transaction(async (tx) => {
      const nuevo = await tx.usuario.create({
        data: { nombre: nombre.trim(), email: emailNorm, password: passwordHash, rol },
        select: SELECT_USUARIO,
      });
      await tx.auditoriaAdmin.create({
        data: {
          usuarioId: parseInt(sesion.user.id),
          accion: "CREAR_USUARIO",
          detalle: `Creó usuario ${emailNorm} con rol ${rol}`,
          ip,
        },
      });
      return nuevo;
    });

    return NextResponse.json(usuario, { status: 201 });
  } catch (error) {
    console.error("[POST /api/usuarios]", error);
    return NextResponse.json({ error: "Error al crear usuario" }, { status: 500 });
  }
}
