'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Prefijo de API según entorno ('' en dev, '/a03' en prod)
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const api = (p: string) => `${BASE}${p}`;

export type SensorActuatorFormValues = {
  nombre: string;
  descripcion: string;
  unidadMedidaId: number;
  valorMin: string;
  valorMax: string;
  fuenteDatos: string;
};

type Props = {
  // LÓGICA DEL FORM
  tipo: 'sensor' | 'actuador';
  initialValues?: Partial<SensorActuatorFormValues>;
  editingId?: number;
  onCancel?: () => void;
  onSubmit?: (values: SensorActuatorFormValues) => void;
  asModal?: boolean;
  open?: boolean;
  onRequestClose?: () => void;
};

type ConflictData = {
  nombres: string[];
};

type UnidadMedida = {
  id: number;
  nombre: string;
  simbolo: string;
  categoria: string;
};

// Categorías válidas del enum
const CATEGORIAS = [
  'temperatura',
  'presion',
  'volumen',
  'masa',
  'tiempo',
  'velocidad',
  'concentracion',
  'pH',
  'flujo',
  'frecuencia',
  'porcentaje',
  'otra',
] as const;

export default function SensorActuatorForm({
  tipo,
  initialValues = {},
  editingId,
  onCancel,
  onSubmit,
  asModal = false,
  open = true,
  onRequestClose,
}: Props) {
  // Estado del formulario principal
  const [values, setValues] = useState<SensorActuatorFormValues>({
    nombre: initialValues.nombre ?? '',
    descripcion: initialValues.descripcion ?? '',
    unidadMedidaId: initialValues.unidadMedidaId ?? 0,
    valorMin: initialValues.valorMin ?? '',
    valorMax: initialValues.valorMax ?? '',
    fuenteDatos: initialValues.fuenteDatos ?? '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const confirmModalRef = useRef<HTMLDivElement>(null);

  const [unidadesDisponibles, setUnidadesDisponibles] = useState<UnidadMedida[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(false);

  // Estado para el formulario inline de nueva unidad
  const [showNewUnitForm, setShowNewUnitForm] = useState(false);
  const [newUnit, setNewUnit] = useState({
    nombre: '',
    simbolo: '',
    categoria: '' as string,
  });
  const [newUnitErrors, setNewUnitErrors] = useState<Record<string, string>>({});
  const [isCreatingUnit, setIsCreatingUnit] = useState(false);

  // Estado para gestionar unidades existentes
  const [showManageUnits, setShowManageUnits] = useState(false);
  const [deletingUnitId, setDeletingUnitId] = useState<number | null>(null);
  const [showDeleteError, setShowDeleteError] = useState(false);
  const [deleteErrorData, setDeleteErrorData] = useState<{
    message: string;
    elementos: string[];
  } | null>(null);

  const {
    nombre: ivNombre = '',
    descripcion: ivDescripcion = '',
    unidadMedidaId: ivUnidadMedidaId = 0,
    valorMin: ivValorMin = '',
    valorMax: ivValorMax = '',
    fuenteDatos: ivFuenteDatos = '',
  } = initialValues ?? {};

  // Reset del formulario principal
  useEffect(() => {
    if (!asModal || !open) return;
    setValues({
      nombre: ivNombre,
      descripcion: ivDescripcion,
      unidadMedidaId: ivUnidadMedidaId,
      valorMin: ivValorMin,
      valorMax: ivValorMax,
      fuenteDatos: ivFuenteDatos,
    });
    setErrors({});
    setShowConfirmModal(false);
    setConflictData(null);
    setShowNewUnitForm(false);
    setNewUnit({ nombre: '', simbolo: '', categoria: '' });
    setNewUnitErrors({});
    setShowManageUnits(false);
    setShowDeleteError(false);
    setDeleteErrorData(null);
  }, [
    open,
    asModal,
    ivNombre,
    ivDescripcion,
    ivUnidadMedidaId,
    ivValorMin,
    ivValorMax,
    ivFuenteDatos,
  ]);

  // Accesibilidad en modal
  useEffect(() => {
    if (!asModal || !open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showConfirmModal && !showNewUnitForm && !showDeleteError) {
        (onRequestClose ?? onCancel)?.();
      }
    };
    document.addEventListener('keydown', handleKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [asModal, open, showConfirmModal, showNewUnitForm, showDeleteError, onRequestClose, onCancel]);

  const titulo = useMemo(
    () => (initialValues?.nombre ? `Editar ${tipo}` : `Nuevo ${tipo}`),
    [initialValues?.nombre, tipo]
  );

  const handleChange =
    (field: keyof SensorActuatorFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
    };

  const validate = () => {
    const next: Record<string, string> = {};

    if (!values.nombre.trim()) next.nombre = 'El nombre es obligatorio.';
    if (!values.descripcion.trim()) next.descripcion = 'La descripción es obligatoria.';
    if (!values.unidadMedidaId) next.unidadMedida = 'Debe seleccionar una unidad de medida.';
    if (!values.fuenteDatos.trim()) next.fuenteDatos = 'La fuente de datos es obligatoria.';

    // Obligatorios:
    if (values.valorMin.trim() === '') next.valorMin = 'El mínimo es obligatorio.';
    if (values.valorMax.trim() === '') next.valorMax = 'El máximo es obligatorio.';

    const min = Number(values.valorMin);
    const max = Number(values.valorMax);

    if (values.valorMin.trim() !== '' && Number.isNaN(min)) next.valorMin = 'Debe ser un número.';
    if (values.valorMax.trim() !== '' && Number.isNaN(max)) next.valorMax = 'Debe ser un número.';

    if (!Number.isNaN(min) && !Number.isNaN(max) && min > max) {
      next.valorMax = 'El máximo debe ser ≥ mínimo.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const checkFuenteDatosConflict = async (): Promise<boolean> => {
    const fuenteDatos = values.fuenteDatos.trim();
    if (!fuenteDatos) return false;

    setIsCheckingConflict(true);
    try {
      const endpoint = tipo === 'sensor'
        ? api('/api/sensors/check-fuente')
        : api('/api/actuators/check-fuente');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fuenteDatos,
          excludeId: editingId,
        }),
      });

      if (!response.ok) {
        console.error('Error al verificar conflictos');
        return false;
      }

      const data = await response.json();

      if (data.conflict) {
        const items = tipo === 'sensor' ? data.sensors : data.actuators;
        const nombres = items.map((item: { nombre: string }) => item.nombre);
        setConflictData({ nombres });
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error al verificar conflictos:', error);
      return false;
    } finally {
      setIsCheckingConflict(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Verificar conflictos de fuente_datos
    const hasConflict = await checkFuenteDatosConflict();

    if (hasConflict) {
      setShowConfirmModal(true);
    } else {
      // No hay conflicto, proceder directamente
      onSubmit?.(values);
    }
  };

  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    setConflictData(null);
    onSubmit?.(values);
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setConflictData(null);
  };

  // Cargar unidades disponibles
  const loadUnidades = async () => {
    setLoadingUnidades(true);
    try {
      const response = await fetch(api('/api/units'));
      if (response.ok) {
        const data = await response.json();
        setUnidadesDisponibles(data);
      }
    } catch (error) {
      console.error('Error cargando unidades:', error);
    } finally {
      setLoadingUnidades(false);
    }
  };

  useEffect(() => {
    loadUnidades();
  }, []);

  // Validar formulario de nueva unidad
  const validateNewUnit = () => {
    const next: Record<string, string> = {};

    if (!newUnit.nombre.trim()) next.nombre = 'El nombre es obligatorio.';
    if (!newUnit.simbolo.trim()) next.simbolo = 'El símbolo es obligatorio.';
    if (!newUnit.categoria) next.categoria = 'Debe seleccionar una categoría.';

    // Validar que el símbolo no esté duplicado (case-insensitive)
    const simboloExiste = unidadesDisponibles.some(
      (u) => u.simbolo.toLowerCase() === newUnit.simbolo.trim().toLowerCase()
    );
    if (simboloExiste) {
      next.simbolo = 'Este símbolo ya existe. Debe ser único.';
    }

    setNewUnitErrors(next);
    return Object.keys(next).length === 0;
  };

  // Crear nueva unidad
  const handleCreateUnit = async () => {
    if (!validateNewUnit()) return;

    setIsCreatingUnit(true);
    try {
      const response = await fetch(api('/api/units'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newUnit.nombre.trim(),
          simbolo: newUnit.simbolo.trim(),
          categoria: newUnit.categoria,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData?.error ?? 'Error al crear la unidad de medida');
        return;
      }

      const createdUnit = await response.json();

      // Recargar la lista de unidades
      await loadUnidades();

      // Seleccionar automáticamente la nueva unidad
      setValues((v) => ({ ...v, unidadMedidaId: createdUnit.id }));

      // Cerrar el formulario inline
      setShowNewUnitForm(false);
      setNewUnit({ nombre: '', simbolo: '', categoria: '' });
      setNewUnitErrors({});

      alert('Unidad de medida creada correctamente');
    } catch (error) {
      console.error('Error al crear unidad:', error);
      alert('Error al crear la unidad de medida');
    } finally {
      setIsCreatingUnit(false);
    }
  };

  // Iniciar eliminación de unidad
  const handleDeleteUnit = async (unitId: number, unitName: string) => {
    setDeletingUnitId(unitId);
    try {
      const response = await fetch(api(`/api/units/${unitId}`), {
        method: 'DELETE',
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Mostrar error de unidad en uso
        if (responseData.elementos) {
          setDeleteErrorData({
            message: responseData.message || `No se puede eliminar la unidad "${unitName}"`,
            elementos: responseData.elementos,
          });
          setShowDeleteError(true);
        } else {
          alert(responseData?.error ?? 'Error al eliminar la unidad de medida');
        }
        return;
      }

      // Eliminación exitosa
      await loadUnidades();

      // Si la unidad eliminada estaba seleccionada, limpiar selección
      if (values.unidadMedidaId === unitId) {
        setValues((v) => ({ ...v, unidadMedidaId: 0 }));
      }

      alert('Unidad de medida marcada como inactiva correctamente');
    } catch (error) {
      console.error('Error al eliminar unidad:', error);
      alert('Error al eliminar la unidad de medida');
    } finally {
      setDeletingUnitId(null);
    }
  };

  const wrapperClass = asModal
    ? 'space-y-4'
    : 'bg-white shadow-md rounded-lg p-4 md:p-6 space-y-4';

  // Formulario inline para crear nueva unidad
  const newUnitFormMarkup = showNewUnitForm && (
    <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Nueva unidad de medida</h4>
        <button
          type="button"
          onClick={() => {
            setShowNewUnitForm(false);
            setNewUnit({ nombre: '', simbolo: '', categoria: '' });
            setNewUnitErrors({});
          }}
          className="text-gray-500 hover:text-gray-700"
          disabled={isCreatingUnit}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block mb-1 text-xs text-gray-600" htmlFor="new-unit-nombre">
            Nombre
          </label>
          <input
            id="new-unit-nombre"
            type="text"
            value={newUnit.nombre}
            onChange={(e) => setNewUnit((u) => ({ ...u, nombre: e.target.value }))}
            placeholder="p. ej. Grados Celsius"
            className="w-full px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCreatingUnit}
          />
          {newUnitErrors.nombre && (
            <p className="text-xs text-red-600 mt-1">{newUnitErrors.nombre}</p>
          )}
        </div>

        <div>
          <label className="block mb-1 text-xs text-gray-600" htmlFor="new-unit-simbolo">
            Símbolo
          </label>
          <input
            id="new-unit-simbolo"
            type="text"
            value={newUnit.simbolo}
            onChange={(e) => setNewUnit((u) => ({ ...u, simbolo: e.target.value }))}
            placeholder="p. ej. °C"
            className="w-full px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCreatingUnit}
          />
          {newUnitErrors.simbolo && (
            <p className="text-xs text-red-600 mt-1">{newUnitErrors.simbolo}</p>
          )}
        </div>

        <div>
          <label className="block mb-1 text-xs text-gray-600" htmlFor="new-unit-categoria">
            Categoría
          </label>
          <select
            id="new-unit-categoria"
            value={newUnit.categoria}
            onChange={(e) => setNewUnit((u) => ({ ...u, categoria: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCreatingUnit}
          >
            <option value="">Seleccione una categoría</option>
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {newUnitErrors.categoria && (
            <p className="text-xs text-red-600 mt-1">{newUnitErrors.categoria}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setShowNewUnitForm(false);
              setNewUnit({ nombre: '', simbolo: '', categoria: '' });
              setNewUnitErrors({});
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCreatingUnit}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreateUnit}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isCreatingUnit}
          >
            {isCreatingUnit ? 'Creando...' : 'Crear unidad'}
          </button>
        </div>
      </div>
    </div>
  );

  // Lista de gestión de unidades existentes
  const manageUnitsMarkup = showManageUnits && (
    <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">Gestionar unidades existentes</h4>
        <button
          type="button"
          onClick={() => setShowManageUnits(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {unidadesDisponibles.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No hay unidades disponibles</p>
        ) : (
          unidadesDisponibles.map((unidad) => (
            <div
              key={unidad.id}
              className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {unidad.nombre} ({unidad.simbolo})
                </p>
                <p className="text-xs text-gray-500">{unidad.categoria}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteUnit(unidad.id, unidad.nombre)}
                disabled={deletingUnitId === unidad.id}
                className="ml-2 p-1.5 text-red-600 hover:bg-red-50 rounded focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Eliminar unidad"
              >
                {deletingUnitId === unidad.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Formulario principal
  const formMarkup = (
    <form onSubmit={handleSubmit} className={wrapperClass} noValidate>
      <h3 className="text-xl font-semibold text-gray-800">{titulo}</h3>

      {/* Nombre */}
      <div>
        <label className="block mb-1 text-sm text-gray-600" htmlFor="nombre">
          Nombre
        </label>
        <input
          id="nombre"
          type="text"
          value={values.nombre}
          onChange={handleChange('nombre')}
          placeholder="p. ej. Sensor de pH"
          className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre}</p>}
      </div>

      {/* Descripción */}
      <div>
        <label className="block mb-1 text-sm text-gray-600" htmlFor="descripcion">
          Descripción
        </label>
        <textarea
          id="descripcion"
          value={values.descripcion}
          onChange={handleChange('descripcion')}
          placeholder="Descripción breve del elemento"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        {errors.descripcion && (
          <p className="text-xs text-red-600 mt-1">{errors.descripcion}</p>
        )}
      </div>

      {/* Unidad de medida con opción de crear nueva */}
      <div>
        <label className="block mb-1 text-sm text-gray-600" htmlFor="unidadMedida">
          Unidad de medida
        </label>
        <select
          id="unidadMedida"
          value={values.unidadMedidaId || ''}
          onChange={(e) => setValues(v => ({ ...v, unidadMedidaId: Number(e.target.value) }))}
          className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          disabled={loadingUnidades || showNewUnitForm}
        >
          <option value="">
            {loadingUnidades ? 'Cargando...' : 'Seleccione una unidad'}
          </option>
          {unidadesDisponibles.map((unidad) => (
            <option key={unidad.id} value={unidad.id}>
              {unidad.nombre} ({unidad.simbolo}) - {unidad.categoria}
            </option>
          ))}
        </select>
        {errors.unidadMedida && (
          <p className="text-xs text-red-600 mt-1">{errors.unidadMedida}</p>
        )}

        {/* Botón para mostrar formulario de nueva unidad */}
        {!showNewUnitForm && !showManageUnits && (
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => setShowNewUnitForm(true)}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
              disabled={loadingUnidades}
            >
              ¿No encuentras la unidad? Crear una nueva
            </button>
            <span className="text-xs text-gray-400">|</span>
            <button
              type="button"
              onClick={() => setShowManageUnits(true)}
              className="text-xs text-gray-600 hover:text-gray-800 hover:underline focus:outline-none"
              disabled={loadingUnidades}
            >
              Gestionar unidades existentes
            </button>
          </div>
        )}

        {/* Formulario inline para crear nueva unidad */}
        {newUnitFormMarkup}

        {/* Lista de gestión de unidades existentes */}
        {manageUnitsMarkup}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block mb-1 text-sm text-gray-600" htmlFor="valorMin">
            Valor mínimo
          </label>
          <input
            id="valorMin"
            type="number"
            step="any"
            value={values.valorMin}
            onChange={handleChange('valorMin')}
            placeholder="p. ej. 0"
            className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {errors.valorMin && <p className="text-xs text-red-600 mt-1">{errors.valorMin}</p>}
        </div>

        <div>
          <label className="block mb-1 text-sm text-gray-600" htmlFor="valorMax">
            Valor máximo
          </label>
          <input
            id="valorMax"
            type="number"
            step="any"
            value={values.valorMax}
            onChange={handleChange('valorMax')}
            placeholder="p. ej. 14"
            className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {errors.valorMax && <p className="text-xs text-red-600 mt-1">{errors.valorMax}</p>}
        </div>
      </div>

      <div>
        <label className="block mb-1 text-sm text-gray-600" htmlFor="fuenteDatos">
          Fuente de datos
        </label>
        <input
          id="fuenteDatos"
          type="text"
          value={values.fuenteDatos}
          onChange={handleChange('fuenteDatos')}
          placeholder="p. ej. MQTT tópico /bioreactor/ph"
          className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        {errors.fuenteDatos && (
          <p className="text-xs text-red-600 mt-1">{errors.fuenteDatos}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isCheckingConflict || showNewUnitForm || showManageUnits}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isCheckingConflict || showNewUnitForm || showManageUnits}
        >
          {isCheckingConflict ? 'Verificando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );

  // Modal de confirmación de conflicto
  const confirmModalMarkup = showConfirmModal && conflictData && (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleCancelConfirm}
        aria-hidden="true"
      />

      <div
        ref={confirmModalRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl outline-none"
      >
        <h4 className="text-lg font-semibold text-gray-900 mb-3">
          Fuente de datos duplicada
        </h4>

        <p className="text-sm text-gray-700 mb-2">
          Este tópico está siendo utilizado por {conflictData.nombres.length === 1 ? 'el siguiente' : 'los siguientes'} {tipo}{conflictData.nombres.length > 1 ? 's' : ''}:
        </p>

        <ul className="list-disc list-inside text-sm text-gray-700 mb-4 ml-2">
          {conflictData.nombres.map((nombre, idx) => (
            <li key={idx} className="mb-1">{nombre}</li>
          ))}
        </ul>

        <p className="text-sm text-gray-700 mb-6">
          ¿Desea continuar de todos modos?
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancelConfirm}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );

  // Modal de error de eliminación de unidad
  const deleteErrorModalMarkup = showDeleteError && deleteErrorData && (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          setShowDeleteError(false);
          setDeleteErrorData(null);
        }}
        aria-hidden="true"
      />

      <div
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl outline-none"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              No se puede eliminar la unidad
            </h4>
            <p className="text-sm text-gray-700 mb-3">
              {deleteErrorData.message}
            </p>
          </div>
        </div>

        <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded max-h-60 overflow-y-auto">
          <ul className="space-y-1">
            {deleteErrorData.elementos.map((elemento, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5">•</span>
                <span>{elemento}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              setShowDeleteError(false);
              setDeleteErrorData(null);
            }}
            className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );

  if (!asModal) {
    return (
      <>
        {formMarkup}
        {confirmModalMarkup}
        {deleteErrorModalMarkup}
      </>
    );
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="absolute inset-0 bg-black/40"
          onClick={(onRequestClose ?? onCancel)}
          aria-hidden="true"
        />

        <div
          ref={panelRef}
          tabIndex={-1}
          className="relative z-10 w-full max-w-2xl rounded-xl bg-white p-4 md:p-6 shadow-xl outline-none max-h-[90vh] overflow-y-auto"
        >
          {formMarkup}
        </div>
      </div>

      {confirmModalMarkup}
      {deleteErrorModalMarkup}
    </>
  );
}
