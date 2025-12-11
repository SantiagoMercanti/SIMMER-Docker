import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, canAccessResource } from '@/lib/auth';

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

    // ✅ Requiere autenticación
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // ✅ Verificar que el actuador existe y el usuario puede acceder a él
    const actuador = await prisma.actuador.findUnique({
      where: { actuator_id: actuadorId },
      select: { 
        actuator_id: true, 
        creadorId: true,
        activo: true 
      },
    });

    if (!actuador) {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }

    // ✅ Verificar ownership del actuador
    if (!canAccessResource(actuador.creadorId, user)) {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }

    // ✅ Si el actuador está inactivo, solo admin puede ver sus usuarios
    if (!actuador.activo && user.role !== 'admin') {
      return NextResponse.json({ error: 'Actuador no encontrado' }, { status: 404 });
    }

    // ✅ Obtener usuarios únicos que han hecho registros, filtrando por proyectos del usuario
    const registros = await prisma.registroActuador.findMany({
      where: {
        proyectoActuador: {
          actuadorId,
          proyecto: {
            activo: true,
            // Si no es admin, solo proyectos propios
            ...(user.role !== 'admin' ? { creadorId: user.id } : {}),
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
