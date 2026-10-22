import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ru from "./locales/ru.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";
import de from "./locales/de.json";
import tr from "./locales/tr.json";
import uk from "./locales/uk.json";

export const SUPPORTED_LANGUAGES = ["ru", "en", "es", "pt", "de", "tr", "uk"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      es: { translation: es },
      pt: { translation: pt },
      de: { translation: de },
      tr: { translation: tr },
      uk: { translation: uk },
    },
    // Russian is the site's primary language for every first-time visitor,
    // regardless of browser locale — only an explicit switch via the
    // language switcher (persisted to localStorage) changes it after that.
    // Detection only checks localStorage (no navigator auto-detect), so an
    // unset preference falls through to fallbackLng below.
    fallbackLng: "ru",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "gundone.lang",
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
