import { decryptJson } from '@/lib/crypto';
// ডিক্রিপ্ট করা ফেস টেমপ্লেট ২০ সেকেন্ড মেমরিতে (প্রতি স্ক্যানে ডাটাবেস পড়ার খরচ কমাতে)
let cache: { t: number; v: { employee_id: string; samples: number[][] }[] } | null = null;
export const clearTemplates = () => { cache = null; };
export async function getTemplates(q: any) {
  if (cache && Date.now() - cache.t < 20000) return cache.v;
  const rows = await q`SELECT employee_id, template FROM face_templates`;
  const v = rows.map((r: any) => ({ employee_id: r.employee_id, samples: decryptJson(r.template) }));
  cache = { t: Date.now(), v };
  return v;
}
