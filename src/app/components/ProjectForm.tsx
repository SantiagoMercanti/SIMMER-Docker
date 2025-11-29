'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type ProjectFormValues = {
    nombre: string;
    descripcion: string;
    sensorIds: number[];
    actuatorIds: number[];
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
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const panelRef = useRef<HTMLDivElement>(null);

    // Reset al abrir/cambiar initialValues
    useEffect(() => {
        if (!asModal || !open) return;
        setValues({
            nombre: initialValues.nombre ?? '',
            descripcion: initialValues.descripcion ?? '',
            sensorIds: initialValues.sensorIds ?? [],
            actuatorIds: initialValues.actuatorIds ?? [],
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
        onSubmit?.(values);
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

    if (!asModal) return formMarkup;
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={(onRequestClose ?? onCancel)} aria-hidden="true" />
            <div ref={panelRef} tabIndex={-1} className="relative z-10 w-full max-w-2xl rounded-xl bg-white p-4 md:p-6 shadow-xl outline-none">
                {formMarkup}
            </div>
        </div>
    );
}
