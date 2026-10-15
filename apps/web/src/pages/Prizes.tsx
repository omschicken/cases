import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { CaseDto } from "../lib/types";
import { PageHeader } from "../components/dz/PageHeader";

// Static prize tiers shown on the wheel visual
const PRIZE_TIERS = ["×2", "×5", "×10", "×1.5", "×3", "×7"];

export function PrizesPage() {
  const { t } = useTranslation();
  const [cases, setCases] = useState<CaseDto[]>([]);

  useEffect(() => {
    api.get<CaseDto[]>("/cases").then((all) => setCases(all.slice(0, 3))).catch(() => undefined);
  }, []);

  const features = [
    { title: t("prizes.feature1Title"), body: t("prizes.feature1Body") },
    { title: t("prizes.feature2Title"), body: t("prizes.feature2Body") },
    { title: t("prizes.feature3Title"), body: t("prizes.feature3Body") },
    { title: t("prizes.feature4Title"), body: t("prizes.feature4Body") },
  ];

  return (
    <div className="dz-workspace">
      <PageHeader
        kicker={t("prizes.kicker")}
        title={t("prizes.title")}
        lede={t("prizes.lede")}
      />

      {/* Wheel visual */}
      <div className="dz-panel" style={{ marginTop: "var(--dz-s5)" }}>
        <div className="prizes-wheel" aria-label={t("prizes.title")}>
          <div className="prizes-wheel-inner">
            {PRIZE_TIERS.map((tier, i) => (
              <div
                key={i}
                className="prizes-wheel-segment"
                style={{ "--segment-index": i, "--segment-count": PRIZE_TIERS.length } as React.CSSProperties}
              >
                <span>{tier}</span>
              </div>
            ))}
            <div className="prizes-wheel-hub">
              <span>SOON</span>
            </div>
          </div>
          <div className="prizes-wheel-pointer" aria-hidden="true">▼</div>
        </div>

        <div style={{ marginTop: "var(--dz-s5)", maxWidth: "36rem" }}>
          <h2 style={{ margin: "0 0 var(--dz-s3)", fontFamily: "var(--dz-font-display)", fontSize: "var(--dz-type-lg)", fontWeight: 700, letterSpacing: "var(--dz-tracking-display)", textTransform: "uppercase", color: "var(--dz-text-1)" }}>
            {t("prizes.comingTitle")}
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "var(--dz-s3)" }}>
            {features.map(({ title, body }) => (
              <li key={title} style={{ display: "flex", gap: "var(--dz-s2)", fontSize: "var(--dz-type-sm)", color: "var(--dz-text-3)" }}>
                <span style={{ color: "var(--dz-amber)", fontFamily: "var(--dz-font-technical)", fontSize: "var(--dz-type-tech)", letterSpacing: "var(--dz-tracking-tech)", textTransform: "uppercase", paddingTop: "2px", flexShrink: 0 }}>→</span>
                <span><strong style={{ color: "var(--dz-text-1)" }}>{title}</strong> — {body}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* While waiting — open a real case */}
      {cases.length > 0 && (
        <div className="dz-panel" style={{ marginTop: "var(--dz-s4)" }}>
          <div className="dz-panel__label">
            <span>{t("prizes.whileWaiting")}</span>
          </div>
          <div className="dz-pick-grid">
            {cases.map((c) => (
              <Link
                key={c.id}
                to={`/cases/${c.slug}`}
                className="dz-pick"
                style={{ textDecoration: "none" }}
              >
                <span className="dz-pick__art">
                  <img src={c.imageUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </span>
                <span className="dz-pick__name">{c.name}</span>
                <span className="dz-pick__value">{formatMinor(c.priceMinor, c.currency)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
