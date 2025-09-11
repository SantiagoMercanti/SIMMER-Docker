'use client';

import { useEffect, useMemo, useState } from 'react';

type Role = 'operator' | 'labManager' | 'admin';

type UserRow = {
  id: string;          // UUID
  nombre: string;
  apellido: string;
  email: string;
  tipo: Role;
  createdAt: string;   // ISO string
  updatedAt: string;   // ISO string
};

// Prefijo de API según entorno ('' en dev, '/a03' en prod)
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

const tipoOptions: Array<{ value: Role; label: string }> = [
  { value: 'operator', label: 'Operador' },
  { value: 'labManager', label: 'Jefe de Laboratorio' },
  { value: 'admin', label: 'Admin' },
];

export default function AdminUserTable() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  // Cargar usuarios
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(api('/api/users'), { credentials: 'include' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string })?.error || 'Error listando usuarios');
        }
        const data: UserRow[] = await res.json();
        if (!cancelled) setUsers(data);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message || 'Error listando usuarios');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Map rápido por id para lecturas
  const usersById = useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  async function handleTipoChange(userId: string, nextRole: Role) {
    const prev = usersById.get(userId);
    if (!prev || prev.tipo === nextRole) return;

    // Optimistic UI
    setSavingIds(s => ({ ...s, [userId]: true }));
    setUsers(list => list.map(u => (u.id === userId ? { ...u, tipo: nextRole } : u)));

    try {
      const res = await fetch(api(`/api/users/${userId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tipo: nextRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error || 'No se pudo actualizar el rol');
      }
      const updated: UserRow = await res.json();
      // Aseguramos estado final con lo devuelto por el backend
      setUsers(list => list.map(u => (u.id === userId ? updated : u)));
    } catch (e) {
      // Revertimos
      setUsers(list =>
        list.map(u => (u.id === userId && prev ? { ...u, tipo: prev.tipo } : u))
      );
      alert((e as Error).message || 'Error actualizando rol');
    } finally {
      setSavingIds(s => {
        const rest = { ...s };
        delete rest[userId];
        return rest;
      });
    }
  }

  async function handleDelete(userId: string) {
    const user = usersById.get(userId);
    if (!user) return;

    const ok = confirm(
      `¿Eliminar al usuario "${user.nombre} ${user.apellido}"? Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    setDeletingIds(s => ({ ...s, [userId]: true }));
    try {
      const res = await fetch(api(`/api/users/${userId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error || 'No se pudo eliminar el usuario');
      }
      setUsers(list => list.filter(u => u.id !== userId));
    } catch (e) {
      alert((e as Error).message || 'Error eliminando usuario');
    } finally {
      setDeletingIds(s => {
        const rest = { ...s };
        delete rest[userId];
        return rest;
      });
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-600">Cargando usuarios…</div>;
  }

  if (err) {
    return <div className="p-4 text-sm text-red-600">{err}</div>;
  }

  if (users.length === 0) {
    return <div className="p-4 text-sm text-gray-600">No hay usuarios para mostrar.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 text-sm bg-gray-200">
        <thead>
          <tr className="bg-gray-100 text-gray-700 uppercase text-center">
            <th className="p-3">Nombre</th>
            <th className="p-3">Apellido</th>
            <th className="p-3">Email</th>
            <th className="p-3">Fecha de creación</th>
            <th className="p-3">Tipo de usuario</th>
            <th className="p-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSaving = !!savingIds[user.id];
            const isDeleting = !!deletingIds[user.id];
            return (
              <tr
                key={user.id}
                className="border-b bg-white hover:bg-gray-50 transition text-center text-gray-600"
              >
                <td className="p-3">{user.nombre}</td>
                <td className="p-3">{user.apellido}</td>
                <td className="p-3">{user.email || 'Desconocido'}</td>
                <td className="p-3">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : 'Desconocida'}
                </td>
                <td className="p-3">
                  <select
                    value={user.tipo}
                    onChange={(e) => handleTipoChange(user.id, e.target.value as Role)}
                    className="border border-gray-300 rounded-md px-2 py-1 disabled:opacity-60"
                    disabled={isSaving || isDeleting}
                    aria-label={`Cambiar rol de ${user.nombre} ${user.apellido}`}
                    title={isSaving ? 'Guardando…' : 'Cambiar tipo de usuario'}
                  >
                    {tipoOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-800 disabled:opacity-60"
                    title="Eliminar usuario"
                    aria-label={`Eliminar ${user.nombre} ${user.apellido}`}
                    disabled={isSaving || isDeleting}
                  >
                    {/* podés reemplazar por un ícono más adelante si querés */}
                    <span role="img" aria-hidden="true">🗑️</span>
                    <span className="sr-only">Eliminar</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
