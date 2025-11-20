'use client';

import { useEffect, useState } from 'react';

type Measurement = {
  id: number;
  valor: number;
  timestamp: string;
  proyectoNombre: string;
  proyectoId: number;
  unidadSimbolo: string;
};

type MeasurementsResponse = {
  measurements: Measurement[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  sensorNombre: string;
};

type Props = {
  open: boolean;
  sensorId: string | null;
  projectId?: number | null;
  onClose: () => void;
  onOpenProject?: (projectId: number) => void;
};

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

export default function SensorMeasurementsModal({
  open,
  sensorId,
  projectId,
  onClose,
  onOpenProject,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MeasurementsResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    if (!open || !sensorId) {
      setData(null);
      setCurrentPage(1);
      setError(null);
      return;
    }

    let abort = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(pageSize),
        });
        
        if (projectId) {
          params.append('projectId', String(projectId));
        }

        const url = api(`/api/sensors/${sensorId}/measurements?${params}`);
        const res = await fetch(url, { cache: 'no-store' });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Error desconocido' }));
          throw new Error(errorData.error || 'No se pudieron obtener las mediciones');
        }
        
        const json = (await res.json()) as MeasurementsResponse;
        
        if (!abort) {
          setData(json);
        }
      } catch (e) {
        console.error(e);
        if (!abort) {
          setData(null);
          setError(e instanceof Error ? e.message : 'Error al cargar mediciones');
        }
      } finally {
        if (!abort) {
          setLoading(false);
        }
      }
    })();

    return () => {
      abort = true;
    };
  }, [open, sensorId, projectId, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (data && currentPage < data.pagination.totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '—';
    
    const timeStr = date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const dateStr = date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    
    return `${timeStr} ${dateStr}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Registro de Mediciones
            </h3>
            {data && (
              <p className="text-sm text-gray-600">
                Sensor: {data.sensorNombre}
                {projectId && ' (filtrado por proyecto)'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="ml-3 text-sm text-gray-500">Cargando mediciones...</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!loading && !error && data && data.measurements.length === 0 && (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="mt-2 text-gray-600">No hay mediciones registradas.</p>
            </div>
          )}

          {!loading && !error && data && data.measurements.length > 0 && (
            <div className="space-y-2">
              {data.measurements.map((m, index) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-sm font-medium text-gray-500 min-w-[3rem]">
                      #{(currentPage - 1) * pageSize + index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-lg font-semibold text-gray-800">
                        {m.valor} {m.unidadSimbolo}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <button
                          type="button"
                          onClick={() => onOpenProject?.(m.proyectoId)}
                          className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          title="Ver proyecto"
                        >
                          {m.proyectoNombre}
                        </button>
                        <span>·</span>
                        <span className="tabular-nums">{formatDate(m.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con paginación */}
        {!loading && !error && data && data.pagination.totalPages > 0 && (
          <div className="flex items-center justify-between border-t px-5 py-4 flex-shrink-0">
            <p className="text-sm text-gray-600">
              Página {data.pagination.page} de {data.pagination.totalPages} 
              <span className="text-gray-500"> ({data.pagination.totalCount} mediciones)</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= data.pagination.totalPages}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
