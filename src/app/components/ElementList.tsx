'use client';

export type ElementItem = {
  id: string;
  name: string;
};

type ElementListProps = {
  title: string;
  items: ElementItem[];
  addLabel?: string;
  onAdd?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export default function ElementList({
  title,
  items,
  addLabel = 'Agregar',
  onAdd,
  onEdit,
  onDelete,
}: ElementListProps) {
  return (
    <section className="bg-white shadow-md rounded-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          + {addLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No hay elementos todavía.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3">
              <span className="text-gray-700">{item.name}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit?.(item.id)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(item.id)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { type ElementListProps };
