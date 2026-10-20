import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_LABELS, rarityColor } from "../lib/rarity";
import { useAuth } from "../context/AuthContext";
import { CaseOpeningScene } from "../components/CaseOpeningScene";
import { EditorialItemImage } from "../components/editorial/EditorialItemImage";

import { Money } from "../components/Money";
import "../styles/case-detail-editorial.css";
import "../styles/case-reel.css";
import "../styles/case-opening-scene.css";
import "../styles/casecrow-polish.css";
import type { CaseDto, CaseItem, OpenCaseResult } from "../lib/types";
import { clearOpening, loadOpening, saveOpening } from "../lib/openingRecovery";

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
  const [batchResults, setBatchResults] = useState<OpenCaseResult[]>([]);
  const [openCount, setOpenCount] = useState<1 | 3 | 5>(1);
  const [fastOpen, setFastOpen] = useState(false);
  const [demoItem, setDemoItem] = useState<CaseItem | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);
  const [recoveryPending, setRecoveryPending] = useState(false);
  // Opening results are server-authoritative and remain recoverable after navigation.

  const openingLockRef = useRef(false);
  const requestPendingRef = useRef(false);
  const skipRequestedRef = useRef(false);

  useEffect(() => {
    if (!theCase || !user) return;
    const receipt = loadOpening(user.id, theCase.id);
    setRecoveryPending(Boolean(receipt && !receipt.result));
    if (receipt?.result) {
      setResult(receipt.result);
      setBatchResults(receipt.results ?? [receipt.result]);
      setRevealed(true);

    }
  }, [theCase, user]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setTheCase(null);
    setError(null);
    setResult(null);
    setBatchResults([]);
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
    if (!theCase || !user || !theCase.isActive || theCase.canOpen === false || recoveryPending || openingLockRef.current) return;
    openingLockRef.current = true;
    requestPendingRef.current = true;
    skipRequestedRef.current = false;
    setError(null);
    setOpening(true);
    setRevealed(false);
    setResult(null);
    setDemoItem(null);

    const startedAt = Date.now();
    saveOpening(user.id, theCase.id, { startedAt });
    try {
      // Only the server decides the result. The reel mounts once this
      // response arrives and presents that exact item.
      if (openCount === 1) {
        const response = await api.post<OpenCaseResult>("/cases/open", { caseId: theCase.id });
        saveOpening(user.id, theCase.id, { startedAt, result: response });
        setResult(response);
        setBatchResults([response]);
        requestPendingRef.current = false;
        if (fastOpen || skipRequestedRef.current) finishOpening();
      } else {
        const response = await api.post<{ results: OpenCaseResult[] }>("/cases/open-batch", { caseId: theCase.id, count: openCount });
        if (response.results.length !== openCount) throw new Error("Неполный ответ на открытие. Проверьте инвентарь.");
        saveOpening(user.id, theCase.id, { startedAt, result: response.results[0], results: response.results });
        setResult(response.results[0]);
        setBatchResults(response.results);
        requestPendingRef.current = false;
        finishOpening();
      }
    } catch (err) {
      const uncertain = !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
      if (uncertain) setRecoveryPending(true);
      else clearOpening(user.id, theCase.id);
      setError(err instanceof ApiError ? err.message : t("caseDetail.couldNotOpenCase"));
      setOpening(false);
      requestPendingRef.current = false;
      openingLockRef.current = false;
      skipRequestedRef.current = false;
    }
  }

  // A visual-only demo: no server request, balance change or inventory item.
  function demoSpin() {
    if (!theCase || !theCase.items.length || openingLockRef.current) return;
    openingLockRef.current = true;
    requestPendingRef.current = false;
    skipRequestedRef.current = false;
    setError(null);
    setResult(null);
    setBatchResults([]);
    setRevealed(false);

    setOpening(true);
    setDemoItem(weightedSample(theCase.items));
  }

  const winningItem = result?.item ?? demoItem;

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

  /** Skip presentation, never the pending server request or its fixed result. */
  function skipAnimation() {
    skipRequestedRef.current = true;
    if (!requestPendingRef.current && winningItem) finishOpening();
  }
  const sortedItems = [...theCase.items].sort((a, b) => Number(BigInt(b.valueMinor) - BigInt(a.valueMinor)));


  return (
    <div
      className="case-detail"
      data-rarity={revealed && winningItem ? winningItem.rarity : undefined}
    >
      <CaseOpeningScene theCase={theCase} winner={winningItem} opening={opening} onComplete={finishOpening} onSkip={skipAnimation}
        actions={<>
          <div className="cc-opening-controls" aria-label="Параметры открытия">
            <div className="cc-opening-multipliers" role="group" aria-label="Количество кейсов">
              {([1, 3, 5] as const).map(count => <button key={count} type="button" className={openCount === count ? "is-active" : ""} disabled={opening || recoveryPending} aria-pressed={openCount === count} onClick={() => setOpenCount(count)}>×{count}</button>)}
            </div>
            <label className="cc-fast-toggle"><input type="checkbox" checked={fastOpen} onChange={event => setFastOpen(event.target.checked)} disabled={opening} />Быстро</label>
          </div>
          <span className="cc-case-price"><Money minor={(BigInt(theCase.priceMinor) * BigInt(openCount)).toString()} currency={theCase.currency} /></span>
          {user ? (
            <>
              <button onClick={openCase} disabled={opening || recoveryPending || !theCase.isActive || theCase.canOpen === false} className="dza-open">
                {!theCase.isActive || theCase.canOpen === false ? t("caseDetail.unavailable", { defaultValue: "Недоступен" }) : opening ? t("caseDetail.rolling") : `Открыть ×${openCount}`}
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
          {error && <p className="form-error" role="alert">{error}</p>}
          {recoveryPending && user && <div className="dze-recovery" role="status">
            <p>{t("caseDetail.recoveryPending", { defaultValue: "Ответ на предыдущее открытие не получен. Проверь инвентарь перед новым открытием: предмет мог уже поступить." })}</p>
            <Link to="/inventory">{t("caseDetail.claim", { defaultValue: "В инвентарь" })}</Link>
            <button type="button" onClick={() => { clearOpening(user.id, theCase.id); setRecoveryPending(false); setError(null); }}>
              {t("caseDetail.recoveryChecked", { defaultValue: "Я проверил инвентарь" })}
            </button>
          </div>} </>}
        resultView={revealed && winningItem ? <>      {revealed && winningItem && (
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
      )}</> : null}
      />

      {revealed && batchResults.length > 1 && (
        <section className="cc-batch-results" aria-label="Полученные предметы" role="status">
          <div className="cc-batch-heading"><h2>Получено {batchResults.length} предметов</h2><Link to="/inventory">Перейти в инвентарь →</Link></div>
          <div className="cc-batch-grid">{batchResults.map((entry, index) => (
            <article key={entry.openEventId} className="cc-batch-card">
              <span className="cc-batch-index">{String(index + 1).padStart(2, "0")} / {batchResults.length}</span>
              <EditorialItemImage name={entry.item.name} imageUrl={entry.item.imageUrl} decorative />
              <strong>{entry.item.name}</strong>
              <span>{formatMinor(entry.item.valueMinor, entry.item.currency)}</span>
            </article>
          ))}</div>
        </section>
      )}

      {seedHash && (
        <details className="dz-panel cc-opening-audit"><summary>Проверка результата и сведения о генерации</summary><div>
          <h3>Техническая проверка</h3>
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
        </div></details>
      )}

      {/* ZONE 3 — contents */}
      <section id="all-case-items" className="dza-items" aria-labelledby="dza-items-title">
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

