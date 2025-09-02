import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { nombre, apellido, email, password } = await req.json();

    // Validaciones mínimas
    if (!nombre?.trim() || !apellido?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ message: 'Faltan datos obligatorios' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ message: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    // ¿Existe el email?
    const existing = await prisma.userMetadata.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: 'El correo ya está registrado' }, { status: 409 });
    }

    // Hash de contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario (rol por defecto: operator)
    await prisma.userMetadata.create({
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        password: passwordHash,
        tipo: 'operator',
      },
    });

    return NextResponse.json({ message: 'Usuario registrado correctamente' }, { status: 201 });
  } catch (err) {
    console.error('Error /api/register:', err);
    return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
  }
}
