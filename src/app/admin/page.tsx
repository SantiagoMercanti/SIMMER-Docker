import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminUserTable from '../components/AdminUserTable';
import Header from '../components/Header';

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin') redirect('/dashboard');

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-100 px-4 py-8 overflow-y-auto">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-blue-600 tracking-wide">
              Administración de Usuarios
            </h1>
            <p className="text-gray-600">
              Gestioná todos los usuarios del sistema: cambiá su rol, eliminalos (soft-delete) o reactivalos.
            </p>
          </header>

          <AdminUserTable />
        </div>
      </main>
    </div>
  );
}
