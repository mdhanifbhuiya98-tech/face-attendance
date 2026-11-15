import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
export const dynamic = 'force-dynamic';
export default async function Dashboard() {
  if (!(await getSession())) redirect('/login');
  redirect('/app.html');
}
