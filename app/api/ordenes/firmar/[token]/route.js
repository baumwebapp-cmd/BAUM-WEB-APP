import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const INCLUDE_ORDEN = {
  partidas: true,
  firmas: true,
  fotos: true,
};

export async function GET(req, { params }) {
  const { token } = await params;

  try {
    const registro = await prisma.tokenFirma.findUnique({
      where: { token },
      include: { orden: { include: INCLUDE_ORDEN } },
    });

    if (!registro) {
      return NextResponse.json({ error: "Token inválido o no encontrado" }, { status: 404 });
    }
    if (registro.usado) {
      return NextResponse.json({ error: "Este enlace de firma ya fue utilizado" }, { status: 409 });
    }
    if (!registro.orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (registro.orden.cancelada) {
      return NextResponse.json({ error: "La orden fue cancelada" }, { status: 409 });
    }

    return NextResponse.json({
      rol: registro.rol,
      orden: registro.orden,
      firmas: registro.orden.firmas.map((f) => ({
        rol: f.rol,
        firmada: !!(f.imagen || f.fecha),
        nombre: f.nombre,
        empresa: f.empresa,
        fecha: f.fecha,
      })),
    });
  } catch (error) {
    console.error("[GET /api/ordenes/firmar/[token]]", error);
    return NextResponse.json({ error: "Error al obtener la orden" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { token } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { nombre, empresa, imagen } = body;

  if (!nombre?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (!imagen) {
    return NextResponse.json({ error: "La firma es obligatoria" }, { status: 400 });
  }

  try {
    const registro = await prisma.tokenFirma.findUnique({ where: { token } });

    if (!registro) {
      return NextResponse.json({ error: "Token inválido o no encontrado" }, { status: 404 });
    }
    if (registro.usado) {
      return NextResponse.json({ error: "Este enlace de firma ya fue utilizado" }, { status: 409 });
    }

    const orden = await prisma.ordenCambio.findUnique({
      where: { id: registro.ordenId },
      select: { id: true, cancelada: true },
    });
    if (!orden) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (orden.cancelada) {
      return NextResponse.json({ error: "La orden fue cancelada" }, { status: 409 });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.tokenFirma.update({
        where: { token },
        data: { usado: true },
      });

      const firma = await tx.firma.upsert({
        where: { ordenId_rol: { ordenId: registro.ordenId, rol: registro.rol } },
        update: {
          nombre: nombre.trim(),
          empresa: empresa?.trim() || null,
          imagen,
          fecha: new Date(),
        },
        create: {
          ordenId: registro.ordenId,
          rol: registro.rol,
          nombre: nombre.trim(),
          empresa: empresa?.trim() || null,
          imagen,
          fecha: new Date(),
        },
      });

      return firma;
    });

    return NextResponse.json({ ok: true, firma: resultado });
  } catch (error) {
    console.error("[POST /api/ordenes/firmar/[token]]", error);
    return NextResponse.json({ error: "Error al registrar la firma" }, { status: 500 });
  }
}
