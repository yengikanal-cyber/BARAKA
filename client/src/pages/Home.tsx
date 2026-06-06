import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export function Home() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="max-w-3xl mx-auto py-4 space-y-4">
      <div className="card">
        <div className="text-sm muted">{t('home.hello')},</div>
        <div className="font-display text-2xl font-semibold mt-1">{user.name}</div>
        <div className="text-sm muted mt-1">@{user.nickname} · {t(`roles.${user.role}`)}</div>
      </div>
      <div className="card">
        <div className="font-semibold mb-1">{t('home.welcome')}</div>
        <div className="muted text-sm">{t('home.phase1Notice')}</div>
      </div>
    </div>
  );
}
