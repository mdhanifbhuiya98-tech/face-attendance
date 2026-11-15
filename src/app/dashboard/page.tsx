import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { dict } from '@/lib/i18n';
import { sql } from '@/lib/db';
import { checkSheets, getDashboardStats, type DashboardStats } from '@/integrations/googleSheets';
import LangToggle from '@/components/LangToggle';
import LogoutButton from '@/components/LogoutButton';
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const s = await getSession();
  if (!s) redirect('/login');
  const { l, t } = dict();
  let stats: DashboardStats | null = null, dbErr = '', sheets = await checkSheets();
  try { await sql()`SELECT 1`; } catch (e: any) { dbErr = e.message; }
  if (sheets.ok) { try { stats = await getDashboardStats(); } catch { sheets = { ok: false, ms: 0, error: t('dbError') }; } }
  const nav: [string, boolean][] = [['nav_dashboard', true], ['nav_employees', false], ['nav_attendance', false], ['nav_leave', false], ['nav_payroll', false], ['nav_reports', false], ['nav_settings', false]];
  const cards: [string, number | undefined][] = [['employees', stats?.employees], ['present', stats?.present], ['absent', stats?.absent], ['late', stats?.late]];
  const badge = (name: string, ok: boolean, note?: string) => (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" title={note}>
      <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />{name}: <b>{ok ? t('connected') : t('failed')}</b>
    </div>);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-brand-900 text-white md:w-60 md:min-h-screen">
        <div className="px-5 py-4 text-lg font-bold">SmartFace HR</div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {nav.map(([k, on]) => (
            <span key={k} title={on ? '' : t('soon')} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${on ? 'bg-white/15 font-semibold' : 'text-white/50'}`}>{t(k)}</span>
          ))}
        </nav>
      </aside>
      <main className="flex-1">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-3">
          <div className="text-sm text-slate-600">{t('welcome')}, <b className="text-slate-900">{s.name}</b> <span className="ml-1 rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{s.role}</span></div>
          <div className="flex items-center gap-3"><LangToggle current={l} /><LogoutButton label={t('logout')} /></div>
        </header>
        <section className="space-y-4 p-5">
          <div className="flex flex-wrap gap-3">{badge(t('dbStatus'), !dbErr, dbErr)}{badge(t('sheetsStatus'), sheets.ok, sheets.error)}</div>
          {(dbErr || sheets.error) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{dbErr || sheets.error}</p>}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-3xl font-bold text-brand-700">{v ?? '–'}</div>
                <div className="mt-1 text-sm text-slate-500">{t(k)}</div>
              </div>))}
          </div>
          <p className="text-xs text-slate-400">{t('dataNote')}</p>
        </section>
      </main>
    </div>
  );
}
