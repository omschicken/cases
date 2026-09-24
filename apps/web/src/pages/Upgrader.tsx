import { useTranslation } from "react-i18next";
import { ComingSoon } from "../components/ComingSoon";

export function UpgraderPage() {
  const { t } = useTranslation();
  return (
    <ComingSoon
      title={t("comingSoon.upgrader.title")}
      description={t("comingSoon.upgrader.description")}
      icon={
        <svg width="56" height="56" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 14 L10 6 M6.5 9.5 L10 6 L13.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    />
  );
}
