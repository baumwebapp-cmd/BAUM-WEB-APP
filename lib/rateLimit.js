import { prisma } from "./prisma";

const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 10;

export function obtenerIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "desconocida"
  );
}

export async function verificarLimiteCliente(ip) {
  const desde = new Date(Date.now() - VENTANA_MS);
  try {
    const fallidos = await prisma.intentoAccesoCliente.findMany({
      where: { ip, exitoso: false, createdAt: { gte: desde } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: MAX_INTENTOS,
    });

    if (fallidos.length >= MAX_INTENTOS) {
      const masAntiguo = fallidos[fallidos.length - 1].createdAt.getTime();
      const liberacion = masAntiguo + VENTANA_MS;
      const restante = Math.max(1, Math.ceil((liberacion - Date.now()) / 1000));
      return { bloqueado: true, segundosRestantes: restante };
    }
    return { bloqueado: false };
  } catch (error) {
    console.error("[rateLimit] verificarLimiteCliente", error);
    return { bloqueado: false };
  }
}

export async function registrarIntentoCliente(ip, pin, exitoso) {
  try {
    await prisma.intentoAccesoCliente.create({
      data: { ip, pin: (pin || "").slice(0, 6), exitoso },
    });
    if (exitoso) {
      const desde = new Date(Date.now() - VENTANA_MS);
      await prisma.intentoAccesoCliente.deleteMany({
        where: { ip, exitoso: false, createdAt: { gte: desde } },
      });
    }
  } catch (error) {
    console.error("[rateLimit] registrarIntentoCliente", error);
  }
}

export function respuestaBloqueado(segundosRestantes) {
  return new Response(
    JSON.stringify({
      error: "Demasiados intentos. Intenta más tarde.",
      segundosRestantes,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(segundosRestantes),
        "Cache-Control": "no-store",
      },
    }
  );
}
