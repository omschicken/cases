import { useTranslation } from "react-i18next";
import { ComingSoon } from "../components/ComingSoon";

export function ContractsPage() {
  const { t } = useTranslation();
  return (
    <ComingSoon
      title={t("comingSoon.contracts.title")}
      description={t("comingSoon.contracts.description")}
      icon={
        <svg width="56" height="56" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="2.5" width="12" height="15" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6.5 6.5 L13.5 6.5 M6.5 9.5 L13.5 9.5 M6.5 12.5 L11 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      }
    />
  );
}
