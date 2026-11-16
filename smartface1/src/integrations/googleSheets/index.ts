// Google Apps Script-এর সাথে সব যোগাযোগ শুধু এই মডিউল দিয়ে হবে
const READ_ACTIONS = new Set(['ping', 'dashboard', 'list', 'file']);
const WRITES = new Set(['save', 'remove', 'mark', 'upload']);

async function rawCall<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL?.trim();
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET?.trim();
  if (!url) throw new Error('GOOGLE_APPS_SCRIPT_URL পাওয়া যায়নি (নাম, Environment ও Redeploy দেখুন)');
  if (!secret) throw new Error('GOOGLE_APPS_SCRIPT_SECRET পাওয়া যায়নি (নাম, Environment ও Redeploy দেখুন)');
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

// গতির জন্য: একই list অনুরোধ ৩ সেকেন্ড মেমরিতে রাখা হয় ও একই সময়ের অনুরোধ একত্র হয়; লিখলে ক্যাশ মুছে যায়
const cache = new Map<string, { t: number; p: Promise<any> }>();
export function callSheets<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  if (action === 'list') {
    const key = JSON.stringify(payload), hit = cache.get(key);
    if (hit && Date.now() - hit.t < 3000) return hit.p as Promise<T>;
    const p = rawCall<T>(action, payload);
    cache.set(key, { t: Date.now(), p });
    p.catch(() => cache.delete(key));
    return p;
  }
  const p = rawCall<T>(action, payload);
  if (WRITES.has(action)) { cache.clear(); p.finally(() => cache.clear()).catch(() => {}); }
  return p;
}

export async function checkSheets(): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  try { await callSheets('ping'); return { ok: true, ms: Date.now() - t0 }; }
  catch (e: any) { return { ok: false, ms: Date.now() - t0, error: e.message }; }
}

export type DashboardStats = { employees: number; present: number; absent: number; late: number };
export const getDashboardStats = () => callSheets<DashboardStats>('dashboard');
