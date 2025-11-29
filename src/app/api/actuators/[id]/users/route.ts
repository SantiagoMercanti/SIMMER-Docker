import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/actuators/:id/users
// Retorna la lista de usuarios que han hecho registros en este actuador
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actuadorId = Number(id);

    if (!Number.isInteger(actuadorId) || actuadorId <= 0) {
      return NextResponse.json({ error: 'ID de actuador inválido' }, { status: 400 });
    }

    // Obtener usuarios únicos que han hecho registros en este actuador
    const registros = await prisma.registroActuador.findMany({
      where: {
        proyectoActuador: {
          actuadorId,
          proyecto: {
            activo: true,
          },
        },
        usuario: {
          isNot: null, // Solo registros con usuario asignado
        },
      },
      select: {
        usuario: {
          select: {
            id: true,
            email: true,
            nombre: true,
            apellido: true,
          },
        },
      },
      distinct: ['usuarioId'],
    });

    // Eliminar duplicados y formatear
    const uniqueUsers = registros
      .filter(r => r.usuario)
      .map(r => r.usuario!)
      .reduce((acc, user) => {
        if (!acc.find(u => u.id === user.id)) {
          acc.push(user);
        }
        return acc;
      }, [] as Array<{ id: string; email: string; nombre: string; apellido: string }>);

    // Ordenar por email
    uniqueUsers.sort((a, b) => a.email.localeCompare(b.email));

    const formattedUsers = uniqueUsers.map((u) => ({
      id: u.id,
      email: u.email,
      nombreCompleto: `${u.nombre} ${u.apellido}`,
    }));

    return NextResponse.json({
      users: formattedUsers,
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { 
          error: 'Error al obtener usuarios',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error al obtener usuarios' },
      { status: 500 }
    );
  }
}
