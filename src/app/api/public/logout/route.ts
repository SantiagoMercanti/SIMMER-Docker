// src/app/api/public/logout/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const c = await cookies();
  // Ajusta el nombre del cookie si usás otro:
  c.delete('token');
  return NextResponse.json({ ok: true });
}
