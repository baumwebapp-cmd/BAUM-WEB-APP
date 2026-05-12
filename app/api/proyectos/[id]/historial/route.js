import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") {
    return NextResponse.json({ error: "Solo gerentes pueden ver el historial" }, { status: 403 });
  }

  const { id } = await params;
  const proyectoId = parseInt(id);
  if (isNaN(proyectoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        nombre: true,
        clienteNombre: true,
        gerentes: { select: { usuarioId: true } },
      },
    });

    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const totalGerentes = proyecto.gerentes.length;

    const claves = await prisma.clave.findMany({
      where: { proyectoId },
      include: {
        planos: {
          include: {
            subidoPor: { select: { nombre: true } },
            autorizacionesInternas: {
              include: { gerente: { select: { nombre: true } } },
              orderBy: { createdAt: "asc" },
            },
            autorizacionCliente: {
              select: {
                decision: true,
                firmadoPor: true,
                comentarios: true,
                urlPdfFirmado: true,
                createdAt: true,
              },
            },
          },
          orderBy: { version: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const eventos = [];

    for (const clave of claves) {
      for (const plano of clave.planos) {
        eventos.push({
          tipo: "PLANO_SUBIDO",
          descripcion: `${plano.subidoPor.nombre} subió el plano v${plano.version} de ${clave.codigo}`,
          responsable: plano.subidoPor.nombre,
          comentarios: null,
          clave: clave.codigo,
          fecha: plano.createdAt,
        });

        let aprobados = 0;
        let ultimaAprobacion = null;

        for (const auth of plano.autorizacionesInternas) {
          if (auth.decision === "APROBADO") {
            aprobados++;
            ultimaAprobacion = auth.createdAt;
            eventos.push({
              tipo: "AUTH_INTERNA_APROBADA",
              descripcion: `${auth.gerente.nombre} autorizó internamente ${clave.codigo}`,
              responsable: auth.gerente.nombre,
              comentarios: null,
              clave: clave.codigo,
              fecha: auth.createdAt,
            });
          } else {
            eventos.push({
              tipo: "AUTH_INTERNA_RECHAZADA",
              descripcion: `${auth.gerente.nombre} rechazó internamente ${clave.codigo}`,
              responsable: auth.gerente.nombre,
              comentarios: auth.comentarios || null,
              clave: clave.codigo,
              fecha: auth.createdAt,
            });
          }
        }

        // Sintetizado: cuando el último gerente aprueba → enviado al cliente
        if (totalGerentes > 0 && aprobados >= totalGerentes && ultimaAprobacion) {
          eventos.push({
            tipo: "ENVIADO_CLIENTE",
            descripcion: `Plano ${clave.codigo} enviado al cliente`,
            responsable: "Sistema",
            comentarios: null,
            clave: clave.codigo,
            fecha: ultimaAprobacion,
          });
        }

        if (plano.autorizacionCliente) {
          const ac = plano.autorizacionCliente;
          if (ac.decision === "APROBADO") {
            eventos.push({
              tipo: "CLIENTE_APROBO",
              descripcion: `Cliente aprobó ${clave.codigo} — firmado por: ${ac.firmadoPor}`,
              responsable: ac.firmadoPor,
              comentarios: null,
              urlPdfFirmado: ac.urlPdfFirmado || null,
              clave: clave.codigo,
              fecha: ac.createdAt,
            });
          } else {
            eventos.push({
              tipo: "CLIENTE_RECHAZO",
              descripcion: `Cliente rechazó ${clave.codigo}`,
              responsable: ac.firmadoPor,
              comentarios: ac.comentarios || null,
              clave: clave.codigo,
              fecha: ac.createdAt,
            });
          }
        }
      }
    }

    eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return NextResponse.json({
      nombre: proyecto.nombre,
      clienteNombre: proyecto.clienteNombre,
      eventos,
    });
  } catch (error) {
    console.error("[GET /api/proyectos/[id]/historial]", error);
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 });
  }
}
