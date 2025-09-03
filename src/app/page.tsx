import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      redirect('/dashboard');
    } catch {
      redirect('/login'); // Token inválido o expirado
    }
  } else {
    redirect('/login'); // No hay token
  }
}