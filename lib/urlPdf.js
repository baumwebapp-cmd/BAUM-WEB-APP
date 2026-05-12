export function urlPdfPlano(planoId, opciones = {}) {
  const { tipo = "original", modo = "inline" } = opciones;
  const params = new URLSearchParams({ tipo, modo });
  return `/api/archivos/plano/${planoId}?${params.toString()}`;
}

export function urlPdfCliente(pin, planoId, opciones = {}) {
  const { tipo = "original", modo = "inline" } = opciones;
  const params = new URLSearchParams({ tipo, modo });
  return `/api/archivos/cliente/${pin}/plano/${planoId}?${params.toString()}`;
}
