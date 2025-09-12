import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminUserTable from '../components/AdminUserTable';
import Header from '../components/Header';

// Para soportar tu subpath en prod ('' en dev, '/a03' en prod)
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');

export default async function AdminPage() {
  const user = await getCurrentUser();

  // sin sesión -> al login con next=/admin
  if (!user) {
    redirect(`${BASE}/login?next=/admin`);
  }

  // logueado pero no admin -> al dashboard
  if (user.role !== 'admin') {
    redirect(`${BASE}/dashboard`);
  }

  // admin: render normal con el patrón de estilos del dashboard
  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-100 px-4 py-8">
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
      </div>
    </>
  );
}
