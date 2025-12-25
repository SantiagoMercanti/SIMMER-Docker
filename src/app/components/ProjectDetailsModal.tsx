'use client';

import { useEffect, useMemo, useState } from 'react';

type ApiProjectAnyCase = {
  id?: number | string;
  project_id?: number;

  nombre: string;
  descripcion?: string | null;

  // Para el form (compat)
  sensorIds?: number[];
  actuatorIds?: number[];

  // Para el modal (actualizado)
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
  // (fallbacks si en algún momento vienen con otras claves)
  sensores?: Array<{ sensor?: { sensor_id: number; nombre: string; unidad_de_medida?: string } }>;
  actuadores?: Array<{ actuador?: { actuator_id: number; nombre: string; unidad_de_medida?: string } }>;

  // ✅ Información del creador
  creador?: {
    email: string;
    nombreCompleto: string;
  } | null;
};

type ProjectDetail = {
  id: number;
  nombre: string;
  descripcion: string;
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
  onClose: () => void;

  // callbacks para abrir modales de detalle
  onOpenSensor?: (sensorId: number) => void;
  onOpenActuator?: (actuatorId: number) => void;
};

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

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
    // Fallback si solo viniera el include crudo
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
    sensors, 
    actuators,
    creador: p.creador ?? null,
  };
}

// ✅ Función para formatear fecha corta (similar a SensorMeasurementsModal)
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

export default function ProjectDetailsModal({
  open,
  projectId,
  onClose,
  onOpenSensor,
  onOpenActuator,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);

  useEffect(() => {
    if (!open || !projectId) {
      setDetail(null);
      return;
    }
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(api(`/api/projects/${projectId}`), { cache: 'no-store' });
        if (!res.ok) throw new Error('No se pudo obtener el proyecto');
        const raw = (await res.json()) as ApiProjectAnyCase;
        const norm = normalizeProject(raw);
        if (!abort) setDetail(norm);
      } catch (e) {
        console.error(e);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [open, projectId]);

  const sensors = useMemo(() => detail?.sensors ?? [], [detail]);
  const actuators = useMemo(() => detail?.actuators ?? [], [detail]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-800">Detalle del Proyecto</h3>
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
            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <p className="text-xs font-medium text-gray-500">Nombre</p>
                <p className="text-gray-800">{detail.nombre}</p>
              </div>

              {/* Descripción */}
              <div>
                <p className="text-xs font-medium text-gray-500">Descripción</p>
                <p className="text-gray-800">{detail.descripcion?.trim() || '—'}</p>
              </div>

              {/* Creado por */}
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

              {/* ✅ Sensores con última medición */}
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
                          onClick={() => onOpenSensor?.(s.id)}
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

              {/* Actuadores */}
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
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
