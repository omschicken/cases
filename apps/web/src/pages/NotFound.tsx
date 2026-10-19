import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <main className="not-found-page" role="status">
      <span className="section-kicker">CASECROW / 404</span>
      <h1>{t("common.pageNotFound")}</h1>
      <p>{t("common.pageNotFoundHint")}</p>
      <Link to="/" className="open-button">{t("common.backToCatalog")}</Link>
    </main>
  );
}
