import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/sensors/check-fuente
// Body: { fuenteDatos: string, excludeId?: number }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fuenteDatos = body?.fuenteDatos?.trim();
    const excludeId = body?.excludeId ? Number(body.excludeId) : undefined;

    if (!fuenteDatos) {
      return NextResponse.json({ conflict: false, sensors: [] });
    }

    // Buscar sensores activos con la misma fuente_datos
    const conflictingSensors = await prisma.sensor.findMany({
      where: {
        fuente_datos: fuenteDatos,
        activo: true,
        // Excluir el sensor actual si estamos editando
        ...(excludeId ? { sensor_id: { not: excludeId } } : {}),
      },
      select: {
        sensor_id: true,
        nombre: true,
      },
    });

    return NextResponse.json({
      conflict: conflictingSensors.length > 0,
      sensors: conflictingSensors.map(s => ({
        id: s.sensor_id,
        nombre: s.nombre,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Error al verificar fuente de datos' },
      { status: 500 }
    );
  }
}
