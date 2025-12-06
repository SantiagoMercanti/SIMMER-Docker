'use client';

import { useEffect, useMemo, useState } from 'react';
import ActuatorRecordsModal from './ActuatorRecordsModal';

type Role = 'operator' | 'labManager' | 'admin';

type ApiActuatorAnyCase = {
  actuator_id?: number;
  actuatorId?: number;
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

  // fechas
  createdAt?: string;
  created_at?: string;
  created?: string;
  updatedAt?: string;
  updated_at?: string;
  updated?: string;
};

type ActuatorDetail = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  unidad: string;
  unidadNombre?: string;
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
  actuatorId: string | null;
  onClose: () => void;
  onGoProjects?: (actuatorId: number) => void;
  onGoLogs?: (actuatorId: number) => void;
  onOpenProject?: (projectId: number) => void;
};

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

function isManagerOrAdmin(role: Role) {
  return role === 'labManager' || role === 'admin';
}

function normalizeActuator(data: ApiActuatorAnyCase): ActuatorDetail {
  const unidad = data.unidadMedida?.simbolo ?? '';
  const unidadNombre = data.unidadMedida?.nombre;
  const valorMax = (data.valor_max ?? data.valorMax ?? null) as number | null;
  const valorMin = (data.valor_min ?? data.valorMin ?? null) as number | null;
  const fuente = (data.fuente_datos ?? data.fuenteDatos ?? null) as string | null;
  const id = (data.actuator_id ?? data.actuatorId ?? 0) as number;
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

export default function ActuatorDetailsModal({
  open,
  actuatorId,
  onClose,
  onOpenProject,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ActuatorDetail | null>(null);
  const [localEstado, setLocalEstado] = useState<boolean | null>(null);

  // Input "Valor a enviar"
  const [sendValue, setSendValue] = useState<string>('');
  const [sendError, setSendError] = useState<string>('');
  const [sendSuccess, setSendSuccess] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Estado para la lista de proyectos
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  // Estado para el modal de registros
  const [showRecordsModal, setShowRecordsModal] = useState(false);

  // Rol real desde el server
  const [role, setRole] = useState<Role>('operator');
  const canSeeSensitive = isManagerOrAdmin(role);

  // Traer rol con /api/me cuando se abre el modal
  useEffect(() => {
    if (!open) return;
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
    return () => { abort = true; };
  }, [open]);

  useEffect(() => {
    if (!open || !actuatorId) {
      setDetail(null);
      setLocalEstado(null);
      setSendValue('');
      setSendError('');
      setSendSuccess('');
      setShowRecordsModal(false);
      return;
    }
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(api(`/api/actuators/${actuatorId}`), { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo obtener el actuador');
        const raw = (await res.json()) as ApiActuatorAnyCase;
        const norm = normalizeActuator(raw);
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
  }, [open, actuatorId]);

  // Cargar proyectos cuando se expande la sección
  useEffect(() => {
    if (!showProjects || !actuatorId) {
      return;
    }
    let abort = false;
    (async () => {
      try {
        setLoadingProjects(true);
        const res = await fetch(api(`/api/actuators/${actuatorId}/usage`), { cache: 'no-store' });
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
  }, [showProjects, actuatorId]);

  const rangoEstable = useMemo(() => {
    if (!detail) return '—';
    const { valorMin, valorMax, unidad } = detail;
    if (typeof valorMin !== 'number' || typeof valorMax !== 'number') return '—';
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

  const handleSend = async () => {
    setSendError('');
    setSendSuccess('');
    
    const n = Number(sendValue);
    if (sendValue.trim() === '' || Number.isNaN(n)) {
      setSendError('Ingresá un número válido.');
      return;
    }

    // Validación opcional contra el rango, si está disponible:
    if (detail && typeof detail.valorMin === 'number' && typeof detail.valorMax === 'number') {
      if (n < detail.valorMin || n > detail.valorMax) {
        setSendError(`Fuera de rango (${detail.valorMin} - ${detail.valorMax}).`);
        return;
      }
    }

    // Enviar al endpoint
    try {
      setSending(true);
      
      const res = await fetch(api(`/api/actuators/${actuatorId}/send`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: n }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar el valor');
      }

      // Éxito
      setSendSuccess(
        data.warning 
          ? `✓ ${data.message}. ${data.warning}` 
          : `✓ ${data.message}. Registros creados: ${data.recordsCreated}`
      );
      
      // Limpiar input después de 3 segundos
      setTimeout(() => {
        setSendValue('');
        setSendSuccess('');
      }, 3000);

      console.log('[Actuador] Envío exitoso:', data);
    } catch (error) {
      console.error('[Actuador] Error en envío:', error);
      setSendError(error instanceof Error ? error.message : 'Error al enviar el valor');
    } finally {
      setSending(false);
    }
  };

  const handleOpenRecords = () => {
    setShowRecordsModal(true);
  };

  const handleCloseRecords = () => {
    setShowRecordsModal(false);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-2xl rounded-xl bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-lg font-semibold text-gray-800">Detalle del Actuador</h3>
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
                {/* 1) Nombre */}
                <div>
                  <p className="text-xs font-medium text-gray-500">Nombre</p>
                  <p className="text-gray-800">{detail.nombre}</p>
                </div>

                {/* 2) Descripción */}
                <div>
                  <p className="text-xs font-medium text-gray-500">Descripción</p>
                  <p className="text-gray-800">{detail.descripcion?.trim() || '—'}</p>
                </div>

                {/* 3) Valor a enviar (solo labManager/admin) */}
                {canSeeSensitive && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Valor a enviar</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        value={sendValue}
                        onChange={(e) => setSendValue(e.target.value)}
                        placeholder="p. ej. 30"
                        disabled={sending}
                        className="w-40 px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-gray-700 select-none">
                        {detail.unidad || ''}
                      </span>
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {sending ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                    {sendError && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {sendError}
                      </p>
                    )}
                    {sendSuccess && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {sendSuccess}
                      </p>
                    )}
                  </div>
                )}

                {/* 4) Rango estable */}
                <div>
                  <p className="text-xs font-medium text-gray-500">Rango estable</p>
                  <p className="text-gray-800">{rangoEstable}</p>
                </div>

                {/* 5) Estado (solo labManager/admin) */}
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

                {/* 6) Fuente de datos (solo labManager/admin) */}
                {canSeeSensitive && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Fuente de datos</p>
                    <p className="font-mono text-gray-800">{detail.fuente || '—'}</p>
                  </div>
                )}

                {/* 7-8) Fechas */}
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
                    <span>Proyectos{projects.length > 0 ? ` (${projects.length})` : ''}</span>
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
                onClick={handleOpenRecords}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Registro de envíos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de registros */}
      <ActuatorRecordsModal
        open={showRecordsModal}
        actuadorId={actuatorId}
        onClose={handleCloseRecords}
        onOpenProject={(projectId) => {
          handleCloseRecords();
          onClose();
          onOpenProject?.(projectId);
        }}
      />
    </>
  );
}
