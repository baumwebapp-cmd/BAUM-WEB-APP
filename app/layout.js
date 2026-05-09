import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: {
    default: "BAUM Sistema",
    template: "%s | BAUM Sistema",
  },
  description: "Sistema de gestión de planos y aprobaciones — BAUM Industria Carpintera",
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
      <Providers>{children}</Providers>
    </body>
    </html>
  );
}
