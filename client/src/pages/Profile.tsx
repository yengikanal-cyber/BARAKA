import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { api, AppearanceSettings, User } from '../api';
import { applyAppearancePublic } from '../contexts/ThemeContext';
import { Avatar } from '../components/Avatar';

const ACCENTS: AppearanceSettings['accent'][] = ['green','blue','indigo','purple','pink','orange','teal','graphite'];
const ACCENT_HEX: Record<AppearanceSettings['accent'], string> = {
  green: '#10b981', blue: '#3b82f6', indigo: '#6366f1', purple: '#a855f7',
  pink: '#ec4899', orange: '#f97316', teal: '#14b8a6', graphite: '#64748b',
};
const GLASS: AppearanceSettings['glass'][] = ['off', 'soft', 'medium', 'strong'];
const BACKGROUNDS: AppearanceSettings['background'][] = ['plain', 'gradient', 'pattern'];
const DENSITIES: AppearanceSettings['density'][] = ['comfortable', 'compact'];
const FONTS: AppearanceSettings['font'][] = ['system', 'inter', 'outfit', 'manrope'];
const RADII: AppearanceSettings['radius'][] = ['square', 'soft', 'round'];

function pickAppearance(u: User): AppearanceSettings {
  return {
    theme: u.theme, accent: u.accent, glass: u.glass,
    background: u.background, density: u.density, font: u.font, radius: u.radius,
  };
}

