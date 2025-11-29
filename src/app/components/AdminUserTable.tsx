'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Role = 'operator' | 'labManager' | 'admin';

type UserRow = {
  id: string;          // UUID
  nombre: string;
  apellido: string;
  email: string;
  tipo: Role;
  activo?: boolean;    // opcional por si el backend no lo incluye siempre
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
  const [activeUsers, setActiveUsers] = useState<UserRow[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // estados por fila
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [reactivatingIds, setReactivatingIds] = useState<Record<string, boolean>>({});

  // Mapa value->label para mostrar etiquetas en la tabla de inactivos
  const roleLabelMap = useMemo(
    () => Object.fromEntries(tipoOptions.map(o => [o.value, o.label])) as Record<Role, string>,
    []
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [resAct, resInact] = await Promise.all([
        fetch(api('/api/users'), { credentials: 'include' }),
        fetch(api('/api/users?status=inactive'), { credentials: 'include' }),
      ]);
      if (!resAct.ok) {
        const d = await resAct.json().catch(() => ({}));
        throw new Error((d as { error?: string })?.error || 'Error listando usuarios activos');
      }
      if (!resInact.ok) {
        const d = await resInact.json().catch(() => ({}));
        throw new Error((d as { error?: string })?.error || 'Error listando usuarios inactivos');
      }
      const [act, inact] = (await Promise.all([resAct.json(), resInact.json()])) as [
        UserRow[],
        UserRow[]
      ];
      setActiveUsers(act);
      setInactiveUsers(inact);
    } catch (e) {
      setErr((e as Error).message || 'Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadAll(); })();
    return () => { cancelled = true; };
  }, [loadAll]);

  // Map por id (activos)
  const actById = useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of activeUsers) m.set(u.id, u);
    return m;
  }, [activeUsers]);

  // Map por id (inactivos)
  const inactById = useMemo(() => {
    const m = new Map<string, UserRow>();
    for (const u of inactiveUsers) m.set(u.id, u);
    return m;
  }, [inactiveUsers]);

  // Cambiar rol (solo activos)
  async function handleTipoChange(userId: string, nextRole: Role) {
    const prev = actById.get(userId);
    if (!prev || prev.tipo === nextRole) return;

    // Optimista
    setSavingIds(s => ({ ...s, [userId]: true }));
    setActiveUsers(list => list.map(u => (u.id === userId ? { ...u, tipo: nextRole } : u)));

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
      setActiveUsers(list => list.map(u => (u.id === userId ? updated : u)));
      // No hace falta recargar inactivos (no cambia ese conjunto)
    } catch (e) {
      // Revertir
      setActiveUsers(list =>
        list.map(u => (u.id === userId && prev ? { ...u, tipo: prev.tipo } : u))
      );
      alert((e as Error).message || 'Error actualizando rol');
    } finally {
      setSavingIds(s => {
        const r = { ...s };
        delete r[userId];
        return r;
      });
    }
  }

  // Eliminar (soft-delete) → pasa de activos a inactivos
  async function handleDelete(userId: string) {
    const user = actById.get(userId);
    if (!user) return;

    const ok = confirm(
      `¿Eliminar al usuario "${user.nombre} ${user.apellido}"?`
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
      // Simplísimo y consistente: recargar ambas listas
      await loadAll();
    } catch (e) {
      alert((e as Error).message || 'Error eliminando usuario');
    } finally {
      setDeletingIds(s => {
        const r = { ...s };
        delete r[userId];
        return r;
      });
    }
  }

  // Reactivar (solo inactivos) → pasa a activos
  async function handleReactivate(userId: string) {
    const user = inactById.get(userId);
    if (!user) return;

    setReactivatingIds(s => ({ ...s, [userId]: true }));

    const run = async (body?: { newEmail?: string }) => {
      const res = await fetch(api(`/api/users/${userId}/reactivate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 409) {
        // Email en uso: pedir otro y reintentar
        const suggestion = window.prompt(
          'El email está en uso por otro usuario activo.\nIngresá un nuevo email para reactivar:'
        );
        if (suggestion && suggestion.trim()) {
          return run({ newEmail: suggestion.trim().toLowerCase() });
        }
        throw new Error('Reactivación cancelada.');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string })?.error || 'No se pudo reactivar el usuario');
      }

      return res.json();
    };

    try {
      await run();
      // Recargar ambas listas para reflejar el cambio
      await loadAll();
    } catch (e) {
      alert((e as Error).message || 'Error reactivando usuario');
    } finally {
      setReactivatingIds(s => {
        const r = { ...s };
        delete r[userId];
        return r;
      });
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-600">Cargando usuarios…</div>;
  }

  if (err) {
    return <div className="p-4 text-sm text-red-600">{err}</div>;
  }

  return (
    <div className="space-y-8">
      {/* ====== Activos ====== */}
      <section className="overflow-x-auto max-h-[60vh] overflow-y-auto bg-white shadow-md rounded-lg p-4">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">
            Usuarios activos <span className="text-gray-400">({activeUsers.length})</span>
          </h2>
        </header>

        {activeUsers.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No hay usuarios activos.</div>
        ) : (
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
              {activeUsers.map((user) => {
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
                        className="text-red-600 hover:text-red-800 disabled:opacity-60 underline underline-offset-4"
                        title="Eliminar (soft-delete)"
                        aria-label={`Eliminar ${user.nombre} ${user.apellido}`}
                        disabled={isSaving || isDeleting}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ====== Inactivos ====== */}
      <section className="overflow-x-auto max-h-[60vh] overflow-y-auto bg-white shadow-md rounded-lg p-4">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-700">
            Usuarios inactivos <span className="text-gray-400">({inactiveUsers.length})</span>
          </h2>
        </header>

        {inactiveUsers.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No hay usuarios inactivos.</div>
        ) : (
          <table className="min-w-full border border-gray-200 text-sm bg-gray-200">
            <thead>
              <tr className="bg-gray-100 text-gray-700 uppercase text-center">
                <th className="p-3">Nombre</th>
                <th className="p-3">Apellido</th>
                <th className="p-3">Email</th>
                <th className="p-3">Fecha de creación</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inactiveUsers.map((u) => {
                const isWorking = !!reactivatingIds[u.id];
                return (
                  <tr key={u.id} className="border-b bg-white hover:bg-gray-50 transition text-center text-gray-600">
                    <td className="p-3">{u.nombre}</td>
                    <td className="p-3">{u.apellido}</td>
                    <td className="p-3">{u.email || 'Desconocido'}</td>
                    <td className="p-3">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Desconocida'}</td>
                    <td className="p-3">
                      {/* Mostrar etiqueta según mapa de roles */}
                      {roleLabelMap[u.tipo] ?? u.tipo}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => handleReactivate(u.id)}
                        className="text-green-600 hover:text-green-800 disabled:opacity-60 underline underline-offset-4"
                        title="Reactivar usuario"
                        aria-label={`Reactivar ${u.nombre} ${u.apellido}`}
                        disabled={isWorking}
                      >
                        Reactivar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
