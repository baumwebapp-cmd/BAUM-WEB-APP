import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: usuarioId, rol } = sesion.user;

  if (rol !== "GERENTE" && rol !== "DISENADOR") {
    return NextResponse.json({ error: "Sin permiso para subir planos" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const archivo = formData.get("file");
    const claveId = parseInt(formData.get("claveId"));

    if (!archivo || typeof archivo === "string") {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }
    if (isNaN(claveId)) {
      return NextResponse.json({ error: "claveId inválido" }, { status: 400 });
    }
    if (archivo.type !== "application/pdf") {
      return NextResponse.json({ error: "Solo se permiten archivos PDF" }, { status: 400 });
    }
    if (archivo.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no puede superar 50 MB" }, { status: 400 });
    }

    const clave = await prisma.clave.findUnique({
      where: { id: claveId },
      include: {
        proyecto: {
          include: {
            gerentes: { include: { usuario: { select: { id: true, nombre: true, email: true } } } },
          },
        },
      },
    });

    if (!clave) return NextResponse.json({ error: "Clave no encontrada" }, { status: 404 });

    const estatusPermitidos = ["BORRADOR", "REVISION_INTERNA", "RECHAZADO"];
    if (!estatusPermitidos.includes(clave.estatus)) {
      return NextResponse.json(
        { error: `No se puede subir un plano en estatus ${clave.estatus}` },
        { status: 400 }
      );
    }

    const ultimoPlano = await prisma.plano.findFirst({
      where: { claveId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nuevaVersion = (ultimoPlano?.version ?? 0) + 1;

    /* Convertir archivo a base64 para guardar temporalmente */
    const buffer = await archivo.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const urlPdf = `data:application/pdf;base64,${base64}`;

    const plano = await prisma.$transaction(async (tx) => {
      const nuevo = await tx.plano.create({
        data: {
          claveId,
          version: nuevaVersion,
          urlPdf,
          subidoPorId: parseInt(usuarioId),
        },
        include: {
          subidoPor: { select: { nombre: true } },
        },
      });

      await tx.clave.update({
        where: { id: claveId },
        data: { estatus: "REVISION_INTERNA" },
      });

      return nuevo;
    });

    return NextResponse.json(plano, { status: 201 });
  } catch (error) {
    console.error("[POST /api/planos]", error);
    return NextResponse.json({ error: "Error al procesar el plano" }, { status: 500 });
  }
}