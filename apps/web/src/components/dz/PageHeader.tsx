import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Short technical line above the title. */
  kicker: string;
  title: string;
  /** One sentence on what this page is for. */
  lede?: string;
  /** Right-hand slot — a balance read-out, an account id, a link back. */
  aside?: ReactNode;
  /** Rendered as h1 by default; pass 2 for a page that already has one. */
  level?: 1 | 2;
}

/**
 * The header every page shares. Fourteen pages hand-built this and drifted
 * apart in spacing and type scale, which is most of why the product read as
 * separate screens instead of one system.
 */
export function PageHeader({ kicker, title, lede, aside, level = 1 }: PageHeaderProps) {
  const Title = level === 1 ? "h1" : "h2";
  return (
    <header className="dz-page-header">
      <div className="dz-page-header__main">
        <span className="dz-page-header__kicker">{kicker}</span>
        <Title className="dz-page-header__title">{title}</Title>
        {lede && <p className="dz-page-header__lede">{lede}</p>}
      </div>
      {aside && <div className="dz-page-header__aside">{aside}</div>}
    </header>
  );
}

/** A labelled figure for the header's right-hand slot. */
export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <span className="dz-readout">
      <span className="dz-readout__label">{label}</span>
      <span className="dz-readout__value">{value}</span>
    </span>
  );
}
