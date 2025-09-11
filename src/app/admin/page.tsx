import { requireAdmin } from '@/lib/auth';
import AdminUserTable from '../components/AdminUserTable';

export default async function AdminPage() {
  // Solo continúa si el usuario es admin
  await requireAdmin();

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Administración de Usuarios</h1>
      <p className="text-gray-600">
        Aquí puedes gestionar todos los usuarios del sistema: cambiar su rol o eliminarlos.
      </p>
      <AdminUserTable />
    </main>
  );
}
