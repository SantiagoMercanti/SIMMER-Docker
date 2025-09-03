import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_ROUTES = ['/login', '/register'];
const JWT_SECRET = process.env.JWT_SECRET || 'secret_key';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  console.log('🛡️ Middleware ejecutado para:', pathname);

  const token = request.cookies.get('token')?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, secret); // ✔ Compatible con Edge Runtime
    return NextResponse.next();
  } catch (err) {
    console.warn('⚠️ Token inválido o expirado:', err);
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|images|api/public).*)'],
};