export function Profile() {
  const { t, i18n } = useTranslation();
  const { user, setUser, logout } = useAuth();
  const nav = useNavigate();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [language, setLanguage] = useState(user?.language ?? 'uz');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [appearance, setAppearance] = useState<AppearanceSettings>(user ? pickAppearance(user) : {
    theme: 'system', accent: 'blue', glass: 'medium',
    background: 'plain', density: 'comfortable', font: 'inter', radius: 'soft',
  });

  // password
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  // avatar
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  // location
  const [locBusy, setLocBusy] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone ?? '');
    setAddress(user.address ?? '');
    setLanguage(user.language);
    setAppearance(pickAppearance(user));
  }, [user]);

  if (!user) return null;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const { user } = await api.updateProfile({
        name, phone: phone || null, address: address || null,
        language: language as User['language'],
      });
      setUser(user);
      if (language !== i18n.language) i18n.changeLanguage(language);
      setProfileMsg('saved');
    } catch {
      setProfileMsg('error');
    } finally {
      setSavingProfile(false);
      setTimeout(() => setProfileMsg(null), 2500);
    }
  }

  async function patchAppearance(patch: Partial<AppearanceSettings>) {
    const next = { ...appearance, ...patch };
    setAppearance(next);
    applyAppearancePublic(next);
    try {
      const { user } = await api.updateAppearance(patch);
      setUser(user);
    } catch {
      // revert on failure
      setAppearance(appearance);
      applyAppearancePublic(appearance);
    }
  }

  async function onAvatarPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const { user } = await api.uploadAvatar(f);
      setUser(user);
    } catch {
      // swallow
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function useGps() {
    if (!('geolocation' in navigator)) {
      setLocMsg('error');
      return;
    }
    setLocBusy(true);
    setLocMsg(null);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { user } = await api.updateProfile({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setUser(user);
          setLocMsg('saved');
        } catch {
          setLocMsg('error');
        } finally {
          setLocBusy(false);
          setTimeout(() => setLocMsg(null), 2500);
        }
      },
      () => { setLocBusy(false); setLocMsg('error'); setTimeout(() => setLocMsg(null), 2500); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (pwNext.length < 6) { setPwMsg('invalid_input'); return; }
    setPwBusy(true);
    setPwMsg(null);
    try {
      await api.changePassword(pwCurrent, pwNext);
      setPwCurrent(''); setPwNext('');
      setPwMsg('success');
    } catch (ex: any) {
      setPwMsg(ex.message || 'error');
    } finally {
      setPwBusy(false);
      setTimeout(() => setPwMsg(null), 3000);
    }
  }

  async function onLogout() {
    if (!confirm(t('profile.logoutConfirm'))) return;
    await logout();
    nav('/login', { replace: true });
  }

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-4">
      <h1 className="font-display text-2xl font-semibold px-1">{t('profile.title')}</h1>

      {/* Personal */}
      <section className="card">
        <h2 className="font-semibold mb-4">{t('profile.personal')}</h2>

        <div className="flex items-center gap-4 mb-5">
          <Avatar src={user.avatar_url || undefined} name={user.name} size={80} />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarPicked}
            />
            <button
              type="button"
              className="btn-ghost"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? t('common.loading') : (user.avatar_url ? t('profile.changeAvatar') : t('profile.uploadAvatar'))}
            </button>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-3">
          <div>
            <label className="label">{t('auth.name')}</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">{t('profile.phone')}</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998..." />
          </div>
          <div>
            <label className="label">{t('profile.address')}</label>
            <input className="input" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('profile.location')}</label>
            <div className="flex items-center gap-3">
              <button type="button" className="btn-ghost" onClick={useGps} disabled={locBusy}>
                {locBusy ? t('common.loading') : t('profile.useGps')}
              </button>
              {user.lat != null && user.lng != null && (
                <span className="text-sm muted">
                  {user.lat.toFixed(5)}, {user.lng.toFixed(5)}
                </span>
              )}
              {locMsg === 'saved' && <span className="pill-green px-2 py-1 rounded-btn text-xs">{t('profile.locationSaved')}</span>}
              {locMsg === 'error' && <span className="pill-red px-2 py-1 rounded-btn text-xs">{t('profile.locationError')}</span>}
            </div>
          </div>
          <div>
            <label className="label">{t('profile.language')}</label>
            <div className="flex gap-2">
              {(['uz', 'ru', 'en'] as const).map(l => (
                <button
                  type="button"
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={`px-4 py-2 rounded-btn spring text-sm ${
                    language === l ? 'border-2 font-medium' : 'border border-black/10 dark:border-white/10'
                  }`}
                  style={language === l ? { borderColor: 'rgb(var(--accent-500))', background: 'rgb(var(--accent-500) / 0.10)' } : undefined}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button className="btn-primary" disabled={savingProfile}>
              {savingProfile ? t('common.saving') : t('common.save')}
            </button>
            {profileMsg === 'saved' && <span className="pill-green px-2 py-1 rounded-btn text-xs">{t('common.saved')}</span>}
            {profileMsg === 'error' && <span className="pill-red px-2 py-1 rounded-btn text-xs">{t('common.error')}</span>}
          </div>
        </form>
      </section>

      {/* Appearance */}
      <section className="card">
        <h2 className="font-semibold">{t('profile.appearance')}</h2>
        <p className="muted text-xs mt-1 mb-5">{t('appearance.instantApply')}</p>

        {/* Theme */}
        <div className="mb-5">
          <div className="label">{t('profile.theme')}</div>
          <div className="grid grid-cols-3 gap-2">
            {(['light','dark','system'] as const).map(v => (
              <button
                key={v}
                onClick={() => patchAppearance({ theme: v })}
                className={`px-3 py-2.5 rounded-btn text-sm spring ${
                  appearance.theme === v ? 'border-2 font-medium' : 'border border-black/10 dark:border-white/10'
                }`}
                style={appearance.theme === v ? { borderColor: 'rgb(var(--accent-500))', background: 'rgb(var(--accent-500) / 0.10)' } : undefined}
              >
                {t(`profile.themes.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Accent */}
        <div className="mb-5">
          <div className="label">{t('profile.accent')}</div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {ACCENTS.map(c => (
              <button
                key={c}
                onClick={() => patchAppearance({ accent: c })}
                title={t(`profile.accents.${c}`)}
                className={`relative h-11 rounded-btn spring border ${
                  appearance.accent === c ? 'ring-4 ring-offset-2 ring-offset-transparent' : ''
                } border-black/10 dark:border-white/10`}
                style={{
                  background: `linear-gradient(135deg, ${ACCENT_HEX[c]}, ${ACCENT_HEX[c]}cc)`,
                  // @ts-expect-error css var
                  '--tw-ring-color': ACCENT_HEX[c],
                }}
              >
                <span className="sr-only">{t(`profile.accents.${c}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Glass */}
        <div className="mb-5">
          <div className="label">{t('profile.glass')}</div>
          <div className="grid grid-cols-4 gap-2">
            {GLASS.map(v => (
              <button
                key={v}
                onClick={() => patchAppearance({ glass: v })}
                className={`px-3 py-2.5 rounded-btn text-sm spring ${
                  appearance.glass === v ? 'border-2 font-medium' : 'border border-black/10 dark:border-white/10'
                }`}
                style={appearance.glass === v ? { borderColor: 'rgb(var(--accent-500))', background: 'rgb(var(--accent-500) / 0.10)' } : undefined}
              >
                {t(`profile.glassValues.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Background */}
        <div className="mb-5">
          <div className="label">{t('profile.background')}</div>
          <div className="grid grid-cols-3 gap-2">
            {BACKGROUNDS.map(v => (
              <button
                key={v}
                onClick={() => patchAppearance({ background: v })}
                className={`px-3 py-2.5 rounded-btn text-sm spring ${
                  appearance.background === v ? 'border-2 font-medium' : 'border border-black/10 dark:border-white/10'
                }`}
                style={appearance.background === v ? { borderColor: 'rgb(var(--accent-500))', background: 'rgb(var(--accent-500) / 0.10)' } : undefined}
              >
                {t(`profile.backgrounds.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Density */}
        <div className="mb-5">
          <div className="label">{t('profile.density')}</div>
          <div className="grid grid-cols-2 gap-2">
            {DENSITIES.map(v => (
              <button
                key={v}
                onClick={() => patchAppearance({ density: v })}
                className={`px-3 py-2.5 rounded-btn text-sm spring ${
                  appearance.density === v ? 'border-2 font-medium' : 'border border-black/10 dark:border-white/10'
                }`}
                style={appearance.density === v ? { borderColor: 'rgb(var(--accent-500))', background: 'rgb(var(--accent-500) / 0.10)' } : undefined}
              >
                {t(`profile.densities.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Font */}
        <div className="mb-5">
          <div className="label">{t('profile.font')}</div>
          <div className="grid grid-cols-4 gap-2">
            {FONTS.map(v => (
              <button
                key={v}
                onClick={() => patchAppearance({ font: v })}
                className={`px-3 py-2.5 rounded-btn text-sm spring ${
                  appearance.font === v ? 'border-2 font-medium' : 'border border-black/10 dark:border-white/10'
                }`}
                style={appearance.font === v ? { borderColor: 'rgb(var(--accent-500))', background: 'rgb(var(--accent-500) / 0.10)' } : undefined}
              >
                {t(`profile.fonts.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Radius */}
        <div className="mb-5">
          <div className="label">{t('profile.radius')}</div>
          <div className="grid grid-cols-3 gap-2">
            {RADII.map(v => (
              <button
                key={v}
                onClick={() => patchAppearance({ radius: v })}
                className={`px-3 py-2.5 rounded-btn text-sm spring ${
                  appearance.radius === v ? 'border-2 font-medium' : 'border border-black/10 dark:border-white/10'
                }`}
                style={appearance.radius === v ? { borderColor: 'rgb(var(--accent-500))', background: 'rgb(var(--accent-500) / 0.10)' } : undefined}
              >
                {t(`profile.radii.${v}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-6">
          <div className="label">{t('profile.preview')}</div>
          <div className="glass p-4 flex items-center gap-3">
            <Avatar src={user.avatar_url || undefined} name={user.name} size={48} />
            <div className="flex-1">
              <div className="font-semibold">{user.name}</div>
              <div className="text-xs muted">{t('profile.previewMsg')}</div>
            </div>
            <button className="btn-primary text-sm">{t('common.ok')}</button>
          </div>
        </div>
      </section>

      {/* Team (manufacturer only) */}
      {user.role === 'manufacturer' && (
        <section className="card">
          <button onClick={() => nav('/team')} className="w-full flex items-center gap-3 text-left spring">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgb(var(--accent-500) / 0.14)', color: 'rgb(var(--accent-700))' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M22 19c0-2.6-2-4.5-5-4.5"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{t('team.title')}</div>
              <div className="text-xs muted">{t('team.subtitle')}</div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 muted"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </section>
      )}

      {/* Password */}
      <section className="card">
        <h2 className="font-semibold mb-4">{t('profile.password')}</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="label">{t('profile.currentPassword')}</label>
            <input className="input" type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} required />
          </div>
          <div>
            <label className="label">{t('profile.newPassword')}</label>
            <input className="input" type="password" value={pwNext} onChange={e => setPwNext(e.target.value)} minLength={6} required />
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={pwBusy}>
              {pwBusy ? t('common.saving') : t('profile.changePassword')}
            </button>
            {pwMsg === 'success' && <span className="pill-green px-2 py-1 rounded-btn text-xs">{t('common.saved')}</span>}
            {pwMsg === 'current_password_wrong' && <span className="pill-red px-2 py-1 rounded-btn text-xs">{t('auth.errors.current_password_wrong')}</span>}
            {pwMsg === 'invalid_input' && <span className="pill-red px-2 py-1 rounded-btn text-xs">{t('auth.errors.invalid_input')}</span>}
            {pwMsg === 'error' && <span className="pill-red px-2 py-1 rounded-btn text-xs">{t('common.error')}</span>}
          </div>
        </form>
      </section>

      {/* Logout */}
      <section className="card">
        <button onClick={onLogout} className="btn-danger w-full">{t('profile.logout')}</button>
      </section>

      <div className="h-2" />
    </div>
  );
}
