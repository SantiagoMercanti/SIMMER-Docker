'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProjectNotes from './ProjectNotes';

type ApiProjectAnyCase = {
  id?: number | string;
  project_id?: number;

  nombre: string;
  descripcion?: string | null;
  publico?: boolean;
  estado?: boolean;
  canEdit?: boolean;

  sensorIds?: number[];
  actuatorIds?: number[];

  sensors?: Array<{
    id: number;
    nombre: string;
    unidadMedida?: string;
    unidadNombre?: string;
    ultimoValor?: number | null;
    ultimaFecha?: string | null;
  }>;
  actuators?: Array<{
    id: number;
    nombre: string;
    unidadMedida?: string;
    unidadNombre?: string;
  }>;

  sensores?: Array<{ sensor?: { sensor_id: number; nombre: string; unidad_de_medida?: string } }>;
  actuadores?: Array<{ actuador?: { actuator_id: number; nombre: string; unidad_de_medida?: string } }>;

  creador?: {
    email: string;
    nombreCompleto: string;
  } | null;
};

type ProjectDetail = {
  id: number;
  nombre: string;
  descripcion: string;
  publico: boolean;
  estado: boolean;
  canEdit: boolean;
  sensors: Array<{ 
    id: number; 
    nombre: string; 
    unidad: string;
    ultimoValor: number | null;
    ultimaFecha: string | null;
  }>;
  actuators: Array<{ id: number; nombre: string; unidad: string }>;
  creador?: {
    email: string;
    nombreCompleto: string;
  } | null;
};

type Props = {
  open: boolean;
  projectId: string | null;
  onClose: (updatedEstado?: boolean) => void;
  onOpenSensor?: (sensorId: number, projectId?: number) => void;
  onOpenActuator?: (actuatorId: number) => void;
  currentUserId?: string;
  isAdmin?: boolean;
};

type MeasurementsResponse = {
  measurements: Array<{
    id: number;
    valor: number;
    timestamp: string;
    proyectoNombre: string;
    proyectoId: number;
    unidadSimbolo: string;
  }>;
  sensorNombre: string;
};

type RecordsResponse = {
  records: Array<{
    id: number;
    valor: number;
    timestamp: string;
    proyectoNombre: string;
    proyectoId: number;
    unidadSimbolo: string;
    usuario: {
      id: string;
      email: string;
      nombre: string;
      apellido: string;
    } | null;
  }>;
  actuadorNombre: string;
};

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

const AUTO_REFRESH_INTERVAL = 15 * 1000;
const maxRecords = 200;

function normalizeProject(p: ApiProjectAnyCase): ProjectDetail {
  const id = Number(p.id ?? p.project_id ?? 0);
  const nombre = p.nombre;
  const descripcion = p.descripcion ?? '';

  let sensors: Array<{ id: number; nombre: string; unidad: string; ultimoValor: number | null; ultimaFecha: string | null }> = [];
  if (Array.isArray(p.sensors)) {
    sensors = p.sensors.map(s => ({
      id: s.id,
      nombre: s.nombre,
      unidad: s.unidadMedida ?? '',
      ultimoValor: s.ultimoValor ?? null,
      ultimaFecha: s.ultimaFecha ?? null,
    }));
  } else if (Array.isArray(p.sensores)) {
    sensors = p.sensores
      .map(s => s.sensor)
      .filter(Boolean)
      .map(s => ({
        id: s!.sensor_id,
        nombre: s!.nombre,
        unidad: s!.unidad_de_medida ?? '',
        ultimoValor: null,
        ultimaFecha: null,
      }));
  }

  let actuators: Array<{ id: number; nombre: string; unidad: string }> = [];
  if (Array.isArray(p.actuators)) {
    actuators = p.actuators.map(a => ({
      id: a.id,
      nombre: a.nombre,
      unidad: a.unidadMedida ?? '',
    }));
  } else if (Array.isArray(p.actuadores)) {
    actuators = p.actuadores
      .map(a => a.actuador)
      .filter(Boolean)
      .map(a => ({
        id: a!.actuator_id,
        nombre: a!.nombre,
        unidad: a!.unidad_de_medida ?? '',
      }));
  }

  return { 
    id, 
    nombre, 
    descripcion,
    publico: p.publico ?? false,
    estado: p.estado ?? true,
    canEdit: p.canEdit ?? true, // default true para no romper usos sin el campo
    sensors, 
    actuators,
    creador: p.creador ?? null,
  };
}

