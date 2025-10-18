// src/app/api/public/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { nombre, apellido, email, password } = await req.json();

    const nombreTrim = (nombre ?? '').trim();
    const apellidoTrim = (apellido ?? '').trim();
    const emailNorm = (email ?? '').trim().toLowerCase();

    // Validaciones mínimas
    if (!nombreTrim || !apellidoTrim || !emailNorm || !password) {
      return NextResponse.json({ message: 'Faltan datos obligatorios' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    // ¿Existe un usuario ACTIVO con ese email? (borrado lógico respetado)
    const existing = await prisma.userMetadata.findFirst({
      where: { email: emailNorm, activo: true },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ message: 'El correo ya está registrado' }, { status: 409 });
    }

    // Hash de contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario (rol por defecto: operator)
    await prisma.userMetadata.create({
      data: {
        nombre: nombreTrim,
        apellido: apellidoTrim,
        email: emailNorm,
        password: passwordHash,
        tipo: 'operator',
        // activo: true // default
      },
    });

    return NextResponse.json({ message: 'Usuario registrado correctamente' }, { status: 201 });
  } catch (err: unknown) {
    // Evita race conditions: si otro proceso insertó justo antes, Prisma lanza P2002 (unique)
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ message: 'El correo ya está registrado' }, { status: 409 });
    }

    console.error('Error /api/public/register:', err);
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
