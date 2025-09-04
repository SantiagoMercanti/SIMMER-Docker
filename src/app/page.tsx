import { redirect } from 'next/navigation';

export const runtime = 'nodejs';

export default function Root() {
  redirect('/login'); // Next le agrega basePath en prod
}
