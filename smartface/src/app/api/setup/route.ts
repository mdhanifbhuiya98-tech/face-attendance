import { NextResponse } from 'next/server';
import { hash } from '@node-rs/argon2';
import { sql, ensureSchema } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!process.env.SETUP_KEY || b.setupKey !== process.env.SETUP_KEY)
      return NextResponse.json({ error: 'Invalid setup key' }, { status: 403 });
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    if (String(b.password || '').length < 10) return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 });
    await ensureSchema();
    const q = sql();
    const pw = await hash(String(b.password)); // Argon2id
    const rows = await q`INSERT INTO users (email, name, role, password_hash)
      SELECT ${email}, ${String(b.name || '').trim()}, 'super_admin', ${pw}
      WHERE NOT EXISTS (SELECT 1 FROM users) RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: 'Setup already completed' }, { status: 409 });
    await q`INSERT INTO audit_logs (user_id, action, entity) VALUES (${rows[0].id}, 'initial_setup', 'users')`;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
