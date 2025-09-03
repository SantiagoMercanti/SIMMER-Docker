'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginClient() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => setMounted(true), []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('api/public/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.message || 'Usuario o contraseña incorrectos');
      } else {
        router.push('dashboard');
      }
    } catch (err) {
      console.error('Error al iniciar sesión: ', err);
      setErrorMsg('Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Opción A: si querés ocultar el UI hasta montar para evitar extensiones que inyectan atributos
  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4" suppressHydrationWarning>
      <div className="bg-white shadow-md rounded-lg p-8 w-full max-w-md">
        <h1 className="text-4xl font-bold text-blue-600 text-center mb-2 tracking-wide">
          SIMMER
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Sistema Informático de Monitoreo Mercanti
        </p>

        <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
          Iniciar sesión
        </h2>

        <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>
          <div>
            <label className="block mb-1 text-sm text-gray-600" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              required
              className="w-full px-4 py-2 border border-gray-300 text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm text-gray-600" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              className="w-full px-4 py-2 border border-gray-300 text-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-md transition duration-200"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          {errorMsg && (
            <p className="text-sm text-red-600 text-center mt-2" role="alert" aria-live="polite">
              {errorMsg}
            </p>
          )}
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="text-blue-600 hover:underline font-medium"
            >
              Regístrate
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
