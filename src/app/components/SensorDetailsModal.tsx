'use client';

import { useEffect, useMemo, useState } from 'react';

/** Roles permitidos en UI */
type Role = 'operator' | 'labManager' | 'admin';

type ApiSensorAnyCase = {
  sensor_id?: number;
  sensorId?: number;
  nombre: string;
  descripcion?: string | null;

  // unidad como objeto (nuevo)
  unidadMedida?: {
    id: number;
    nombre: string;
    simbolo: string;
    categoria: string;
  };
  unidadMedidaId?: number;

  // rangos
  valor_max?: number;
  valorMax?: number;
  valor_min?: number;
  valorMin?: number;

  // estado
  estado?: boolean;

  // fuente
  fuente_datos?: string | null;
  fuenteDatos?: string | null;

  // fechas (por si alguna ruta serializa distinto)
  createdAt?: string;
  created_at?: string;
  created?: string;
  updatedAt?: string;
  updated_at?: string;
  updated?: string;
};

type SensorDetail = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  unidad: string;  // Guardaremos el símbolo para mostrar
  unidadNombre?: string;  // Opcional: nombre completo
  valorMax: number | null;
  valorMin: number | null;
  estado: boolean;
  fuente: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProjectInfo = {
  id: number;
  nombre: string;
};

type Props = {
  open: boolean;
  sensorId: string | null;
  onClose: () => void;
  onGoProjects?: (sensorId: number) => void;
  onGoLogs?: (sensorId: number) => void;
  onOpenProject?: (projectId: number) => void; // Nueva prop para abrir modal de proyecto
};

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

/** --- Helpers CLIENT-SAFE --- */
function isManagerOrAdmin(role: Role) {
  return role === 'labManager' || role === 'admin';
}

/** --- Normalizador API (acepta camelCase y snake_case) --- */
function normalizeSensor(data: ApiSensorAnyCase): SensorDetail {
  const unidad = data.unidadMedida?.simbolo ?? '';
  const unidadNombre = data.unidadMedida?.nombre;
  const valorMax = (data.valor_max ?? data.valorMax ?? null) as number | null;
  const valorMin = (data.valor_min ?? data.valorMin ?? null) as number | null;
  const fuente = (data.fuente_datos ?? data.fuenteDatos ?? null) as string | null;
  const id = (data.sensor_id ?? data.sensorId ?? 0) as number;

  // fechas en orden de preferencia
  const cAt = data.createdAt ?? data.created_at ?? data.created;
  const uAt = data.updatedAt ?? data.updated_at ?? data.updated;

  return {
    id,
    nombre: data.nombre,
    descripcion: data.descripcion ?? '',
    unidad,
    unidadNombre,
    valorMax,
    valorMin,
    estado: Boolean(data.estado),
    fuente,
    createdAt: cAt,
    updatedAt: uAt,
  };
}

