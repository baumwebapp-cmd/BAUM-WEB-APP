import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { emailClienteAutorizar } from "@/lib/email";

export async function POST(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") {
    return NextResponse.json({ error: "Solo gerentes pueden enviar al cliente" }, { status: 403 });
  }

  const planoId = parseInt(params.id);
  if (isNaN(planoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: {
        clave: {
          include: {
            proyecto: { select: { id: true, nombre: true, clienteNombre: true, clienteEmail: true, pinAcceso: true } },
          },
        },
        autorizacionesInternas: { select: { gerenteId: true } },
      },
    });

    if (!plano) return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });
    if (!plano.esActivo) return NextResponse.json({ error: "Solo se puede enviar el plano activo" }, { status: 400 });

    const clave = plano.clave;
    const proyecto = clave.proyecto;

    if (clave.estatus !== "REVISION_CLIENTE") {
      return NextResponse.json(
        { error: "La clave debe estar en REVISION_CLIENTE para enviar al cliente" },
        { status: 400 }
      );
    }

    /* Enviar email al cliente si tiene email registrado */
    let emailEnviado = false;
    if (proyecto.clienteEmail) {
      const resultado = await emailClienteAutorizar({
        proyecto,
        clave,
        plano,
        version: plano.version,
      }).catch((err) => { console.error("[email clienteAutorizar]", err); return { ok: false }; });
      emailEnviado = resultado?.ok ?? false;
    }

    /* Construir link de cliente */
    const urlCliente = `${process.env.NEXT_PUBLIC_APP_URL}/cliente/${proyecto.pinAcceso}`;

    return NextResponse.json({ ok: true, emailEnviado, urlCliente });
  } catch (error) {
    console.error("[POST /api/planos/[id]/enviar-cliente]", error);
    return NextResponse.json({ error: "Error al enviar al cliente" }, { status: 500 });
  }
}
