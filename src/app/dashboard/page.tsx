// // Si en algún momento el proyecto pasa a Edge Runtime, jsonwebtoken no funciona allí; habría que fijar Node.js explícitamente:
// // export const runtime = 'nodejs';

// import { prisma } from '@/lib/prisma';
// import { cookies } from 'next/headers';
// import jwt from 'jsonwebtoken';
// import ProjectsList from '@/app/components/ProjectsList';
// import SensorsList from '@/app/components/SensorsList';
// import ActuatorsList from '@/app/components/ActuatorsList';

// type Role = 'operator' | 'labManager' | 'admin';

// async function getRoleFromToken(): Promise<Role> {
//   const cookieStore = await cookies();
//   const token = cookieStore.get('token')?.value;

//   if (!token) return 'operator';
//   try {
//     const payload = jwt.verify(
//       token,
//       process.env.JWT_SECRET || 'dev_secret_change_me'
//     ) as { role?: Role };
//     return payload.role ?? 'operator';
//   } catch {
//     return 'operator';
//   }
// }

// export default async function DashboardPage() {
//   const role = await getRoleFromToken();

//   const [proyectos, sensores, actuadores] = await Promise.all([
//     prisma.proyecto.findMany({ orderBy: { project_id: 'asc' } }),
//     prisma.sensor.findMany({ orderBy: { sensor_id: 'asc' } }),
//     prisma.actuador.findMany({ orderBy: { actuator_id: 'asc' } }),
//   ]);

//   return (
//     <div className="min-h-screen bg-gray-100 p-6">
//       <div className="max-w-7xl mx-auto">
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           {/* Proyectos */}
//           <div className="bg-white rounded-lg shadow-md p-6">
//             <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-6">
//               Proyectos
//             </h2>
//             <ProjectsList items={proyectos} role={role} />
//           </div>

//           {/* Sensores */}
//           <div className="bg-white rounded-lg shadow-md p-6">
//             <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-6">
//               Sensores
//             </h2>
//             <SensorsList items={sensores} role={role} />
//           </div>

//           {/* Actuadores */}
//           <div className="bg-white rounded-lg shadow-md p-6">
//             <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-blue-500 pb-2 mb-6">
//               Actuadores
//             </h2>
//             <ActuatorsList items={actuadores} role={role} />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

export default function DashboardPage() {
  return <h1 className="text-2xl font-bold">Dashboard</h1>;
}

