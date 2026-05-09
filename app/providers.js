"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

function ControladorSesion({ children }) {
  const { data: sesion, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const esRutaPublica =
    pathname.startsWith("/login") ||
    pathname.startsWith("/cliente");

  useEffect(() => {
    if (esRutaPublica) return;
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace("/login?razon=sesion-expirada");
    }
  }, [status, esRutaPublica, router]);

  return children;
}

export default function Providers({ children }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <ControladorSesion>{children}</ControladorSesion>
    </SessionProvider>
  );
}
