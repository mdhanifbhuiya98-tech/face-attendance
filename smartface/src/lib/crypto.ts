import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
// ফেস টেমপ্লেট AES-256-GCM দিয়ে এনক্রিপ্ট হয়; কী থাকে শুধু Vercel environment-এ
const key = () => {
  const k = process.env.FACE_ENCRYPTION_KEY;
  if (!k || k.length < 16) throw new Error('FACE_ENCRYPTION_KEY সেট করা নেই (কমপক্ষে ১৬ অক্ষর)');
  return createHash('sha256').update(k).digest();
};
export function encryptJson(obj: unknown): string {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}
export function decryptJson(s: string): any {
  const [iv, tag, enc] = s.split('.').map(x => Buffer.from(x, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString('utf8'));
}
