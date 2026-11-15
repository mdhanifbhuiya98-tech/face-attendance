'use client';
export default function LogoutButton({ label }: { label: string }) {
  return <button className="text-sm text-slate-600 hover:text-brand-700" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.href = '/login'; }}>{label}</button>;
}
