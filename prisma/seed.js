const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando seed...");

  const passwordHash = await bcrypt.hash("baum2024!", 12);
  const passwordDueno = await bcrypt.hash("Baum2026!", 12);

  await prisma.usuario.upsert({
    where: { email: "admin@baum.mx" },
    update: { password: passwordDueno, rol: "DUENO", activo: true },
    create: { nombre: "Administrador General", email: "admin@baum.mx", password: passwordDueno, rol: "DUENO", activo: true },
  });

  const gerente1 = await prisma.usuario.upsert({
    where: { email: "gerente@baum.mx" },
    update: {},
    create: { nombre: "Carlos Baum", email: "gerente@baum.mx", password: passwordHash, rol: "GERENTE" },
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

  console.log("Usuarios listos");

  await prisma.modulo.upsert({
    where: { slug: "planos" },
    update: {},
    create: {
      nombre: "Planos",
      slug: "planos",
      descripcion: "Gestión de planos técnicos y autorizaciones",
    },
  });

  console.log("Módulos listos");

  const clientesSeed = [
    { nombre: "Desarrolladora Nativa SA de CV", nombreCorto: "Nativa" },
    { nombre: "SUA SA de CV", nombreCorto: "SUA" },
    { nombre: "Consur FR", nombreCorto: "Consur" },
    { nombre: "Hotel SA", nombreCorto: "Hotel SA" },
    { nombre: "Yamile SA", nombreCorto: "Yamile" },
    { nombre: "Pedrito Constructora", nombreCorto: "Pedrito" },
    { nombre: "Constructora Muretto", nombreCorto: "Muretto" },
  ];

  const clientesPorNombre = {};
  for (const c of clientesSeed) {
    const existente = await prisma.cliente.findFirst({ where: { nombre: c.nombre } });
    const cliente = existente
      ? existente
      : await prisma.cliente.create({ data: c });
    clientesPorNombre[c.nombre] = cliente;
  }

  console.log("Clientes listos");

  const ahora = new Date();
  const hace10h = new Date(ahora.getTime() - 10 * 60 * 60 * 1000);
  const hace30h = new Date(ahora.getTime() - 30 * 60 * 60 * 1000);
  const hace60h = new Date(ahora.getTime() - 60 * 60 * 60 * 1000);

  const proyectos = [
    {
      nombre: "Nativa Residencial — Torre A",
      clienteNombre: "Desarrolladora Nativa SA de CV",
      pinAcceso: "111111",
      fechaProyecto: hace60h,
      claves: [
        { codigo: "CL-01", descripcion: "Closet principal recámara master", estatus: "LIBERADO", ultimoMovimiento: hace10h },
        { codigo: "CL-02", descripcion: "Closet recámara 2", estatus: "AUTORIZADO", ultimoMovimiento: hace30h },
        { codigo: "CL-03", descripcion: "Cocina integral", estatus: "ENVIADO", ultimoMovimiento: hace60h },
        { codigo: "CL-04", descripcion: "Vanity baño principal", estatus: "REVISION_INTERNA", ultimoMovimiento: hace30h },
        { codigo: "CL-05", descripcion: "Puerta principal madera", estatus: "BORRADOR", ultimoMovimiento: hace60h },
      ],
    },
    {
      nombre: "Zaguan Depto 4B",
      clienteNombre: "SUA SA de CV",
      pinAcceso: "222222",
      fechaProyecto: hace60h,
      claves: [
        { codigo: "ZAG-01", descripcion: "Cocina integral con isla", estatus: "EN_PRODUCCION", ultimoMovimiento: hace10h },
        { codigo: "ZAG-02", descripcion: "Closet walk-in", estatus: "LIBERADO", ultimoMovimiento: hace60h },
        { codigo: "ZAG-03", descripcion: "Mueble TV sala", estatus: "AUTORIZADO", ultimoMovimiento: hace10h },
        { codigo: "ZAG-04", descripcion: "Vanity baño visitas", estatus: "RECHAZADO", ultimoMovimiento: hace60h },
        { codigo: "ZAG-05", descripcion: "Puerta corredera estudio", estatus: "BORRADOR", ultimoMovimiento: hace30h },
      ],
    },
    {
      nombre: "Malta Torre Norte",
      clienteNombre: "Consur FR",
      pinAcceso: "333333",
      fechaProyecto: hace30h,
      claves: [
        { codigo: "MAL-01", descripcion: "Cocina principal", estatus: "REVISION_INTERNA", ultimoMovimiento: hace30h },
        { codigo: "MAL-02", descripcion: "Closet recámara 1", estatus: "REVISION_INTERNA", ultimoMovimiento: hace60h },
        { codigo: "MAL-03", descripcion: "Mueble lavandería", estatus: "BORRADOR", ultimoMovimiento: hace30h },
        { codigo: "MAL-04", descripcion: "Puerta acceso", estatus: "BORRADOR", ultimoMovimiento: hace10h },
      ],
    },
    {
      nombre: "Casa Piedra Fase 2",
      clienteNombre: "Hotel SA",
      pinAcceso: "444444",
      fechaProyecto: hace60h,
      claves: [
        { codigo: "CP-01", descripcion: "Cocina suite presidencial", estatus: "ENVIADO", ultimoMovimiento: hace60h },
        { codigo: "CP-02", descripcion: "Closet suite 101", estatus: "ENVIADO", ultimoMovimiento: hace30h },
        { codigo: "CP-03", descripcion: "Vanity suite 102", estatus: "AUTORIZADO", ultimoMovimiento: hace10h },
        { codigo: "CP-04", descripcion: "Mueble recepcion", estatus: "LIBERADO", ultimoMovimiento: hace10h },
        { codigo: "CP-05", descripcion: "Puerta habitacion 201", estatus: "EN_PRODUCCION", ultimoMovimiento: hace30h },
        { codigo: "CP-06", descripcion: "Puerta habitacion 202", estatus: "EN_PRODUCCION", ultimoMovimiento: hace60h },
      ],
    },
    {
      nombre: "Macora Residencias",
      clienteNombre: "Yamile SA",
      pinAcceso: "555555",
      fechaProyecto: hace60h,
      claves: [
        { codigo: "MAC-01", descripcion: "Cocina tipo A", estatus: "BORRADOR", ultimoMovimiento: hace60h },
        { codigo: "MAC-02", descripcion: "Cocina tipo B", estatus: "BORRADOR", ultimoMovimiento: hace30h },
        { codigo: "MAC-03", descripcion: "Closet tipo A", estatus: "BORRADOR", ultimoMovimiento: hace10h },
      ],
    },
    {
      nombre: "Conckal Torre Sur",
      clienteNombre: "Pedrito Constructora",
      pinAcceso: "666666",
      fechaProyecto: hace30h,
      claves: [
        { codigo: "CON-01", descripcion: "Cocina departamento A", estatus: "REVISION_INTERNA", ultimoMovimiento: hace60h },
        { codigo: "CON-02", descripcion: "Closet departamento A", estatus: "BORRADOR", ultimoMovimiento: hace30h },
        { codigo: "CON-03", descripcion: "Vanity departamento B", estatus: "ENVIADO", ultimoMovimiento: hace10h },
        { codigo: "CON-04", descripcion: "Cocina departamento B", estatus: "AUTORIZADO", ultimoMovimiento: hace30h },
      ],
    },
    {
      nombre: "Muretto Residencial",
      clienteNombre: "Constructora Muretto",
      pinAcceso: "777777",
      fechaProyecto: hace10h,
      claves: [
        { codigo: "MUR-01", descripcion: "Cocina casa muestra", estatus: "LIBERADO", ultimoMovimiento: hace10h },
        { codigo: "MUR-02", descripcion: "Closet casa muestra", estatus: "EN_PRODUCCION", ultimoMovimiento: hace10h },
        { codigo: "MUR-03", descripcion: "Vanity casa muestra", estatus: "AUTORIZADO", ultimoMovimiento: hace10h },
        { codigo: "MUR-04", descripcion: "Puerta principal", estatus: "REVISION_INTERNA", ultimoMovimiento: hace10h },
        { codigo: "MUR-05", descripcion: "Mueble TV", estatus: "BORRADOR", ultimoMovimiento: hace10h },
      ],
    },
  ];

  for (const p of proyectos) {
    const existe = await prisma.proyecto.findUnique({ where: { pinAcceso: p.pinAcceso } });
    if (existe) {
      console.log(`Proyecto ${p.nombre} ya existe, omitido`);
      continue;
    }

    const cliente = clientesPorNombre[p.clienteNombre];

    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: p.nombre,
        clienteId: cliente?.id,
        pinAcceso: p.pinAcceso,
        createdAt: p.fechaProyecto,
        gerentes: {
          create: [{ usuarioId: gerente1.id }],
        },
      },
    });

    for (const c of p.claves) {
      const clave = await prisma.clave.create({
        data: {
          proyectoId: proyecto.id,
          codigo: c.codigo,
          descripcion: c.descripcion,
          estatus: c.estatus,
          creadoPorId: disenador.id,
          createdAt: p.fechaProyecto,
          updatedAt: c.ultimoMovimiento || p.fechaProyecto,
        },
      });

      if (c.estatus !== "BORRADOR") {
        const plano = await prisma.plano.create({
          data: {
            claveId: clave.id,
            urlPdf: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1.pdf",
            version: 1,
            subidoPorId: disenador.id,
            createdAt: p.fechaProyecto,
          },
        });

        if (!["REVISION_INTERNA", "RECHAZADO"].includes(c.estatus)) {
          await prisma.autorizacionInterna.createMany({
            data: [{ planoId: plano.id, gerenteId: gerente1.id, decision: "APROBADO", createdAt: p.fechaProyecto }],
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
              createdAt: p.fechaProyecto,
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
              createdAt: p.fechaProyecto,
            },
          });
        }
      }
    }

    console.log(`Proyecto creado: ${p.nombre}`);
  }

  console.log("\nCredenciales:");
  console.log("admin@baum.mx      -> DUENO    (Baum2026!)");
  console.log("gerente@baum.mx    -> GERENTE  (baum2024!)");
  console.log("disenador@baum.mx  -> DISENADOR (baum2024!)");
  console.log("costos@baum.mx     -> COSTOS   (baum2024!)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
