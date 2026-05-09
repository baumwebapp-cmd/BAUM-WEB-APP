import { createUploadthing } from "uploadthing/next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const f = createUploadthing();

export const ourFileRouter = {
  /**
   * Ruta para subir planos PDF desde el cliente.
   * Usada si en el futuro se integra el componente <UploadButton> de UploadThing.
   * Actualmente el flujo principal usa UTApi server-side en /api/planos.
   */
  planoUploader: f({ pdf: { maxFileSize: "50MB", maxFileCount: 1 } })
    .middleware(async () => {
      const sesion = await getServerSession(authOptions);
      if (!sesion) throw new Error("No autorizado");
      if (sesion.user.rol !== "GERENTE" && sesion.user.rol !== "DISENADOR") {
        throw new Error("Sin permiso para subir archivos");
      }
      return { usuarioId: sesion.user.id, rol: sesion.user.rol };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.uRL ?? file.url, usuarioId: metadata.usuarioId };
    }),

  /**
   * Ruta para subir PDFs firmados (uso interno desde /api/planos/[id]/autorizar-cliente).
   * Sin autenticación — la validación del PIN se hace en esa API antes de llamar a UTApi.
   */
  pdfFirmadoUploader: f({ pdf: { maxFileSize: "50MB", maxFileCount: 1 } })
    .middleware(async () => {
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.uRL ?? file.url };
    }),
};
