import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Slide {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaTo: string;
  gradient: string;
}

// Placeholder marketing copy — swap for real promo content/art whenever.
// The carousel mechanics (autoplay, dots) don't need to change.
const SLIDES: Slide[] = [
  {
    eyebrow: "Welcome bonus",
    title: "Get 10% extra on your first deposit",
    subtitle: "Fund your wallet and open your first case today.",
    ctaLabel: "Deposit now",
    ctaTo: "/wallet",
    gradient: "linear-gradient(120deg, #241a4a, #120e24)",
  },
  {
    eyebrow: "Just dropped",
    title: "New case added to the vault",
    subtitle: "Fresh odds, fresh skins — check what's inside.",
    ctaLabel: "Browse cases",
    ctaTo: "/",
    gradient: "linear-gradient(120deg, #1a3a33, #0e1f1c)",
  },
  {
    eyebrow: "Refer & earn",
    title: "Invite friends, earn on every deposit they make",
    subtitle: "Share your link and start stacking commission.",
    ctaLabel: "Get my link",
    ctaTo: "/referral",
    gradient: "linear-gradient(120deg, #3a1a3a, #1f0e1f)",
  },
];

const AUTOPLAY_MS = 5000;

export function HeroBanner() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[index];

  return (
    <div className="hero-banner" style={{ background: slide.gradient }}>
      <div className="hero-banner-content">
        <span className="hero-eyebrow">{slide.eyebrow}</span>
        <h2>{slide.title}</h2>
        <p>{slide.subtitle}</p>
        <Link to={slide.ctaTo} className="hero-cta-button">
          {slide.ctaLabel}
        </Link>
      </div>
      <div className="hero-dots">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`hero-dot ${i === index ? "active" : ""}`}
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
