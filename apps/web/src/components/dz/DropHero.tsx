import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { formatMinor } from "../../lib/money";
import { rarityColor } from "../../lib/rarity";
import type { CaseDto, RecentDropDto } from "../../lib/types";
import { CaseChest, caseVisualIdentity } from "../CaseChest";
import { Money } from "../Money";

interface DropHeroProps {
  featuredCase?: CaseDto;
  catalogStatus?: "loading" | "empty" | "error";
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

/** Featured case on a CSS 3D card. Pointer position eases the tilt
 *  (lerp 0.05); on touch screens it sways by itself. */
function FloatingCase({ featuredCase }: { featuredCase?: CaseDto }) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!coarse) window.addEventListener("pointermove", onMove, { passive: true });

    const t0 = performance.now();
    const tick = (now: number) => {
      if (coarse) {
        const t = (now - t0) / 1000;
        tx = Math.sin(t * 0.8) * 0.7;
        ty = Math.cos(t * 0.6) * 0.5;
      }
      cx += (tx - cx) * 0.05;
      cy += (ty - cy) * 0.05;
      el.style.transform = `rotateX(${(-cy * 10).toFixed(2)}deg) rotateY(${(cx * 14).toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!featuredCase) {
    return <div className="dzh-card dzh-card--empty dz-skeleton" aria-hidden="true" />;
  }
  const { hue } = caseVisualIdentity(featuredCase.slug);
  return (
    <Link
      to={`/cases/${featuredCase.slug}`}
      className="dzh-scene"
      style={{ "--chest-hue": hue } as CSSProperties}
      aria-label={featuredCase.name}
    >
      <div className="dzh-card" ref={cardRef}>
        <span className="dzh-card__edge" aria-hidden="true" />
        <span className="dzh-card__serial">FEATURED</span>
        <div className="dzh-card__art">
          <CaseChest caseName={featuredCase.name} caseSlug={featuredCase.slug} className="dzh-chest" />
        </div>
        <div className="dzh-card__foot">
          <span className="dzh-card__name">{featuredCase.name}</span>
          <span className="dzh-card__price"><Money minor={featuredCase.priceMinor} currency={featuredCase.currency} /></span>
        </div>
      </div>
    </Link>
  );
}

/** Landing hero: live feed on top, headline and actions left, a floating
 *  featured case right. */
export function DropHero({ featuredCase }: DropHeroProps) {
  const { t } = useTranslation();
  return (
    <section className="dzh" aria-labelledby="dz-hero-title">
      <LiveFeed />
      <div className="dzh__grid">
        <div className="dzh__copy">
          <h1 id="dz-hero-title" className="dzh__title">
            {t("home.hero.v2.title1", { defaultValue: "Открой" })}<br />
            {t("home.hero.v2.title2", { defaultValue: "кейс" })}
          </h1>
          <p className="dzh__lede">
            {t("home.hero.v2.lede", { defaultValue: "Честно. Быстро. Бесплатный старт." })}
          </p>
          <div className="dzh__actions">
            <Link to={featuredCase ? `/cases/${featuredCase.slug}` : "/#collections"} className="dzh__btn dzh__btn--primary">
              {t("home.hero.v2.open", { defaultValue: "Открыть" })}
            </Link>
            <a href="#recent-drops" className="dzh__btn">
              {t("home.hero.v2.drops", { defaultValue: "Смотреть дропы" })}
            </a>
          </div>
        </div>
        <FloatingCase featuredCase={featuredCase} />
      </div>
    </section>
  );
}
