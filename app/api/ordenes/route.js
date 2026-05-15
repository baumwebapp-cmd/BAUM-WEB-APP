import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const ROLES_GESTION = ["DUENO", "SUPERADMIN", "GERENTE"];

const PREFIJO_TIPO = {
  cambio: "OC",
  extraordinaria: "OE",
  trabajo: "OT",
};

const INCLUDE_ORDEN = {
  partidas: true,
  firmas: true,
  tokens: true,
  fotos: true,
};

export async function GET(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const proyectoIdParam = searchParams.get("proyectoId");
  const tipoParam = searchParams.get("tipo");

  const where = {};
  if (proyectoIdParam) {
    const pid = parseInt(proyectoIdParam);
    if (isNaN(pid)) return NextResponse.json({ error: "proyectoId inválido" }, { status: 400 });
    where.proyectoId = pid;
  }
  if (tipoParam) {
    if (!PREFIJO_TIPO[tipoParam]) return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    where.tipo = tipoParam;
  }

  try {
    const ordenes = await prisma.ordenCambio.findMany({
      where,
      include: INCLUDE_ORDEN,
      orderBy: { creadoEn: "desc" },
    });
    return NextResponse.json(ordenes);
  } catch (error) {
    console.error("[GET /api/ordenes]", error);
    return NextResponse.json({ error: "Error al obtener órdenes" }, { status: 500 });
  }
}

export async function POST(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_GESTION.includes(sesion.user.rol)) {
    return NextResponse.json({ error: "Sin permiso para crear órdenes" }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    tipo,
    proyectoId,
    fechaSolicitud,
    solicitadaPor,
    generadaPor,
    ventasBaum,
    supervisorBaum,
    contacto,
    numeroContrato,
    concepto,
    partidas = [],
    ivaPorcentaje = 16,
    afectacionDias = 0,
    requiereFirmaAdicional = false,
    nombreFirmaAdicional,
    fotos = [],
  } = body;

  if (!tipo || !PREFIJO_TIPO[tipo]) {
    return NextResponse.json({ error: "tipo debe ser cambio, extraordinaria o trabajo" }, { status: 400 });
  }
  const pid = parseInt(proyectoId);
  if (isNaN(pid)) return NextResponse.json({ error: "proyectoId inválido" }, { status: 400 });
  if (!fechaSolicitud?.trim()) return NextResponse.json({ error: "fechaSolicitud es requerida" }, { status: 400 });
  if (!solicitadaPor?.trim()) return NextResponse.json({ error: "solicitadaPor es requerido" }, { status: 400 });
  if (!concepto?.trim()) return NextResponse.json({ error: "concepto es requerido" }, { status: 400 });

  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: pid },
      include: { cliente: { select: { nombre: true, nombreCorto: true } } },
    });
    if (!proyecto) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

    const clienteNombre = proyecto.cliente?.nombre || proyecto.cliente?.nombreCorto || "Sin cliente";

    const partidasNorm = partidas.map((p) => {
      const precio = Number(p.precio) || 0;
      const cantidad = Number(p.cantidad) || 0;
      const totalP = precio * cantidad;
      return {
        codigo: p.codigo?.trim() || null,
        concepto: (p.concepto || "").trim(),
        precio,
        cantidad,
        total: totalP,
      };
    });

    const total = partidasNorm.reduce((acc, p) => acc + p.total, 0);
    const ivaPct = Number(ivaPorcentaje) || 0;
    const ivaImporte = +(total * (ivaPct / 100)).toFixed(2);
    const neto = +(total + ivaImporte).toFixed(2);

    const consecutivo = await prisma.ordenCambio.count({ where: { proyectoId: pid } });
    const numOrden = `${PREFIJO_TIPO[tipo]}-${pid}-${String(consecutivo + 1).padStart(3, "0")}`;

    const conFirmaAdicional = requiereFirmaAdicional === true;
    const roles = ["cliente", "ventas", "supervisor"];
    if (conFirmaAdicional) roles.push("adicional");

    const orden = await prisma.ordenCambio.create({
      data: {
        id: randomUUID(),
        numOrden,
        tipo,
        proyectoId: pid,
        proyectoNombre: proyecto.nombre,
        clienteNombre,
        contacto: contacto?.trim() || null,
        supervisorBaum: supervisorBaum?.trim() || "",
        ventasBaum: ventasBaum?.trim() || "",
        generadaPor: generadaPor?.trim() || sesion.user?.nombre || null,
        fechaSolicitud: fechaSolicitud.trim(),
        solicitadaPor: solicitadaPor.trim(),
        concepto: concepto.trim(),
        total,
        ivaPorcentaje: ivaPct,
        ivaImporte,
        neto,
        afectacionDias: parseInt(afectacionDias) || 0,
        requiereFirmaAdicional: conFirmaAdicional,
        nombreFirmaAdicional: conFirmaAdicional ? (nombreFirmaAdicional?.trim() || null) : null,
        numeroContrato: numeroContrato?.trim() || null,
        partidas: { create: partidasNorm },
        fotos: {
          create: fotos
            .filter((f) => f?.dataUrl)
            .map((f) => ({ dataUrl: f.dataUrl, nota: f.nota?.trim() || null })),
        },
        firmas: { create: roles.map((rol) => ({ rol })) },
        tokens: { create: roles.map((rol) => ({ rol, token: randomUUID() })) },
      },
      include: INCLUDE_ORDEN,
    });

    return NextResponse.json(orden, { status: 201 });
  } catch (error) {
    console.error("[POST /api/ordenes]", error);
    return NextResponse.json({ error: "Error al crear la orden" }, { status: 500 });
  }
}
