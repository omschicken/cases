import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
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
export function DropHero({ caseCount, showcase = [] }: DropHeroProps) {
  const { t } = useTranslation();
  const n = caseCount ?? 0;
  return (
    <section className="hero-v3" aria-labelledby="dz-hero-title">
      <LiveFeed />
      <span className="hero-v3__glow" aria-hidden="true" />
      <div className="hero-v3__inner">
      <div className="hero-v3__content">
        <span className="hero-v3__tag">{t("home.hero.v3.tag", { defaultValue: "CS2 CASE OPENING" })}</span>
        <h1 id="dz-hero-title" className="hero-v3__title">
          {t("home.hero.v3.line1", { defaultValue: "ОТКРОЙ ЧТО-ТО" })}
          <br />
          <span className="hero-v3__accent">{t("home.hero.v3.line2", { defaultValue: "НЕВОЗМОЖНОЕ" })}</span>
        </h1>
        <p className="hero-v3__sub">
          {n > 0 ? `${n} эксклюзивных ${casesWord(n)}. ` : ""}
          {t("home.hero.v3.sub", { defaultValue: "Честные шансы. Мгновенный результат." })}
        </p>
        <div className="hero-v3__actions">
          <a href="#collections" className="hero-v3__btn hero-v3__btn--primary">
            {t("home.hero.v3.open", { defaultValue: "ОТКРЫТЬ КЕЙС" })}
          </a>
          <Link to="/fair" className="hero-v3__btn hero-v3__btn--ghost">
            {t("home.hero.v3.how", { defaultValue: "КАК ЭТО РАБОТАЕТ" })}
          </Link>
        </div>
        <ul className="hero-v3__facts">
          {n > 0 && <li>{n} {casesWord(n).toUpperCase()}</li>}
          <li>{t("home.hero.v3.fact2", { defaultValue: "ЧЕСТНАЯ ИГРА" })}</li>
          <li>{t("home.hero.v3.fact3", { defaultValue: "МГНОВЕННО" })}</li>
        </ul>
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
              <img src={c.imageUrl} alt="" loading="lazy" />
            </Link>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}
