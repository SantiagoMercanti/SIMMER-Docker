import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Header from '../components/Header';
import UserInfoTable from '../components/UserInfoTable';

export default async function UserPage() {
  const user = await getCurrentUser();

  // sin sesión -> al login con next=/user
  if (!user) {
    redirect('/login?next=/user');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gray-100 px-4 py-8 overflow-y-auto">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6">
            <h1 className="text-3xl font-bold text-blue-600 tracking-wide">
              Información de usuario
            </h1>
            <p className="text-gray-600">
              Datos asociados a tu cuenta.
            </p>
          </header>

          <section className="bg-white shadow-md rounded-lg p-4">
            <UserInfoTable
              nombre={user.nombre ?? ''}
              apellido={user.apellido ?? ''}
              email={user.email ?? ''}
              role={(user.role as 'operator' | 'labManager' | 'admin') ?? 'operator'}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
