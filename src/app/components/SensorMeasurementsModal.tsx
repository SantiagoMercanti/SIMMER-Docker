'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

type Project = {
  id: number;
  nombre: string;
};

type Props = {
  open: boolean;
  sensorId: string | null;
  projectId?: number | null;
  onClose: () => void;
  onOpenProject?: (projectId: number) => void;
};

type SortField = 'valor' | 'timestamp' | 'proyectoNombre';
type SortDirection = 'asc' | 'desc';

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

// Intervalo de auto-refresh: 15 segundos
const AUTO_REFRESH_INTERVAL = 15 * 1000; // 15,000 ms

export default function SensorMeasurementsModal({
  open,
  sensorId,
  onClose,
  onOpenProject,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MeasurementsResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  // const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  // Bandera para evitar múltiples fetches simultáneos
  const isRefreshingRef = useRef(false);
  
  const pageSize = 20;
  const maxMeasurements = 200;

  // Obtener lista de proyectos cuando se abre el modal
  useEffect(() => {
    if (!open || !sensorId) {
      setProjects([]);
      setSelectedProjectId(null);
      return;
    }

    let abort = false;

    (async () => {
      try {
        const url = api(`/api/sensors/${sensorId}/projects`);
        const res = await fetch(url, { cache: 'no-store' });
        
        if (res.ok) {
          const json = await res.json();
          if (!abort && json.projects) {
            setProjects(json.projects);
          }
        }
      } catch (e) {
        console.error('Error al cargar proyectos:', e);
      }
    })();

    return () => {
      abort = true;
    };
  }, [open, sensorId]);

  // Función para cargar mediciones (extraída para reutilizar)
  const loadMeasurements = useCallback(async () => {
    if (!sensorId) return;
    
    // Evitar múltiples fetches simultáneos
    if (isRefreshingRef.current) {
      console.log('[Measurements] Ya hay un fetch en curso, omitiendo...');
      return;
    }

    let abort = false;
    isRefreshingRef.current = true;

    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize),
        sortBy: sortField,
        sortDirection: sortDirection,
      });
      
      if (selectedProjectId) {
        params.append('projectId', String(selectedProjectId));
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
        // setLastRefresh(new Date());
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
        isRefreshingRef.current = false;
      }
    }

    return () => {
      abort = true;
      isRefreshingRef.current = false;
    };
  }, [sensorId, selectedProjectId, currentPage, sortField, sortDirection, pageSize]);

  // Effect para cargar mediciones cuando cambian los parámetros
  useEffect(() => {
    if (!open || !sensorId) {
      setData(null);
      setCurrentPage(1);
      setError(null);
      // setLastRefresh(null);
      return;
    }

    loadMeasurements();
  }, [open, sensorId, selectedProjectId, currentPage, sortField, sortDirection, loadMeasurements]);

  // Effect separado para auto-refresh cada 30 segundos
  useEffect(() => {
    if (!open || !sensorId) {
      return;
    }

    console.log(`[Measurements] Auto-refresh activado (cada ${AUTO_REFRESH_INTERVAL / 1000}s)`);

    const interval = setInterval(() => {
      console.log('[Measurements] Ejecutando auto-refresh...');
      loadMeasurements();
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      console.log('[Measurements] Auto-refresh desactivado');
      clearInterval(interval);
    };
  }, [open, sensorId, loadMeasurements]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'timestamp' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId === 'all' ? null : Number(projectId));
    setCurrentPage(1);
  };

  const handleDownloadCSV = async () => {
    if (!sensorId) return;
    
    try {
      // Solicitar todas las mediciones para descarga (sin paginación)
      const params = new URLSearchParams({
        page: '1',
        pageSize: String(maxMeasurements),
        sortBy: sortField,
        sortDirection: sortDirection,
      });
      
      if (selectedProjectId) {
        params.append('projectId', String(selectedProjectId));
      }

      const url = api(`/api/sensors/${sensorId}/measurements?${params}`);
      const res = await fetch(url, { cache: 'no-store' });
      
      if (!res.ok) {
        throw new Error('Error al descargar mediciones');
      }
      
      const json = (await res.json()) as MeasurementsResponse;
      
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
      link.setAttribute('download', `mediciones_${json.sensorNombre}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error('Error al descargar CSV:', e);
      alert('Error al descargar el archivo CSV');
    }
  };

  const formatDateFull = (timestamp: string) => {
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
  };

  const formatShortDate = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '—';
    
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // const formatTimeAgo = (date: Date | null) => {
  //   if (!date) return '';
    
  //   const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
  //   if (seconds < 60) return 'hace menos de 1 min';
    
  //   const minutes = Math.floor(seconds / 60);
  //   if (minutes < 60) return `hace ${minutes} min`;
    
  //   const hours = Math.floor(minutes / 60);
  //   return `hace ${hours}h ${minutes % 60}min`;
  // };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (data && currentPage < data.pagination.totalPages && currentPage * pageSize < maxMeasurements) {
      setCurrentPage(currentPage + 1);
    }
  };

  const maxPages = Math.min(
    data?.pagination.totalPages || 0,
    Math.ceil(maxMeasurements / pageSize)
  );

  const showingUpTo = Math.min(currentPage * pageSize, maxMeasurements, data?.pagination.totalCount || 0);
  const hasMoreThanMax = (data?.pagination.totalCount || 0) > maxMeasurements;

  if (!open) return null;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-5xl rounded-lg bg-white shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex-shrink-0 bg-gray-50">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Registro de Mediciones
              </h3>
              {data && (
                <p className="text-sm text-gray-600 mt-0.5">
                  Sensor: <span className="font-medium">{data.sensorNombre}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Botón de refresh manual */}
              <button
                onClick={loadMeasurements}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Actualizar ahora"
              >
                <svg 
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? 'Actualizando...' : 'Actualizar'}
              </button>
              
              {data && data.measurements.length > 0 && (
                <button
                  onClick={handleDownloadCSV}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  title="Descargar registro completo"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar CSV
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>
          </div>
          
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {loading && !data && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="ml-3 text-sm text-gray-600">Cargando mediciones...</p>
            </div>
          )}

          {!loading && error && (
            <div className="m-6 rounded-md bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!loading && !error && data && data.measurements.length === 0 && (
            <div className="text-center py-12">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-2 text-gray-600">
                {selectedProjectId 
                  ? 'No hay mediciones para el proyecto seleccionado.' 
                  : 'No hay mediciones registradas.'}
              </p>
            </div>
          )}

          {data && data.measurements.length > 0 && (
            <>
              {hasMoreThanMax && (
                <div className="mx-6 mt-4 rounded-md bg-amber-50 border border-amber-200 p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-amber-800">
                      <span className="font-medium">Mostrando las {maxMeasurements} mediciones más {sortDirection === 'desc' && sortField === 'timestamp' ? 'recientes' : 'relevantes'}.</span> Este sensor tiene {data.pagination.totalCount} mediciones en total. Use el botón Descargar CSV para obtener el registro completo.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-y border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider w-16">
                        #
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('valor')}
                      >
                        <div className="flex items-center gap-2">
                          <span>Valor</span>
                          <SortIcon field="valor" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Unidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        <div className="flex flex-col gap-1">
                          <span>Proyecto</span>
                          {projects.length > 0 && (
                            <select
                              value={selectedProjectId || 'all'}
                              onChange={(e) => handleProjectChange(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-normal normal-case rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500 py-1 px-2 border bg-white"
                            >
                              <option value="all">Todos</option>
                              {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.nombre}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort('timestamp')}
                      >
                        <div className="flex items-center gap-2">
                          <span>Fecha y Hora</span>
                          <SortIcon field="timestamp" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.measurements.map((m, index) => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 tabular-nums">
                          {m.valor}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                          {m.unidadSimbolo}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm">
                          <button
                            type="button"
                            onClick={() => onOpenProject?.(m.proyectoId)}
                            className="text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            title="Ver proyecto"
                          >
                            {m.proyectoNombre}
                          </button>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 tabular-nums">
                          {formatShortDate(m.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer con paginación */}
        {!loading && !error && data && data.pagination.totalPages > 0 && (
          <div className="flex items-center justify-between border-t px-6 py-4 flex-shrink-0 bg-gray-50">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-medium">{Math.min((currentPage - 1) * pageSize + 1, data.pagination.totalCount)}</span> a{' '}
              <span className="font-medium">{showingUpTo}</span> de{' '}
              <span className="font-medium">{hasMoreThanMax ? `${maxMeasurements}+` : data.pagination.totalCount}</span> mediciones
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{maxPages}</span>
              </span>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= maxPages}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
