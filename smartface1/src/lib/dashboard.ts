export const dhakaDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function buildDashboard(d: { emps: any[]; leaves: any[]; pay: any[] | null; attToday: any[]; attRecent: any[] }, today: string, month: string) {
  const { emps, leaves, pay, attToday, attRecent } = d;
  const active = emps.filter(e => e.employment_status !== 'Archived');
  const by = new Map(emps.map(e => [e.id, e]));
  const nm = (id: string) => by.get(id)?.full_name || '—';
  const ph = (id: string) => by.get(id)?.photo_file_id || '';
  const onLeave = leaves.filter(l => l.status === 'Approved' && l.from_date <= today && l.to_date >= today);
  let payroll: any = null;
  if (pay) {
    const rows = pay.filter(p => p.month === month), sum = (r: any[]) => r.reduce((s, x) => s + (parseFloat(x.net) || 0), 0);
    const paid = rows.filter(p => p.status === 'Paid');
    payroll = { month, paidCount: paid.length, total: active.length, remaining: Math.max(0, active.length - paid.length),
      net: sum(rows), paidAmount: sum(paid), unpaidAmount: sum(rows) - sum(paid) };
  }
  return {
    month, today,
    employees: { total: emps.length, active: active.length, inactive: emps.length - active.length },
    leave: { pending: leaves.filter(l => l.status === 'Pending').length, total: leaves.length },
    payroll,
    attendance: { present: attToday.length, late: attToday.filter(a => a.status === 'Late').length,
      absent: Math.max(0, active.length - attToday.length), onLeave: onLeave.length },
    leaves: [...leaves].sort((a, b) => (a.status === 'Pending' ? 0 : 1) - (b.status === 'Pending' ? 0 : 1) || String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8).map(l => ({ id: l.id, name: nm(l.employee_id), photo: ph(l.employee_id), type: l.type, from: l.from_date, to: l.to_date, status: l.status })),
    status: {
      onLeave: onLeave.map(l => ({ name: nm(l.employee_id), photo: ph(l.employee_id), note: l.from_date + ' → ' + l.to_date })),
      inactive: emps.filter(e => e.employment_status === 'Archived').map(e => ({ name: e.full_name, photo: e.photo_file_id || '', note: 'Archived' })),
      onboarding: active.filter(e => e.joining_date && dayDiff(e.joining_date, today) >= 0 && dayDiff(e.joining_date, today) <= 30)
        .map(e => ({ name: e.full_name, photo: e.photo_file_id || '', note: 'Joined ' + e.joining_date }))
    },
    recent: attRecent.map(a => ({ name: a.employee_name, photo: ph(a.employee_id), date: a.date, in: a.check_in, out: a.check_out, status: a.status }))
  };
}
