// src/app/api/actuators/check-fuente/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/actuators/check-fuente
// Body: { fuenteDatos: string, excludeId?: number }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fuenteDatos = body?.fuenteDatos?.trim();
    const excludeId = body?.excludeId ? Number(body.excludeId) : undefined;

    if (!fuenteDatos) {
      return NextResponse.json({ conflict: false, actuators: [] });
    }

    // Buscar actuadores activos con la misma fuente_datos
    const conflictingActuators = await prisma.actuador.findMany({
      where: {
        fuente_datos: fuenteDatos,
        activo: true,
        // Excluir el actuador actual si estamos editando
        ...(excludeId ? { actuator_id: { not: excludeId } } : {}),
      },
      select: {
        actuator_id: true,
        nombre: true,
      },
    });

    return NextResponse.json({
      conflict: conflictingActuators.length > 0,
      actuators: conflictingActuators.map(a => ({
        id: a.actuator_id,
        nombre: a.nombre,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Error al verificar fuente de datos' },
      { status: 500 }
    );
  }
}
