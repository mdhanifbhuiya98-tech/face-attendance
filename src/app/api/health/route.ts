import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { sql } from '@/lib/db';
import { checkSheets } from '@/integrations/googleSheets';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let db: { ok: boolean; error?: string } = { ok: true };
  try { await sql()`SELECT 1`; } catch (e: any) { db = { ok: false, error: e.message }; }
  return NextResponse.json({ db, sheets: await checkSheets() });
}
