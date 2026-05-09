import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") {
    return NextResponse.json({ error: "Solo gerentes pueden ver el resumen" }, { status: 403 });
  }

  try {
    const ahora = Date.now();
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [proyectosActivos, enProduccion, pendientesAccion, completadasEsteMes] = await Promise.all([
      prisma.proyecto.count({ where: { estatus: "ACTIVO" } }),
      prisma.clave.count({ where: { estatus: "EN_PRODUCCION" } }),
      prisma.clave.count({
        where: { estatus: { in: ["BORRADOR", "RECHAZADO", "REVISION_INTERNA", "ENVIADO", "AUTORIZADO"] } },
      }),
      prisma.clave.count({
        where: { estatus: { in: ["LIBERADO", "EN_PRODUCCION"] }, updatedAt: { gte: inicioMes } },
      }),
    ]);

    const proyectosRaw = await prisma.proyecto.findMany({
      where: { estatus: "ACTIVO" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nombre: true,
        clienteNombre: true,
        claves: {
          select: {
            estatus: true,
            updatedAt: true,
            planos: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { createdAt: true },
            },
          },
        },
      },
    });

    const ESTATUS_ACTIVOS = ["BORRADOR", "RECHAZADO", "REVISION_INTERNA", "ENVIADO", "AUTORIZADO"];
    const ESTATUS_TERMINADOS = ["LIBERADO", "EN_PRODUCCION"];

    const proyectos = proyectosRaw.map((p) => {
      const total = p.claves.length;
      const completadas = p.claves.filter((c) => ESTATUS_TERMINADOS.includes(c.estatus)).length;

      let semaforo = "verde";
      for (const clave of p.claves) {
        if (!ESTATUS_ACTIVOS.includes(clave.estatus)) continue;
        const fechaClave = new Date(clave.updatedAt);
        const fechaPlano = clave.planos[0] ? new Date(clave.planos[0].createdAt) : null;
        const fechaRef = fechaPlano && fechaPlano > fechaClave ? fechaPlano : fechaClave;
        const hrs = (ahora - fechaRef.getTime()) / 3600000;
        if (hrs >= 48) { semaforo = "rojo"; break; }
        if (hrs >= 24 && semaforo !== "rojo") semaforo = "amarillo";
      }

      const estatuses = new Set(p.claves.map((c) => c.estatus));
      let etapa = "En producción ✓";
      if (estatuses.has("BORRADOR") || estatuses.has("RECHAZADO")) etapa = "Diseño pendiente";
      else if (estatuses.has("REVISION_INTERNA")) etapa = "Revisión interna";
      else if (estatuses.has("ENVIADO")) etapa = "Esperando cliente";
      else if (estatuses.has("AUTORIZADO")) etapa = "Pendiente costos";

      return { id: p.id, nombre: p.nombre, clienteNombre: p.clienteNombre, total, completadas, semaforo, etapa };
    });

    const ordenSemaforo = { rojo: 0, amarillo: 1, verde: 2 };
    proyectos.sort((a, b) => ordenSemaforo[a.semaforo] - ordenSemaforo[b.semaforo]);

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
        descripcion: `${p.subidoPor.nombre} subió plano v${p.version} de ${p.clave.codigo}`,
        responsable: p.subidoPor.nombre,
        proyecto: p.clave.proyecto.nombre,
        fecha: p.createdAt,
      });
    }
    for (const a of autsInternas) {
      const accion = a.decision === "APROBADO" ? "autorizó internamente" : "rechazó internamente";
      eventos.push({
        tipo: a.decision === "APROBADO" ? "AUTH_INTERNA_APROBADA" : "AUTH_INTERNA_RECHAZADA",
        descripcion: `${a.gerente.nombre} ${accion} ${a.plano.clave.codigo}`,
        responsable: a.gerente.nombre,
        proyecto: a.plano.clave.proyecto.nombre,
        fecha: a.createdAt,
      });
    }
    for (const a of autsCliente) {
      const accion = a.decision === "APROBADO" ? "aprobó" : "rechazó";
      eventos.push({
        tipo: a.decision === "APROBADO" ? "CLIENTE_APROBO" : "CLIENTE_RECHAZO",
        descripcion: `${a.firmadoPor} (cliente) ${accion} ${a.plano.clave.codigo}`,
        responsable: a.firmadoPor,
        proyecto: a.plano.clave.proyecto.nombre,
        fecha: a.createdAt,
      });
    }

    eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return NextResponse.json({
      metricas: { proyectosActivos, enProduccion, pendientesAccion, completadasEsteMes },
      proyectos,
      actividadReciente: eventos.slice(0, 8),
    });
  } catch (error) {
    console.error("[GET /api/dashboard/resumen]", error);
    return NextResponse.json({ error: "Error al obtener resumen" }, { status: 500 });
  }
}
