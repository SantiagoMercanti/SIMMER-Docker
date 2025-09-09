import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// GET /api/me → { id, email, role, nombre, apellido }
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { id, email, role, nombre, apellido } = user;
    return NextResponse.json({ id, email, role, nombre, apellido });
  } catch {
    return NextResponse.json({ error: 'Error obteniendo sesión' }, { status: 500 });
  }
}
