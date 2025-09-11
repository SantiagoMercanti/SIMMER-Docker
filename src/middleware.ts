import { NextRequest, NextResponse } from 'next/server';

// Base path tomado del entorno (prod) o vacío (dev)
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || '').replace(/\/$/, '');

// Rutas públicas exactas y prefijos públicos
const PUBLIC_EXACT = new Set<string>(['/login', '/register']);
const PUBLIC_PREFIX = ['/api/public']; // todo /api/public/* es público

// Prefijos que requieren sesión (solo presencia de token).
// El rol admin se valida dentro de la page / handlers con requireAdmin().
const PROTECTED_PREFIX = ['/admin', '/api/users'];

// Quita el basePath del pathname para comparar rutas de forma consistente
function stripBase(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE || pathname === `${BASE}/`) return '/';
  return pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
}

// Agrega el basePath a una ruta relativa
function withBase(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${p}`.replace(/\/{2,}/g, '/');
}

// Construye una URL absoluta hacia `path` respetando el basePath actual
function abs(req: NextRequest, path: string): URL {
  return new URL(withBase(path), req.url);
}

export function middleware(req: NextRequest) {
  const { nextUrl, cookies } = req;

  // normalizamos el path (sin base) para comparar
  const rawPath = nextUrl.pathname;
  const path = stripBase(rawPath);

  const isApi = path.startsWith('/api');
  const isPublic =
    PUBLIC_EXACT.has(path) ||
    PUBLIC_PREFIX.some((pref) => path === pref || path.startsWith(pref + '/'));

  // Detectá tu cookie de sesión (ajustá el nombre si usás otra)
  const token =
    cookies.get('token')?.value ||
    cookies.get('auth_token')?.value ||
    cookies.get('session')?.value ||
    null;

  // Si la ruta es pública, continuar
  if (isPublic) {
    return NextResponse.next();
  }

  // Si la ruta está bajo un prefijo protegido, exigimos sesión (solo presencia de token)
  const needsAuth = PROTECTED_PREFIX.some((pref) => path === pref || path.startsWith(pref + '/'));

  if (needsAuth && !token) {
    if (isApi) {
      // Para APIs devolvemos 401 JSON (mejor DX en fetch)
      return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }
    // Para páginas redirigimos a /login, guardando el destino en ?next= (sin base)
    const url = abs(req, '/login');
    url.searchParams.set('next', path); // ej: /admin
    return NextResponse.redirect(url);
  }

  // Si hay sesión y viene a /login o /register, mandalo al dashboard (o donde prefieras)
  if (token && (path === '/login' || path === '/register')) {
    return NextResponse.redirect(abs(req, '/dashboard'));
  }

  // Continuar normalmente
  return NextResponse.next();
}

// Matcher agnóstico del basePath (Next aplica el matcher tras el basePath).
// Ignoramos assets de Next y archivos públicos comunes.
export const config = {
  matcher: ['/((?!_next|favicon.ico|robots.txt|sitemap.xml|static|assets).*)'],
};
