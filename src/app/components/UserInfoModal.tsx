'use client';

import { useEffect, useState } from 'react';

// Helper SOLO para APIs (respeta tu NEXT_PUBLIC_BASE_PATH)
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

type Props = {
  open: boolean;
  onClose: () => void;
  defaults: {
    nombre: string;
    apellido: string;
    email: string;
  };
  onSaved?: (u: { nombre: string; apellido: string; email: string }) => void;
};

export default function UserInfoModal({ open, onClose, defaults, onSaved }: Props) {
  const [nombre, setNombre] = useState(defaults.nombre);
  const [apellido, setApellido] = useState(defaults.apellido);
  const [email, setEmail] = useState(defaults.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resetear valores al abrir o si cambian los defaults
  useEffect(() => {
    if (!open) return;
    setNombre(defaults.nombre);
    setApellido(defaults.apellido);
    setEmail(defaults.email);
    setError(null);
    setSaving(false);
  }, [open, defaults]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validaciones mínimas en cliente
    if (nombre.trim().length < 2) return setError('El nombre debe tener al menos 2 caracteres.');
    if (apellido.trim().length < 2) return setError('El apellido debe tener al menos 2 caracteres.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Email inválido.');

    try {
      setSaving(true);
      const res = await fetch(api('/api/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim().toLowerCase(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'No se pudo actualizar el perfil');
      }
      const updated = await res.json();
      onSaved?.({
        nombre: updated?.nombre ?? nombre,
        apellido: updated?.apellido ?? apellido,
        email: updated?.email ?? email,
      });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-800">Editar perfil</h3>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-gray-900"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Apellido</label>
            <input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-gray-900"
              placeholder="Tu apellido"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-gray-900"
              placeholder="tucorreo@dominio.com"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
