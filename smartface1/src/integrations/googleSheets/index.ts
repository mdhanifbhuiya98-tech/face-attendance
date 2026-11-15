// Google Apps Script-এর সাথে সব যোগাযোগ শুধু এই মডিউল দিয়ে হবে
const READ_ACTIONS = new Set(['ping', 'dashboard', 'list']);

export async function callSheets<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new Error('GOOGLE_APPS_SCRIPT_URL / GOOGLE_APPS_SCRIPT_SECRET সেট করা নেই');
  const retries = READ_ACTIONS.has(action) ? 2 : 0; // লেখার কাজ রিট্রাই হয় না (ডুপ্লিকেট এড়াতে)
  let last: any;
  for (let i = 0; i <= retries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, secret, payload }), cache: 'no-store', redirect: 'follow', signal: ctrl.signal
      });
      const text = await res.text();
      let j: any;
      try { j = JSON.parse(text); } catch { throw new Error('Apps Script থেকে অবৈধ উত্তর এসেছে (Deploy সেটিং: Anyone)'); }
      if (!j || typeof j.ok !== 'boolean') throw new Error('Apps Script-এর উত্তরের গঠন ভুল');
      if (!j.ok) throw new Error(j.error || 'Apps Script error');
      return j.data as T;
    } catch (e: any) {
      last = e;
      if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    } finally { clearTimeout(timer); }
  }
  throw last;
}

export async function checkSheets(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  try { await callSheets('ping'); return { ok: true, ms: Date.now() - t0 }; }
  catch (e: any) { return { ok: false, ms: Date.now() - t0, error: e.message }; }
}

export type DashboardStats = { employees: number; present: number; absent: number; late: number };
export const getDashboardStats = () => callSheets<DashboardStats>('dashboard');
