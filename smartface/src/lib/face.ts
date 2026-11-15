export const threshold = () => Number(process.env.FACE_MATCH_THRESHOLD) || 0.45; // কম = কড়া
export const margin = () => Number(process.env.FACE_MATCH_MARGIN) || 0.05;
export const validDescriptor = (d: any) => Array.isArray(d) && d.length === 128 && d.every((x: any) => typeof x === 'number' && isFinite(x));

// সবচেয়ে কাছের কর্মী নেওয়া হয়, কিন্তু দ্বিতীয় কাছের কর্মী খুব কাছাকাছি হলে (দ্ব্যর্থক) বাতিল
export function bestMatch(d: number[], templates: { employee_id: string; samples: number[][] }[], th = threshold(), mg = margin()) {
  const per = new Map<string, number>();
  for (const t of templates) {
    let min = Infinity;
    for (const s of t.samples) {
      let x = 0;
      for (let i = 0; i < 128; i++) x += (s[i] - d[i]) ** 2;
      min = Math.min(min, Math.sqrt(x));
    }
    per.set(t.employee_id, min);
  }
  const sorted = [...per.entries()].sort((a, b) => a[1] - b[1]);
  const best = sorted[0], second = sorted[1];
  const distance = best ? best[1] : Infinity, gap = second ? second[1] - distance : Infinity;
  return { employee_id: best ? best[0] : null, distance, gap, match: !!best && distance <= th && gap >= mg };
}
