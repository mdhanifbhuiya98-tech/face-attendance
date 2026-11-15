import { NextResponse } from 'next/server';
import { verify } from '@node-rs/argon2';
import { sql } from '@/lib/db';
import { createSession } from '@/lib/session';

const MAX_FAILS = 5, LOCK_MIN = 15;

export async function POST(req: Request) {
  const bad = (s = 401, m = 'Invalid email or password') => NextResponse.json({ error: m }, { status: s });
  try {
    const b = await req.json();
    const email = String(b.email || '').trim().toLowerCase();
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const ua = req.headers.get('user-agent') || '';
    const q = sql();
    const u = (await q`SELECT * FROM users WHERE email = ${email} LIMIT 1`)[0];
    const log = (success: boolean, reason: string) =>
      q`INSERT INTO login_history (user_id, email, success, ip, user_agent, reason) VALUES (${u?.id ?? null}, ${email}, ${success}, ${ip}, ${ua}, ${reason})`;

    if (!u || !u.active) { await log(false, 'unknown or inactive'); return bad(); }
    if (u.locked_until && new Date(u.locked_until) > new Date()) { await log(false, 'locked'); return bad(429, 'Account temporarily locked. Try again later.'); }

    const ok = await verify(u.password_hash, String(b.password || '')).catch(() => false);
    if (!ok) {
      const n = u.failed_attempts + 1;
      if (n >= MAX_FAILS) await q`UPDATE users SET failed_attempts = 0, locked_until = now() + ${LOCK_MIN + ' minutes'}::interval WHERE id = ${u.id}`;
      else await q`UPDATE users SET failed_attempts = ${n} WHERE id = ${u.id}`;
      await log(false, 'wrong password');
      return bad();
    }
    await q`UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = now() WHERE id = ${u.id}`;
    await log(true, 'ok');
    await createSession({ uid: u.id, role: u.role, name: u.name, email: u.email });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error: ' + e.message }, { status: 500 });
  }
}
