import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminUserTable from '../components/AdminUserTable';
import Header from '../components/Header';

export default async function AdminPage() {
  const user = await getCurrentUser();

  // sin sesión -> al login con next=/admin
  if (!user) {
    redirect('/login?next=/admin');
  }

  // logueado pero no admin -> al dashboard
  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  // admin: render normal
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
              Gestioná todos los usuarios del sistema: cambiá su rol o eliminalos.
            </p>
          </header>

          <section className="bg-white shadow-md rounded-lg p-4">
            <AdminUserTable />
          </section>
        </div>
      </main>
    </div>
  );
}
