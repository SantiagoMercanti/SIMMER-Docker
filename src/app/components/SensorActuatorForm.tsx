'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type SensorActuatorFormValues = {
  nombre: string;
  descripcion: string;
  unidadMedida: string;
  valorMin: string;   // strings para validación simple en UI
  valorMax: string;
  fuenteDatos: string;
};

type Props = {
  // LÓGICA DEL FORM
  tipo: 'sensor' | 'actuador';
  initialValues?: Partial<SensorActuatorFormValues>;
  onCancel?: () => void;
  onSubmit?: (values: SensorActuatorFormValues) => void;

  // MODO MODAL (opcional)
  asModal?: boolean;           // si true, se renderiza como modal
  open?: boolean;              // controla la visibilidad del modal
  onRequestClose?: () => void; // cerrar por backdrop o Escape
};

export default function SensorActuatorForm({
  tipo,
  initialValues = {},
  onCancel,
  onSubmit,
  asModal = false,
  open = true,
  onRequestClose,
}: Props) {
  // Estado del formulario (se inicializa una vez con initialValues)
  const [values, setValues] = useState<SensorActuatorFormValues>({
    nombre: initialValues.nombre ?? '',
    descripcion: initialValues.descripcion ?? '',
    unidadMedida: initialValues.unidadMedida ?? '',
    valorMin: initialValues.valorMin ?? '',
    valorMax: initialValues.valorMax ?? '',
    fuenteDatos: initialValues.fuenteDatos ?? '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);

  // Accesibilidad/UX en modo modal: cerrar con Escape y bloquear scroll del fondo
  useEffect(() => {
    if (!asModal || !open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (onRequestClose ?? onCancel)?.();
    };
    document.addEventListener('keydown', handleKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [asModal, open, onRequestClose, onCancel]);

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
    if (!values.unidadMedida.trim()) next.unidadMedida = 'La unidad de medida es obligatoria.';
    if (!values.fuenteDatos.trim()) next.fuenteDatos = 'La fuente de datos es obligatoria.';

    const min = values.valorMin.trim() === '' ? null : Number(values.valorMin);
    const max = values.valorMax.trim() === '' ? null : Number(values.valorMax);
    if (values.valorMin && Number.isNaN(min)) next.valorMin = 'Debe ser un número.';
    if (values.valorMax && Number.isNaN(max)) next.valorMax = 'Debe ser un número.';
    if (min !== null && max !== null && min > max) next.valorMax = 'El máximo debe ser ≥ mínimo.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit?.(values);
  };

  // CLASES: si es modal, el form se muestra "plano" (sin card)
  const wrapperClass = asModal
    ? 'space-y-4'
    : 'bg-white shadow-md rounded-lg p-4 md:p-6 space-y-4';

  // --- MARKUP DEL FORM ---
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
        />
      </div>

      {/* Unidad de medida */}
      <div>
        <label className="block mb-1 text-sm text-gray-600" htmlFor="unidadMedida">
          Unidad de medida
        </label>
        <input
          id="unidadMedida"
          type="text"
          value={values.unidadMedida}
          onChange={handleChange('unidadMedida')}
          placeholder="p. ej. °C, pH, RPM, %"
          className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        {errors.unidadMedida && (
          <p className="text-xs text-red-600 mt-1">{errors.unidadMedida}</p>
        )}
      </div>

      {/* Rango */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block mb-1 text-sm text-gray-600" htmlFor="valorMin">
            Valor mínimo (opcional)
          </label>
          <input
            id="valorMin"
            type="number"
            step="any"
            value={values.valorMin}
            onChange={handleChange('valorMin')}
            placeholder="p. ej. 0"
            className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.valorMin && <p className="text-xs text-red-600 mt-1">{errors.valorMin}</p>}
        </div>

        <div>
          <label className="block mb-1 text-sm text-gray-600" htmlFor="valorMax">
            Valor máximo (opcional)
          </label>
          <input
            id="valorMax"
            type="number"
            step="any"
            value={values.valorMax}
            onChange={handleChange('valorMax')}
            placeholder="p. ej. 14"
            className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.valorMax && <p className="text-xs text-red-600 mt-1">{errors.valorMax}</p>}
        </div>
      </div>

      {/* Fuente de datos */}
      <div>
        <label className="block mb-1 text-sm text-gray-600" htmlFor="fuenteDatos">
          Fuente de datos
        </label>
        <input
          id="fuenteDatos"
          type="text"
          value={values.fuenteDatos}
          onChange={handleChange('fuenteDatos')}
          placeholder="p. ej. Node-RED, OPC-UA, MQTT tópico /bioreactor/ph"
          className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        {errors.fuenteDatos && (
          <p className="text-xs text-red-600 mt-1">{errors.fuenteDatos}</p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Guardar
        </button>
      </div>
    </form>
  );

  // Si no es modal: render directo
  if (!asModal) return formMarkup;

  // En modo modal: no renderiza si está cerrado
  if (!open) return null;

  // En modo modal: overlay + panel (el form va "plano" adentro)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={(onRequestClose ?? onCancel)}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-2xl rounded-xl bg-white p-4 md:p-6 shadow-xl outline-none"
      >
        {formMarkup}
      </div>
    </div>
  );
}
