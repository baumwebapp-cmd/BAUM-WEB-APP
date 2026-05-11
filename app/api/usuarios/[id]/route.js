import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const ROLES_GESTIONABLES_POR_SUPERADMIN = ["GERENTE", "DISENADOR", "COSTOS", "PRODUCCION"];

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

function puedeActuarSobre(rolActual, rolObjetivo, esElMismo) {
  if (rolObjetivo === "DUENO") return esElMismo;
  if (rolActual === "DUENO") return true;
  if (rolActual === "SUPERADMIN") {
    return ROLES_GESTIONABLES_POR_SUPERADMIN.includes(rolObjetivo);
  }
  return false;
}

export async function GET(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!puedeGestionarUsuarios(sesion.user.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;
  const usuarioId = parseInt(id);
  if (isNaN(usuarioId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_USUARIO });
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

  const rolActual = sesion.user.rol;
  const idActual = parseInt(sesion.user.id);

  const { id } = await params;
  const usuarioId = parseInt(id);
  if (isNaN(usuarioId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || null;

  try {
    const objetivo = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_USUARIO });
    if (!objetivo) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const esElMismo = usuarioId === idActual;

    if (!puedeActuarSobre(rolActual, objetivo.rol, esElMismo)) {
      return NextResponse.json({ error: "Sin permiso para modificar este usuario" }, { status: 403 });
    }

    const body = await req.json();
    const { nombre, email, rol, activo, passwordNuevo } = body;

    const datos = {};

    if (nombre !== undefined) datos.nombre = nombre.trim();

    if (email !== undefined) {
      const emailNorm = email.trim().toLowerCase();
      const existe = await prisma.usuario.findFirst({ where: { email: emailNorm, NOT: { id: usuarioId } } });
      if (existe) return NextResponse.json({ error: "Ese email ya está en uso" }, { status: 409 });
      datos.email = emailNorm;
    }

    if (rol !== undefined) {
      if (objetivo.rol === "DUENO" && !esElMismo) {
        return NextResponse.json({ error: "No se puede cambiar el rol del dueño" }, { status: 403 });
      }
      const rolesPermitidos = rolActual === "DUENO"
        ? ["SUPERADMIN", "GERENTE", "DISENADOR", "COSTOS", "PRODUCCION"]
        : ROLES_GESTIONABLES_POR_SUPERADMIN;
      if (!rolesPermitidos.includes(rol)) {
        return NextResponse.json({ error: "Rol inválido o sin permiso para asignarlo" }, { status: 400 });
      }
      datos.rol = rol;
    }

    if (activo !== undefined) {
      if (esElMismo && activo === false) {
        return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
      }
      if (objetivo.rol === "DUENO") {
        return NextResponse.json({ error: "La cuenta del dueño no puede desactivarse" }, { status: 403 });
      }
      datos.activo = activo;
    }

    if (passwordNuevo !== undefined) {
      if (passwordNuevo.length < 8) {
        return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
      }
      datos.password = await bcrypt.hash(passwordNuevo, 12);
    }

    const camposModificados = Object.keys(datos).filter((k) => k !== "password").join(", ");

    const usuario = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuario.update({
        where: { id: usuarioId },
        data: datos,
        select: SELECT_USUARIO,
      });
      await tx.auditoriaAdmin.create({
        data: {
          usuarioId: idActual,
          accion: activo !== undefined ? (activo ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO") : "EDITAR_USUARIO",
          detalle: `Modificó ${objetivo.email} — campos: ${camposModificados || "contraseña"}`,
          ip,
        },
      });
      return actualizado;
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

  const rolActual = sesion.user.rol;
  const idActual = parseInt(sesion.user.id);

  const { id } = await params;
  const usuarioId = parseInt(id);
  if (isNaN(usuarioId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  if (usuarioId === idActual) {
    return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || null;

  try {
    const objetivo = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: SELECT_USUARIO });
    if (!objetivo) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (objetivo.rol === "DUENO") {
      return NextResponse.json({ error: "La cuenta del dueño no puede desactivarse" }, { status: 403 });
    }

    if (!puedeActuarSobre(rolActual, objetivo.rol, false)) {
      return NextResponse.json({ error: "Sin permiso para desactivar este usuario" }, { status: 403 });
    }

    const usuario = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuario.update({
        where: { id: usuarioId },
        data: { activo: false },
        select: SELECT_USUARIO,
      });
      await tx.auditoriaAdmin.create({
        data: {
          usuarioId: idActual,
          accion: "DESACTIVAR_USUARIO",
          detalle: `Desactivó la cuenta de ${objetivo.email} (${objetivo.rol})`,
          ip,
        },
      });
      return actualizado;
    });

    return NextResponse.json(usuario);
  } catch (error) {
    console.error("[DELETE /api/usuarios/[id]]", error);
    return NextResponse.json({ error: "Error al desactivar usuario" }, { status: 500 });
  }
}
