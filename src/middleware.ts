import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// '' en dev, '/a03' en prod (sin barra final)
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');

const LOGIN_PATH = '/login';
const REGISTER_PATH = '/register';
const DASHBOARD_PATH = '/dashboard';

// helpers
const toAbs = (p: string) => `${BASE}${p}`; // agrega basePath
const isStatic = (p: string) =>
  p.startsWith('/_next/') ||
  p === '/favicon.ico' ||
  /\.[a-zA-Z0-9]+$/.test(p);

const isPublic = (p: string) =>
  p === LOGIN_PATH ||
  p.startsWith('/login/') ||
  p === REGISTER_PATH ||
  p.startsWith('/register/') ||
  p.startsWith('/api/public');

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Normalizar: quitar BASE del pathname para comparar contra rutas "planas"
  const path =
    BASE && pathname.startsWith(BASE)
      ? pathname.slice(BASE.length) || '/'
      : pathname;

  if (isStatic(path) || isPublic(path)) return NextResponse.next();

  const token = req.cookies.get('token')?.value;

  // Sin token → mandar a /login (pero no si ya estás ahí)
  if (!token) {
    if (path !== LOGIN_PATH && !path.startsWith('/login/')) {
      return NextResponse.redirect(new URL(toAbs(LOGIN_PATH), req.url));
    }
    return NextResponse.next();
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('Missing JWT_SECRET');
    await jwtVerify(token, new TextEncoder().encode(secret));

    // Con token válido y visitando /login → /dashboard
    if (path === LOGIN_PATH || path.startsWith('/login/')) {
      return NextResponse.redirect(new URL(toAbs(DASHBOARD_PATH), req.url));
    }
    return NextResponse.next();
  } catch {
    // Token inválido: si ya estás en /login, no redirijas otra vez
    if (path === LOGIN_PATH || path.startsWith('/login/')) {
      const res = NextResponse.next();
      res.cookies.delete('token');
      return res;
    }
    const res = NextResponse.redirect(new URL(toAbs(LOGIN_PATH), req.url));
    res.cookies.delete('token');
    return res;
  }
}

// Ejecutar en dev (/) y prod (/a03)
export const config = {
  matcher: ['/(.*)', '/a03/(.*)'],
};
