import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || '');
export type Session = { uid: string; role: string; name: string; email: string };

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s }).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime('8h').sign(key());
  cookies().set('sf_session', token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: 8 * 3600
  });
}
export async function getSession(): Promise<Session | null> {
  const t = cookies().get('sf_session')?.value;
  if (!t) return null;
  try { return (await jwtVerify(t, key())).payload as any; } catch { return null; }
}
export function destroySession() { cookies().delete('sf_session'); }

export async function sessionStatus(): Promise<{ s: Session | null; why: string }> {
  const t = cookies().get('sf_session')?.value;
  if (!t) return { s: null, why: 'no session cookie reached the server' };
  try { return { s: (await jwtVerify(t, key())).payload as any, why: '' }; }
  catch (e: any) { return { s: null, why: 'session token invalid (' + (e.code || e.message) + ') - check SESSION_SECRET' }; }
}
