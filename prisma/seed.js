const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando seed...");

  const passwordHash = await bcrypt.hash("baum2024!", 12);

  const ahora = new Date();
  const hace30h = new Date(ahora.getTime() - 30 * 60 * 60 * 1000);
  const hace60h = new Date(ahora.getTime() - 60 * 60 * 60 * 1000);

  function fecha(color) {
    if (color === "rojo") return hace60h;
    if (color === "amarillo") return hace30h;
    return ahora;
  }

  const gerente1 = await prisma.usuario.upsert({
    where: { email: "gerente@baum.mx" },
    update: {},
    create: { nombre: "Carlos Baum", email: "gerente@baum.mx", password: passwordHash, rol: "GERENTE" },
  });

  const gerente2 = await prisma.usuario.upsert({
    where: { email: "gerente2@baum.mx" },
    update: {},
    create: { nombre: "Laura Mendoza", email: "gerente2@baum.mx", password: passwordHash, rol: "GERENTE" },
  });

  const disenador = await prisma.usuario.upsert({
    where: { email: "disenador@baum.mx" },
    update: {},
    create: { nombre: "Sofia Reyes", email: "disenador@baum.mx", password: passwordHash, rol: "DISENADOR" },
  });

  await prisma.usuario.upsert({
    where: { email: "costos@baum.mx" },
    update: {},
    create: { nombre: "Miguel Torres", email: "costos@baum.mx", password: passwordHash, rol: "COSTOS" },
  });

  await prisma.usuario.upsert({
    where: { email: "produccion@baum.mx" },
    update: {},
    create: { nombre: "Roberto Sanchez", email: "produccion@baum.mx", password: passwordHash, rol: "PRODUCCION" },
  });

  console.log("Usuarios listos");

  const proyectos = [
    {
      nombre: "Nativa Residencial — Torre A",
      clienteNombre: "Desarrolladora Nativa SA de CV",
      pinAcceso: "111111",
      claves: [
        { codigo: "CL-01", descripcion: "Closet principal recámara master", estatus: "LIBERADO", color: "verde" },
        { codigo: "CL-02", descripcion: "Closet recámara 2", estatus: "AUTORIZADO", color: "verde" },
        { codigo: "CL-03", descripcion: "Cocina integral", estatus: "ENVIADO", color: "verde" },
        { codigo: "CL-04", descripcion: "Vanity baño principal", estatus: "REVISION_INTERNA", color: "verde" },
        { codigo: "CL-05", descripcion: "Puerta principal madera", estatus: "BORRADOR", color: "verde" },
      ],
    },
    {
      nombre: "Zaguan Depto 4B",
      clienteNombre: "SUA SA de CV",
      pinAcceso: "222222",
      claves: [
        { codigo: "ZAG-01", descripcion: "Cocina integral con isla", estatus: "EN_PRODUCCION", color: "verde" },
        { codigo: "ZAG-02", descripcion: "Closet walk-in", estatus: "LIBERADO", color: "rojo" },
        { codigo: "ZAG-03", descripcion: "Mueble TV sala", estatus: "AUTORIZADO", color: "verde" },
        { codigo: "ZAG-04", descripcion: "Vanity baño visitas", estatus: "RECHAZADO", color: "rojo" },
        { codigo: "ZAG-05", descripcion: "Puerta corredera estudio", estatus: "BORRADOR", color: "rojo" },
      ],
    },
    {
      nombre: "Malta Torre Norte",
      clienteNombre: "Consur FR",
      pinAcceso: "333333",
      claves: [
        { codigo: "MAL-01", descripcion: "Cocina principal", estatus: "REVISION_INTERNA", color: "amarillo" },
        { codigo: "MAL-02", descripcion: "Closet recámara 1", estatus: "REVISION_INTERNA", color: "amarillo" },
        { codigo: "MAL-03", descripcion: "Mueble lavandería", estatus: "BORRADOR", color: "amarillo" },
        { codigo: "MAL-04", descripcion: "Puerta acceso", estatus: "BORRADOR", color: "amarillo" },
      ],
    },
    {
      nombre: "Casa Piedra Fase 2",
      clienteNombre: "Hotel SA",
      pinAcceso: "444444",
      claves: [
        { codigo: "CP-01", descripcion: "Cocina suite presidencial", estatus: "ENVIADO", color: "rojo" },
        { codigo: "CP-02", descripcion: "Closet suite 101", estatus: "ENVIADO", color: "amarillo" },
        { codigo: "CP-03", descripcion: "Vanity suite 102", estatus: "AUTORIZADO", color: "verde" },
        { codigo: "CP-04", descripcion: "Mueble recepcion", estatus: "LIBERADO", color: "verde" },
        { codigo: "CP-05", descripcion: "Puerta habitacion 201", estatus: "EN_PRODUCCION", color: "amarillo" },
        { codigo: "CP-06", descripcion: "Puerta habitacion 202", estatus: "EN_PRODUCCION", color: "rojo" },
      ],
    },
    {
      nombre: "Macora Residencias",
      clienteNombre: "Yamile SA",
      pinAcceso: "555555",
      claves: [
        { codigo: "MAC-01", descripcion: "Cocina tipo A", estatus: "BORRADOR", color: "rojo" },
        { codigo: "MAC-02", descripcion: "Cocina tipo B", estatus: "BORRADOR", color: "rojo" },
        { codigo: "MAC-03", descripcion: "Closet tipo A", estatus: "BORRADOR", color: "rojo" },
      ],
    },
    {
      nombre: "Conckal Torre Sur",
      clienteNombre: "Pedrito Constructora",
      pinAcceso: "666666",
      claves: [
        { codigo: "CON-01", descripcion: "Cocina departamento A", estatus: "REVISION_INTERNA", color: "rojo" },
        { codigo: "CON-02", descripcion: "Closet departamento A", estatus: "BORRADOR", color: "amarillo" },
        { codigo: "CON-03", descripcion: "Vanity departamento B", estatus: "ENVIADO", color: "amarillo" },
        { codigo: "CON-04", descripcion: "Cocina departamento B", estatus: "AUTORIZADO", color: "verde" },
      ],
    },
    {
      nombre: "Muretto Residencial",
      clienteNombre: "Constructora Muretto",
      pinAcceso: "777777",
      claves: [
        { codigo: "MUR-01", descripcion: "Cocina casa muestra", estatus: "LIBERADO", color: "amarillo" },
        { codigo: "MUR-02", descripcion: "Closet casa muestra", estatus: "EN_PRODUCCION", color: "verde" },
        { codigo: "MUR-03", descripcion: "Vanity casa muestra", estatus: "AUTORIZADO", color: "rojo" },
        { codigo: "MUR-04", descripcion: "Puerta principal", estatus: "REVISION_INTERNA", color: "amarillo" },
        { codigo: "MUR-05", descripcion: "Mueble TV", estatus: "BORRADOR", color: "verde" },
      ],
    },
  ];

  for (const p of proyectos) {
    const existe = await prisma.proyecto.findUnique({ where: { pinAcceso: p.pinAcceso } });
    if (existe) {
      console.log(`Proyecto ${p.nombre} ya existe, omitido`);
      continue;
    }

    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: p.nombre,
        clienteNombre: p.clienteNombre,
        pinAcceso: p.pinAcceso,
        createdAt: fecha(p.claves[0].color),
        gerentes: {
          create: [
            { usuarioId: gerente1.id },
            { usuarioId: gerente2.id },
          ],
        },
      },
    });

    for (const c of p.claves) {
      const fechaClave = fecha(c.color);

      const clave = await prisma.clave.create({
        data: {
          proyectoId: proyecto.id,
          codigo: c.codigo,
          descripcion: c.descripcion,
          estatus: c.estatus,
          creadoPorId: disenador.id,
          createdAt: fechaClave,
          updatedAt: fechaClave,
        },
      });

      if (c.estatus !== "BORRADOR") {
        const plano = await prisma.plano.create({
          data: {
            claveId: clave.id,
            urlPdf: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1.pdf",
            version: 1,
            subidoPorId: disenador.id,
            createdAt: fechaClave,
          },
        });

        if (!["REVISION_INTERNA", "RECHAZADO"].includes(c.estatus)) {
          await prisma.autorizacionInterna.createMany({
            data: [
              { planoId: plano.id, gerenteId: gerente1.id, decision: "APROBADO", createdAt: fechaClave },
              { planoId: plano.id, gerenteId: gerente2.id, decision: "APROBADO", createdAt: fechaClave },
            ],
            skipDuplicates: true,
          });
        }

        if (["AUTORIZADO", "LIBERADO", "EN_PRODUCCION"].includes(c.estatus)) {
          await prisma.autorizacionCliente.create({
            data: {
              planoId: plano.id,
              decision: "APROBADO",
              firmadoPor: "Cliente Demo",
              firmaBase64: "firma_demo",
              createdAt: fechaClave,
            },
          });
        }

        if (c.estatus === "RECHAZADO") {
          await prisma.autorizacionCliente.create({
            data: {
              planoId: plano.id,
              decision: "RECHAZADO",
              firmadoPor: "Cliente Demo",
              comentarios: "Las medidas no coinciden con el plano arquitectónico, favor corregir.",
              createdAt: fechaClave,
            },
          });
        }
      }
    }

    console.log(`Proyecto creado: ${p.nombre}`);
  }

  console.log("\nCredenciales (password: baum2024!)");
  console.log("gerente@baum.mx    -> GERENTE");
  console.log("gerente2@baum.mx   -> GERENTE");
  console.log("disenador@baum.mx  -> DISENADOR");
  console.log("costos@baum.mx     -> COSTOS");
  console.log("produccion@baum.mx -> PRODUCCION");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });