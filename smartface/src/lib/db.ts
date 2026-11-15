import { neon } from '@neondatabase/serverless';

export function sql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL সেট করা নেই');
  return neon(process.env.DATABASE_URL);
}

// পাসওয়ার্ড, সেশন ও লগ এখানে (Google Sheet-এ নয়)। ফেস টেমপ্লেট Phase 4-এ এখানেই আসবে।
export async function ensureSchema() {
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL, name text NOT NULL, role text NOT NULL,
    password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
    failed_attempts int NOT NULL DEFAULT 0, locked_until timestamptz,
    last_login timestamptz, created_at timestamptz NOT NULL DEFAULT now())`;
  await q`CREATE TABLE IF NOT EXISTS login_history (
    id bigserial PRIMARY KEY, user_id uuid, email text, success boolean NOT NULL,
    ip text, user_agent text, reason text, created_at timestamptz NOT NULL DEFAULT now())`;
  await q`CREATE TABLE IF NOT EXISTS audit_logs (
    id bigserial PRIMARY KEY, user_id uuid, action text NOT NULL, entity text, entity_id text,
    details text, created_at timestamptz NOT NULL DEFAULT now())`;
  await q`CREATE TABLE IF NOT EXISTS face_templates (
    employee_id text PRIMARY KEY, template text NOT NULL, consent boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`;
}
