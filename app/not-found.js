import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#f5f5f5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      color: "#212121",
    }}>
      <img
        src="/isotipo_baum.svg"
        alt="BAUM"
        style={{ height: 72, marginBottom: 28, filter: "grayscale(1) opacity(0.35)" }}
      />
      <p style={{ margin: 0, fontSize: 56, fontWeight: 800, color: "#212121", lineHeight: 1 }}>404</p>
      <p style={{ margin: "12px 0 6px", fontSize: 16, fontWeight: 600, color: "#212121" }}>
        Página no encontrada
      </p>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: "#888888", textAlign: "center", maxWidth: 340, lineHeight: 1.55 }}>
        La dirección que intentas abrir no existe o ya no está disponible.
      </p>
      <Link
        href="/login"
        style={{
          background: "#c9a84c",
          color: "#212121",
          padding: "10px 22px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Volver al inicio
      </Link>
    </div>
  );
}
