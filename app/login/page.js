"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    procesarLogin();
  }

  async function procesarLogin() {
    setCargando(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Correo o contraseña incorrectos.");
      setCargando(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "row",
      background: "#ffffff",
    }}>

      {/* Panel izquierdo — decorativo */}
      <div style={{
        flex: 1,
        background: "#212121",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        minHeight: "100vh",
      }} className="hidden md:flex">

        {/* Círculos decorativos */}
        <div style={{
          position: "absolute", width: 500, height: 500,
          borderRadius: "50%", border: "1px solid rgba(201,168,76,0.15)",
          top: -100, left: -150,
        }} />
        <div style={{
          position: "absolute", width: 350, height: 350,
          borderRadius: "50%", border: "1px solid rgba(201,168,76,0.1)",
          top: 80, left: -80,
        }} />
        <div style={{
          position: "absolute", width: 200, height: 200,
          borderRadius: "50%", border: "1px solid rgba(201,168,76,0.12)",
          bottom: 120, left: 60,
        }} />
        <div style={{
          position: "absolute", width: 120, height: 120,
          borderRadius: "50%", border: "1px solid rgba(201,168,76,0.2)",
          bottom: 60, right: 80,
        }} />
        <div style={{
          position: "absolute", width: 280, height: 280,
          borderRadius: "50%",
          background: "rgba(201,168,76,0.04)",
          bottom: -80, right: -80,
        }} />

        {/* Logo texto centrado */}
        <div style={{ textAlign: "center", zIndex: 1 }}>
          <Image
            src="/baum_logo_bco.svg"
            alt="Baum Industria Carpintera"
            width={380}
            height={200}
            style={{ objectFit: "contain" }}
          />
          <p style={{
            color: "rgba(201,168,76,0.7)",
            fontSize: 11,
            letterSpacing: "0.3em",
            marginTop: 20,
            textTransform: "uppercase",
          }}>
            Sistema de gestión
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={{
        width: "100%",
        maxWidth: 480,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 32px",
        background: "#ffffff",
        position: "relative",
      }}>

        {/* Ícono circular con logo B */}
        <div style={{
          width: 90, height: 90,
          borderRadius: "50%",
          background: "#212121",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 28,
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          overflow: "hidden",
          padding: 16,
        }}>
          <Image
            src="/isotipo_baum_bco.svg"
            alt="Baum"
            width={58}
            height={58}
            style={{ objectFit: "contain" }}
          />
        </div>

         <h2 style={{
          fontSize: 22,
          fontWeight: 500,
          color: "#212121",
          marginBottom: 6,
          letterSpacing: "-0.01em",
        }}>
          Bienvenido
        </h2>
        <p style={{
          fontSize: 13,
          color: "#888",
          marginBottom: 36,
        }}>
          Ingresa tus credenciales para continuar
        </p>

        <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, letterSpacing: "0.1em", color: "#555", textTransform: "uppercase" }}>
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="correo@baum.mx"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1.5px solid #e0e0e0",
                fontSize: 14,
                color: "#212121",
                background: "#fafafa",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#c9a84c"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            />
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, letterSpacing: "0.1em", color: "#555", textTransform: "uppercase" }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1.5px solid #e0e0e0",
                fontSize: 14,
                color: "#212121",
                background: "#fafafa",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#c9a84c"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: "#fff5f5",
              border: "1px solid #fecaca",
              fontSize: 13,
              color: "#dc2626",
              textAlign: "center",
            }}>
              {error}
            </div>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={cargando}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 10,
              border: "none",
              background: cargando ? "rgba(201,168,76,0.5)" : "#c9a84c",
              color: "#212121",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: cargando ? "not-allowed" : "pointer",
              transition: "background 0.2s, transform 0.1s",
              marginTop: 8,
            }}
            onMouseEnter={(e) => { if (!cargando) e.target.style.background = "#b8952e" }}
            onMouseLeave={(e) => { if (!cargando) e.target.style.background = "#c9a84c" }}
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>

        </form>

        {/* Footer */}
        <p style={{
          position: "absolute",
          bottom: 20,
          fontSize: 11,
          color: "#bbb",
          textAlign: "center",
        }}>
          © {new Date().getFullYear()} BAUM · Nodeva Consultoría Digital
        </p>

      </div>
    </div>
  );
}