// 'use client';

// type Role = 'operator' | 'labManager' | 'admin';

// type Proyecto = {
//   project_id: number;
//   nombre: string;
//   descripcion: string | null;
// };

// export default function ProjectsList({
//   items,
//   role,
// }: {
//   items: Proyecto[];
//   role: Role;
// }) {
//   const canEdit = role !== 'operator';

//   if (!items?.length) {
//     return (
//       <>
//         <EmptyState label="No hay proyectos." />
//         {canEdit && (
//           <div className="mt-6 text-center">
//             <button
//               onClick={() => console.log('Crear proyecto')}
//               className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
//             >
//               +
//             </button>
//           </div>
//         )}
//       </>
//     );
//   }

//   return (
//     <>
//       <ul className="space-y-4">
//         {items.map((p) => (
//           <li
//             key={p.project_id}
//             className="flex items-center justify-between p-4 bg-gray-100 rounded-md"
//           >
//             <button
//               className="text-left text-gray-800 font-bold hover:text-gray-500"
//               onClick={() => console.log('Ver detalle proyecto', p.project_id)}
//             >
//               {p.nombre}
//               {p.descripcion ? (
//                 <span className="block text-xs text-gray-500 font-normal">
//                   {p.descripcion}
//                 </span>
//               ) : null}
//             </button>

//             {canEdit && (
//               <div className="flex space-x-2">
//                 <button
//                   className="text-blue-500 hover:text-blue-700"
//                   onClick={() => console.log('Editar proyecto', p.project_id)}
//                 >
//                   Editar
//                 </button>
//                 <button
//                   className="text-red-500 hover:text-red-700"
//                   onClick={() => console.log('Eliminar proyecto', p.project_id)}
//                 >
//                   Eliminar
//                 </button>
//               </div>
//             )}
//           </li>
//         ))}
//       </ul>

//       {canEdit && (
//         <div className="mt-6 text-center">
//           <button
//             onClick={() => console.log('Crear proyecto')}
//             className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
//           >
//             +
//           </button>
//         </div>
//       )}
//     </>
//   );
// }

// function EmptyState({ label }: { label: string }) {
//   return (
//     <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
//       {label}
//     </div>
//   );
// }
