import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface Slide {
  key: string;
  ctaTo: string;
  gradient: string;
}

// Placeholder marketing copy — swap for real promo content/art whenever.
// The carousel mechanics (autoplay, dots) don't need to change.
const SLIDES: Slide[] = [
  { key: "slide1", ctaTo: "/wallet", gradient: "linear-gradient(120deg, #241a4a, #120e24)" },
  { key: "slide2", ctaTo: "/", gradient: "linear-gradient(120deg, #1a3a33, #0e1f1c)" },
  { key: "slide3", ctaTo: "/referral", gradient: "linear-gradient(120deg, #3a1a3a, #1f0e1f)" },
];

const AUTOPLAY_MS = 5000;

export function HeroBanner() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[index];

  return (
    <div className="hero-banner" style={{ background: slide.gradient }}>
      <div className="hero-banner-content">
        <span className="hero-eyebrow">{t(`home.hero.${slide.key}.eyebrow`)}</span>
        <h2>{t(`home.hero.${slide.key}.title`)}</h2>
        <p>{t(`home.hero.${slide.key}.subtitle`)}</p>
        <Link to={slide.ctaTo} className="hero-cta-button">
          {t(`home.hero.${slide.key}.cta`)}
        </Link>
      </div>
      <div className="hero-dots">
        {SLIDES.map((_, i) => (
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
