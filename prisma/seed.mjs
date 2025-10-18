import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'simmeringar@gmail.com';
  const plain = 'poiuMNBV0987';

  const existing = await prisma.userMetadata.findFirst({
    where: { email, activo: true },
    select: { id: true },
  });

  if (existing) {
    console.log('✅ Usuario admin ya existe. No se crea otro.');
    return;
  }

  const passwordHash = await bcrypt.hash(plain, 10);

  await prisma.userMetadata.create({
    data: {
      nombre: 'Admin',
      apellido: 'SIMMER',
      tipo: 'admin',
      email,
      password: passwordHash,
    },
  });

  console.log('✅ Usuario admin creado.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
