const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
require('dotenv').config();
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
prisma.plano.findMany({ 
  where: { 
    NOT: { urlPdf: { startsWith: 'https://www.w3.org' } }
  },
  select: { id: true, urlPdf: true, claveId: true, createdAt: true } 
})
  .then(function(r) { console.log(JSON.stringify(r, null, 2)); })
  .finally(function() { prisma.$disconnect(); });