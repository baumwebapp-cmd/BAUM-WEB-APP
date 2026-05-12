import { NextResponse } from "next/server";

const METODOS_MUTACION = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const RUTAS_EXENTAS = [
  /^\/api\/auth\//,
];

function originPermitido(req) {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (!host) return false;

  const fuentes = [origin, referer].filter(Boolean);
  if (fuentes.length === 0) return false;

  for (const fuente of fuentes) {
    try {
      const url = new URL(fuente);
      if (url.host === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) return NextResponse.next();
  if (!METODOS_MUTACION.has(req.method)) return NextResponse.next();
  if (RUTAS_EXENTAS.some((re) => re.test(pathname))) return NextResponse.next();

  if (!originPermitido(req)) {
    return NextResponse.json(
      { error: "Origen no permitido" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
