"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

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
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#212121" }}>
        Algo salió mal
      </p>
      <p style={{ margin: "8px 0 28px", fontSize: 13, color: "#888888", textAlign: "center", maxWidth: 360, lineHeight: 1.55 }}>
        Ocurrió un error inesperado. Si persiste, contacta al administrador del sistema.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => reset()}
          style={{
            background: "#c9a84c",
            color: "#212121",
            border: "none",
            padding: "10px 22px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
        <a
          href="/login"
          style={{
            background: "#ffffff",
            color: "#555555",
            border: "1px solid #e5e5e5",
            padding: "10px 22px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
