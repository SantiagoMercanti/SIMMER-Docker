'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

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

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Estado del flujo
  const [step, setStep] = useState<'email' | 'code'>(('email'));
  
  // Paso 1: Email
  const [email, setEmail] = useState('');
  
  // Paso 2: Código y contraseña
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Paso 1: Solicitar código
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch(api('/api/public/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.message || 'Error al enviar el código');
      } else {
        setSuccessMsg('Si el correo existe, recibirás un código. Revisa tu bandeja.');
        setStep('code');
      }
    } catch (err) {
      console.error('Error al solicitar código:', err);
      setErrorMsg('Error al enviar el código');
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: Resetear contraseña
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password !== repeatPassword) {
      setErrorMsg('Las contraseñas no coinciden');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrorMsg(passwordError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(api('/api/public/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.message || 'Error al resetear la contraseña');
      } else {
        setSuccessMsg('Contraseña actualizada correctamente. Redirigiendo...');
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch (err) {
      console.error('Error al resetear contraseña:', err);
      setErrorMsg('Error al resetear la contraseña');
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
          Recuperar contraseña
        </h2>

        {step === 'email' ? (
          <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
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

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-md transition"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>

            {successMsg && (
              <p className="text-sm text-green-600 text-center">{successMsg}</p>
            )}
            {errorMsg && (
              <p className="text-sm text-red-600 text-center">{errorMsg}</p>
            )}
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <div>
              <label htmlFor="code" className="block mb-1 text-sm text-gray-600">
                Código de recuperación
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC12345"
                required
                maxLength={8}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-lg font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ingresa el código de 8 caracteres recibido por correo
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block mb-1 text-sm text-gray-600">
                Nueva contraseña
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
                Mínimo 8 caracteres, una mayúscula y un número
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
              {loading ? 'Actualizando...' : 'Cambiar contraseña'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setPassword('');
                setRepeatPassword('');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Volver a ingresar email
            </button>

            {successMsg && (
              <p className="text-sm text-green-600 text-center">{successMsg}</p>
            )}
            {errorMsg && (
              <p className="text-sm text-red-600 text-center">{errorMsg}</p>
            )}
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-sm text-gray-600 hover:underline"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  );
}
