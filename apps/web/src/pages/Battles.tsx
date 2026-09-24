import { useTranslation } from "react-i18next";
import { ComingSoon } from "../components/ComingSoon";

export function BattlesPage() {
  const { t } = useTranslation();
  return (
    <ComingSoon
      title={t("comingSoon.battles.title")}
      description={t("comingSoon.battles.description")}
      icon={
        <svg width="56" height="56" viewBox="0 0 20 20" fill="none">
          <path d="M3 3 L11 11 M9 13 L3 19 M13 9 L11 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M17 3 L9 11 M11 13 L17 19 M7 9 L9 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      }
    />
  );
}
