import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { sql, ensureSchema } from '@/lib/db';
import { callSheets } from '@/integrations/googleSheets';
import { encryptJson } from '@/lib/crypto';
import { validDescriptor } from '@/lib/face';
import { clearTemplates } from '@/lib/templates';

export const dynamic = 'force-dynamic';
let ready = false;
const bad = (m: string, s = 400) => NextResponse.json({ ok: false, error: m }, { status: s });
const good = (d: any) => NextResponse.json({ ok: true, data: d });

// কর্মীর নিজের ফেস-রেজিস্ট্রেশন লিঙ্ক (লগইন ছাড়া; এককালীন ও ৪৮ ঘণ্টার টোকেন)
export async function POST(req: Request) {
  let hash = '', claimed = false;
  const q = () => sql();
  try {
    const b = await req.json();
    const t = String(b.t || '');
    if (!/^[\w-]{20,80}$/.test(t)) return bad('Invalid link', 400);
    if (!ready) { await ensureSchema(); ready = true; }
    hash = createHash('sha256').update(t).digest('hex');
    const row = (await q()`SELECT employee_id, expires_at, used_at FROM enroll_tokens WHERE token_hash = ${hash}`)[0];
    if (!row || row.used_at || new Date(row.expires_at) < new Date()) return bad('This link is invalid, used, or expired. Ask HR for a new one.', 410);
    const emp = (await callSheets('list', { table: 'employees', where: { id: row.employee_id } }))[0];
    if (!emp || emp.employment_status === 'Archived') return bad('Employee not found', 404);
    if (b.action === 'info') return good({ name: emp.full_name, code: emp.employee_code });
    if (b.action !== 'submit') return bad('unknown action');

    const ds = b.descriptors;
    if (b.consent !== true) return bad('Consent is required');
    if (!Array.isArray(ds) || ds.length < 3 || ds.length > 10 || !ds.every(validDescriptor)) return bad('Invalid face samples');
    const claim = await q()`UPDATE enroll_tokens SET used_at = now() WHERE token_hash = ${hash} AND used_at IS NULL RETURNING token_hash`;
    if (!claim.length) return bad('This link was already used.', 410);
    claimed = true;
    await q()`INSERT INTO face_templates (employee_id, template) VALUES (${emp.id}, ${encryptJson(ds)})
              ON CONFLICT (employee_id) DO UPDATE SET template = EXCLUDED.template, consent = true, updated_at = now()`;
    const rowUpd: any = { id: emp.id, face_enrolled: 'true' };
    const du = String(b.photo || '');
    if (/^data:image\/(jpeg|png|webp);base64,/.test(du) && du.length <= 400000) {
      try { rowUpd.photo_file_id = ((await callSheets('upload', { dataUrl: du, name: emp.id })) as any).id; } catch {}
    }
    await callSheets('save', { table: 'employees', row: rowUpd, actor: 'self-enroll:' + emp.employee_code });
    clearTemplates();
    await q()`INSERT INTO audit_logs (action, entity, entity_id, details) VALUES ('face_self_enroll', 'face_templates', ${emp.id}, 'via enrollment link')`;
    return good('ok');
  } catch (e: any) {
    if (claimed) { try { await q()`UPDATE enroll_tokens SET used_at = NULL WHERE token_hash = ${hash}`; } catch {} }
    return bad(e.message || 'Error', 500);
  }
}
