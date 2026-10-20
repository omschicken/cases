import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { CaseMiniArt } from "./CaseCard";
import { formatMinor } from "../../lib/money";
import { rarityColor } from "../../lib/rarity";
import type { RecentDropDto } from "../../lib/types";

interface DropHeroProps {
  /** Real number of cases in the catalog; omitted claims when unknown. */
  caseCount?: number;
  /** Up to three real cases (most expensive first) for the right-hand showcase. */
  showcase?: { slug: string; name: string; imageUrl: string }[];
}

/** Horizontal marquee of the latest drops. Linear, no pauses, no jumps: the
 *  list is rendered twice and the track slides by exactly one copy. */
function LiveFeed() {
  const [drops, setDrops] = useState<RecentDropDto[]>([]);

  useEffect(() => {
    api.get<RecentDropDto[]>("/cases/recent-drops").then((d) => setDrops(d.slice(0, 12))).catch(() => undefined);
  }, []);

  if (drops.length === 0) return null;
  return (
    <div className="dzh-feed" aria-label="Live feed">
      <span className="dzh-feed__label"><i aria-hidden="true" />LIVE</span>
      <div className="dzh-feed__window">
        <div className="dzh-feed__track">
          {[...drops, ...drops].map((d, i) => (
            <span
              className="dzh-drop"
              key={`${d.id}-${i}`}
              style={{ "--rc": rarityColor(d.item.rarity) } as CSSProperties}
            >
              <img src={d.item.imageUrl} alt="" loading="lazy" />
              <span className="dzh-drop__name">{d.item.name}</span>
              <span className="dzh-drop__value">{formatMinor(d.item.valueMinor, d.item.currency)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** ru plural: 1 кейс, 2-4 кейса, 5+ кейсов. */
function casesWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "кейс";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "кейса";
  return "кейсов";
}

/** Landing hero: centred statement, two actions, three micro-facts. */
/** Returns true for a usable case image URL (not a placeholder, not blank). */
function hasCaseArt(url: string | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//.test(url) && !/placehold(er)?\.co/i.test(url);
}

export function DropHero({ caseCount, showcase = [] }: DropHeroProps) {
  const n = caseCount ?? 0;
  return (
    <section className="hero-v3" aria-labelledby="dz-hero-title">
      <LiveFeed />
      <div className="hero-v3__inner">
        <div className="hero-v3__content">
          <h1 id="dz-hero-title" className="hero-v3__title">
            DROP<span className="hero-v3__brand-accent">ZONE</span>
          </h1>
          <p className="hero-v3__sub">
            {n > 0 ? `${n} ${casesWord(n)} · ` : ""}Честные шансы · Мгновенный результат
          </p>
          <a href="#collections" className="hero-v3__btn hero-v3__btn--primary">
            ОТКРЫТЬ КЕЙС
          </a>
        </div>

        {showcase.length > 0 && (
          <div className="hero-v3__showcase" aria-hidden="true">
            <span className="hero-v3__showcase-glow" />
            {showcase.slice(0, 3).map((c, i) => (
              <Link
                key={c.slug}
                to={`/cases/${c.slug}`}
                tabIndex={-1}
                className={`hero-v3__case hero-v3__case--${["center", "left", "right"][i]}`}
              >
                {hasCaseArt(c.imageUrl) ? (
                  <img src={c.imageUrl} alt="" loading="lazy" />
                ) : (
                  <CaseMiniArt caseName={c.name} caseSlug={c.slug} />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
