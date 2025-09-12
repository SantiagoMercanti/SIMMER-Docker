import { NextRequest, NextResponse } from 'next/server';

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || '').replace(/\/$/, '');

const PUBLIC_EXACT = new Set<string>(['/login', '/register']);
const PUBLIC_PREFIX = ['/api/public']; // /api/public/** es público

function stripBase(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE || pathname === `${BASE}/`) return '/';
  return pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
}

function withBase(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${p}`.replace(/\/{2,}/g, '/');
}

function abs(req: NextRequest, path: string): URL {
  return new URL(withBase(path), req.url);
}

export function middleware(req: NextRequest) {
  const { nextUrl, cookies } = req;
  const rawPath = nextUrl.pathname;
  const path = stripBase(rawPath);

  const isApi = path.startsWith('/api');

  const isPublic =
    PUBLIC_EXACT.has(path) ||
    PUBLIC_PREFIX.some((pref) => path === pref || path.startsWith(pref + '/'));

  const token =
    cookies.get('token')?.value ||
    cookies.get('auth_token')?.value ||
    cookies.get('session')?.value ||
    null;

  // === Sin sesión: solo /login, /register y /api/public/**
  if (!isPublic && !token) {
    if (isApi) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    const url = abs(req, '/login');
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // Con sesión: si entra a /login o /register, mandalo al dashboard
  if (token && (path === '/login' || path === '/register')) {
    return NextResponse.redirect(abs(req, '/dashboard'));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml|static|assets).*)'],
};
