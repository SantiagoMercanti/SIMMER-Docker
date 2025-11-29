import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const validatePassword = (password: string): string | null => {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe contener al menos una letra mayúscula';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe contener al menos un número';
  }
  return null;
};

export async function POST(req: Request) {
  try {
    const { email, code, password } = await req.json();

    const emailNorm = (email ?? '').trim().toLowerCase();
    const codeNorm = (code ?? '').trim().toUpperCase();

    if (!emailNorm || !codeNorm || !password) {
      return NextResponse.json(
        { message: 'Todos los campos son obligatorios' },
        { status: 400 }
      );
    }

    // Validar formato de contraseña
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 });
    }

    // Buscar código válido
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        email: emailNorm,
        code: codeNorm,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetRecord) {
      return NextResponse.json(
        { message: 'Código inválido o expirado' },
        { status: 400 }
      );
    }

    // Buscar usuario activo
    const user = await prisma.userMetadata.findFirst({
      where: { email: emailNorm, activo: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Hashear nueva contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Actualizar contraseña y marcar código como usado
    await prisma.$transaction([
      prisma.userMetadata.update({
        where: { id: user.id },
        data: { password: passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json({
      message: 'Contraseña actualizada correctamente',
    });
  } catch (err) {
    console.error('Error /api/public/reset-password:', err);
    return NextResponse.json(
      { message: 'Error al resetear la contraseña' },
      { status: 500 }
    );
  }
}
