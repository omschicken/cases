import { useTranslation } from "react-i18next";
import { ComingSoon } from "../components/ComingSoon";

export function PrizesPage() {
  const { t } = useTranslation();
  return (
    <ComingSoon
      title={t("comingSoon.prizes.title")}
      description={t("comingSoon.prizes.description")}
      icon={
        <svg width="56" height="56" viewBox="0 0 20 20" fill="none">
          <path d="M10 2.5 L12.2 7 L17 7.7 L13.5 11 L14.4 15.8 L10 13.5 L5.6 15.8 L6.5 11 L3 7.7 L7.8 7 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
      }
    />
  );
}
