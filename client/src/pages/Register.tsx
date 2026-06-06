import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api, User } from '../api';

const ROLES: User['role'][] = ['manufacturer', 'buyer', 'staff', 'accountant', 'partner'];

export function Register() {
  const { t, i18n } = useTranslation();
  const { setUser } = useAuth();
  const nav = useNavigate();

  const [role, setRole] = useState<User['role']>('manufacturer');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [ownerNickname, setOwnerNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsOwner = role === 'staff' || role === 'accountant' || role === 'partner';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { user } = await api.register({
        email, password, name, nickname,
        phone: phone.trim() || null,
        role,
        ownerNickname: needsOwner ? ownerNickname.trim() : null,
      });
      setUser(user);
      nav('/', { replace: true });
    } catch (ex: any) {
      setErr(ex.message || 'generic');
    } finally {
      setBusy(false);
    }
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
          <h1 className="font-display text-2xl font-semibold mb-1">{t('auth.createAccount')}</h1>
          <p className="muted text-sm mb-5">{t('auth.register')}</p>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="label">{t('auth.role')}</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setRole(r)}
                    className={`px-3 py-2 rounded-btn text-sm spring text-left ${
                      role === r
                        ? 'border-2 font-medium'
                        : 'border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    style={
                      role === r
                        ? { borderColor: 'rgb(var(--accent-500))', background: 'rgb(var(--accent-500) / 0.10)' }
                        : undefined
                    }
                  >
                    {t(`roles.${r}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">{t('auth.name')}</label>
              <input className="input" required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('auth.nickname')}</label>
              <input
                className="input"
                required
                value={nickname}
                onChange={e => setNickname(e.target.value.replace(/\s+/g, ''))}
                placeholder="my_nickname"
              />
              <div className="text-xs muted mt-1">{t('auth.nicknameHint')}</div>
            </div>
            <div>
              <label className="label">{t('auth.email')}</label>
              <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className="label">{t('auth.phone')}</label>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998..." />
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input className="input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              <div className="text-xs muted mt-1">{t('auth.passwordHint')}</div>
            </div>

            {needsOwner && (
              <div>
                <label className="label">{t('auth.ownerNickname')}</label>
                <input
                  className="input"
                  required
                  value={ownerNickname}
                  onChange={e => setOwnerNickname(e.target.value.replace(/\s+/g, ''))}
                  placeholder="owner_nickname"
                />
                <div className="text-xs muted mt-1">{t('auth.ownerNicknameHint')}</div>
              </div>
            )}

            {err && (
              <div className="pill-red px-3 py-2 rounded-btn text-sm">
                {t(`auth.errors.${err}`, { defaultValue: t('auth.errors.generic') })}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? t('common.loading') : t('auth.submit')}
            </button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="muted">{t('auth.haveAccount')} </span>
            <Link to="/login" className="font-medium" style={{ color: 'rgb(var(--accent-600))' }}>
              {t('auth.loginNow')}
            </Link>
          </div>
        </div>

        <div className="mt-4 flex justify-center gap-2 text-xs">
          {(['uz', 'ru', 'en'] as const).map(l => (
            <button
              key={l}
              onClick={() => i18n.changeLanguage(l)}
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
