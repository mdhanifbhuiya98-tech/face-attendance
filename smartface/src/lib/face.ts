export const threshold = () => Number(process.env.FACE_MATCH_THRESHOLD) || 0.5; // কম = কড়া
export const validDescriptor = (d: any) => Array.isArray(d) && d.length === 128 && d.every((x: any) => typeof x === 'number' && isFinite(x));
export function bestMatch(d: number[], templates: { employee_id: string; samples: number[][] }[], th = threshold()) {
  let best: string | null = null, bd = Infinity;
  for (const t of templates) for (const s of t.samples) {
    let x = 0;
    for (let i = 0; i < 128; i++) x += (s[i] - d[i]) ** 2;
    x = Math.sqrt(x);
    if (x < bd) { bd = x; best = t.employee_id; }
  }
  return { employee_id: best, distance: bd, match: best !== null && bd <= th };
}
