import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const emailNorm = (email ?? '').trim().toLowerCase();
    if (!emailNorm || !password) {
      return NextResponse.json(
        { message: 'Email y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    // Opción A (simple): findFirst con activo=true
    const user = await prisma.userMetadata.findFirst({
      where: { email: emailNorm, activo: true },
      select: { id: true, email: true, password: true, tipo: true },
    });

    // // Opción B (estricta por índice compuesto): descomentar si preferís usar el @@unique
    // const user = await prisma.userMetadata.findUnique({
    //   where: { email_activo: { email: emailNorm, activo: true } },
    //   select: { id: true, email: true, password: true, tipo: true },
    // });

    if (!user) {
      return NextResponse.json(
        { message: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { message: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.tipo }, // 'operator' | 'labManager' | 'admin'
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const res = NextResponse.json({ message: 'Login exitoso' }, { status: 200 });
    res.cookies.set('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    return res;
  } catch (err) {
    console.error('Error /api/public/login:', err);
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