function formatShortDate(timestamp: string) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '—';
  
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateFull(timestamp: string) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '—';
  
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default function ProjectDetailsModal({
  open,
  projectId,
  onClose,
  onOpenSensor,
  onOpenActuator,
  currentUserId,
  isAdmin = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [downloadingCsvs, setDownloadingCsvs] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'notes'>('info');
  
  const isRefreshingRef = useRef(false);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    
    if (isRefreshingRef.current) {
      console.log('[ProjectDetails] Ya hay un fetch en curso, omitiendo...');
      return;
    }

    let abort = false;
    isRefreshingRef.current = true;

    try {
      setLoading(true);
      const res = await fetch(api(`/api/projects/${projectId}`), { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo obtener el proyecto');
      const raw = (await res.json()) as ApiProjectAnyCase;
      const norm = normalizeProject(raw);
      if (!abort) {
        setDetail(norm);
        // Si el usuario no es dueño, asegurarse de mostrar Info (no Notas)
        if (!norm.canEdit) {
          setActiveTab('info');
        }
      }
    } catch (e) {
      console.error(e);
      if (!abort) {
        setDetail(null);
      }
    } finally {
      if (!abort) {
        setLoading(false);
        isRefreshingRef.current = false;
      }
    }

    return () => {
      abort = true;
      isRefreshingRef.current = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!open || !projectId) {
      setDetail(null);
      setActiveTab('info');
      return;
    }
    loadProject();
  }, [open, projectId, loadProject]);

  useEffect(() => {
    if (!open || !projectId || activeTab !== 'info') {
      return;
    }

    console.log(`[ProjectDetails] Auto-refresh activado (cada ${AUTO_REFRESH_INTERVAL / 1000}s)`);

    const interval = setInterval(() => {
      console.log('[ProjectDetails] Ejecutando auto-refresh...');
      loadProject();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      console.log('[ProjectDetails] Auto-refresh desactivado');
      clearInterval(interval);
    };
  }, [open, projectId, activeTab, loadProject]);

  const handleDownloadAllCSVs = async () => {
    if (!detail || (!detail.sensors.length && !detail.actuators.length)) {
      alert('No hay sensores ni actuadores para descargar');
      return;
    }

    setDownloadingCsvs(true);

    try {
      const downloadPromises: Promise<void>[] = [];

      for (const sensor of detail.sensors) {
        const promise = (async () => {
          try {
            const params = new URLSearchParams({
              page: '1',
              pageSize: String(maxRecords),
              sortBy: 'timestamp',
              sortDirection: 'desc',
            });

            if (projectId) {
              params.append('projectId', projectId);
            }

            const url = api(`/api/sensors/${sensor.id}/measurements?${params}`);
            const res = await fetch(url, { cache: 'no-store' });

            if (!res.ok) {
              throw new Error(`Error al descargar mediciones del sensor ${sensor.nombre}`);
            }

            const json = (await res.json()) as MeasurementsResponse;

            if (json.measurements.length === 0) {
              console.log(`Sin mediciones para sensor: ${sensor.nombre}`);
              return;
            }

            const headers = ['#', 'Valor', 'Unidad', 'Proyecto', 'Fecha y Hora'];
            const rows = json.measurements.map((m, idx) => [
              String(idx + 1),
              String(m.valor),
              m.unidadSimbolo,
              m.proyectoNombre,
              formatDateFull(m.timestamp)
            ]);

            const csvContent = [
              headers.join(','),
              ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const downloadUrl = URL.createObjectURL(blob);

            link.setAttribute('href', downloadUrl);
            link.setAttribute(
              'download', 
              `${detail.nombre}_sensor_${json.sensorNombre}_${new Date().toISOString().split('T')[0]}.csv`
            );
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);

            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (e) {
            console.error(`Error al descargar CSV del sensor ${sensor.nombre}:`, e);
          }
        })();

        downloadPromises.push(promise);
      }

      for (const actuator of detail.actuators) {
        const promise = (async () => {
          try {
            const params = new URLSearchParams({
              page: '1',
              pageSize: String(maxRecords),
              sortBy: 'timestamp',
              sortDirection: 'desc',
            });

            if (projectId) {
              params.append('projectId', projectId);
            }

            const url = api(`/api/actuators/${actuator.id}/records?${params}`);
            const res = await fetch(url, { cache: 'no-store' });

            if (!res.ok) {
              throw new Error(`Error al descargar registros del actuador ${actuator.nombre}`);
            }

            const json = (await res.json()) as RecordsResponse;

            if (json.records.length === 0) {
              console.log(`Sin registros para actuador: ${actuator.nombre}`);
              return;
            }

            const headers = ['#', 'Valor', 'Unidad', 'Proyecto', 'Usuario', 'Fecha y Hora'];
            const rows = json.records.map((r, idx) => [
              String(idx + 1),
              String(r.valor),
              r.unidadSimbolo,
              r.proyectoNombre,
              r.usuario ? r.usuario.email : 'Sin usuario',
              formatDateFull(r.timestamp),
            ]);

            const csvContent = [
              headers.join(','),
              ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
            ].join('\n');

            const blob = new Blob(['\ufeff' + csvContent], {
              type: 'text/csv;charset=utf-8;',
            });
            const link = document.createElement('a');
            const downloadUrl = URL.createObjectURL(blob);

            link.setAttribute('href', downloadUrl);
            link.setAttribute(
              'download',
              `${detail.nombre}_actuador_${json.actuadorNombre}_${new Date()
                .toISOString()
                .split('T')[0]}.csv`
            );
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);

            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (e) {
            console.error(`Error al descargar CSV del actuador ${actuator.nombre}:`, e);
          }
        })();

        downloadPromises.push(promise);
      }

      await Promise.all(downloadPromises);

      console.log('Todas las descargas completadas');
    } catch (e) {
      console.error('Error general al descargar CSVs:', e);
      alert('Hubo un error al descargar algunos archivos CSV');
    } finally {
      setDownloadingCsvs(false);
    }
  };

  const sensors = useMemo(() => detail?.sensors ?? [], [detail]);
  const actuators = useMemo(() => detail?.actuators ?? [], [detail]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-800">Detalle del Proyecto</h3>
            {detail && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  detail.publico
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
                title={detail.publico ? 'Visible para todos los usuarios' : 'Solo visible para vos y administradores'}
              >
                {detail.publico ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Público
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Privado
                  </>
                )}
              </span>
            )}
            {detail && detail.canEdit && (
              <button
                type="button"
                onClick={async () => {
                  const nuevoEstado = !detail.estado;
                  setDetail(prev => prev ? { ...prev, estado: nuevoEstado } : prev);
                  try {
                    const res = await fetch(api(`/api/projects/${detail.id}`), {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ estado: nuevoEstado }),
                    });
                    if (!res.ok) throw new Error();
                  } catch {
                    setDetail(prev => prev ? { ...prev, estado: !nuevoEstado } : prev);
                  }
                }}
                title={detail.estado ? 'Proyecto encendido — click para apagar' : 'Proyecto apagado — click para encender'}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  detail.estado
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${detail.estado ? 'bg-green-500' : 'bg-gray-400'}`} />
                {detail.estado ? 'Encendido' : 'Apagado'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'info' && (
              <>
                <button
                  onClick={loadProject}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Actualizar ahora"
                >
                  <svg 
                    className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {loading ? 'Actualizando...' : 'Actualizar'}
                </button>

                {detail && detail.canEdit && (sensors.length > 0 || actuators.length > 0) && (
                  <button
                    onClick={handleDownloadAllCSVs}
                    disabled={downloadingCsvs}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Descargar todos los CSVs del proyecto"
                  >
                    <svg
                      className={`w-4 h-4 ${downloadingCsvs ? 'animate-bounce' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {downloadingCsvs ? 'Descargando...' : 'Descargar CSVs'}
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => onClose(detail?.estado)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="border-b flex-shrink-0">
          <div className="flex px-5">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Información
            </button>
            {/* Notas solo visibles para el dueño del proyecto o admin */}
            {(!detail || detail.canEdit) && (
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'notes'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Notas
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          {activeTab === 'info' && (
            <>
              {loading && !detail && <p className="text-sm text-gray-500">Cargando...</p>}

              {!loading && !detail && (
                <p className="text-sm text-red-600">No se pudo cargar el proyecto.</p>
              )}

              {detail && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Nombre</p>
                    <p className="text-gray-800">{detail.nombre}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500">Descripción</p>
                    <p className="text-gray-800">{detail.descripcion?.trim() || '—'}</p>
                  </div>

                  {detail.creador && (
                    <div>
                      <p className="text-xs font-medium text-gray-500">Usuario</p>
                      <p className="text-gray-800">
                        {detail.creador.nombreCompleto}
                        {' '}
                        <span className="text-gray-500">({detail.creador.email})</span>
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Sensores</p>
                    {sensors.length === 0 ? (
                      <p className="text-gray-600">No hay sensores asociados.</p>
                    ) : (
                      <ul className="space-y-2">
                        {sensors.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                            <button
                              type="button"
                              onClick={() => onOpenSensor?.(s.id, detail.id)}
                              className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                              title="Ver detalle del sensor"
                            >
                              {s.nombre}
                            </button>
                            
                            <div className="text-right">
                              {s.ultimoValor !== null ? (
                                <>
                                  <div className="text-base font-semibold text-gray-900 tabular-nums">
                                    {s.ultimoValor.toFixed(2)}{s.unidad ? ` ${s.unidad}` : ''}
                                  </div>
                                  {s.ultimaFecha && (
                                    <div className="text-xs text-gray-500 tabular-nums">
                                      {formatShortDate(s.ultimaFecha)}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-sm text-gray-500 italic">Sin mediciones</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {detail.canEdit && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Actuadores</p>
                      {actuators.length === 0 ? (
                        <p className="text-gray-600">No hay actuadores asociados.</p>
                      ) : (
                        <ul className="space-y-1">
                          {actuators.map((a) => (
                            <li key={a.id}>
                              <button
                                type="button"
                                onClick={() => onOpenActuator?.(a.id)}
                                className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
                                title="Ver detalle del actuador"
                              >
                                {a.nombre}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'notes' && detail && (
            <ProjectNotes
              projectId={detail.id}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              canWrite={detail.canEdit}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-5 py-4 flex-shrink-0">
          <button
            type="button"
            onClick={() => onClose(detail?.estado)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
