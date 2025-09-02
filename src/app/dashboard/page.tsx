// Si en algún momento el proyecto pasa a Edge Runtime, jsonwebtoken no funciona allí; habría que fijar Node.js explícitamente:
// export const runtime = 'nodejs';

import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import ProjectsList from '@/app/components/ProjectsList';
import SensorsList from '@/app/components/SensorsList';
import ActuatorsList from '@/app/components/ActuatorsList';

type Role = 'operator' | 'labManager' | 'admin';

async function getRoleFromToken(): Promise<Role> {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return 'operator';
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev_secret_change_me'
    ) as { role?: Role };
    return payload.role ?? 'operator';
  } catch {
    return 'operator';
  }
}

export default async function DashboardPage() {
  const role = await getRoleFromToken();

  // Traemos todo para listar
  const [proyectos, sensores, actuadores] = await Promise.all([
    prisma.proyecto.findMany({ orderBy: { project_id: 'asc' } }),
    prisma.sensor.findMany({ orderBy: { sensor_id: 'asc' } }),
    prisma.actuador.findMany({ orderBy: { actuator_id: 'asc' } }),
  ]);

  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500">
            Rol actual: <span className="font-medium">{role}</span>
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 grid gap-6 md:grid-cols-3">
        {/* Proyectos */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-4 flex items-center justify-between text-lg font-semibold">
            Proyectos
            {/* Los operadores solo visualizan; otros ven acciones */}
            {role !== 'operator' && (
              <button
                className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                onClick={() => {}}
              >
                + Crear
              </button>
            )}
          </h2>
          <ProjectsList items={proyectos} role={role} />
        </div>

        {/* Sensores */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-4 flex items-center justify-between text-lg font-semibold">
            Sensores
            {role !== 'operator' && (
              <button
                className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                onClick={() => {}}
              >
                + Crear
              </button>
            )}
          </h2>
          <SensorsList items={sensores} role={role} />
        </div>

        {/* Actuadores */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="mb-4 flex items-center justify-between text-lg font-semibold">
            Actuadores
            {role !== 'operator' && (
              <button
                className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                onClick={() => {}}
              >
                + Crear
              </button>
            )}
          </h2>
          <ActuatorsList items={actuadores} role={role} />
        </div>
      </section>
    </main>
  );
}


