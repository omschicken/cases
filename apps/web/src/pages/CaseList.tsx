import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { HeroBanner } from "../components/HeroBanner";
import { StatsBar } from "../components/StatsBar";
import { RecentDrops } from "../components/RecentDrops";
import type { CaseDto } from "../lib/types";

export function CaseListPage() {
  const { t } = useTranslation();
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CaseDto[]>("/cases")
      .then(setCases)
      .catch(() => setError(t("home.couldNotLoadCases")));
  }, [t]);

  return (
    <div>
      <HeroBanner />
      <StatsBar />
      <RecentDrops />

      <h1 className="section-heading">{t("home.casesHeading")}</h1>
      {error && <p className="form-error">{error}</p>}
      <div className="case-grid">
        {cases.map((c) => (
          <Link to={`/cases/${c.slug}`} key={c.id} className="case-card">
            <img src={c.imageUrl} alt={c.name} />
            <h3>{c.name}</h3>
            <p className="price">{formatMinor(c.priceMinor, c.currency)}</p>
          </Link>
        ))}
        {cases.length === 0 && !error && <p>{t("home.noCasesYet")}</p>}
      </div>
    </div>
  );
}
