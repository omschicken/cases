import { useTranslation } from "react-i18next";

const FAQ_KEYS = ["provablyFair", "deposits", "kyc", "withdrawals", "steam"] as const;

export function FAQPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("faq.title")}</h1>
      <div className="faq-list">
        {FAQ_KEYS.map((key) => (
          <details key={key} className="faq-item">
            <summary>{t(`faq.items.${key}.q`)}</summary>
            <p>{t(`faq.items.${key}.a`)}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
