import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { isChaseRarity, RARITY_RANK, rarityColor } from "../lib/rarity";
import { useAuth } from "../context/AuthContext";
import { CaseOpeningReel } from "../components/CaseOpeningReel";
import { CaseChest, caseVisualIdentity } from "../components/CaseChest";
import type { CaseDto, CaseItem, OpenCaseResult } from "../lib/types";

const EXTERIOR_PATTERN = / \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;
const EXTERIOR_SHORT: Record<string, string> = {
  "Factory New": "FN",
  "Minimal Wear": "MW",
  "Field-Tested": "FT",
  "Well-Worn": "WW",
  "Battle-Scarred": "BS",
};
const EXTERIOR_RANK = ["Factory New", "Minimal Wear", "Field-Tested", "Well-Worn", "Battle-Scarred"];

interface SkinGroup {
  name: string;
  rarity: CaseItem["rarity"];
  imageUrl: string;
  items: CaseItem[];
  totalWeight: number;
  minValueMinor: string;
  maxValueMinor: string;
  currency: string;
}

function groupCaseItems(items: CaseItem[]): SkinGroup[] {
  const groups = new Map<string, CaseItem[]>();
  for (const item of items) {
    const baseName = item.name.replace(EXTERIOR_PATTERN, "");
    const group = groups.get(baseName);
    if (group) group.push(item);
    else groups.set(baseName, [item]);
  }

  return [...groups.entries()].map(([name, variants]) => {
    const byPrice = [...variants].sort((a, b) => Number(BigInt(a.valueMinor) - BigInt(b.valueMinor)));
    const byWear = [...variants].sort((a, b) => {
      const aExterior = a.name.match(EXTERIOR_PATTERN)?.[1] ?? "";
      const bExterior = b.name.match(EXTERIOR_PATTERN)?.[1] ?? "";
      return EXTERIOR_RANK.indexOf(aExterior) - EXTERIOR_RANK.indexOf(bExterior);
    });
    return {
      name,
      rarity: variants[0].rarity,
      imageUrl: byPrice[byPrice.length - 1].imageUrl,
      items: byWear,
      totalWeight: variants.reduce((sum, item) => sum + item.weight, 0),
      minValueMinor: byPrice[0].valueMinor,
      maxValueMinor: byPrice[byPrice.length - 1].valueMinor,
      currency: variants[0].currency,
    };
  }).sort((a, b) => {
    const rarityDifference = RARITY_RANK.indexOf(a.rarity) - RARITY_RANK.indexOf(b.rarity);
    return rarityDifference || Number(BigInt(b.maxValueMinor) - BigInt(a.maxValueMinor));
  });
}

function exteriorLabel(item: CaseItem): string {
  const exterior = item.name.match(EXTERIOR_PATTERN)?.[1];
  return exterior ? EXTERIOR_SHORT[exterior] : "BASE";
}

function groupChancePercent(group: SkinGroup, totalWeight: number): string {
  if (totalWeight <= 0) return "0";
  return formatChance((group.totalWeight / totalWeight) * 100);
}

