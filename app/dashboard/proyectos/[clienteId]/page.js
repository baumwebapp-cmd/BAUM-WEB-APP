"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, FileText, Plus } from "lucide-react";
import { ModalCrearProyecto } from "../page";

export default function ClienteDetallePage() {
  const { data: sesion, status: sesionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const clienteId = parseInt(params.clienteId);

  const [cliente, setCliente] = useState(null);
  const [proyectos, setProyectos] = useState([]);
  const [gerentes, setGerentes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modalCrear, setModalCrear] = useState(false);

  const rol = sesion?.user?.rol;
  const puedeCrear = rol === "DUENO" || rol === "SUPERADMIN";

  const cargar = useCallback(async () => {
    setError("");
    try {
      const [resCliente, resProyectos] = await Promise.all([
        fetch(`/api/clientes/${clienteId}`),
        fetch(`/api/proyectos?clienteId=${clienteId}`),
      ]);
      if (!resCliente.ok) {
        const d = await resCliente.json().catch(() => ({}));
        setError(d.error || "Error al cargar cliente");
        return;
      }
      const dataCliente = await resCliente.json();
      const dataProyectos = resProyectos.ok ? await resProyectos.json() : [];
      setCliente(dataCliente);
      setProyectos(Array.isArray(dataProyectos) ? dataProyectos : []);
    } catch {
      setError("Error de conexión");
    } finally {
      setCargando(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (sesionStatus === "authenticated" && !isNaN(clienteId)) cargar();
  }, [sesionStatus, clienteId, cargar]);

  useEffect(() => {
    if (modalCrear && puedeCrear && gerentes.length === 0) {
      fetch("/api/usuarios")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setGerentes(data.filter((u) => u.rol === "GERENTE" && u.activo));
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalCrear, puedeCrear]);

  if (sesionStatus === "loading" || cargando) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div>
        <button onClick={() => router.push("/dashboard/proyectos")} style={sBotonVolver}>
          <ArrowLeft size={15} /> Proyectos
        </button>
        <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
          {error || "Cliente no encontrado"}
        </div>
      </div>
    );
  }

  const totalProyectos = proyectos.length;
  const totalClaves = proyectos.reduce((acc, p) => acc + (p.claves?.length || 0), 0);
  const activo = cliente.activo !== false;

  return (
    <div>
      <button onClick={() => router.push("/dashboard/proyectos")} style={sBotonVolver}>
        <ArrowLeft size={15} /> Proyectos
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#212121" }}>{cliente.nombre}</h1>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
              background: activo ? "#dcfce7" : "#f3f4f6",
              color: activo ? "#166534" : "#6b7280",
            }}>
              {activo ? "Activo" : "Inactivo"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 8, fontSize: 13, color: "#6b7280" }}>
            {cliente.nombreCorto && (
              <span><strong style={{ fontWeight: 600, color: "#9ca3af" }}>Nombre corto: </strong>{cliente.nombreCorto}</span>
            )}
            {cliente.razonSocial && (
              <span><strong style={{ fontWeight: 600, color: "#9ca3af" }}>Razón social: </strong>{cliente.razonSocial}</span>
            )}
            {cliente.rfc && (
              <span><strong style={{ fontWeight: 600, color: "#9ca3af" }}>RFC: </strong><span style={{ fontFamily: "monospace", letterSpacing: 0.5 }}>{cliente.rfc}</span></span>
            )}
          </div>
        </div>
        {puedeCrear && (
          <button
            onClick={() => setModalCrear(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#c9a84c", border: "none", borderRadius: 8, padding: "10px 18px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <Plus size={15} /> Nuevo proyecto
          </button>
        )}
      </div>

      {totalProyectos === 0 ? (
        <div style={{ background: "#ffffff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 14 }}>
            Este cliente no tiene proyectos activos aún.
          </p>
          {puedeCrear && (
            <button
              onClick={() => setModalCrear(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#c9a84c", border: "none", borderRadius: 8, padding: "10px 18px", color: "#212121", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              <Plus size={15} /> Crear primer proyecto
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          <TarjetaModulo
            icono={FileText}
            titulo="Planos"
            subtitulo={`${totalProyectos} proyecto${totalProyectos !== 1 ? "s" : ""} activo${totalProyectos !== 1 ? "s" : ""}`}
            metricaLabel="Claves totales"
            metricaValor={totalClaves}
            onClick={() => router.push(`/dashboard/planos/${clienteId}`)}
          />
        </div>
      )}

      {modalCrear && (
        <ModalCrearProyecto
          onCerrar={() => setModalCrear(false)}
          onCreado={() => cargar()}
          gerentes={gerentes}
          clientePreseleccionado={cliente}
        />
      )}
    </div>
  );
}

function TarjetaModulo({ icono: Icono, titulo, subtitulo, metricaLabel, metricaValor, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: "left",
        background: "#ffffff",
        border: `1px solid ${hover ? "#c9a84c" : "#e5e5e5"}`,
        borderRadius: 12,
        padding: 24,
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: hover ? "0 4px 12px rgba(201,168,76,0.08)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: "#fffbeb", color: "#c9a84c",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icono size={22} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#212121" }}>{titulo}</div>
        <div style={{ marginTop: 2, fontSize: 13, color: "#6b7280" }}>{subtitulo}</div>
      </div>
      <div style={{ paddingTop: 12, borderTop: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          {metricaLabel}
        </span>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#212121" }}>{metricaValor}</span>
      </div>
    </button>
  );
}

const sBotonVolver = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "none",
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  padding: "4px 0",
  marginBottom: 12,
};
