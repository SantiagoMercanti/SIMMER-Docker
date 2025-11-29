'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Role = 'operator' | 'labManager' | 'admin';

const roleLabels: Record<Role, string> = {
  operator: 'Operador',
  labManager: 'Jefe de laboratorio',
  admin: 'Admin',
};

// Helper SOLO para APIs
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`;

export default function Header() {
  const pathname = usePathname(); // puede venir con o sin basePath según config
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [nombre, setNombre] = useState<string>('');
  const [apellido, setApellido] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Ocultar en /login y /register, sea que pathname traiga o no el basePath
  const shouldHide = useMemo(() => {
    const p = pathname || '';
    return p.endsWith('/login') || p.endsWith('/register');
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const fetchUser = async () => {
      try {
        const res = await fetch(api('/api/me'), { cache: 'no-store' });
        if (res.status === 401) {
          if (!cancelled) {
            setRole(null);
            setLoading(false);
          }
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          role?: Role;
          nombre?: string;
          apellido?: string;
        };
        if (!cancelled) {
          setRole(data.role ?? null);
          setNombre(data.nombre ?? '');
          setApellido(data.apellido ?? '');
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    if (!shouldHide) fetchUser();
    return () => {
      cancelled = true;
    };
  }, [shouldHide]);

  const handleLogout = async () => {
    try {
      await fetch(api('/api/public/logout'), { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    } finally {
      // No usar BASE acá: Next añade basePath automáticamente
      router.push('/login');
    }
  };

  if (shouldHide) return null;

  return (
    <header className="w-full bg-blue-800 text-white shadow-md px-6 py-3 flex items-center justify-between">
      {/* Izquierda: SIMMER */}
      <button
        onClick={() => router.push('/dashboard')}
        className="text-2xl tracking-wider text-white hover:text-gray-300 focus:outline-none"
        aria-label="Ir al Dashboard"
        type="button"
      >
        S I M M E R
      </button>

      {/* Derecha: Datos de usuario + botones */}
      <div className="flex items-center gap-6">
        {/* Texto de usuario clickeable */}
        {!loading && role && (
          <button
            onClick={() => router.push('/user')}
            className="flex flex-col text-right leading-tight hover:text-gray-300 focus:outline-none"
            type="button"
          >
            <span className="text-base font-medium">
              {nombre} {apellido}
            </span>
            {role !== 'admin' && (
              <span className="text-sm text-gray-300">{roleLabels[role]}</span>
            )}
          </button>
        )}

        {/* Botones */}
        <div className="flex items-center gap-3">
          {!loading && role === 'admin' && (
            <button
              onClick={() => router.push('/admin')}
              type="button"
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md transition text-sm font-medium"
              title="Ir a Admin"
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className="opacity-90">
                <path
                  d="M12 3l7 3v6c0 4.418-3.582 8-7 8s-7-3.582-7-8V6l7-3z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Admin</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            type="button"
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md transition text-sm font-medium"
            title="Cerrar sesión"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className="opacity-90">
              <path
                d="M16 17l5-5-5-5M21 12H9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
