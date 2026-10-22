import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_LABELS, RARITY_RANK, rarityColor } from "../lib/rarity";
import { useAuth } from "../context/AuthContext";
import { DropProtocol, type ProtocolPhase } from "../components/dz/DropProtocol";
import { Money } from "../components/Money";
import { CaseChest, caseVisualIdentity } from "../components/CaseChest";
import { CaseStage } from "../components/CaseStage";
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
  const [theCase, setTheCase] = useState<CaseDto | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [seedHash, setSeedHash] = useState<string | null>(null);
  const [clientSeed, setClientSeed] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<OpenCaseResult | null>(null);
  const [demoItem, setDemoItem] = useState<CaseItem | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [batchCount, setBatchCount] = useState(1);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchResults, setBatchResults] = useState<OpenCaseResult[]>([]);
  const [batchDone, setBatchDone] = useState(false);
  const [batchFailures, setBatchFailures] = useState(0);
  const [sellingResult, setSellingResult] = useState(false);
  const [soldResult, setSoldResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  // The staged opening scene is dismissible; the page below keeps the result
  // panel, so closing it never hides the provably-fair record.
  const [protocolDismissed, setProtocolDismissed] = useState(false);
  const openingLockRef = useRef(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setTheCase(null);
    setBatchResults([]);
    setBatchDone(false);
    setError(null);
    setIsPreview(false);
    setResult(null);
    setSoldResult(false);
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

  /** Fires once the chest's own burst/reveal overlay has settled on the item. */
  function handleChestRevealed() {
    setOpening(false);
    setRevealed(true);
    openingLockRef.current = false;
  }

  async function openCase() {
    if (!theCase || openingLockRef.current) return;
    openingLockRef.current = true;
    setError(null);
    setOpening(true);
    setRevealed(false);
    setResult(null);
    setDemoItem(null);
    setProtocolDismissed(false);
    try {
      // The result is fully determined here — the chest overlay below just
      // animates toward it, it never influences the outcome. The overlay
      // holds its own reveal step until this resolves and winningItem is set.
      const response = await api.post<OpenCaseResult>("/cases/open", { caseId: theCase.id });
      setResult(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("caseDetail.couldNotOpenCase"));
      setOpening(false);
      openingLockRef.current = false;
    }
  }

  async function openBatch() {
    if (!theCase || !user || isPreview || openingLockRef.current || batchBusy) return;
    openingLockRef.current = true;
    setBatchBusy(true);
    setBatchResults([]);
    setBatchDone(false);
    setBatchFailures(0);
    setError(null);
    try {
      // Every request is an independent server-authoritative opening.
      // Sequential requests avoid bursting through the API rate limiter.
      const won: OpenCaseResult[] = [];
      let failed = 0;
      for (let i = 0; i < batchCount; i++) {
        try {
          const result = await api.post<OpenCaseResult>("/cases/open", { caseId: theCase.id });
          won.push(result);
        } catch {
          failed++;
          break; // Do not charge for further openings after a failure.
        }
      }
      setBatchResults(won);
      setBatchFailures(failed);
      if (won.length) {
        window.setTimeout(() => setBatchDone(true), 3300);
      } else {
        setError("Не удалось открыть кейсы. Проверь баланс и попробуй ещё раз.");
      }
    } finally {
      openingLockRef.current = false;
      setBatchBusy(false);
    }
  }

  async function sellOpenedItem() {
    if (!result || sellingResult || soldResult) return;
    setSellingResult(true);
    setError(null);
    try {
      await api.post(`/cases/inventory/${result.inventoryItemId}/sell`);
      setSoldResult(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось продать предмет");
    } finally {
      setSellingResult(false);
    }
  }

  // No account, no money, no server call — just a client-side preview so
  // visitors can see how it feels before logging in. The item is known
  // immediately, so the chest overlay's reveal step never has to wait.
  function demoSpin() {
    if (!theCase || openingLockRef.current) return;
    openingLockRef.current = true;
    setError(null);
    setResult(null);
    setRevealed(false);
    setProtocolDismissed(false);
    setOpening(true);
    setDemoItem(weightedSample(theCase.items));
  }

  if (error && !theCase) return (
    <div className="case-load-error" role="alert">
      <h1>{error}</h1>
      <button type="button" className="dz-commit" onClick={() => setRequestId((id) => id + 1)}>{t("common.retry", { defaultValue: "Retry" })}</button>
      <Link to="/" className="dz-commit">{t("caseDetail.backToCases", { defaultValue: "Вернуться к кейсам" })}</Link>
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

  // The "chase" item teased above the closed chest: the rarest one in the
  // case that has a real picture (not a generated placeholder).
  const chaseItem = [...theCase.items]
    .filter((item) => item.imageUrl && !item.imageUrl.startsWith("data:") && !item.imageUrl.includes("placehold.co"))
    .sort(
      (a, b) =>
        RARITY_RANK.indexOf(a.rarity) - RARITY_RANK.indexOf(b.rarity) ||
        Number(BigInt(b.valueMinor) - BigInt(a.valueMinor)),
    )[0];

  // Phase is derived, never stored, so it cannot drift from the opening
  // state it describes. A failed request leaves opening false with no item,
  // which resolves to null here and closes the scene on its own. The chest's
  // own overlay owns the whole burst→reveal choreography now, so there's
  // nothing left to stage between "arming" and "reveal".
  const protocolPhase: ProtocolPhase | null = protocolDismissed
    ? null
    : opening
      ? "arming"
      : winningItem && revealed
        ? "reveal"
        : null;

  /** Ends the animation early. The outcome was decided by the server before
   *  the first frame, so this just cuts the chest overlay's own choreography
   *  short and shows what already dropped — it never re-rolls. */
  function skipAnimation() {
    setOpening(false);
    setRevealed(true);
    openingLockRef.current = false;
  }
  const skinGroups = groupCaseItems(theCase.items);
  const totalWeight = theCase.items.reduce((total, item) => total + item.weight, 0);

  return (
    <div
      className="case-detail"
      data-rarity={revealed && winningItem ? winningItem.rarity : undefined}
    >
      {protocolPhase && (
        <DropProtocol
          phase={protocolPhase}
          caseName={theCase.name}
          item={winningItem}
          result={result}
          oddsPercent={winningItem ? dropChancePercent(winningItem, theCase.items) : undefined}
          isOpening={opening}
          itemRarity={winningItem?.rarity}
          caseChest={
            <CaseChest
              className="case-chest-detail"
              caseName={theCase.name}
              caseSlug={theCase.slug}
              opening={opening}
              itemImageUrl={winningItem?.imageUrl}
              itemName={winningItem?.name}
              itemRarity={winningItem?.rarity}
              onRevealed={handleChestRevealed}
            />
          }
          onSell={sellOpenedItem}
          selling={sellingResult}
          sold={soldResult}
          onSkip={skipAnimation}
          onClose={() => setProtocolDismissed(true)}
          onOpenAgain={openCase}
          canOpenAgain={Boolean(user) && !isPreview}
        />
      )}
      {isPreview && (
        <div id="catalog-preview-notice" className="catalog-notice" role="status" aria-live="polite">
          <span>{t("caseDetail.previewNotice", { defaultValue: "Demo mode: the item service is currently unavailable. Real openings and deductions are disabled." })}</span>
          <button type="button" className="catalog-retry" onClick={() => setRequestId((id) => id + 1)}>{t("common.retry", { defaultValue: "Retry" })}</button>
        </div>
      )}
      {/* ZONE 1 — slim header */}
      <header className="dza-head">
        <Link to="/" className="dza-back" aria-label={t("caseDetail.backToCases", { defaultValue: "Назад к кейсам" })}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <nav className="dza-crumb" aria-label={t("caseDetail.breadcrumbLabel", { defaultValue: "Breadcrumb" })}>
          <Link to="/#collections">{t("caseDetail.crumbCases", { defaultValue: "Кейсы" })}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{theCase.name.replace(/\s*case$/i, "")}</span>
        </nav>
      </header>

      {/* ZONE 2 — arena */}
      <section id="opening-station" className="dza-arena" aria-label={t("caseDetail.openingStation", { defaultValue: "Case opening" })}>
        <div className="dza-arena__stage">
          <CaseStage
            caseName={theCase.name}
            caseSlug={theCase.slug}
            caseImageUrl={theCase.imageUrl}
            chase={chaseItem ? { name: chaseItem.name, imageUrl: chaseItem.imageUrl, rarity: chaseItem.rarity } : undefined}
            hidden={opening}
          />
        </div>

        <div className="dza-arena__panel">
          <div className="dza-arena__price">
            <span className="dza-arena__label">{t("caseDetail.casePrice", { defaultValue: "Цена" })}</span>
            <Money minor={theCase.priceMinor} currency={theCase.currency} />
            <span className="dza-arena__label">{isPreview ? t("caseDetail.demoOnly", { defaultValue: "DEMO ONLY" }) : t("caseDetail.provablyFair")}</span>
          </div>

          {user && !isPreview ? (
            <>
              <button onClick={batchCount === 1 ? openCase : () => void openBatch()} disabled={opening || batchBusy || (batchResults.length > 0 && !batchDone)} className="dza-open">
                {opening || batchBusy ? t("caseDetail.rolling") : batchCount === 1 ? t("caseDetail.open", { defaultValue: "Открыть" }) : `Открыть ×${batchCount}`}
              </button>
              <div className="case-batch-picker" role="group" aria-label="Количество открытий">
                {[1, 3, 5].map((count) => <button key={count} type="button" className={batchCount === count ? "is-active" : ""} aria-pressed={batchCount === count} disabled={opening || batchBusy} onClick={() => { setBatchCount(count); setBatchResults([]); setBatchDone(false); }}>×{count}</button>)}
              </div>
              <button onClick={demoSpin} disabled={opening || batchBusy} className="dza-demo">
                {t("caseDetail.demoSpin")}
              </button>
            </>
          ) : (
            <>
              <button onClick={demoSpin} disabled={opening} className="dza-open" aria-describedby={isPreview ? "catalog-preview-notice" : undefined}>
                {opening ? t("caseDetail.rolling") : t("caseDetail.demoSpin")}
              </button>
              <p className="dza-hint">
                {isPreview
                  ? t("caseDetail.previewHint")
                  : <>{t("caseDetail.demoHint")} <Link to="/login">{t("caseDetail.logIn")}</Link></>}
              </p>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
      </section>

      {batchResults.length > 0 && (
        <section className="case-batch-results" aria-label="Результаты мультиоткрытия">
          <div className="case-batch-results__head"><h2>Открыто: {batchResults.length}</h2>
            <button type="button" onClick={() => { setBatchDone(true); }} disabled={batchDone}>Пропустить анимацию</button>
          </div>
          <div className="case-batch-reels">
            {batchResults.map((entry, index) => (
              <div className={`case-batch-reel ${batchDone ? "is-done" : "is-spinning"}`} key={entry.openEventId} style={{ "--reel-index": index, "--reel-rarity": rarityColor(entry.item.rarity) } as CSSProperties}>
                <div className="case-batch-reel__viewport">
                  <div className="case-batch-reel__track">
                    {Array.from({ length: 13 }, (_, slot) => {
                      const filler = theCase.items[(index * 7 + slot * 17) % theCase.items.length] ?? entry.item;
                      const shown = slot === 11 ? entry.item : filler;
                      return <div className="case-batch-reel__tile" key={slot}><img src={shown.imageUrl} alt="" /></div>;
                    })}
                  </div>
                  <div className="case-batch-reel__marker" aria-hidden="true" />
                </div>
                <div className="case-batch-reel__reward"><img src={entry.item.imageUrl} alt="" /><strong>{entry.item.name}</strong><span>{formatMinor(entry.item.valueMinor, entry.item.currency)}</span></div>
              </div>
            ))}
          </div>
          {batchFailures > 0 && <p role="alert">Часть открытий не выполнена. Списания за неуспешные открытия не запрашивались повторно.</p>}
          {batchDone && <Link className="dz-btn" to="/inventory">Перейти в инвентарь</Link>}
        </section>
      )}
      {revealed && winningItem && (
        <section
          className="dz-record"
          role="status"
          aria-live="polite"
          style={{ "--dz-rarity": rarityColor(winningItem.rarity) } as CSSProperties}
        >
          <img className="dz-record__art" src={winningItem.imageUrl} alt="" />
          <div>
            <span className="dz-record__label">
              {result
                ? t("caseDetail.resultKicker", { defaultValue: "ПРЕДМЕТ ПОЛУЧЕН" })
                : t("caseDetail.demoResultLabel", { defaultValue: "ДЕМО — предмет не зачислен" })}
              {" · "}
              {t(`rarity.${winningItem.rarity}`, { defaultValue: RARITY_LABELS[winningItem.rarity] })}
            </span>
            <h2 className="dz-record__name">{winningItem.name}</h2>
            <p className="dz-record__value">{formatMinor(winningItem.valueMinor, winningItem.currency)}</p>
            <div className="dz-record__actions">
              {result ? (
                <>
                  {soldResult ? <span className="dz-btn">Предмет продан</span> : <>
                    <button type="button" className="dz-btn" onClick={() => void sellOpenedItem()} disabled={sellingResult}>{sellingResult ? "Продажа…" : `Продать за ${formatMinor(winningItem.valueMinor, winningItem.currency)}`}</button>
                    <Link to="/inventory" className="dz-btn">{t("caseDetail.claim", { defaultValue: "Забрать в инвентарь" })}</Link>
                  </>}
                  <Link to={`/verify/${result.openEventId}`} className="dz-btn">{t("caseDetail.verifyThisResult", { defaultValue: "Проверить результат" })}</Link>
                </>
              ) : (
                <Link to="/login" className="dz-btn">{t("caseDetail.logIn")}</Link>
              )}
            </div>
            {result && (
              <details className="dz-protocol__fair">
                <summary>{t("caseDetail.roundDetails")}</summary>
                <dl>
                  <dt>roll</dt><dd>{result.roll.toFixed(8)}</dd>
                  <dt>nonce</dt><dd>{result.nonce}</dd>
                  <dt>server seed hash</dt><dd>{result.serverSeedHash}</dd>
                  <dt>client seed</dt><dd>{result.clientSeed}</dd>
                </dl>
              </details>
            )}
          </div>
        </section>
      )}

      {seedHash && (
        <div className="dz-panel">
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

      {/* ZONE 3 — contents */}
      <section className="dza-items" aria-labelledby="dza-items-title">
        <div className="dza-items__head">
          <h2 id="dza-items-title">{t("caseDetail.itemsHeading")}</h2>
          <span className="dza-items__count">
            {String(skinGroups.length).padStart(2, "0")} / {String(theCase.items.length).padStart(2, "0")}
          </span>
        </div>
        {RARITY_RANK.map((rarity) => {
          const groups = skinGroups.filter((g) => g.rarity === rarity);
          if (groups.length === 0) return null;
          return (
            <div
              key={rarity}
              className="dza-tier"
              style={{ "--rc": rarityColor(rarity) } as CSSProperties}
            >
              <h3 className="dza-tier__title">
                <span>{t(`rarity.${rarity}`, { defaultValue: RARITY_LABELS[rarity] })}</span>
                <i aria-hidden="true" />
                <b>{String(groups.length).padStart(2, "0")}</b>
              </h3>
              <div className="dza-items__rail">
                {groups.map((group) => (
                  <article key={group.name} className="dza-item" style={{ "--rc": rarityColor(group.rarity) } as CSSProperties}>
                    <span className="dza-item__chance">{groupChancePercent(group, totalWeight)}%</span>
                    <img src={group.imageUrl} alt={group.name} loading="lazy" />
                    <h4 className="dza-item__name">{group.name}</h4>
                    <span className="dza-item__value">
                      {group.minValueMinor === group.maxValueMinor
                        ? formatMinor(group.minValueMinor, group.currency)
                        : `${formatMinor(group.minValueMinor, group.currency)} – ${formatMinor(group.maxValueMinor, group.currency)}`}
                    </span>
                    <span className="dza-item__wear">{group.items.map(exteriorLabel).join(" · ")}</span>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </section>
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
