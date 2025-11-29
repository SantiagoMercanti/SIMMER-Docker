'use client';

export type ElementItem = {
  id: string;
  name: string;
  activo?: boolean;  // ← Agregado
};

type ElementListProps = {
  title: string;
  items: ElementItem[];
  addLabel?: string;
  onAdd?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onReactivate?: (id: string) => void;  // ← Agregado
  /** Abrir modal de detalle al clickear el nombre */
  onView?: (id: string) => void;
  /** Permisos (default true para no romper otros usos) */
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

export default function ElementList({
  title,
  items,
  addLabel = 'Agregar',
  onAdd,
  onEdit,
  onDelete,
  onReactivate,  // ← Agregado
  onView,
  canCreate = true,
  canEdit = true,
  canDelete = true,
}: ElementListProps) {
  return (
    <section className="bg-white shadow-md rounded-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        {onAdd && canCreate && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + {addLabel}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No hay elementos todavía.</p>
      ) : (
        <ul className="divide-y divide-gray-200 max-h-[50vh] overflow-y-auto">
          {items.map((item) => {
            const isInactive = item.activo === false;  // ← Agregado
            
            return (
              <li key={item.id} className="flex items-center justify-between py-3">
                {onView ? (
                  <button
                    type="button"
                    onClick={() => onView(item.id)}
                    className="text-left text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Ver detalles"
                  >
                    {item.name}
                  </button>
                ) : (
                  <span className="text-gray-700">{item.name}</span>
                )}

                <div className="flex items-center gap-2">
                  {onEdit && canEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit?.(item.id)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Editar
                    </button>
                  )}
                  {/* ↓ Modificado */}
                  {isInactive && onReactivate ? (
                    <button
                      type="button"
                      onClick={() => onReactivate(item.id)}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      Reactivar
                    </button>
                  ) : (
                    onDelete && canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete?.(item.id)}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        Eliminar
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export { type ElementListProps };
