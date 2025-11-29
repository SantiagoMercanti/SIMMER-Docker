'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

// Función para validar contraseña
const validatePassword = (password: string): string | null => {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe contener al menos una letra mayúscula.';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe contener al menos un número.';
  }
  return null;
};

export default function RegisterPage() {
  const router = useRouter();

  const [nombre, setNombre] = useState<string>('');
  const [apellido, setApellido] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [repeatPassword, setRepeatPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedNombre = nombre.trim();
    const trimmedApellido = apellido.trim();
    const trimmedEmail = email.trim();

    if (!trimmedNombre || !trimmedApellido) {
      setErrorMsg('Nombre y apellido son obligatorios.');
      return;
    }

    if (password !== repeatPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    // Validar contraseña con los nuevos requisitos
    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrorMsg(passwordError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(api('/api/public/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: trimmedNombre,
          apellido: trimmedApellido,
          email: trimmedEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.message || 'Error al registrar el usuario');
      } else {
        router.push('/login'); // absoluto (basePath-aware)
      }
    } catch (err) {
      console.error('Error al registrar el usuario: ', err);
      setErrorMsg('Error al registrar el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-md rounded-lg p-8 w-full max-w-md">
        <h1 className="text-4xl font-bold text-blue-600 text-center mb-2 tracking-wide">
          SIMMER
        </h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Sistema Informático de Monitoreo Mercanti
        </p>

        <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
          Registro de usuario
        </h2>

        <form onSubmit={handleRegister} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="nombre" className="block mb-1 text-sm text-gray-600">
              Nombre
            </label>
            <input
              id="nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Juan"
              required
              autoComplete="given-name"
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="apellido" className="block mb-1 text-sm text-gray-600">
              Apellido
            </label>
            <input
              id="apellido"
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Pérez"
              required
              autoComplete="family-name"
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block mb-1 text-sm text-gray-600">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              required
              autoComplete="email"
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-1 text-sm text-gray-600">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              autoComplete="new-password"
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Mínimo 8 caracteres, una mayúscula y un número.
            </p>
          </div>

          <div>
            <label htmlFor="repeatPassword" className="block mb-1 text-sm text-gray-600">
              Repetir contraseña
            </label>
            <input
              id="repeatPassword"
              type="password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              placeholder="********"
              required
              autoComplete="new-password"
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-md transition"
          >
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>

          {errorMsg && (
            <p
              className="text-sm text-red-600 text-center"
              role="alert"
              aria-live="polite"
            >
              {errorMsg}
            </p>
          )}
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            ¿Ya tienes una cuenta?{' '}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="text-blue-600 hover:underline font-medium"
            >
              Inicia sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
