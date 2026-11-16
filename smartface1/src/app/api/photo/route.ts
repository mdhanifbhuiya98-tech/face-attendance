import { sessionStatus } from '@/lib/session';
import { callSheets } from '@/integrations/googleSheets';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  if (!(await sessionStatus()).s) return new Response('Unauthorized', { status: 401 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[\w-]{10,80}$/.test(id)) return new Response('Bad id', { status: 400 });
  try {
    const f = await callSheets<{ mime: string; data: string }>('file', { id });
    return new Response(new Uint8Array(Buffer.from(f.data, 'base64')), { headers: { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=86400' } });
  } catch { return new Response('Not found', { status: 404 }); }
}
