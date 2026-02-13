'use client';

// Archivo: src/app/components/ProjectNotes.tsx
import { useState, useEffect, useCallback, useRef } from 'react';

type ImagenMeta = {
  id: number;
  mimeType: string;
  nombre: string;
  tamanio: number;
};

type ImagenPendiente = {
  base64: string;
  mimeType: string;
  nombre: string;
  // preview local para mostrar antes de guardar
  previewUrl: string;
};

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
  imagenes: ImagenMeta[];
};

type Props = {
  projectId: number;
  currentUserId?: string;
  isAdmin?: boolean;
  canWrite?: boolean; // false = proyecto público ajeno, solo lectura
};

const MAX_IMAGENES = 3;
const MAX_BYTES = 1 * 1024 * 1024; // 1 MB
const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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

function imagenUrl(projectId: number, noteId: number, imageId: number) {
  return api(`/api/projects/${projectId}/notes/${noteId}/images/${imageId}`);
}

// Convierte un File a base64 y valida tamaño/tipo
async function fileAImagenPendiente(file: File): Promise<ImagenPendiente | string> {
  if (!MIME_PERMITIDOS.includes(file.type)) {
    return `"${file.name}": tipo no permitido. Solo JPEG, PNG, WebP, GIF.`;
  }
  if (file.size > MAX_BYTES) {
    return `"${file.name}": supera el límite de 1 MB.`;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result = "data:image/jpeg;base64,XXXXXX"
      const base64 = result.split(',')[1];
      resolve({
        base64,
        mimeType: file.type,
        nombre: file.name,
        previewUrl: result,
      });
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

// Subcomponente: selector de imágenes reutilizable
function SelectorImagenes({
  imagenes,
  onChange,
  disabled,
}: {
  imagenes: ImagenPendiente[];
  onChange: (imagenes: ImagenPendiente[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const disponibles = MAX_IMAGENES - imagenes.length;
    if (disponibles <= 0) return;

    const errores: string[] = [];
    const nuevas: ImagenPendiente[] = [];

    for (let i = 0; i < Math.min(files.length, disponibles); i++) {
      const resultado = await fileAImagenPendiente(files[i]);
      if (typeof resultado === 'string') {
        errores.push(resultado);
      } else {
        nuevas.push(resultado);
      }
    }

    if (errores.length > 0) {
      alert('Algunos archivos no se pudieron agregar:\n' + errores.join('\n'));
    }

    if (nuevas.length > 0) {
      onChange([...imagenes, ...nuevas]);
    }

    // Limpiar el input para permitir seleccionar el mismo archivo de vuelta
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = (index: number) => {
    onChange(imagenes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {/* Previews de imágenes pendientes */}
      {imagenes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imagenes.map((img, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt={img.nombre}
                className="w-20 h-20 object-cover rounded-md border border-gray-300"
              />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                disabled={disabled}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 shadow disabled:opacity-50"
                title="Quitar imagen"
              >
                ✕
              </button>
              <p className="text-xs text-gray-500 mt-0.5 max-w-[80px] truncate" title={img.nombre}>
                {img.nombre}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Botón agregar si hay espacio */}
      {imagenes.length < MAX_IMAGENES && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={MIME_PERMITIDOS.join(',')}
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 border border-gray-300 border-dashed rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adjuntar imagen ({imagenes.length}/{MAX_IMAGENES})
          </button>
          <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP o GIF · máx. 1 MB por imagen</p>
        </div>
      )}
    </div>
  );
}

// Subcomponente: galería de imágenes ya guardadas
function GaleriaImagenes({
  projectId,
  noteId,
  imagenes,
}: {
  projectId: number;
  noteId: number;
  imagenes: ImagenMeta[];
}) {
  const [viendoIdx, setViendoIdx] = useState<number | null>(null);

  if (imagenes.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {imagenes.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setViendoIdx(i)}
            className="relative group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
            title={img.nombre}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagenUrl(projectId, noteId, img.id)}
              alt={img.nombre}
              className="w-16 h-16 object-cover rounded-md border border-gray-300 group-hover:opacity-90 transition-opacity"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Lightbox simple */}
      {viendoIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViendoIdx(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <span className="text-sm text-gray-700 font-medium truncate max-w-xs">
                {imagenes[viendoIdx].nombre}
              </span>
              <div className="flex items-center gap-2">
                {imagenes.length > 1 && (
                  <>
                    <button
                      onClick={() => setViendoIdx((viendoIdx - 1 + imagenes.length) % imagenes.length)}
                      className="text-gray-500 hover:text-gray-800 px-2 py-1 text-sm"
                    >
                      ‹ Anterior
                    </button>
                    <button
                      onClick={() => setViendoIdx((viendoIdx + 1) % imagenes.length)}
                      className="text-gray-500 hover:text-gray-800 px-2 py-1 text-sm"
                    >
                      Siguiente ›
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViendoIdx(null)}
                  className="text-gray-500 hover:text-gray-800 font-medium px-2 py-1"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagenUrl(projectId, noteId, imagenes[viendoIdx].id)}
              alt={imagenes[viendoIdx].nombre}
              className="max-w-full max-h-[80vh] object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

export default function ProjectNotes({ projectId, currentUserId, isAdmin, canWrite = true }: Props) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(false);

  // Estado para nueva nota
  const [nuevoContenido, setNuevoContenido] = useState('');
  const [nuevasImagenes, setNuevasImagenes] = useState<ImagenPendiente[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Estado para edición
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  // null = no tocar imágenes existentes; array = reemplazarlas por estas
  const [editImagenes, setEditImagenes] = useState<ImagenPendiente[] | null>(null);

  const loadNotas = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => {
    loadNotas();
  }, [loadNotas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoContenido.trim()) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { contenido: nuevoContenido };
      if (nuevasImagenes.length > 0) {
        body.imagenes = nuevasImagenes.map(({ base64, mimeType, nombre }) => ({
          base64,
          mimeType,
          nombre,
        }));
      }

      const res = await fetch(api(`/api/projects/${projectId}/notes`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(error?.error || 'Error al crear la nota');
        return;
      }

      setNuevoContenido('');
      setNuevasImagenes([]);
      await loadNotas();
    } catch (err) {
      console.error('Error al crear nota:', err);
      alert('Error al crear la nota');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (nota: Nota) => {
    setEditingId(nota.id);
    setEditContent(nota.contenido);
    setEditImagenes(null); // null = no tocar imágenes existentes por defecto
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent('');
    setEditImagenes(null);
  };

  const handleUpdate = async (notaId: number) => {
    if (!editContent.trim()) return;

    try {
      const body: Record<string, unknown> = { contenido: editContent };

      // Solo enviar imagenes si el usuario eligió reemplazarlas
      if (editImagenes !== null) {
        body.imagenes = editImagenes.map(({ base64, mimeType, nombre }) => ({
          base64,
          mimeType,
          nombre,
        }));
      }

      const res = await fetch(api(`/api/projects/${projectId}/notes/${notaId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        alert(error?.error || 'Error al actualizar la nota');
        return;
      }

      cancelEditing();
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

  const canEdit = (nota: Nota) => canWrite && (nota.usuario.id === currentUserId || isAdmin);

  return (
    <div className="space-y-4">
      {/* Formulario nueva nota — solo si el usuario puede escribir */}
      {canWrite ? (
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

          <SelectorImagenes
            imagenes={nuevasImagenes}
            onChange={setNuevasImagenes}
            disabled={submitting}
          />

          <button
            type="submit"
            disabled={submitting || !nuevoContenido.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {submitting ? 'Guardando...' : 'Agregar nota'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-500 italic bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          Este es un proyecto público. Solo podés ver las notas.
        </p>
      )}

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
              <div className="space-y-3">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm text-gray-800"
                />

                {/* Sección imágenes en edición */}
                <div className="space-y-2">
                  {editImagenes === null ? (
                    // Mostrar imágenes actuales con opción de reemplazar
                    <div className="space-y-2">
                      {nota.imagenes.length > 0 && (
                        <GaleriaImagenes
                          projectId={projectId}
                          noteId={nota.id}
                          imagenes={nota.imagenes}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setEditImagenes([])}
                        className="text-xs text-orange-600 hover:text-orange-700 underline"
                      >
                        {nota.imagenes.length > 0
                          ? 'Reemplazar imágenes actuales'
                          : 'Agregar imágenes'}
                      </button>
                    </div>
                  ) : (
                    // Modo reemplazo: selector con nuevas imágenes
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">
                        Las imágenes anteriores serán reemplazadas al guardar.{' '}
                        <button
                          type="button"
                          onClick={() => setEditImagenes(null)}
                          className="text-blue-600 hover:underline"
                        >
                          Cancelar cambio
                        </button>
                      </p>
                      <SelectorImagenes
                        imagenes={editImagenes}
                        onChange={setEditImagenes}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdate(nota.id)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
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

                {nota.imagenes.length > 0 && (
                  <GaleriaImagenes
                    projectId={projectId}
                    noteId={nota.id}
                    imagenes={nota.imagenes}
                  />
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
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
                        type="button"
                        onClick={() => startEditing(nota)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(nota.id)}
                        className="text-red-600 hover:text-red-700 font-medium"
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
