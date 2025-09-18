'use client';

import { useState } from 'react';
import UserInfoModal from './UserInfoModal';

type Role = 'operator' | 'labManager' | 'admin';

const roleLabels: Record<Role, string> = {
  operator: 'Operador',
  labManager: 'Jefe de laboratorio',
  admin: 'Admin',
};

export default function UserInfoTable({
  nombre: initialNombre,
  apellido: initialApellido,
  email: initialEmail,
  role,
}: {
  nombre: string;
  apellido: string;
  email: string;
  role: Role;
}) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(initialNombre);
  const [apellido, setApellido] = useState(initialApellido);
  const [email, setEmail] = useState(initialEmail);

  const usuarioStr = `${nombre ?? ''} ${apellido ?? ''}`.trim() || '—';

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <tbody className="divide-y divide-gray-100">
            <tr>
              <th className="w-56 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Usuario
              </th>
              <td className="px-4 py-3 text-gray-800">{usuarioStr}</td>
            </tr>
            <tr>
              <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Correo electrónico
              </th>
              <td className="px-4 py-3 text-gray-800">{email || '—'}</td>
            </tr>
            <tr>
              <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Tipo de usuario
              </th>
              <td className="px-4 py-3 text-gray-800">
                {roleLabels[role]}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Editar
        </button>
      </div>

      {/* Modal de edición */}
      <UserInfoModal
        open={open}
        onClose={() => setOpen(false)}
        defaults={{ nombre, apellido, email }}
        onSaved={(u) => {
          setNombre(u.nombre);
          setApellido(u.apellido);
          setEmail(u.email);
        }}
      />
    </div>
  );
}
