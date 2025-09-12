'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Role = 'operator' | 'labManager' | 'admin';

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`;

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // Ocultar en login/register
  const hideIn = useMemo(() => [`${BASE}/login`, `${BASE}/register`], []);
  const shouldHide = hideIn.includes(pathname || '');

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
        const data = (await res.json()) as { role?: Role };
        if (!cancelled) {
          setRole(data.role ?? null);
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
      await fetch(api('/api/public/logout'), { method: 'POST' });
    } catch {
      // ignore
    } finally {
      router.push(`${BASE}/login`);
    }
  };

  if (shouldHide) return null;

  return (
    <header className="w-full bg-blue-800 text-white shadow-md px-6 py-3 flex items-center justify-between">
      {/* Izquierda: SIMMER */}
      <button
        onClick={() => router.push(`${BASE}/dashboard`)}
        className="text-2xl tracking-wider text-white hover:text-gray-300 focus:outline-none"
        aria-label="Ir al Dashboard"
        type="button"
      >
        S I M M E R
      </button>

      {/* Derecha: Admin (si es admin) y Salir */}
      <div className="flex items-center gap-3">
        {!loading && role === 'admin' && (
          <button
            onClick={() => router.push(`${BASE}/admin`)}
            type="button"
            className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md transition text-sm font-medium"
            title="Ir a Admin"
          >
            {/* SVG escudo */}
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              className="opacity-90"
            >
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
          {/* SVG icono de salida */}
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            className="opacity-90"
          >
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
    </header>
  );
}
