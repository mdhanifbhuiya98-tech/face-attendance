import { dict } from '@/lib/i18n';
import AuthForm from '@/components/AuthForm';
import LangToggle from '@/components/LangToggle';
export const dynamic = 'force-dynamic';
export default function Setup() {
  const { l, t } = dict();
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white p-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-end"><LangToggle current={l} /></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="mb-6 text-xl font-bold text-brand-900">{t('setupTitle')}</h1>
          <AuthForm endpoint="/api/setup" submit={t('create')} busy={t('signing')} doneText={t('setupDone')}
            fields={[{ name: 'name', label: t('name'), type: 'text' }, { name: 'email', label: t('email'), type: 'email' },
              { name: 'password', label: t('password') + ' (10+)', type: 'password' }, { name: 'setupKey', label: t('setupKey'), type: 'password' }]} />
        </div>
      </div>
    </main>
  );
}