function formatChance(value: number): string {
  const decimals = value < 1 ? 2 : 1;
  return value.toFixed(decimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/** Visual-only demo pick, weighted the same way the reel's filler items are. */
function weightedSample(items: CaseItem[]): CaseItem {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

const QUICK_SPIN_KEY = "gundone.quickSpin";
const CASE_OPENING_DURATION_MS = 1250;
const PREVIEW_ART = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 420'%3E%3Crect width='640' height='420' fill='%23151b2d'/%3E%3Cpath d='M80 300 220 100l140 200 90-120 110 120' fill='none' stroke='%23b86bff' stroke-width='10'/%3E%3C/svg%3E";

function previewCase(slug: string): CaseDto {
  const names: Record<string, [string, string]> = {
    "ignition-case": ["Ignition Case", "14900"],
    "static-case": ["Static Case", "29900"],
    "overdrive-case": ["Overdrive Case", "59900"],
  };
  const [name, priceMinor] = names[slug] ?? ["Preview Case", "14900"];
  return {
    id: `preview-${slug}`, slug, name, priceMinor, currency: "RUB", imageUrl: PREVIEW_ART, isActive: true,
    items: [
      { id: `${slug}-common`, name: "USP-S | Printstream", imageUrl: PREVIEW_ART, weight: 60, valueMinor: "9900", currency: "RUB", rarity: "RESTRICTED" },
      { id: `${slug}-rare`, name: "AK-47 | Slate", imageUrl: PREVIEW_ART, weight: 30, valueMinor: "29900", currency: "RUB", rarity: "CLASSIFIED" },
      { id: `${slug}-gold`, name: "★ Нож | Aurora", imageUrl: PREVIEW_ART, weight: 10, valueMinor: "129900", currency: "RUB", rarity: "GOLD" },
    ],
  };
}

export function CaseDetailPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const heroArtRef = useRef<HTMLDivElement>(null);
  const [theCase, setTheCase] = useState<CaseDto | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [seedHash, setSeedHash] = useState<string | null>(null);
  const [clientSeed, setClientSeed] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<OpenCaseResult | null>(null);
  const [demoItem, setDemoItem] = useState<CaseItem | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  const openingLockRef = useRef(false);
  const [quickSpin, setQuickSpin] = useState(() => {
    try {
      return localStorage.getItem(QUICK_SPIN_KEY) === "1";
    } catch {
      return false;
    }
  });

  function toggleQuickSpin(next: boolean) {
    setQuickSpin(next);
    try {
      localStorage.setItem(QUICK_SPIN_KEY, next ? "1" : "0");
    } catch {
      // Private-browsing/blocked storage — the toggle still works for this visit.
    }
  }

  function openingDelay() {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 80 : CASE_OPENING_DURATION_MS));
  }

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setTheCase(null);
    setError(null);
    setIsPreview(false);
    setResult(null);
    setDemoItem(null);
    setRevealed(false);
    api
      .get<CaseDto>(`/cases/${slug}`)
      .then((data) => {
        if (!active) return;
        setTheCase(data);
        setIsPreview(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setError(t("caseDetail.caseNotFound"));
          return;
        }

        // Only known demo slugs may use the explicitly labeled offline preview.
        // An arbitrary URL must never become a plausible-looking case.
        const knownPreviewSlugs = ["ignition-case", "static-case", "overdrive-case"];
        if (knownPreviewSlugs.includes(slug)) {
          setTheCase(previewCase(slug));
          setIsPreview(true);
        } else {
          setError(err instanceof ApiError ? err.message : t("caseDetail.couldNotLoadCase", { defaultValue: "Не удалось загрузить кейс" }));
        }
      });
    return () => { active = false; };
  }, [slug, t, requestId]);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ serverSeedHash: string; clientSeed: string }>("/cases/seed/me")
      .then((s) => {
        setSeedHash(s.serverSeedHash);
        setClientSeed(s.clientSeed);
      })
      .catch(() => undefined);
  }, [user]);

  async function openCase() {
    if (!theCase || openingLockRef.current) return;
    openingLockRef.current = true;
    setError(null);
    setOpening(true);
    setRevealed(false);
    setResult(null);
    setDemoItem(null);
    try {
      // The result is fully determined here — the reel below just animates
      // toward it, it never influences the outcome.
      const [response] = await Promise.allSettled([
        api.post<OpenCaseResult>("/cases/open", { caseId: theCase.id }),
        openingDelay(),
      ]);
      if (response.status === "rejected") throw response.reason;
      setResult(response.value);
      setSpinKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("caseDetail.couldNotOpenCase"));
      openingLockRef.current = false;
    } finally {
      setOpening(false);
    }
  }

  // No account, no money, no server call — just a client-side preview of the
  // reel so visitors can see how it feels before logging in.
  async function demoSpin() {
    if (!theCase || openingLockRef.current) return;
    openingLockRef.current = true;
    setError(null);
    setResult(null);
    setDemoItem(null);
    setRevealed(false);
    setOpening(true);
    await openingDelay();
    setDemoItem(weightedSample(theCase.items));
    setSpinKey((k) => k + 1);
    setOpening(false);
  }

  if (error && !theCase) return (
    <div className="case-load-error" role="alert">
      <h1>{error}</h1>
      <button type="button" className="open-button" onClick={() => setRequestId((id) => id + 1)}>{t("common.retry", { defaultValue: "Retry" })}</button>
      <Link to="/" className="open-button">{t("caseDetail.backToCases", { defaultValue: "Вернуться к кейсам" })}</Link>
    </div>
  );
  if (!theCase) return (
    <div className="case-detail-loading" aria-busy="true" aria-live="polite">
      <span className="loading-line loading-line-title" />
      <span className="loading-line loading-line-price" />
      <div className="loading-reel" />
      <span className="loading-line loading-line-button" />
    </div>
  );

  const winningItem = result?.item ?? demoItem;
  const spinning = winningItem !== null && !revealed;
  const skinGroups = groupCaseItems(theCase.items);
  const featuredItem = theCase.items.reduce<CaseItem | null>((best, item) => {
    if (!best) return item;
    return BigInt(item.valueMinor) > BigInt(best.valueMinor) ? item : best;
  }, null);
  const totalWeight = theCase.items.reduce((total, item) => total + item.weight, 0);
  const featuredGroup = featuredItem ? skinGroups.find((group) => featuredItem.name.replace(EXTERIOR_PATTERN, "") === group.name) : null;
  const featuredChance = featuredGroup ? groupChancePercent(featuredGroup, totalWeight) : "0";
  const previewItems = [...theCase.items]
    .filter((item) => !item.imageUrl.startsWith("data:image"))
    .sort((a, b) => Number(b.valueMinor) - Number(a.valueMinor))
    .slice(0, 5);

  return (
    <div className="case-detail">
      {isPreview && (
        <div id="catalog-preview-notice" className="catalog-notice" role="status" aria-live="polite">
          <span>{t("caseDetail.previewNotice", { defaultValue: "Demo mode: the item service is currently unavailable. Real openings and deductions are disabled." })}</span>
          <button type="button" className="catalog-retry" onClick={() => setRequestId((id) => id + 1)}>{t("common.retry", { defaultValue: "Retry" })}</button>
        </div>
      )}
      <nav className="case-detail-breadcrumb" aria-label={t("caseDetail.breadcrumbLabel", { defaultValue: "Breadcrumb" })}>
        <Link to="/#collections">{t("caseDetail.allCases", { defaultValue: "All cases" })}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{theCase.name}</span>
      </nav>
      <section className="case-detail-hero" style={{ "--case-hue": caseVisualIdentity(theCase.slug).hue } as CSSProperties}>
        <div className="case-detail-hero-copy">
          <span className="section-kicker">DROPZONE / {t("caseDetail.collectionLabel", { defaultValue: "COLLECTION" })}</span>
          <h1>{theCase.name}</h1>
          <p className="case-detail-lede">{t("caseDetail.heroDescription", { defaultValue: "Explore every possible item and its exact chance before opening." })}</p>
          <div className="case-detail-stats">
            <div><span>{t("caseDetail.casePrice", { defaultValue: "CASE PRICE" })}</span><strong>{formatMinor(theCase.priceMinor, theCase.currency)}</strong></div>
            <div><span>{t("caseDetail.skinCount", { defaultValue: "SKIN DESIGNS" })}</span><strong>{skinGroups.length}</strong></div>
            <div><span>{t("caseDetail.featuredChance", { defaultValue: "TOP ITEM CHANCE" })}</span><strong>{featuredChance}%</strong></div>
          </div>
          <a href="#opening-station" className="case-detail-jump">{t("caseDetail.goToOpening", { defaultValue: "Go to opening" })} <span aria-hidden="true">↓</span></a>
        </div>
        <div
          className="case-detail-hero-art"
          ref={heroArtRef}
          onMouseMove={(e) => {
            const el = heroArtRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
            el.style.setProperty("--tilt-x", `${(y * -8).toFixed(2)}deg`);
            el.style.setProperty("--tilt-y", `${(x * 8).toFixed(2)}deg`);
          }}
          onMouseLeave={() => {
            const el = heroArtRef.current;
            if (!el) return;
            el.style.setProperty("--tilt-x", "0deg");
            el.style.setProperty("--tilt-y", "0deg");
          }}
        >
          <div className="case-detail-art-grid" aria-hidden="true" />
          <div className="case-detail-art-ring" aria-hidden="true" />
          <CaseChest className="case-chest-detail" caseName={theCase.name} caseSlug={theCase.slug} itemImageUrl={featuredItem?.imageUrl} />
          <div className="case-detail-art-caption"><span>{t("caseDetail.featuredItem", { defaultValue: "FEATURED ITEM" })}</span><strong>{featuredGroup?.name ?? theCase.name}</strong></div>
        </div>
      </section>

      <section id="opening-station" className="case-opening-station" aria-label={t("caseDetail.openingStation", { defaultValue: "Case opening" })}>
        <div className="case-opening-heading"><span className="section-kicker">{t("caseDetail.openingSequence", { defaultValue: "OPENING SEQUENCE" })}</span><span>{isPreview ? t("caseDetail.demoOnly", { defaultValue: "DEMO ONLY" }) : t("caseDetail.provablyFair")}</span></div>

      {winningItem && (
        <p className="opening-status" aria-live="polite">
          {spinning ? t("caseDetail.spinning", { defaultValue: "Определяем предмет…" }) : t("caseDetail.resultKicker", { defaultValue: "Предмет готов" })}
        </p>
      )}

      {winningItem && (
        <CaseOpeningReel
          key={spinKey}
          poolItems={theCase.items}
          winningItem={winningItem}
          onFinished={() => { setRevealed(true); openingLockRef.current = false; }}
          quick={quickSpin}
        />
      )}

      {opening && !winningItem && (
        <div className="case-opening-chest-stage" role="status" aria-live="polite">
          <span className="case-opening-energy" aria-hidden="true" />
          <CaseChest className="case-chest-opening" caseName={theCase.name} caseSlug={theCase.slug} opening />
          <p>{t("caseDetail.unlocking", { defaultValue: "Открываем замок…" })}</p>
        </div>
      )}

      {!opening && !winningItem && previewItems.length > 0 && (
        <div className="case-opening-preview" aria-hidden="true">
          <div className="case-opening-preview-track">
            {previewItems.map((item) => (
              <div className="case-opening-preview-item" key={item.id} style={{ "--rarity-color": rarityColor(item.rarity) } as CSSProperties}>
                <img src={item.imageUrl} alt="" />
              </div>
            ))}
          </div>
          <span className="case-opening-preview-marker" />
        </div>
      )}

      <div
        className="spin-mode-toggle"
        role="group"
        aria-label={t("caseDetail.spinMode", { defaultValue: "Режим открытия" })}
      >
        <button
          type="button"
          className={!quickSpin ? "active" : ""}
          onClick={() => toggleQuickSpin(false)}
          disabled={opening || spinning}
        >
          {t("caseDetail.spinFull")}
        </button>
        <button
          type="button"
          className={quickSpin ? "active" : ""}
          onClick={() => toggleQuickSpin(true)}
          disabled={opening || spinning}
        >
          {t("caseDetail.spinQuick")}
        </button>
      </div>

      {user && !isPreview ? (
        <button onClick={openCase} disabled={opening || spinning} className="open-button">
          {opening
            ? t("caseDetail.rolling")
            : spinning
              ? t("caseDetail.spinning")
              : t("caseDetail.openFor", { price: formatMinor(theCase.priceMinor, theCase.currency) })}
        </button>
      ) : (
        <>
          <button onClick={demoSpin} disabled={opening || spinning} className="open-button demo-button" aria-describedby={isPreview ? "catalog-preview-notice" : undefined}>
            {opening ? t("caseDetail.rolling") : spinning ? t("caseDetail.spinning") : t("caseDetail.demoSpin")}
          </button>
          <p className="hint">
            {isPreview
              ? t("caseDetail.previewHint")
              : <>{t("caseDetail.demoHint")} <Link to="/login">{t("caseDetail.logIn")}</Link></>}
          </p>
        </>
      )}

      {error && <p className="form-error">{error}</p>}
      </section>

      {result && revealed && (
        <div className={`result-panel ${isChaseRarity(result.item.rarity) ? "result-panel-chase" : ""}`} role="status" aria-live="polite" style={{ "--rarity-color": rarityColor(result.item.rarity) } as CSSProperties}>
          <span className="result-reveal-ring" aria-hidden="true" />
          <span className="result-reveal-burst" aria-hidden="true" />
          <span className="result-reveal-sparks" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--spark-index": index } as CSSProperties} />)}</span>
          <p className="result-kicker">{t("caseDetail.resultKicker", { defaultValue: "ПРЕДМЕТ ПОЛУЧЕН" })}</p>
          <h2>{t("caseDetail.youGot", { name: result.item.name })}</h2>
          <span className="result-rarity" style={{ color: rarityColor(result.item.rarity) }}>{t("caseDetail.rarity", { defaultValue: result.item.rarity })}</span>
          <img src={result.item.imageUrl} alt={result.item.name} className="result-image" />
          <p className="value">{formatMinor(result.item.valueMinor, result.item.currency)}</p>
          <div className="result-actions">
            <Link to="/inventory" className="result-action result-action-primary">{t("caseDetail.claim", { defaultValue: "Забрать в инвентарь" })}</Link>
            <button type="button" className="result-action result-action-secondary" onClick={openCase} disabled={opening}>{t("caseDetail.openAgain", { defaultValue: "Открыть ещё" })}</button>
          </div>
          <details>
            <summary>{t("caseDetail.roundDetails")}</summary>
            <ul>
              <li>{t("caseDetail.roll", { roll: result.roll.toFixed(8) })}</li>
              <li>{t("caseDetail.nonce", { nonce: result.nonce })}</li>
              <li>{t("caseDetail.serverSeedHash", { hash: result.serverSeedHash })}</li>
              <li>{t("caseDetail.clientSeed", { seed: result.clientSeed })}</li>
              <li>
                <Link to={`/verify/${result.openEventId}`}>{t("caseDetail.verifyThisResult")}</Link>
              </li>
            </ul>
          </details>
        </div>
      )}

      {!result && demoItem && revealed && (
        <div
          className={`result-panel demo-result ${isChaseRarity(demoItem.rarity) ? "result-panel-chase" : ""}`}
          role="status"
          aria-live="polite"
          style={{ "--rarity-color": rarityColor(demoItem.rarity) } as CSSProperties}
        >
          <span className="result-reveal-ring" aria-hidden="true" />
          <span className="result-reveal-burst" aria-hidden="true" />
          <span className="result-reveal-sparks" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--spark-index": index } as CSSProperties} />)}</span>
          <p className="result-kicker">{t("caseDetail.demoResultLabel")}</p>
          <h2>{t("caseDetail.demoYouGot", { name: demoItem.name })}</h2>
          <img src={demoItem.imageUrl} alt={demoItem.name} className="result-image" />
          <p className="value">{formatMinor(demoItem.valueMinor, demoItem.currency)}</p>
          <p className="hint">
            {t("caseDetail.demoResultHint")} <Link to="/login">{t("caseDetail.logIn")}</Link>
          </p>
        </div>
      )}

      {seedHash && (
        <div className="fairness-panel">
          <h3>{t("caseDetail.provablyFair")}</h3>
          <p>
            {t("caseDetail.serverSeedCommitment")}
            <br />
            <code>{seedHash}</code>
          </p>
          <p>
            {t("caseDetail.yourClientSeed")} <code>{clientSeed}</code>
          </p>
          <p>
            {t("caseDetail.rotateHintPrefix")} <Link to="/profile">{t("caseDetail.profileLink")}</Link>{" "}
            {t("caseDetail.rotateHintSuffix")}
          </p>
        </div>
      )}

      <div className="case-contents-heading"><div><span className="section-kicker">DROP TABLE / {String(skinGroups.length).padStart(2, "0")} SKINS · {String(theCase.items.length).padStart(2, "0")} OUTCOMES</span><h2 className="section-heading">{t("caseDetail.itemsHeading")}</h2></div><p>{t("caseDetail.groupedOddsDisclosure", { defaultValue: "Each card combines all available wear conditions. The chance shown is the total chance for that skin design." })}</p></div>
      <div className="item-grid">
        {skinGroups.map((group, i) => (
          <div
            className="item-card"
            key={group.name}
            style={{ "--rarity-color": rarityColor(group.rarity), "--index": i } as CSSProperties}
          >
            <span className="item-card-index">DZ / {String(i + 1).padStart(2, "0")}</span>
            <span className="item-chance-badge">{groupChancePercent(group, totalWeight)}%</span>
            <img src={group.imageUrl} alt={group.name} loading="lazy" />
            <div className="item-card-info">
              <span className="rarity-label">{t(`rarity.${group.rarity}`, { defaultValue: group.rarity.replace("_", " ") })}</span>
              <p className="item-skin-name">{group.name}</p>
              <div className="item-wear-list" aria-label={t("caseDetail.availableWear", { defaultValue: "Available wear conditions" })}>
                {group.items.map((item) => <span key={item.id} title={item.name.match(EXTERIOR_PATTERN)?.[1] ?? item.name}>{exteriorLabel(item)}</span>)}
              </div>
              <p className="value">
                {group.minValueMinor === group.maxValueMinor
                  ? formatMinor(group.minValueMinor, group.currency)
                  : `${formatMinor(group.minValueMinor, group.currency)} — ${formatMinor(group.maxValueMinor, group.currency)}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Real odds, computed from the same weights the server rolls against —
 * shown up front so buyers can see exactly what they're paying for. */
function dropChancePercent(item: CaseItem, pool: CaseItem[]): string {
  const total = pool.reduce((sum, i) => sum + i.weight, 0);
  if (total <= 0) return "0";
  const pct = (item.weight / total) * 100;
  return formatChance(pct);
}
