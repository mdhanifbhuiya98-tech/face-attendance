import { NextResponse } from 'next/server';
import { hash, verify } from '@node-rs/argon2';
import { sessionStatus } from '@/lib/session';
import { sql, ensureSchema } from '@/lib/db';
import { callSheets, getDashboardStats } from '@/integrations/googleSheets';
import * as P from '@/lib/policy';
import { randomBytes, createHash } from 'crypto';
import { encryptJson } from '@/lib/crypto';
import { getTemplates, clearTemplates } from '@/lib/templates';
import { buildDashboard, dhakaDate } from '@/lib/dashboard';
import { bestMatch, validDescriptor, threshold } from '@/lib/face';

export const dynamic = 'force-dynamic';
let ready = false;
const out = (ok: boolean, body: any, status = 200) => NextResponse.json(ok ? { ok, data: body } : { ok, error: body }, { status });
const deny = () => { const e: any = new Error('Permission denied'); e.status = 403; return e; };

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin'), host = req.headers.get('host');
    if (origin && host && new URL(origin).host !== host) return out(false, 'Bad origin', 403);
    const { s, why } = await sessionStatus();
    if (!s) return out(false, 'Session expired: ' + why, 401);
    if (!ready) { await ensureSchema(); ready = true; }
    const q = sql();
    const u = (await q`SELECT id, email, name, role, active FROM users WHERE id = ${s.uid} LIMIT 1`)[0];
    if (!u) return out(false, 'Session expired: user not found in database', 401);
    if (!u.active) return out(false, 'Session expired: user is inactive', 401);
    const b = await req.json();
    const site = 'https://' + (req.headers.get('x-forwarded-host') || host);
    return out(true, await dispatch(String(b.action), b.payload || {}, u, q, site));
  } catch (e: any) {
    return out(false, e.message || 'Error', e.status || 400);
  }
}

const emailOf = (r: any) => String(r.email || '').toLowerCase();
async function meEmp(u: any) {
  const rows = await callSheets('list', { table: 'employees' });
  return rows.find((r: any) => emailOf(r) === u.email) || null;
}
const audit = (q: any, u: any, action: string, entity: string, id: string) =>
  q`INSERT INTO audit_logs (user_id, action, entity, entity_id) VALUES (${u.id}, ${action}, ${entity}, ${id})`;
const need = (u: any, roles: string[]) => { if (!roles.includes(u.role)) throw deny(); };

