import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { DIRECTORIO_PLANOS, leerArchivoPdf } from "@/lib/archivos";
import { registrarAuditoria, obtenerIpAuditoria } from "@/lib/auditoria";

export async function POST(req, { params }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (sesion.user.rol !== "GERENTE") {
    return NextResponse.json({ error: "Solo gerentes pueden autorizar internamente" }, { status: 403 });
  }

  const { id } = await params;
  const planoId = parseInt(id);
  if (isNaN(planoId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const gerenteId = parseInt(sesion.user.id);

  try {
    const plano = await prisma.plano.findUnique({
      where: { id: planoId },
      include: {
        clave: {
          include: {
            proyecto: {
              include: {
                gerentes: { select: { usuarioId: true } },
              },
            },
          },
        },
        autorizacionesInternas: { select: { gerenteId: true } },
      },
    });

    if (!plano) return NextResponse.json({ error: "Plano no encontrado" }, { status: 404 });

    if (plano.clave.estatus !== "REVISION_INTERNA") {
      return NextResponse.json({ error: "La clave no está en revisión interna" }, { status: 400 });
    }

    const asignado = plano.clave.proyecto.gerentes.some((g) => g.usuarioId === gerenteId);
    if (!asignado) {
      return NextResponse.json({ error: "No estás asignado como gerente de este proyecto" }, { status: 403 });
    }

    const yaAutorizo = plano.autorizacionesInternas.some((a) => a.gerenteId === gerenteId);
    if (yaAutorizo) {
      return NextResponse.json({ error: "Ya autorizaste este plano" }, { status: 409 });
    }

    const totalGerentes = plano.clave.proyecto.gerentes.length;
    const totalAutorizados = plano.autorizacionesInternas.length + 1;
    const todosAutorizaron = totalAutorizados >= totalGerentes;

    const ip = obtenerIpAuditoria(req);
    const detalleAuditoria = `Plano #${planoId} (clave ${plano.clave.codigo}) — autorización ${totalAutorizados}/${totalGerentes}${todosAutorizaron ? " (enviado al cliente)" : ""}`;

    const resultado = await prisma.$transaction(async (tx) => {
      const auth = await tx.autorizacionInterna.create({
        data: {
          planoId,
          gerenteId,
          decision: "APROBADO",
        },
      });

      if (todosAutorizaron) {
        await tx.clave.update({
          where: { id: plano.claveId },
          data: { estatus: "ENVIADO" },
        });
      }

      await registrarAuditoria(tx, {
        usuarioId: gerenteId,
        accion: todosAutorizaron ? "AUTORIZAR_INTERNO_FINAL" : "AUTORIZAR_INTERNO",
        detalle: detalleAuditoria,
        ip,
      });

      return { auth };
    });

    let urlPdfActualizada = null;

    if (todosAutorizaron && plano.urlPdf?.startsWith("/uploads/")) {
      try {
        const pdfBytes = await leerArchivoPdf(plano.urlPdf);
        if (!pdfBytes) throw new Error("PDF original no encontrado en almacenamiento");
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const clienteNombre = plano.clave.proyecto.clienteNombre;
        const fechaEnvio = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
        const textoMarca = `CONFIDENCIAL — ${clienteNombre} — ${fechaEnvio}`;

        const paginas = pdfDoc.getPages();
        for (const pagina of paginas) {
          const { width, height } = pagina.getSize();
          pagina.drawText(textoMarca, {
            x: width / 2 - 150,
            y: height / 2,
            size: 40,
            font: helveticaBold,
            color: rgb(0.8, 0.8, 0.8),
            opacity: 0.15,
            rotate: degrees(45),
          });
        }

        const pdfMarcaBytes = await pdfDoc.save();
        await mkdir(DIRECTORIO_PLANOS, { recursive: true });
        const nombreMarca = `plano-${planoId}-watermark-${Date.now()}.pdf`;
        const rutaMarca = path.join(DIRECTORIO_PLANOS, nombreMarca);
        await writeFile(rutaMarca, pdfMarcaBytes);
        urlPdfActualizada = `/uploads/planos/${nombreMarca}`;

        await prisma.plano.update({
          where: { id: planoId },
          data: { urlPdf: urlPdfActualizada },
        });
      } catch (errMarca) {
        console.error("[autorizar-interno] Error al aplicar marca de agua:", errMarca);
      }
    }

    return NextResponse.json({
      auth: resultado.auth,
      totalAutorizados,
      totalGerentes,
      ...(todosAutorizaron
        ? {
            clienteUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/cliente/${plano.clave.proyecto.pinAcceso}`,
            urlPdf: urlPdfActualizada,
          }
        : {}),
    });
  } catch (error) {
    console.error("[POST /api/planos/[id]/autorizar-interno]", error);
    return NextResponse.json({ error: "Error al autorizar el plano" }, { status: 500 });
  }
}
