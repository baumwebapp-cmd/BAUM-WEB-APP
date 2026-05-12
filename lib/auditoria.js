import { prisma } from "./prisma";

export function obtenerIpAuditoria(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

export async function registrarAuditoria(tx, datos) {
  const cliente = tx || prisma;
  try {
    await cliente.auditoriaAdmin.create({
      data: {
        usuarioId: datos.usuarioId ?? null,
        actor: datos.actor ?? null,
        accion: datos.accion,
        detalle: datos.detalle ?? null,
        ip: datos.ip ?? null,
      },
    });
  } catch (error) {
    console.error("[auditoria] error registrando", datos.accion, error);
  }
}
