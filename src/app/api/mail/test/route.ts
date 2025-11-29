// src/app/api/mail/test/route.ts
// SOLO test, luego ELIMINAR
import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email';

export async function POST() {
  try {
    await sendMail({
      to: 'santiagoamercanti@gmail.com',
      subject: 'Prueba de correo SIMMER',
      text: 'Este es un mail de prueba enviado desde SIMMER (texto plano).',
      html: `
        <p>Hola Santiago,</p>
        <p>Este es un <strong>mail de prueba</strong> enviado desde SIMMER usando Nodemailer + Gmail SMTP.</p>
        <p>Si ves este mensaje, el envío desde el backend funciona correctamente ✅</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API /api/mail/test] Error enviando mail:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Error interno enviando el correo. Revisar logs del servidor.',
      },
      { status: 500 },
    );
  }
}
