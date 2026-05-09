import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  const { id } = await params;
  const planoId = parseInt(id);
  if (isNaN(planoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { decision, firmadoPor, firmaBase64, comentarios } = body;

  if (!decision || !["APROBADO", "RECHAZADO"].includes(decision)) {
    return NextResponse.json({ error: "decision debe ser APROBADO o RECHAZADO" }, { status: 400 });
  }
  if (decision === "APROBADO") {
    if (!firmadoPor?.trim()) {
      return NextResponse.json({ error: "El nombre del firmante es obligatorio" }, { status: 400 });
    }
    if (!firmaBase64) {
      return NextResponse.json({ error: "La firma es obligatoria para aprobar" }, { status: 400 });
    }
  }
  if (decision === "RECHAZADO") {
    if (!comentarios?.trim() || comentarios.trim().length < 10) {
      return NextResponse.json({ error: "Los comentarios son obligatorios (mínimo 10 caracteres)" }, { status: 400 });
    }
  }

  const ipCliente =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;

  try {
    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: {
        clave: { select: { id: true, estatus: true } },
        autorizacionCliente: { select: { id: true } },
      },
    });

    if (!plano) return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });

    if (plano.clave.estatus !== "ENVIADO") {
      return NextResponse.json({ error: "La clave no está en estatus ENVIADO" }, { status: 400 });
    }

    if (plano.autorizacionCliente) {
      return NextResponse.json({ error: "Este plano ya tiene una respuesta del cliente" }, { status: 409 });
    }

    const nuevoEstatus = decision === "APROBADO" ? "AUTORIZADO" : "RECHAZADO";

    await prisma.$transaction(async (tx) => {
      await tx.autorizacionCliente.create({
        data: {
          planoId,
          decision,
          firmadoPor: decision === "APROBADO" ? firmadoPor.trim() : "Cliente",
          firmaBase64: firmaBase64 || null,
          comentarios: comentarios?.trim() || null,
          ipCliente,
        },
      });
      await tx.clave.update({
        where: { id: plano.claveId },
        data: { estatus: nuevoEstatus },
      });
    });

    return NextResponse.json({ ok: true, estatus: nuevoEstatus });
  } catch (error) {
    console.error("[POST /api/planos/[id]/autorizar-cliente]", error);
    return NextResponse.json({ error: "Error al procesar la autorización" }, { status: 500 });
  }
}
