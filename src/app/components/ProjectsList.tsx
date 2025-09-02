'use client';

type Role = 'operator' | 'labManager' | 'admin';

type Proyecto = {
  project_id: number;
  nombre: string;
  descripcion: string | null;
};

export default function ProjectsList({
  items,
  role,
}: {
  items: Proyecto[];
  role: Role;
}) {
  if (!items?.length) {
    return <EmptyState label="No hay proyectos." />;
  }

  return (
    <ul className="space-y-2">
      {items.map((p) => (
        <li
          key={p.project_id}
          className="flex items-start justify-between rounded-lg border px-3 py-2"
        >
          <div>
            <p className="font-medium">{p.nombre}</p>
            {p.descripcion ? (
              <p className="text-sm text-gray-500">{p.descripcion}</p>
            ) : null}
          </div>

          {role !== 'operator' && (
            <Actions
              onEdit={() => console.log('Editar proyecto', p.project_id)}
              onDelete={() => console.log('Eliminar proyecto', p.project_id)}
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
