import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const [proyectosActivos, clientesActivos, clavesActivas, pendientesAccion] = await Promise.all([
      prisma.proyecto.count({ where: { estatus: "ACTIVO" } }),
      prisma.cliente.count({ where: { activo: true } }),
      prisma.clave.count(),
      prisma.clave.count({
        where: { estatus: { in: ["REVISION_INTERNA", "ENVIADO", "AUTORIZADO"] } },
      }),
    ]);

    const [planosRecientes, autsInternas, autsCliente] = await Promise.all([
      prisma.plano.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          createdAt: true,
          version: true,
          subidoPor: { select: { nombre: true } },
          clave: { select: { codigo: true, proyecto: { select: { nombre: true } } } },
        },
      }),
      prisma.autorizacionInterna.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          createdAt: true,
          decision: true,
          gerente: { select: { nombre: true } },
          plano: { select: { clave: { select: { codigo: true, proyecto: { select: { nombre: true } } } } } },
        },
      }),
      prisma.autorizacionCliente.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          createdAt: true,
          decision: true,
          firmadoPor: true,
          plano: { select: { clave: { select: { codigo: true, proyecto: { select: { nombre: true } } } } } },
        },
      }),
    ]);

    const eventos = [];

    for (const p of planosRecientes) {
      eventos.push({
        tipo: "PLANO_SUBIDO",
        descripcion: `${p.subidoPor.nombre} subió plano v${p.version} de ${p.clave.codigo} en ${p.clave.proyecto.nombre}`,
        fecha: p.createdAt,
        actor: p.subidoPor.nombre,
      });
    }

    for (const a of autsInternas) {
      const accion = a.decision === "APROBADO" ? "autorizó internamente" : "rechazó internamente";
      eventos.push({
        tipo: "AUTORIZACION_INTERNA",
        descripcion: `${a.gerente.nombre} ${accion} ${a.plano.clave.codigo} en ${a.plano.clave.proyecto.nombre}`,
        fecha: a.createdAt,
        actor: a.gerente.nombre,
      });
    }

    for (const a of autsCliente) {
      const accion = a.decision === "APROBADO" ? "aprobó" : "rechazó";
      eventos.push({
        tipo: "AUTORIZACION_CLIENTE",
        descripcion: `${a.firmadoPor} (cliente) ${accion} ${a.plano.clave.codigo} en ${a.plano.clave.proyecto.nombre}`,
        fecha: a.createdAt,
        actor: a.firmadoPor,
      });
    }

    eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return NextResponse.json({
      proyectosActivos,
      clientesActivos,
      clavesActivas,
      pendientesAccion,
      actividadReciente: eventos.slice(0, 8),
    });
  } catch (error) {
    console.error("[GET /api/dashboard/resumen]", error);
    return NextResponse.json({ error: "Error al obtener resumen" }, { status: 500 });
  }
}