async function dispatch(action: string, p: any, u: any, q: any, site: string): Promise<any> {
  switch (action) {
    case 'me': return { id: u.id, email: u.email, name: u.name, role: u.role };
    case 'dashboard': return getDashboardStats();

    case 'list': {
      const t = String(p.table);
      if (!P.canRead(u.role, t)) throw deny();
      if (t === 'audit_logs') {
        const sheetRows = await callSheets('list', { table: t });
        const mine = await q`SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200`;
        return [...sheetRows, ...mine.map((x: any) => ({ id: 'n' + x.id, created_at: new Date(x.created_at).toISOString(), user_id: x.user_id || '', action: x.action, table_name: x.entity || '', record_id: x.entity_id || '' }))]
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
      }
      const rows = await callSheets('list', { table: t });
      let meId = '';
      if (u.role === 'employee') meId = ((t === 'employees' ? rows.find((r: any) => emailOf(r) === u.email) : await meEmp(u)) || {}).id || '';
      return P.redact(u.role, t, P.scopeRows(u.role, t, rows, meId));
    }
    case 'save': {
      const t = String(p.table);
      if (!P.canWrite(u.role, t)) throw deny();
      let row = p.row || {};
      if (t === 'leave_applications') row = P.leaveRowFor(u.role, P.HR.includes(u.role) ? '' : ((await meEmp(u)) || {}).id || '', row, !row.id);
      return callSheets('save', { table: t, row, actor: u.email });
    }
    case 'remove': {
      const t = String(p.table);
      if (!P.canWrite(u.role, t) || (t === 'leave_applications' && !P.HR.includes(u.role))) throw deny();
      return callSheets('remove', { table: t, id: p.id, actor: u.email });
    }

    case 'selfAttendance': {
      const me = await meEmp(u);
      if (!me) throw new Error('Your login email is not linked to an employee record');
      return callSheets('mark', { employee_id: me.id, method: 'self', actor: u.email });
    }
    case 'enrollFace': {
      need(u, P.HR);
      const ds = p.descriptors;
      if (p.consent !== true) throw new Error('Employee consent is required');
      if (!Array.isArray(ds) || ds.length < 3 || ds.length > 10 || !ds.every(validDescriptor)) throw new Error('Invalid face samples');
      const emp = (await callSheets('list', { table: 'employees' })).find((r: any) => r.id === p.employee_id);
      if (!emp) throw new Error('Employee not found');
      await q`INSERT INTO face_templates (employee_id, template) VALUES (${emp.id}, ${encryptJson(ds)})
              ON CONFLICT (employee_id) DO UPDATE SET template = EXCLUDED.template, consent = true, updated_at = now()`;
      await callSheets('save', { table: 'employees', row: { id: emp.id, face_enrolled: 'true' }, actor: u.email });
      clearTemplates();
      await audit(q, u, 'face_enroll', 'face_templates', emp.id);
      return 'ok';
    }
    case 'deleteFace': {
      need(u, P.HR);
      await q`DELETE FROM face_templates WHERE employee_id = ${String(p.employee_id)}`;
      await callSheets('save', { table: 'employees', row: { id: p.employee_id, face_enrolled: 'false' }, actor: u.email });
      clearTemplates();
      await audit(q, u, 'face_delete', 'face_templates', String(p.employee_id));
      return 'ok';
    }
    case 'faceAttendance': {
      need(u, P.HR);
      // একাধিক ফ্রেম (শুরুতে ও চ্যালেঞ্জ শেষে) একই কর্মীর সাথে মিলতে হবে
      const ds = Array.isArray(p.descriptors) ? p.descriptors : [];
      if (ds.length < 2 || ds.length > 3 || !ds.every(validDescriptor)) throw new Error('Invalid face data');
      const tpls = await getTemplates(q);
      const ids = ds.map((d: number[]) => { const m = bestMatch(d, tpls, threshold()); return m.match ? m.employee_id : null; });
      if (!ids[0] || ids.some((x: any) => x !== ids[0])) throw new Error('Face not recognised');
      return callSheets('mark', { employee_id: ids[0], method: 'face', actor: u.email });
    }

    case 'dashboardFull': {
      need(u, [...P.HR, 'dept_manager']);
      const today = dhakaDate(), month = today.slice(0, 7);
      const [emps, leaves, pay, attToday, attRecent] = await Promise.all([
        callSheets('list', { table: 'employees' }),
        callSheets('list', { table: 'leave_applications' }),
        P.ADM.includes(u.role) ? callSheets('list', { table: 'payroll_records' }) : Promise.resolve(null),
        callSheets('list', { table: 'attendance_records', where: { date: today } }),
        callSheets('list', { table: 'attendance_records', last: 15 })
      ]);
      return buildDashboard({ emps, leaves, pay, attToday, attRecent }, today, month);
    }
    case 'uploadPhoto': {
      need(u, P.HR);
      if (!p.employee_id) throw new Error('Employee required');
      const up: any = await callSheets('upload', { dataUrl: String(p.dataUrl || ''), name: String(p.employee_id) });
      await callSheets('save', { table: 'employees', row: { id: p.employee_id, photo_file_id: up.id }, actor: u.email });
      await audit(q, u, 'photo_upload', 'employees', String(p.employee_id));
      return { id: up.id };
    }
    case 'createEnrollLink': {
      need(u, P.HR);
      const emp = (await callSheets('list', { table: 'employees', where: { id: p.employee_id } }))[0];
      if (!emp || emp.employment_status === 'Archived') throw new Error('Employee not found');
      const token = randomBytes(24).toString('base64url');
      const th = createHash('sha256').update(token).digest('hex');
      await q`INSERT INTO enroll_tokens (token_hash, employee_id, created_by, expires_at) VALUES (${th}, ${emp.id}, ${u.id}, now() + interval '48 hours')`;
      await audit(q, u, 'enroll_link', 'employees', emp.id);
      return { url: `${site}/enroll.html?t=${token}`, name: emp.full_name, hours: 48 };
    }
    case 'listUsers': {
      need(u, P.ADM);
      const rows = await q`SELECT id, email, name, role, active, last_login FROM users ORDER BY created_at`;
      return rows.map((r: any) => ({ ...r, active: String(r.active), last_login: r.last_login ? new Date(r.last_login).toISOString() : '' }));
    }
    case 'createUser': {
      need(u, P.ADM);
      const email = String(p.email || '').trim().toLowerCase();
      if (!P.ROLES.includes(p.role)) throw new Error('Invalid role');
      if (p.role === 'super_admin' && u.role !== 'super_admin') throw new Error('Only a super administrator can create one');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Invalid email');
      if (String(p.password || '').length < 10) throw new Error('Password must be at least 10 characters');
      const pw = await hash(String(p.password));
      const r = await q`INSERT INTO users (email, name, role, password_hash) VALUES (${email}, ${String(p.name || '').trim()}, ${p.role}, ${pw})
                        ON CONFLICT (email) DO NOTHING RETURNING id`;
      if (!r.length) throw new Error('Email already exists');
      await audit(q, u, 'create_user', 'users', r[0].id);
      return 'ok';
    }
    case 'setUserActive': {
      need(u, P.ADM);
      if (p.id === u.id) throw new Error('You cannot change your own status');
      await q`UPDATE users SET active = ${!!p.active} WHERE id = ${p.id}`;
      await audit(q, u, p.active ? 'activate_user' : 'deactivate_user', 'users', String(p.id));
      return 'ok';
    }
    case 'changePassword': {
      const row = (await q`SELECT password_hash FROM users WHERE id = ${u.id}`)[0];
      if (!(await verify(row.password_hash, String(p.oldPassword || '')).catch(() => false))) throw new Error('Current password is wrong');
      if (String(p.newPassword || '').length < 10) throw new Error('Password must be at least 10 characters');
      await q`UPDATE users SET password_hash = ${await hash(String(p.newPassword))} WHERE id = ${u.id}`;
      await audit(q, u, 'change_password', 'users', u.id);
      return 'ok';
    }
    default: throw new Error('unknown action');
  }
}
