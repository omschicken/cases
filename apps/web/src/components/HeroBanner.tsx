import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const SLIDE_KEYS = ["slide1", "slide2", "slide3"] as const;
const SLIDE_TARGETS: Record<(typeof SLIDE_KEYS)[number], string> = {
  slide1: "/wallet",
  slide2: "/",
  slide3: "/referral",
};

const AUTOPLAY_MS = 5000;

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

export function HeroBanner() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDE_KEYS.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, []);

  const key = SLIDE_KEYS[index];

  return (
    <div className="hero-banner">
      <Crosshair />
      <div className="hero-banner-content">
        <span className="hero-eyebrow">{t(`home.hero.${key}.eyebrow`)}</span>
        <h2>{t(`home.hero.${key}.title`)}</h2>
        <p>{t(`home.hero.${key}.subtitle`)}</p>
        <Link to={SLIDE_TARGETS[key]} className="hero-cta-button">
          {t(`home.hero.${key}.cta`)}
        </Link>
      </div>
      <div className="hero-dots">
        {SLIDE_KEYS.map((_, i) => (
          <button
            key={i}
            className={`hero-dot ${i === index ? "active" : ""}`}
            aria-label={t("home.hero.slideLabel", { n: i + 1 })}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
