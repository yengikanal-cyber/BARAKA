import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

export function Login() {
  const { t, i18n } = useTranslation();
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { user } = await api.login(email, password);
      setUser(user);
      nav('/', { replace: true });
    } catch (ex: any) {
      setErr(ex.message || 'generic');
    } finally {
      setBusy(false);
    }
  }

  function switchLang(l: string) {
    i18n.changeLanguage(l);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="font-display font-bold text-3xl mb-1" style={{ color: 'rgb(var(--accent-600))' }}>
            {t('app.name')}
          </div>
          <div className="muted text-sm">{t('app.tagline')}</div>
        </div>

        <div className="glass p-6">
          <h1 className="font-display text-2xl font-semibold mb-1">{t('auth.welcome')}</h1>
          <p className="muted text-sm mb-5">{t('auth.login')}</p>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="label">{t('auth.email')}</label>
              <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input className="input" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </div>

            {err && (
              <div className="pill-red px-3 py-2 rounded-btn text-sm">
                {t(`auth.errors.${err}`, { defaultValue: t('auth.errors.generic') })}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? t('common.loading') : t('auth.loginNow')}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="muted">{t('auth.noAccount')} </span>
            <Link to="/register" className="font-medium" style={{ color: 'rgb(var(--accent-600))' }}>
              {t('auth.registerNow')}
            </Link>
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-2 text-xs">
          {(['uz', 'ru', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => switchLang(l)}
              className={`px-3 py-1.5 rounded-btn spring ${
                i18n.language === l ? 'glass font-semibold' : 'muted hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
