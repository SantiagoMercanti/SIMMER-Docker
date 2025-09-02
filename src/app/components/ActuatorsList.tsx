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
  const canEdit = role !== 'operator';

  if (!items?.length) {
    return (
      <>
        <EmptyState label="No hay actuadores." />
        {canEdit && (
          <div className="mt-6 text-center">
            <button
              onClick={() => console.log('Crear actuador')}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
            >
              +
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <ul className="space-y-4">
        {items.map((a) => (
          <li
            key={a.actuator_id}
            className="flex items-center justify-between p-4 bg-gray-100 rounded-md"
          >
            <button
              className="text-left text-gray-800 font-bold hover:text-gray-500"
              onClick={() => console.log('Ver detalle actuador', a.actuator_id)}
            >
              {a.nombre}
              <span className="block text-xs text-gray-500 font-normal">
                {(a.descripcion ?? 'Sin descripción') +
                  ` · ud: ${a.unidad_de_medida} · ${a.estado ? 'Activo' : 'Inactivo'}`}
              </span>
            </button>

            {canEdit && (
              <div className="flex space-x-2">
                <button
                  className="text-blue-500 hover:text-blue-700"
                  onClick={() => console.log('Editar actuador', a.actuator_id)}
                >
                  Editar
                </button>
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => console.log('Eliminar actuador', a.actuator_id)}
                >
                  Eliminar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-6 text-center">
          <button
            onClick={() => console.log('Crear actuador')}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
          >
            +
          </button>
        </div>
      )}
    </>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
      {label}
    </div>
  );
}
