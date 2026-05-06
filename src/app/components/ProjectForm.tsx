'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type ProjectFormValues = {
    nombre: string;
    descripcion: string;
    sensorIds: number[];
    actuatorIds: number[];
    publico: boolean;
};

export type SimpleItem = { id: number; name: string };

type Props = {
    // Listas para checkear
    sensores: SimpleItem[];
    actuadores: SimpleItem[];

    // Lógica del form
    initialValues?: Partial<ProjectFormValues>;
    onCancel?: () => void;
    onSubmit?: (values: ProjectFormValues) => void;

    // Modal opcional
    asModal?: boolean;
    open?: boolean;
    onRequestClose?: () => void;
};

export default function ProjectForm({
    sensores,
    actuadores,
    initialValues = {},
    onCancel,
    onSubmit,
    asModal = false,
    open = true,
    onRequestClose,
}: Props) {
    const [values, setValues] = useState<ProjectFormValues>({
        nombre: initialValues.nombre ?? '',
        descripcion: initialValues.descripcion ?? '',
        sensorIds: initialValues.sensorIds ?? [],
        actuatorIds: initialValues.actuatorIds ?? [],
        publico: initialValues.publico ?? false,
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [removalWarning, setRemovalWarning] = useState<{ sensors: string[]; actuators: string[] } | null>(null);
    const [pendingSubmit, setPendingSubmit] = useState<ProjectFormValues | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Reset al abrir/cambiar initialValues
    useEffect(() => {
        if (!asModal || !open) return;
        setValues({
            nombre: initialValues.nombre ?? '',
            descripcion: initialValues.descripcion ?? '',
            sensorIds: initialValues.sensorIds ?? [],
            actuatorIds: initialValues.actuatorIds ?? [],
            publico: initialValues.publico ?? false,
        });
        setErrors({});
    }, [asModal, open, initialValues.nombre, initialValues.descripcion, initialValues.sensorIds, initialValues.actuatorIds]);

    // UX modal: Escape + bloquear scroll
    useEffect(() => {
        if (!asModal || !open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') (onRequestClose ?? onCancel)?.(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [asModal, open, onRequestClose, onCancel]);

    const titulo = useMemo(() => (initialValues?.nombre ? 'Editar proyecto' : 'Nuevo proyecto'), [initialValues?.nombre]);

    const handleChange =
        (field: 'nombre' | 'descripcion') =>
            (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setValues((v) => ({ ...v, [field]: e.target.value }));
            };

    const toggleId = (field: 'sensorIds' | 'actuatorIds', id: number) => {
        setValues((v) => {
            const set = new Set(v[field]);
            if (set.has(id)) {
                set.delete(id);
            } else {
                set.add(id);
            }
            return { ...v, [field]: Array.from(set) };
        });
    };

    const validate = () => {
        const next: Record<string, string> = {};
        if (!values.nombre.trim()) next.nombre = 'El nombre es obligatorio.';
        if (!values.descripcion.trim()) next.descripcion = 'La descripción es obligatoria.';

        // Validar que haya al menos un sensor o actuador
        if (values.sensorIds.length === 0 && values.actuatorIds.length === 0) {
            next.sensores = 'Debe seleccionar al menos un sensor o actuador.';
        }

        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        // Solo advertir en edición (cuando hay un nombre inicial, es edit mode)
        if (initialValues?.nombre) {
            const originalSensorIds = new Set(initialValues.sensorIds ?? []);
            const originalActuatorIds = new Set(initialValues.actuatorIds ?? []);
            const removedSensors = sensores.filter((s) => originalSensorIds.has(s.id) && !values.sensorIds.includes(s.id)).map((s) => s.name);
            const removedActuators = actuadores.filter((a) => originalActuatorIds.has(a.id) && !values.actuatorIds.includes(a.id)).map((a) => a.name);

            if (removedSensors.length > 0 || removedActuators.length > 0) {
                setRemovalWarning({ sensors: removedSensors, actuators: removedActuators });
                setPendingSubmit(values);
                return;
            }
        }

        onSubmit?.(values);
    };

    const handleConfirmRemoval = () => {
        if (pendingSubmit) onSubmit?.(pendingSubmit);
        setRemovalWarning(null);
        setPendingSubmit(null);
    };

    const handleCancelRemoval = () => {
        setRemovalWarning(null);
        setPendingSubmit(null);
    };

    const wrapperClass = asModal ? 'space-y-4' : 'bg-white shadow-md rounded-lg p-4 md:p-6 space-y-4';

    const formMarkup = (
        <form onSubmit={handleSubmit} className={wrapperClass} noValidate>
            <h3 className="text-xl font-semibold text-gray-800">{titulo}</h3>

            {/* Nombre */}
            <div>
                <label className="block mb-1 text-sm text-gray-600" htmlFor="nombre">Nombre</label>
                <input
                    id="nombre"
                    type="text"
                    value={values.nombre}
                    onChange={handleChange('nombre')}
                    placeholder="p. ej. BioReactor A"
                    className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
                {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre}</p>}
            </div>

            {/* Descripción */}
            <div>
                <label className="block mb-1 text-sm text-gray-600" htmlFor="descripcion">Descripción</label>
                <textarea
                    id="descripcion"
                    rows={3}
                    value={values.descripcion}
                    onChange={handleChange('descripcion')}
                    placeholder="Descripción breve del proyecto"
                    className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
                {errors.descripcion && (
                    <p className="text-xs text-red-600 mt-1">{errors.descripcion}</p>
                )}
            </div>

            {/* Sensores */}
            <div>
                <p className="mb-1 text-sm text-gray-600">Sensores</p>
                <div className="max-h-48 overflow-auto border rounded-md p-2 divide-y">
                    {sensores.length === 0 ? (
                        <p className="text-sm text-gray-500 px-1 py-2">No hay sensores cargados.</p>
                    ) : (
                        sensores.map((s) => (
                            <label key={s.id} className="flex items-center gap-2 py-2 px-1">
                                <input
                                    type="checkbox"
                                    checked={values.sensorIds.includes(s.id)}
                                    onChange={() => toggleId('sensorIds', s.id)}
                                />
                                <span className="text-gray-700">{s.name}</span>
                            </label>
                        ))
                    )}
                </div>
            </div>

            {/* Actuadores */}
            <div>
                <p className="mb-1 text-sm text-gray-600">Actuadores</p>
                <div className="max-h-48 overflow-auto border rounded-md p-2 divide-y">
                    {actuadores.length === 0 ? (
                        <p className="text-sm text-gray-500 px-1 py-2">No hay actuadores cargados.</p>
                    ) : (
                        actuadores.map((a) => (
                            <label key={a.id} className="flex items-center gap-2 py-2 px-1">
                                <input
                                    type="checkbox"
                                    checked={values.actuatorIds.includes(a.id)}
                                    onChange={() => toggleId('actuatorIds', a.id)}
                                />
                                <span className="text-gray-700">{a.name}</span>
                            </label>
                        ))
                    )}
                </div>
                {errors.sensores && (
                    <p className="text-xs text-red-600 mt-1">{errors.sensores}</p>
                )}
            </div>

            {/* Visibilidad */}
            <div>
                <p className="mb-2 text-sm text-gray-600">Visibilidad</p>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setValues((v) => ({ ...v, publico: false }))}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            !values.publico
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Privado
                    </button>
                    <button
                        type="button"
                        onClick={() => setValues((v) => ({ ...v, publico: true }))}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            values.publico
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Público
                    </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                    {values.publico
                        ? 'Todos los usuarios pueden ver este proyecto, pero solo vos podés editarlo.'
                        : 'Solo vos y los administradores pueden ver este proyecto.'}
                </p>
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

    const removalWarningModal = removalWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
            <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <div className="flex items-start gap-3 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="text-base font-semibold text-gray-900 mb-1">Pérdida permanente de mediciones</h4>
                        <p className="text-sm text-gray-700">
                            Está a punto de quitar del proyecto:
                        </p>
                    </div>
                </div>

                {removalWarning.sensors.length > 0 && (
                    <div className="mb-2">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Sensores:</p>
                        <ul className="list-disc list-inside text-sm text-gray-800 ml-2 space-y-0.5">
                            {removalWarning.sensors.map((n) => <li key={n}>{n}</li>)}
                        </ul>
                    </div>
                )}
                {removalWarning.actuators.length > 0 && (
                    <div className="mb-2">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Actuadores:</p>
                        <ul className="list-disc list-inside text-sm text-gray-800 ml-2 space-y-0.5">
                            {removalWarning.actuators.map((n) => <li key={n}>{n}</li>)}
                        </ul>
                    </div>
                )}

                <p className="text-sm text-gray-700 mt-3 mb-1">
                    Esto eliminará de manera <strong>permanente e irreversible</strong> todas las mediciones asociadas.
                </p>
                <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2 mt-2">
                    Se recomienda descargar una copia en CSV antes de continuar.
                </p>

                <div className="flex items-center justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={handleCancelRemoval}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmRemoval}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                        Sí, eliminar y guardar
                    </button>
                </div>
            </div>
        </div>
    );

    if (!asModal) return (
        <>
            {formMarkup}
            {removalWarningModal}
        </>
    );
    if (!open) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div className="absolute inset-0 bg-black/40" onClick={(onRequestClose ?? onCancel)} aria-hidden="true" />
                <div
                    ref={panelRef}
                    tabIndex={-1}
                    className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-4 md:p-6 shadow-xl outline-none"
                >
                    {formMarkup}
                </div>
            </div>
            {removalWarningModal}
        </>
    );
}
