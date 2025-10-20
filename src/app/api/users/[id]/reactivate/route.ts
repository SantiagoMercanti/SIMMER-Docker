import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const { id } = params;
    const body = await req.json().catch(() => ({} as { newEmail?: string }));
    const newEmail = typeof body?.newEmail === 'string'
      ? body.newEmail.trim().toLowerCase()
      : undefined;

    const user = await prisma.userMetadata.findUnique({
      where: { id },
      select: { id: true, email: true, activo: true, tipo: true, nombre: true, apellido: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }
    if (user.activo) {
      // Ya está activo: idempotente
      return NextResponse.json({ ok: true, alreadyActive: true });
    }

    // Proponer email deseado
    let desired = (newEmail ?? user.email).trim().toLowerCase();

    // Si no vino newEmail, intentamos “destaggear” +inactive-<id>
    if (!newEmail) {
      const at = user.email.indexOf('@');
      if (at > 0) {
        const local = user.email.slice(0, at);
        const domain = user.email.slice(at + 1);
        const restoredLocal = local.replace(/\+inactive-[a-f0-9-]+$/i, '');
        desired = `${restoredLocal}@${domain}`.toLowerCase();
      }
    }

    // Conflicto con otro usuario ACTIVO
    const conflict = await prisma.userMetadata.findFirst({
      where: { email: desired, activo: true, NOT: { id: user.id } },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: 'Email en uso por otro usuario activo. Proporcione newEmail.' },
        { status: 409 }
      );
    }

    const updated = await prisma.userMetadata.update({
      where: { id: user.id },
      data: { activo: true, email: desired },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        tipo: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err: unknown) {
    if ((err as unknown) === 'P2002') {
      return NextResponse.json(
        { error: 'Conflicto de unicidad. Proporcione newEmail.' },
        { status: 409 }
      );
    }
    const status = (err as { status?: number })?.status ?? 500;
    if (status === 401) return NextResponse.json({ error: 'No autenticado' }, { status });
    if (status === 403) return NextResponse.json({ error: 'Acceso solo para administradores' }, { status });

    console.error('POST /api/users/[id]/reactivate error:', err);
    return NextResponse.json({ error: 'No se pudo reactivar el usuario' }, { status });
  }
}
