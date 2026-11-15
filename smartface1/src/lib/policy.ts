// অনুমতির নিয়ম (কোনো বাইরের নির্ভরতা নেই, সহজে টেস্ট করা যায়)
export const ROLES = ['super_admin', 'hr_admin', 'hr_manager', 'dept_manager', 'employee'];
export const HR = ['super_admin', 'hr_admin', 'hr_manager'];
export const ADM = ['super_admin', 'hr_admin'];
type Rule = { w: string[]; r?: string[]; own?: boolean };
export const TBL: Record<string, Rule> = {
  employees: { w: HR }, departments: { w: HR }, designations: { w: HR }, shifts: { w: HR }, holidays: { w: HR },
  notifications: { w: HR }, kiosk_devices: { w: ADM, r: ADM }, payroll_records: { w: ADM, r: ADM },
  leave_applications: { w: ROLES, own: true }, attendance_records: { w: [], own: true },
  audit_logs: { w: [], r: ADM }, company_settings: { w: ADM, r: ADM }
};
export function rule(t: string): Rule { const r = TBL[t]; if (!r) throw new Error('unknown table'); return r; }
export const canRead = (role: string, t: string) => { const r = rule(t); return !r.r || r.r.includes(role); };
export const canWrite = (role: string, t: string) => rule(t).w.includes(role);

export function scopeRows(role: string, table: string, rows: any[], meId: string) {
  if (role !== 'employee') return rows;
  if (table === 'employees') return rows.filter(x => x.id === meId);
  if (rule(table).own) return rows.filter(x => x.employee_id === meId);
  return rows;
}
export function redact(role: string, table: string, rows: any[]) {
  if (table === 'employees' && role === 'dept_manager') return rows.map(({ salary, ...rest }) => rest);
  return rows;
}
export function leaveRowFor(role: string, meId: string, row: any, isNew: boolean) {
  if (HR.includes(role)) return row;
  if (!meId) throw new Error('Your login email is not linked to an employee record');
  if (!isNew) throw new Error('Permission denied');
  return { employee_id: meId, type: row.type, from_date: row.from_date, to_date: row.to_date, reason: row.reason, status: 'Pending' };
}
