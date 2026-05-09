import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const FROM = process.env.EMAIL_FROM || `BAUM <${process.env.GMAIL_USER}>`;

function plantillaBase({ titulo, mensaje, botonTexto, botonUrl, datos }) {
  const filasDatos = datos
    ? Object.entries(datos)
        .map(
          ([k, v]) => `
          <tr>
            <td style="padding:8px 0;color:#888888;font-size:13px;">${k}</td>
            <td style="padding:8px 0;color:#212121;font-size:14px;font-weight:600;text-align:right;">${v}</td>
          </tr>`
        )
        .join("")
    : "";

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${titulo}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <tr>
              <td style="background:#212121;padding:24px 32px;">
                <div style="color:#c9a84c;font-size:20px;font-weight:700;letter-spacing:1px;">BAUM</div>
                <div style="color:#888888;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Industria Carpintera</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px 0;color:#212121;font-size:20px;font-weight:600;">${titulo}</h1>
                <p style="margin:0 0 24px 0;color:#555555;font-size:15px;line-height:1.5;">${mensaje}</p>
                ${
                  filasDatos
                    ? `<table width="100%" style="border-top:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;margin:0 0 24px 0;">${filasDatos}</table>`
                    : ""
                }
                ${
                  botonUrl && botonTexto
                    ? `<table cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:#c9a84c;border-radius:8px;">
                            <a href="${botonUrl}" style="display:inline-block;padding:12px 24px;color:#212121;font-size:14px;font-weight:600;text-decoration:none;">${botonTexto}</a>
                          </td>
                        </tr>
                      </table>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e0e0e0;">
                <p style="margin:0;color:#888888;font-size:12px;">Este es un mensaje automático del Sistema BAUM. No responder a este correo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function enviar({ to, subject, html }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.warn("[email] GMAIL_USER/GMAIL_PASS no configurados, email omitido");
    return { ok: false, motivo: "smtp-no-configurado" };
  }

  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error("[email] Error enviando:", error);
    return { ok: false, error: error.message };
  }
}

export async function emailPlanoSubido({ destinatarios, proyecto, claveCodigo, claveDescripcion, version, subidoPor }) {
  const html = plantillaBase({
    titulo: "Nuevo plano pendiente de revisión",
    mensaje: `Se subió un plano que requiere tu autorización como gerente del proyecto.`,
    botonTexto: "Revisar plano",
    botonUrl: `${APP_URL}/dashboard/proyectos`,
    datos: {
      Proyecto: proyecto,
      Clave: claveCodigo,
      Descripción: claveDescripcion,
      Versión: `v${version}`,
      "Subido por": subidoPor,
    },
  });
  return enviar({
    to: destinatarios,
    subject: `[BAUM] Plano pendiente — ${claveCodigo} v${version}`,
    html,
  });
}

export async function emailClienteAutorizar({ destinatario, proyecto, pinAcceso, claveCodigo }) {
  const url = `${APP_URL}/cliente/${pinAcceso}`;
  const html = plantillaBase({
    titulo: "Plano listo para tu aprobación",
    mensaje: `El plano de la clave <strong>${claveCodigo}</strong> del proyecto <strong>${proyecto}</strong> está listo para tu revisión y firma. Ingresa al portal para aprobar o solicitar cambios.`,
    botonTexto: "Acceder al portal",
    botonUrl: url,
    datos: { Proyecto: proyecto, Clave: claveCodigo, "PIN de acceso": pinAcceso },
  });
  return enviar({
    to: destinatario,
    subject: `[BAUM] Plano listo para aprobación — ${claveCodigo}`,
    html,
  });
}

export async function emailClienteAprobo({ destinatarios, proyecto, claveCodigo, firmadoPor }) {
  const html = plantillaBase({
    titulo: "Plano aprobado por el cliente",
    mensaje: `El cliente firmó la aprobación del plano. Ya puede ser liberado a producción desde el sistema.`,
    botonTexto: "Liberar plano",
    botonUrl: `${APP_URL}/dashboard/proyectos`,
    datos: { Proyecto: proyecto, Clave: claveCodigo, "Firmado por": firmadoPor },
  });
  return enviar({
    to: destinatarios,
    subject: `[BAUM] Cliente aprobó — ${claveCodigo}`,
    html,
  });
}

export async function emailClienteRechazo({ destinatarios, proyecto, claveCodigo, comentarios }) {
  const html = plantillaBase({
    titulo: "El cliente rechazó el plano",
    mensaje: `El cliente solicitó cambios. Revisa los comentarios y sube una nueva versión.`,
    botonTexto: "Ver clave",
    botonUrl: `${APP_URL}/dashboard/proyectos`,
    datos: {
      Proyecto: proyecto,
      Clave: claveCodigo,
      Comentarios: comentarios || "Sin comentarios adicionales",
    },
  });
  return enviar({
    to: destinatarios,
    subject: `[BAUM] Cliente rechazó — ${claveCodigo}`,
    html,
  });
}

export async function emailPlanoLiberado({ destinatarios, proyecto, claveCodigo, liberadoPor }) {
  const html = plantillaBase({
    titulo: "Plano liberado a producción",
    mensaje: `Un plano fue liberado y está listo para iniciar fabricación.`,
    botonTexto: "Ver bandeja de producción",
    botonUrl: `${APP_URL}/dashboard`,
    datos: { Proyecto: proyecto, Clave: claveCodigo, "Liberado por": liberadoPor },
  });
  return enviar({
    to: destinatarios,
    subject: `[BAUM] Plano liberado — ${claveCodigo}`,
    html,
  });
}
