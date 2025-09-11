'use client';

import { useEffect, useMemo, useState } from 'react';

type ApiActuatorAnyCase = {
  actuator_id?: number;
  actuatorId?: number;
  nombre: string;
  descripcion?: string | null;

  // unidad
  unidad_de_medida?: string;
  unidadMedida?: string;

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
  valorMax: number | null;
  valorMin: number | null;
  estado: boolean;
  fuente: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  open: boolean;
  actuatorId: string | null;
  onClose: () => void;
  onGoProjects?: (actuatorId: number) => void;
  onGoLogs?: (actuatorId: number) => void; // “Registro de envíos”
};

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

// Normalizador (acepta camelCase/snake_case)
function normalizeActuator(data: ApiActuatorAnyCase): ActuatorDetail {
  const unidad = data.unidad_de_medida ?? data.unidadMedida ?? '';
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
  onGoProjects,
  onGoLogs,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ActuatorDetail | null>(null);
  const [localEstado, setLocalEstado] = useState<boolean | null>(null);

  // Input “Valor a enviar”
  const [sendValue, setSendValue] = useState<string>('');
  const [sendError, setSendError] = useState<string>('');

  useEffect(() => {
    if (!open || !actuatorId) {
      setDetail(null);
      setLocalEstado(null);
      setSendValue('');
      setSendError('');
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

  const handleSend = () => {
    setSendError('');
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
    // Por ahora, solo console.log del número (ej: 30)
    console.log(n);
    // Si querés, podés limpiar el input:
    // setSendValue('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
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

        <div className="px-5 py-4">
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

              {/* 3) Valor a enviar (input + unidad + botón Enviar) */}
              <div>
                <p className="text-xs font-medium text-gray-500">Valor a enviar</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    value={sendValue}
                    onChange={(e) => setSendValue(e.target.value)}
                    placeholder="p. ej. 30"
                    className="w-40 px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-700 select-none">
                    {detail.unidad || ''}
                  </span>
                  <button
                    type="button"
                    onClick={handleSend}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Enviar
                  </button>
                </div>
                {sendError && <p className="text-xs text-red-600 mt-1">{sendError}</p>}
              </div>

              {/* 4) Rango estable */}
              <div>
                <p className="text-xs font-medium text-gray-500">Rango estable</p>
                <p className="text-gray-800">{rangoEstable}</p>
              </div>

              {/* 5) Estado (toggle local, sin persistir aún) */}
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

              {/* 6) Fuente de datos */}
              <div>
                <p className="text-xs font-medium text-gray-500">Fuente de datos</p>
                <p className="font-mono text-gray-800">{detail.fuente || '—'}</p>
              </div>

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
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => detail && onGoProjects?.(detail.id)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Proyectos
            </button>
            <button
              type="button"
              onClick={() => detail && onGoLogs?.(detail.id)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Registro de envíos
            </button>
          </div>

          {/* <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cerrar
          </button> */}
        </div>
      </div>
    </div>
  );
}
