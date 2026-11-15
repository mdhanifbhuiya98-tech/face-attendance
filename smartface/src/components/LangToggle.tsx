'use client';
import { useRouter } from 'next/navigation';
export default function LangToggle({ current }: { current: string }) {
  const r = useRouter();
  const set = (l: string) => { document.cookie = `lang=${l};path=/;max-age=31536000`; r.refresh(); };
  const b = (l: string, label: string) => (
    <button onClick={() => set(l)} className={`px-2.5 py-1 text-xs font-medium rounded ${current === l ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
  );
  return <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5">{b('en', 'EN')}{b('bn', 'বাংলা')}</div>;
}
