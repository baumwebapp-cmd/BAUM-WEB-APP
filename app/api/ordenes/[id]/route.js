import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const ROLES_GESTION = ["DUENO", "SUPERADMIN", "GERENTE"];
const ROLES_ELIMINAR = ["DUENO", "SUPERADMIN"];

const PREFIJO_TIPO = { cambio: "OC", extraordinaria: "OE", trabajo: "OT" };

const INCLUDE_ORDEN = {
  partidas: true,
  firmas: true,
  tokens: true,
  fotos: true,
};

function tieneFirmaClienteOVentas(firmas) {
  return (firmas || []).some(
    (f) => (f.rol === "cliente" || f.rol === "ventas") && (f.imagen || f.fecha)
  );
}

export async function GET(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  try {
    const orden = await prisma.ordenCambio.findUnique({
      where: { id },
      include: INCLUDE_ORDEN,
    });
    if (!orden) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    return NextResponse.json(orden);
  } catch (error) {
    console.error("[GET /api/ordenes/[id]]", error);
    return NextResponse.json({ error: "Error al obtener la orden" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_GESTION.includes(sesion.user.rol)) {
    return NextResponse.json({ error: "Sin permiso para editar órdenes" }, { status: 403 });
  }

  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  try {
    const orden = await prisma.ordenCambio.findUnique({
      where: { id },
      include: { firmas: true },
    });
    if (!orden) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    if (orden.cancelada) {
      return NextResponse.json({ error: "La orden está cancelada y no puede editarse" }, { status: 409 });
    }
    if (tieneFirmaClienteOVentas(orden.firmas)) {
      return NextResponse.json({ error: "La orden ya tiene firmas y no puede editarse" }, { status: 409 });
    }

    const {
      tipo,
      fechaSolicitud,
      solicitadaPor,
      generadaPor,
      ventasBaum,
      supervisorBaum,
      contacto,
      numeroContrato,
      concepto,
      partidas = [],
      ivaPorcentaje = orden.ivaPorcentaje,
      afectacionDias = orden.afectacionDias,
      requiereFirmaAdicional = orden.requiereFirmaAdicional,
      nombreFirmaAdicional,
      fotos = [],
    } = body;

    if (tipo && !PREFIJO_TIPO[tipo]) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    const partidasNorm = partidas.map((p) => {
      const precio = Number(p.precio) || 0;
      const cantidad = Number(p.cantidad) || 0;
      return {
        codigo: p.codigo?.trim() || null,
        concepto: (p.concepto || "").trim(),
        precio,
        cantidad,
        total: precio * cantidad,
      };
    });

    const total = partidasNorm.reduce((acc, p) => acc + p.total, 0);
    const ivaPct = Number(ivaPorcentaje) || 0;
    const ivaImporte = +(total * (ivaPct / 100)).toFixed(2);
    const neto = +(total + ivaImporte).toFixed(2);

    const conFirmaAdicional = requiereFirmaAdicional === true;
    const roles = ["cliente", "ventas", "supervisor"];
    if (conFirmaAdicional) roles.push("adicional");

    const actualizada = await prisma.$transaction(async (tx) => {
      await tx.partida.deleteMany({ where: { ordenId: id } });
      await tx.fotoOrden.deleteMany({ where: { ordenId: id } });
      await tx.tokenFirma.deleteMany({ where: { ordenId: id } });
      await tx.firma.deleteMany({ where: { ordenId: id } });

      return tx.ordenCambio.update({
        where: { id },
        data: {
          ...(tipo ? { tipo } : {}),
          ...(fechaSolicitud !== undefined ? { fechaSolicitud: fechaSolicitud?.trim() || orden.fechaSolicitud } : {}),
          ...(solicitadaPor !== undefined ? { solicitadaPor: solicitadaPor?.trim() || orden.solicitadaPor } : {}),
          ...(generadaPor !== undefined ? { generadaPor: generadaPor?.trim() || null } : {}),
          ...(ventasBaum !== undefined ? { ventasBaum: ventasBaum?.trim() || "" } : {}),
          ...(supervisorBaum !== undefined ? { supervisorBaum: supervisorBaum?.trim() || "" } : {}),
          ...(contacto !== undefined ? { contacto: contacto?.trim() || null } : {}),
          ...(numeroContrato !== undefined ? { numeroContrato: numeroContrato?.trim() || null } : {}),
          ...(concepto !== undefined ? { concepto: concepto?.trim() || orden.concepto } : {}),
          total,
          ivaPorcentaje: ivaPct,
          ivaImporte,
          neto,
          afectacionDias: parseInt(afectacionDias) || 0,
          requiereFirmaAdicional: conFirmaAdicional,
          nombreFirmaAdicional: conFirmaAdicional ? (nombreFirmaAdicional?.trim() || null) : null,
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
    });

    return NextResponse.json(actualizada);
  } catch (error) {
    console.error("[PUT /api/ordenes/[id]]", error);
    return NextResponse.json({ error: "Error al actualizar la orden" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!ROLES_ELIMINAR.includes(sesion.user.rol)) {
    return NextResponse.json({ error: "Sin permiso para eliminar órdenes" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const orden = await prisma.ordenCambio.findUnique({
      where: { id },
      include: { firmas: true },
    });
    if (!orden) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    if (tieneFirmaClienteOVentas(orden.firmas)) {
      return NextResponse.json({ error: "La orden tiene firmas y no puede eliminarse" }, { status: 409 });
    }

    await prisma.ordenCambio.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/ordenes/[id]]", error);
    return NextResponse.json({ error: "Error al eliminar la orden" }, { status: 500 });
  }
}
