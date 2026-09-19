import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: ['en', 'he'],
        debug: false,
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
        interpolation: {
            escapeValue: false, // React handles escaping
        },
        backend: {
            loadPath: '/locales/{{lng}}/translation.json',
            queryStringParams: { v: '1.0.3' }
        },
        react: {
            useSuspense: false
        }
    });

export default i18n;
