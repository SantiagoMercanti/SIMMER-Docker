'use client';

type Role = 'operator' | 'labManager' | 'admin';

type Actuador = {
  actuator_id: number;
  nombre: string;
  descripcion: string | null;
  unidad_de_medida: string;
  estado: boolean;
};

export default function ActuatorsList({
  items,
  role,
}: {
  items: Actuador[];
  role: Role;
}) {
  if (!items?.length) {
    return <EmptyState label="No hay actuadores." />;
  }

  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li
          key={a.actuator_id}
          className="flex items-start justify-between rounded-lg border px-3 py-2"
        >
          <div>
            <p className="font-medium">{a.nombre}</p>
            <p className="text-xs text-gray-500">
              {a.descripcion ?? 'Sin descripción'} · ud: {a.unidad_de_medida} ·{' '}
              {a.estado ? 'Activo' : 'Inactivo'}
            </p>
          </div>

          {role !== 'operator' && (
            <Actions
              onEdit={() => console.log('Editar actuador', a.actuator_id)}
              onDelete={() => console.log('Eliminar actuador', a.actuator_id)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function Actions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
        onClick={onEdit}
      >
        Editar
      </button>
      <button
        className="rounded-md border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        onClick={onDelete}
      >
        Eliminar
      </button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
      {label}
    </div>
  );
}
