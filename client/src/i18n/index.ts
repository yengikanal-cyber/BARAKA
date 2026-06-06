import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import uz from './uz.json';
import ru from './ru.json';
import en from './en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      uz: { translation: uz },
      ru: { translation: ru },
      en: { translation: en },
    },
    fallbackLng: 'uz',
    supportedLngs: ['uz', 'ru', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'baraka_lang',
    },
  });

export default i18n;

export function formatMoney(value: number, lang?: string): string {
  const v = Math.round(Number.isFinite(value) ? value : 0);
  const grouped = v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const suffix =
    lang === 'ru' ? 'сум' :
    lang === 'en' ? 'UZS' :
    "so'm";
  return `${grouped} ${suffix}`;
}
