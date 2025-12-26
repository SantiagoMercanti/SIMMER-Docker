// Archivo: src/app/components/ProjectNotes.tsx
'use client';

import { useState, useEffect } from 'react';

type Nota = {
  id: number;
  contenido: string;
  createdAt: string;
  updatedAt: string;
  usuario: {
    id: string;
    email: string;
    nombreCompleto: string;
  };
};

type Props = {
  projectId: number;
  currentUserId?: string;
  isAdmin?: boolean;
};

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '—';

  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProjectNotes({ projectId, currentUserId, isAdmin }: Props) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(false);
  const [nuevoContenido, setNuevoContenido] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  const loadNotas = async () => {
    setLoading(true);
    try {
      const res = await fetch(api(`/api/projects/${projectId}/notes`), {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('No se pudieron cargar las notas');
      const data = await res.json();
      setNotas(data.notas || []);
    } catch (err) {
      console.error('Error al cargar notas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotas();
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoContenido.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(api(`/api/projects/${projectId}/notes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: nuevoContenido }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(error?.error || 'Error al crear la nota');
        return;
      }

      setNuevoContenido('');
      await loadNotas();
    } catch (err) {
      console.error('Error al crear nota:', err);
      alert('Error al crear la nota');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (notaId: number) => {
    if (!editContent.trim()) return;

    try {
      const res = await fetch(api(`/api/projects/${projectId}/notes/${notaId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido: editContent }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(error?.error || 'Error al actualizar la nota');
        return;
      }

      setEditingId(null);
      setEditContent('');
      await loadNotas();
    } catch (err) {
      console.error('Error al actualizar nota:', err);
      alert('Error al actualizar la nota');
    }
  };

  const handleDelete = async (notaId: number) => {
    if (!confirm('¿Eliminar esta nota?')) return;

    try {
      const res = await fetch(api(`/api/projects/${projectId}/notes/${notaId}`), {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(error?.error || 'Error al eliminar la nota');
        return;
      }

      await loadNotas();
    } catch (err) {
      console.error('Error al eliminar nota:', err);
      alert('Error al eliminar la nota');
    }
  };

  const canEdit = (nota: Nota) => {
    return nota.usuario.id === currentUserId || isAdmin;
  };

  return (
    <div className="space-y-4">
      {/* Formulario para nueva nota */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nueva nota
          </label>
          <textarea
            value={nuevoContenido}
            onChange={(e) => setNuevoContenido(e.target.value)}
            placeholder="Escribe una nota sobre este proyecto..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-800"
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !nuevoContenido.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {submitting ? 'Guardando...' : 'Agregar nota'}
        </button>
      </form>

      {/* Lista de notas */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">
          Notas ({notas.length})
        </h4>

        {loading && <p className="text-sm text-gray-500">Cargando notas...</p>}

        {!loading && notas.length === 0 && (
          <p className="text-sm text-gray-500 italic">No hay notas aún.</p>
        )}

        {!loading && notas.map((nota) => (
          <div
            key={nota.id}
            className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200"
          >
            {editingId === nota.id ? (
              // Modo edición
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(nota.id)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditContent('');
                    }}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-xs font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              // Modo visualización
              <>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {nota.contenido}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="space-y-0.5">
                    <p>
                      <span className="font-medium">{nota.usuario.nombreCompleto}</span>
                      {' · '}
                      <span className="text-gray-400">{nota.usuario.email}</span>
                    </p>
                    <p>
                      {formatDate(nota.createdAt)}
                      {nota.updatedAt !== nota.createdAt && (
                        <span className="text-gray-400"> (editado)</span>
                      )}
                    </p>
                  </div>
                  {canEdit(nota) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(nota.id);
                          setEditContent(nota.contenido);
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                        title="Editar nota"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(nota.id)}
                        className="text-red-600 hover:text-red-700 font-medium"
                        title="Eliminar nota"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
