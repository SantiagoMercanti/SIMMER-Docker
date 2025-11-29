import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';

// Generar código alfanumérico de 8 caracteres
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    const emailNorm = (email ?? '').trim().toLowerCase();
    if (!emailNorm) {
      return NextResponse.json(
        { message: 'El email es obligatorio' },
        { status: 400 }
      );
    }

    // Verificar que existe un usuario activo con ese email
    const user = await prisma.userMetadata.findFirst({
      where: { email: emailNorm, activo: true },
      select: { id: true, email: true, nombre: true },
    });

    // Por seguridad, siempre devolvemos success (no revelar si el email existe)
    if (!user) {
      return NextResponse.json({
        message: 'Revisa tu correo, recibirás un código de recuperación.',
      });
    }

    // Invalidar códigos anteriores no usados de este email
    await prisma.passwordReset.updateMany({
      where: {
        email: emailNorm,
        used: false,
        expiresAt: { gt: new Date() },
      },
      data: { used: true },
    });

    // Generar nuevo código
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await prisma.passwordReset.create({
      data: {
        email: emailNorm,
        code,
        expiresAt,
      },
    });

    // Enviar email
    await sendMail({
      to: emailNorm,
      subject: 'SIMMER - Código de recuperación de contraseña',
      html: `
        <h2>Recuperación de contraseña</h2>
        <p>Hola ${user.nombre},</p>
        <p>Has solicitado restablecer tu contraseña en SIMMER.</p>
        <p>Tu código de recuperación es:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px; color: #2563eb;">${code}</h1>
        <p>Este código expira en 15 minutos.</p>
        <p>Si no solicitaste este cambio, ignora este correo.</p>
      `,
      text: `Hola ${user.nombre}, tu código de recuperación es: ${code}. Expira en 15 minutos.`,
    });

    return NextResponse.json({
      message: 'Recibirás un código de recuperación al correo asociado a tu usuario.',
    });
  } catch (err) {
    console.error('Error /api/public/forgot-password:', err);
    return NextResponse.json(
      { message: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
