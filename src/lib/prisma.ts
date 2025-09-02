import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'], // podés sumar 'query' en dev si querés ver las consultas
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
