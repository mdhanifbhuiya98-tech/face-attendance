import { dict } from '@/lib/i18n';
import AuthForm from '@/components/AuthForm';
import LangToggle from '@/components/LangToggle';
export const dynamic = 'force-dynamic';
export default function Login() {
  const { l, t } = dict();
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white p-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-end"><LangToggle current={l} /></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="mb-1 text-xl font-bold text-brand-900">{t('company')}</h1>
          <p className="mb-6 text-sm text-slate-500">{t('login')}</p>
          <AuthForm endpoint="/api/auth/login" redirect="/dashboard" submit={t('login')} busy={t('signing')}
            fields={[{ name: 'email', label: t('email'), type: 'email' }, { name: 'password', label: t('password'), type: 'password' }]} />
        </div>
      </div>
    </main>
  );
}