export default function SensorDetailsModal({
  open,
  sensorId,
  onClose,
  // onGoProjects,
  onGoLogs,
  onOpenProject,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<SensorDetail | null>(null);
  const [localEstado, setLocalEstado] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role>('operator'); // default
  
  // Estado para la lista de proyectos
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  // Traer el rol real desde el server (DB) usando tu endpoint /api/me
  useEffect(() => {
    if (!open) return; // solo cuando el modal se abre
    let abort = false;
    (async () => {
      try {
        const res = await fetch(api('/api/me'), { cache: 'no-store' });
        if (!res.ok) {
          if (!abort) setRole('operator');
          return;
        }
        const me = (await res.json()) as { role?: string };
        const r = me.role;
        if (!abort) {
          setRole(r === 'admin' || r === 'labManager' ? (r as Role) : 'operator');
        }
      } catch {
        if (!abort) setRole('operator');
      }
    })();
    return () => {
      abort = true;
    };
  }, [open]);

  const canSeeSensitive = isManagerOrAdmin(role);

  // Cargar detalle del sensor
  useEffect(() => {
    if (!open || !sensorId) {
      setDetail(null);
      setLocalEstado(null);
      return;
    }
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(api(`/api/sensors/${sensorId}`), { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo obtener el sensor');
        const raw = (await res.json()) as ApiSensorAnyCase;
        const norm = normalizeSensor(raw);
        if (!abort) {
          setDetail(norm);
          setLocalEstado(Boolean(norm.estado));
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [open, sensorId]);

  // Cargar proyectos cuando se expande la sección
  useEffect(() => {
    if (!showProjects || !sensorId) {
      return;
    }
    let abort = false;
    (async () => {
      try {
        setLoadingProjects(true);
        const res = await fetch(api(`/api/sensors/${sensorId}/usage`), { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudieron obtener los proyectos');
        const data = (await res.json()) as { projects: ProjectInfo[] };
        if (!abort) {
          setProjects(data.projects || []);
        }
      } catch (e) {
        console.error(e);
        if (!abort) {
          setProjects([]);
        }
      } finally {
        if (!abort) setLoadingProjects(false);
      }
    })();
    return () => { abort = true; };
  }, [showProjects, sensorId]);

  const valorActualConUnidad = useMemo(() => {
    if (!detail) return '';
    // hardcode 20 con unidad
    const u = detail.unidad ? ` ${detail.unidad}` : '';
    return `20${u}`;
  }, [detail]);

  const rangoEstable = useMemo(() => {
    if (!detail) return '—';
    const { valorMin, valorMax, unidad } = detail;
    if (
      typeof valorMin !== 'number' ||
      typeof valorMax !== 'number'
    ) return '—';
    const u = unidad ? ` ${unidad}` : '';
    return `${valorMin}${u} — ${valorMax}${u}`;
  }, [detail]);

  const createdAtStr = useMemo(() => {
    if (!detail?.createdAt) return '—';
    const d = new Date(detail.createdAt);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }, [detail]);

  const updatedAtStr = useMemo(() => {
    if (!detail?.updatedAt) return '—';
    const d = new Date(detail.updatedAt);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }, [detail]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-800">Detalle del Sensor</h3>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {loading && <p className="text-sm text-gray-500">Cargando...</p>}

          {!loading && detail && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500">Nombre</p>
                <p className="text-gray-800">{detail.nombre}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Descripción</p>
                <p className="text-gray-800">{detail.descripcion?.trim() || '—'}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Valor actual</p>
                <p className="text-gray-800">{valorActualConUnidad}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500">Rango estable</p>
                <p className="text-gray-800">{rangoEstable}</p>
              </div>

              {canSeeSensitive && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Estado</p>
                    <p className="text-gray-800">{localEstado ? 'Encendido' : 'Apagado'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocalEstado((s) => !s)}
                    className={[
                      'relative inline-flex h-6 w-11 items-center rounded-full transition',
                      localEstado ? 'bg-green-500' : 'bg-gray-300',
                    ].join(' ')}
                    aria-pressed={localEstado ? 'true' : 'false'}
                  >
                    <span
                      className={[
                        'inline-block h-5 w-5 transform rounded-full bg-white transition',
                        localEstado ? 'translate-x-5' : 'translate-x-1',
                      ].join(' ')}
                    />
                  </button>
                </div>
              )}

              {canSeeSensitive && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Fuente de datos</p>
                  <p className="font-mono text-gray-800">{detail.fuente || '—'}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-gray-500">Creado</p>
                  <p className="text-gray-800">{createdAtStr}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Actualizado</p>
                  <p className="text-gray-800">{updatedAtStr}</p>
                </div>
              </div>

              {/* Sección colapsable de proyectos */}
              <div className="border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowProjects(!showProjects)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  <span className={`transform transition-transform ${showProjects ? 'rotate-90' : ''}`}>
                    ▶
                  </span>
                  <span>Proyectos ({projects.length})</span>
                </button>

                {showProjects && (
                  <div className="mt-2 ml-6">
                    {loadingProjects && (
                      <p className="text-sm text-gray-500">Cargando proyectos...</p>
                    )}

                    {!loadingProjects && projects.length === 0 && (
                      <p className="text-sm text-gray-600">No hay proyectos asociados.</p>
                    )}

                    {!loadingProjects && projects.length > 0 && (
                      <ul className="space-y-2">
                        {projects.map((project) => (
                          <li key={project.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onOpenProject?.(project.id);
                                onClose();
                              }}
                              className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              title="Ver detalle del proyecto"
                            >
                              {project.nombre}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => detail && onGoLogs?.(detail.id)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Registro de Mediciones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
