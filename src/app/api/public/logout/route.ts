import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const c = await cookies();
  c.delete('token');
  return NextResponse.json({ ok: true });
}
