import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Crear usuario admin
  const email = 'simmeringar@gmail.com';
  const plain = 'poiuMNBV0987';

  const existing = await prisma.userMetadata.findFirst({
    where: { email, activo: true },
    select: { id: true },
  });

  if (!existing) {
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
  } else {
    console.log('✅ Usuario admin ya existe.');
  }

  // 2. Seed de unidades de medida
  const unidades = [
    // Temperatura
    { nombre: 'Grados Celsius', simbolo: '°C', categoria: 'temperatura' },
    { nombre: 'Grados Fahrenheit', simbolo: '°F', categoria: 'temperatura' },
    { nombre: 'Kelvin', simbolo: 'K', categoria: 'temperatura' },
    
    // pH
    { nombre: 'pH', simbolo: 'pH', categoria: 'pH' },
    
    // Presión
    { nombre: 'Bar', simbolo: 'bar', categoria: 'presion' },
    { nombre: 'Pascal', simbolo: 'Pa', categoria: 'presion' },
    { nombre: 'PSI', simbolo: 'psi', categoria: 'presion' },
    { nombre: 'Atmósferas', simbolo: 'atm', categoria: 'presion' },
    
    // Volumen
    { nombre: 'Litros', simbolo: 'L', categoria: 'volumen' },
    { nombre: 'Mililitros', simbolo: 'mL', categoria: 'volumen' },
    { nombre: 'Metros cúbicos', simbolo: 'm³', categoria: 'volumen' },
    
    // Masa
    { nombre: 'Gramos', simbolo: 'g', categoria: 'masa' },
    { nombre: 'Kilogramos', simbolo: 'kg', categoria: 'masa' },
    { nombre: 'Miligramos', simbolo: 'mg', categoria: 'masa' },
    
    // Velocidad/Frecuencia
    { nombre: 'Revoluciones por minuto', simbolo: 'RPM', categoria: 'frecuencia' },
    { nombre: 'Hertz', simbolo: 'Hz', categoria: 'frecuencia' },
    
    // Concentración
    { nombre: 'Gramos por litro', simbolo: 'g/L', categoria: 'concentracion' },
    { nombre: 'Molar', simbolo: 'M', categoria: 'concentracion' },
    { nombre: 'Partes por millón', simbolo: 'ppm', categoria: 'concentracion' },
    { nombre: 'Porcentaje peso/volumen', simbolo: '% p/v', categoria: 'concentracion' },
    
    // Flujo
    { nombre: 'Litros por minuto', simbolo: 'L/min', categoria: 'flujo' },
    { nombre: 'Mililitros por minuto', simbolo: 'mL/min', categoria: 'flujo' },
    
    // Tiempo
    { nombre: 'Segundos', simbolo: 's', categoria: 'tiempo' },
    { nombre: 'Minutos', simbolo: 'min', categoria: 'tiempo' },
    { nombre: 'Horas', simbolo: 'h', categoria: 'tiempo' },
    
    // Porcentaje
    { nombre: 'Porcentaje', simbolo: '%', categoria: 'porcentaje' },
    
    // Otros
    { nombre: 'Adimensional', simbolo: '-', categoria: 'otra' },
  ];

  for (const u of unidades) {
    await prisma.unidadMedida.upsert({
      where: { simbolo: u.simbolo },
      update: {},
      create: u,
    });
  }

  console.log('✅ Unidades de medida inicializadas.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
