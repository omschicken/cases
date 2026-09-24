import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";

const NATIVE_LABEL: Record<string, string> = {
  ru: "RU",
  en: "EN",
  es: "ES",
  pt: "PT",
  de: "DE",
  tr: "TR",
  uk: "UK",
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      className="language-switcher"
      value={i18n.resolvedLanguage ?? "ru"}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label="Language"
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <option key={lng} value={lng}>
          {NATIVE_LABEL[lng]}
        </option>
      ))}
    </select>
  );
}
