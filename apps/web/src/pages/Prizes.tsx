import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { CaseDto } from "../lib/types";
import { PageHeader } from "../components/dz/PageHeader";

// Static prize tiers shown on the wheel visual
const PRIZE_TIERS = [
  { label: "×2", desc: "Множитель ставки" },
  { label: "×5", desc: "Большой выигрыш" },
  { label: "×10", desc: "Джекпот" },
  { label: "×1.5", desc: "Малый бонус" },
  { label: "×3", desc: "Стандартный приз" },
  { label: "×7", desc: "Крупный выигрыш" },
];

export function PrizesPage() {
  const [cases, setCases] = useState<CaseDto[]>([]);

  useEffect(() => {
    api.get<CaseDto[]>("/cases").then((all) => setCases(all.slice(0, 3))).catch(() => undefined);
  }, []);

  return (
    <div className="game-workspace prizes-workspace">
      <PageHeader kicker="ПРИЗЫ / СКОРО" title="ПРИЗЫ" lede="Колесо фортуны, ежедневные розыгрыши и ивентовые награды — скоро появятся на сайте." />

      {/* Wheel visual */}
      <section className="prizes-wheel-section">
        <div className="prizes-wheel" aria-label="Колесо фортуны (скоро)">
          <div className="prizes-wheel-inner">
            {PRIZE_TIERS.map((tier, i) => (
              <div
                key={i}
                className="prizes-wheel-segment"
                style={{ "--segment-index": i, "--segment-count": PRIZE_TIERS.length } as React.CSSProperties}
              >
                <span>{tier.label}</span>
              </div>
            ))}
            <div className="prizes-wheel-hub">
              <span>SOON</span>
            </div>
          </div>
          <div className="prizes-wheel-pointer" aria-hidden="true">▼</div>
        </div>

        <div className="prizes-upcoming">
          <h2>Что планируется</h2>
          <ul>
            <li><strong>Колесо фортуны</strong> — трать очки активности за спины</li>
            <li><strong>Ежедневные розыгрыши</strong> — бесплатные открытия для активных игроков</li>
            <li><strong>Реферальные призы</strong> — награды за приглашённых друзей</li>
            <li><strong>Ивентовые кейсы</strong> — ограниченные кейсы к праздникам</li>
          </ul>
        </div>
      </section>

      {/* While waiting — open a real case */}
      {cases.length > 0 && (
        <section className="prizes-cases">
          <div className="game-section-label"><span>ПОКА ЖДЁШь — ОТКРОЙ КЕЙС</span></div>
          <div className="game-item-grid">
            {cases.map((c) => (
              <Link key={c.id} to={`/cases/${c.slug}`} className="game-item">
                <img src={c.imageUrl} alt={c.name} />
                <strong>{c.name}</strong>
                <b>{formatMinor(c.priceMinor, c.currency)}</b>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
