import { ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { AppearanceSettings } from '../api';
import i18n from '../i18n';

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'system',
  accent: 'blue',
  glass: 'medium',
  background: 'plain',
  density: 'comfortable',
  font: 'inter',
  radius: 'soft',
};

function applyAppearance(s: AppearanceSettings) {
  const root = document.documentElement;
  root.setAttribute('data-accent', s.accent);
  root.setAttribute('data-glass', s.glass);
  root.setAttribute('data-bg', s.background);
  root.setAttribute('data-density', s.density);
  root.setAttribute('data-font', s.font);
  root.setAttribute('data-radius', s.radius);

  const resolved =
    s.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : s.theme;
  root.classList.toggle('dark', resolved === 'dark');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Load appearance from logged-in user, or fall back to localStorage (anon),
  // or defaults.
  useEffect(() => {
    let appearance: AppearanceSettings;
    if (user) {
      appearance = {
        theme: user.theme as any,
        accent: user.accent as any,
        glass: user.glass as any,
        background: user.background as any,
        density: user.density as any,
        font: user.font as any,
        radius: user.radius as any,
      };
      if (user.language && i18n.language !== user.language) {
        i18n.changeLanguage(user.language);
      }
    } else {
      try {
        const stored = localStorage.getItem('baraka_appearance');
        appearance = stored ? { ...DEFAULT_APPEARANCE, ...JSON.parse(stored) } : DEFAULT_APPEARANCE;
      } catch {
        appearance = DEFAULT_APPEARANCE;
      }
    }
    applyAppearance(appearance);
  }, [user]);

  // React to system theme changes when theme === 'system'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const theme = (user?.theme as any) || DEFAULT_APPEARANCE.theme;
      if (theme === 'system') {
        document.documentElement.classList.toggle('dark', mq.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [user]);

  return <>{children}</>;
}

// Public helper used by Profile page for live preview before save
export function applyAppearancePublic(s: AppearanceSettings) {
  applyAppearance(s);
  try { localStorage.setItem('baraka_appearance', JSON.stringify(s)); } catch {}
}
