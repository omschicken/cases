import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_LABELS, rarityColor } from "../lib/rarity";
import { useAuth } from "../context/AuthContext";
import { DropProtocol, type ProtocolPhase } from "../components/dz/DropProtocol";
import { EditorialItemImage } from "../components/editorial/EditorialItemImage";
import { caseVersionLabel, resolveCaseArt } from "../lib/caseArt";
import { Money } from "../components/Money";
import "../styles/case-detail-editorial.css";
import "../styles/case-reel.css";
import { REEL_MS } from "../components/CaseReel";
import type { CaseDto, CaseItem, OpenCaseResult } from "../lib/types";

const EXTERIOR_PATTERN = / \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;
const EXTERIOR_SHORT: Record<string, string> = {
  "Factory New": "FN",
  "Minimal Wear": "MW",
  "Field-Tested": "FT",
  "Well-Worn": "WW",
  "Battle-Scarred": "BS",
};

function splitName(name: string): { weapon: string; finish: string } {
  const [weapon, ...rest] = name.replace(EXTERIOR_PATTERN, "").replace(/^★ /, "").split(" | ");
  return { weapon, finish: rest.join(" | ") };
}

function exteriorLabel(item: CaseItem): string {
  const exterior = item.name.match(EXTERIOR_PATTERN)?.[1];
  return exterior ? EXTERIOR_SHORT[exterior] : "BASE";
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

export function CaseDetailPage() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [theCase, setTheCase] = useState<CaseDto | null>(null);
  const [seedHash, setSeedHash] = useState<string | null>(null);
  const [clientSeed, setClientSeed] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<OpenCaseResult | null>(null);
  const [demoItem, setDemoItem] = useState<CaseItem | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  // The staged opening scene is dismissible; the page below keeps the result
  // panel, so closing it never hides the provably-fair record.
  const [protocolDismissed, setProtocolDismissed] = useState(false);
  const openingLockRef = useRef(false);
  const requestPendingRef = useRef(false);
  const skipRequestedRef = useRef(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setTheCase(null);
    setError(null);
    setResult(null);
    setDemoItem(null);
    setRevealed(false);
    api
      .get<CaseDto>(`/cases/${slug}`)
      .then((data) => {
        if (!active) return;
        setTheCase(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setError(t("caseDetail.caseNotFound"));
          return;
        }

        setError(err instanceof ApiError ? err.message : t("caseDetail.couldNotLoadCase", { defaultValue: "Не удалось загрузить кейс" }));
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

  function finishOpening() {
    setOpening(false);
    setRevealed(true);
    openingLockRef.current = false;
    skipRequestedRef.current = false;
  }

  async function openCase() {
    if (!theCase || !theCase.isActive || openingLockRef.current) return;
    openingLockRef.current = true;
    requestPendingRef.current = true;
    skipRequestedRef.current = false;
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
      requestPendingRef.current = false;
      if (skipRequestedRef.current) finishOpening();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("caseDetail.couldNotOpenCase"));
      setOpening(false);
      requestPendingRef.current = false;
      openingLockRef.current = false;
      skipRequestedRef.current = false;
    }
  }

  // No account, no money, no server call — just a client-side preview so
  // visitors can see how it feels before logging in. The item is known
  // immediately, so the chest overlay's reveal step never has to wait.
  function demoSpin() {
    if (!theCase || openingLockRef.current) return;
    openingLockRef.current = true;
    requestPendingRef.current = false;
    skipRequestedRef.current = false;
    setError(null);
    setResult(null);
    setRevealed(false);
    setProtocolDismissed(false);
    setOpening(true);
    setDemoItem(weightedSample(theCase.items));
  }

  const winningItem = result?.item ?? demoItem;

  useEffect(() => {
    if (!opening || !winningItem || requestPendingRef.current || skipRequestedRef.current) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : REEL_MS + 700;
    const timer = window.setTimeout(() => {
      setOpening(false);
      setRevealed(true);
      openingLockRef.current = false;
      skipRequestedRef.current = false;
    }, duration);
    return () => window.clearTimeout(timer);
  }, [opening, winningItem]);

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
    skipRequestedRef.current = true;
    if (!requestPendingRef.current && winningItem) finishOpening();
  }
  const sortedItems = [...theCase.items].sort((a, b) => Number(BigInt(b.valueMinor) - BigInt(a.valueMinor)));
  const version = caseVersionLabel(theCase.slug);

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
          caseImageUrl={resolveCaseArt(theCase.slug, theCase.imageUrl)}
          reelItems={theCase.items}
          onSkip={skipAnimation}
          onClose={() => setProtocolDismissed(true)}
          onOpenAgain={openCase}
          canOpenAgain={Boolean(user) && theCase.isActive}
        />
      )}
      {/* Editorial detail header */}
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

      <section id="opening-station" className="dza-arena dze-product" aria-label={t("caseDetail.openingStation", { defaultValue: "Case opening" })}>
        <div className="dza-arena__stage dze-studio">
          <img className="dze-studio__art" src={resolveCaseArt(theCase.slug, theCase.imageUrl)} alt={theCase.name} />
        </div>

        <div className="dza-arena__panel dze-product__info">
          <span className="dze-eyebrow">● {t("caseDetail.crumbCases", { defaultValue: "Кейсы" })}{version ? ` / ${version}` : ""}</span>
          <h1 className="dze-title">{theCase.name.replace(/\s*case$/i, "")} <span>Case.</span></h1>
          <p className="dze-description">{t("caseDetail.editorialDescription", { defaultValue: "Изучи содержимое коллекции, реальные шансы и выбери свой следующий предмет." })}</p>
          <div className="dze-meta"><div><small>{t("caseDetail.status", { defaultValue: "СТАТУС" })}</small><strong>{theCase.isActive ? t("caseDetail.available", { defaultValue: "Доступен" }) : t("caseDetail.unavailable", { defaultValue: "Недоступен" })}</strong></div><div><small>{t("caseDetail.mode", { defaultValue: "РЕЖИМ" })}</small><strong>{t("caseDetail.openingStation", { defaultValue: "Открытие кейса" })}</strong></div></div>
          <div className="dza-arena__price">
            <span className="dza-arena__label">{t("caseDetail.casePrice", { defaultValue: "Цена" })}</span>
            <Money minor={theCase.priceMinor} currency={theCase.currency} />
            <span className="dza-arena__label">{t("caseDetail.provablyFair")}</span>
          </div>

          {user ? (
            <>
              <button onClick={openCase} disabled={opening || !theCase.isActive} className="dza-open">
                {!theCase.isActive ? t("caseDetail.unavailable", { defaultValue: "Недоступен" }) : opening ? t("caseDetail.rolling") : t("caseDetail.open", { defaultValue: "Открыть" })}
              </button>
              <button onClick={demoSpin} disabled={opening} className="dza-demo">
                {t("caseDetail.demoSpin")}
              </button>
            </>
          ) : (
            <>
              <button onClick={demoSpin} disabled={opening} className="dza-open">
                {opening ? t("caseDetail.rolling") : t("caseDetail.demoSpin")}
              </button>
              <p className="dza-hint">
                <>{t("caseDetail.demoHint")} <Link to="/login">{t("caseDetail.logIn")}</Link></>
              </p>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
        </div>
      </section>

      {revealed && winningItem && (
        <section
          className="dz-record"
          role="status"
          aria-live="polite"
          style={{ "--dz-rarity": rarityColor(winningItem.rarity) } as CSSProperties}
        >
          <EditorialItemImage className="dz-record__art" name={winningItem.name} imageUrl={winningItem.imageUrl} decorative loading="eager" />
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
                  <Link to="/inventory" className="dz-btn">{t("caseDetail.claim", { defaultValue: "Забрать в инвентарь" })}</Link>
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
            {String(theCase.items.length).padStart(2, "0")}
          </span>
        </div>
        <div className="dza-grid">
          {sortedItems.map((item) => {
            const { weapon, finish } = splitName(item.name);
            return (
              <article key={item.id} className="dza-tile" style={{ "--rc": rarityColor(item.rarity) } as CSSProperties}>
                <div className="dza-tile__top">
                  <span className="dza-tile__wear">{exteriorLabel(item)}</span>
                  <span className="dza-tile__chance">{dropChancePercent(item, theCase.items)}%</span>
                </div>
                <EditorialItemImage name={item.name} imageUrl={item.imageUrl} />
                <span className="dza-tile__weapon">{weapon}</span>
                <h4 className="dza-tile__name">{finish || weapon}</h4>
                <span className="dza-tile__value">{formatMinor(item.valueMinor, item.currency)}</span>
              </article>
            );
          })}
        </div>
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
