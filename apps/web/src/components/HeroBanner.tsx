import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMinor } from "../lib/money";
import { RARITY_RANK } from "../lib/rarity";
import type { CaseDto } from "../lib/types";

const SLIDE_KEYS = ["slide1", "slide2", "slide3"] as const;

const AUTOPLAY_MS = 5000;

interface HeroBannerProps {
  featuredCase?: CaseDto;
}

/** Decorative reticle — a nod to CS2's own crosshair, not an interactive control. */
function Crosshair() {
  return (
    <svg className="hero-crosshair" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="3" fill="currentColor" />
      <line x1="50" y1="2" x2="50" y2="22" stroke="currentColor" strokeWidth="2" />
      <line x1="50" y1="78" x2="50" y2="98" stroke="currentColor" strokeWidth="2" />
      <line x1="2" y1="50" x2="22" y2="50" stroke="currentColor" strokeWidth="2" />
      <line x1="78" y1="50" x2="98" y2="50" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function HeroBanner({ featuredCase }: HeroBannerProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const featuredItem = featuredCase?.items.reduce<CaseDto["items"][number] | undefined>((best, item) => {
    if (!best) return item;
    const rarityDiff = RARITY_RANK.indexOf(item.rarity) - RARITY_RANK.indexOf(best.rarity);
    return rarityDiff > 0 || (rarityDiff === 0 && Number(item.valueMinor) > Number(best.valueMinor)) ? item : best;
  }, undefined);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % SLIDE_KEYS.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, reducedMotion]);

  const key = SLIDE_KEYS[index];
  const slideTarget = key === "slide2" && featuredCase
    ? `/cases/${featuredCase.slug}`
    : key === "slide3" ? "/faq" : "/#collections";

  return (
    <section
      className="hero-banner"
      aria-roledescription="carousel"
      aria-label={t("home.hero.carouselLabel", { defaultValue: "Featured collection" })}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="hero-grid-mark" aria-hidden="true" />
      <Crosshair />
      <div className="hero-banner-content">
        <span className="hero-eyebrow">{t(`home.hero.${key}.eyebrow`)}</span>
        <h2 key={key}>{t(`home.hero.${key}.title`)}</h2>
        <p key={`${key}-subtitle`}>{t(`home.hero.${key}.subtitle`)}</p>
        <div className="hero-actions">
          <Link to={slideTarget} className="hero-cta-button">
            {t(`home.hero.${key}.cta`)}
            <span aria-hidden="true">↗</span>
          </Link>
          <span className="hero-proof">{t("home.hero.fairness", { defaultValue: "Provably fair · Server-side results" })}</span>
        </div>
      </div>

      <div className="hero-stage" aria-label={featuredCase?.name ?? t("home.hero.previewCase", { defaultValue: "Featured case" })}>
        <div className="hero-stage-head">
          <span>{featuredCase ? t("home.hero.featured", { defaultValue: "FEATURED DROP" }) : t("home.hero.catalogPendingBadge", { defaultValue: "CATALOG / OFFLINE" })}</span>
          <span>{featuredCase ? "DROP / 001" : "API / WAIT"}</span>
        </div>
        <div className="hero-artwork">
          <div className="hero-orbit hero-orbit-outer" aria-hidden="true" />
          <div className="hero-orbit hero-orbit-inner" aria-hidden="true" />
          {featuredCase && !featuredCase.imageUrl.startsWith("data:image") && (
            <img className="hero-case-art" src={featuredCase.imageUrl} alt={featuredCase.name} />
          )}
          {featuredItem && <img className="hero-item-art" src={featuredItem.imageUrl} alt={featuredItem.name} />}
          <span className="hero-art-coordinate" aria-hidden="true">CS / 2</span>
        </div>
        <div className="hero-stage-foot">
          <div className="hero-stage-item">
            <span>{featuredItem ? t("home.hero.topDrop", { defaultValue: "TOP DROP IN THIS CASE" }) : t("home.hero.catalogPendingBadge", { defaultValue: "CATALOG / OFFLINE" })}</span>
            <strong>{featuredItem?.name ?? t("home.hero.loadingArt", { defaultValue: "Каталог появится после подключения сервиса" })}</strong>
          </div>
          {featuredItem && <span className="hero-stage-value">{formatMinor(featuredItem.valueMinor, featuredItem.currency)}</span>}
        </div>
      </div>

      <div className="hero-dots" role="group" aria-label={t("home.hero.chooseSlide", { defaultValue: "Choose featured panel" })}>
        {SLIDE_KEYS.map((_, i) => (
          <button
            key={i}
            className={`hero-dot ${i === index ? "active" : ""}`}
            aria-label={t("home.hero.slideLabel", { n: i + 1 })}
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}
