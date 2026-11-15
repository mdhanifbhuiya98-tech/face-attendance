'use client';
import { useState } from 'react';
type Field = { name: string; label: string; type: string };
export default function AuthForm({ fields, endpoint, submit, busy, doneText, redirect }:
  { fields: Field[]; endpoint: string; submit: string; busy: string; doneText?: string; redirect?: string }) {
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [loading, setLoading] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(''); setLoading(true);
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) setErr(j.error || 'Error');
      else if (redirect) location.href = redirect;
      else setOk(doneText || 'OK');
    } catch { setErr('Network error'); }
    setLoading(false);
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {fields.map(f => (
        <label key={f.name} className="block text-sm font-medium text-slate-700">{f.label}
          <input name={f.name} type={f.type} required className="input mt-1" autoComplete={f.type === 'password' ? 'current-password' : 'off'} />
        </label>
      ))}
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{ok} <a className="underline" href="/login">/login</a></p>}
      <button className="btn w-full" disabled={loading}>{loading ? busy : submit}</button>
    </form>
  );
}
