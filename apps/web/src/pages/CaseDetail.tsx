import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import { useAuth } from "../context/AuthContext";
import { CaseOpeningReel } from "../components/CaseOpeningReel";
import type { CaseDto, CaseItem, OpenCaseResult } from "../lib/types";

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
  const [seedHash, setSeedHash] = useState<string | null>(null);
  const [clientSeed, setClientSeed] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<OpenCaseResult | null>(null);
  const [demoItem, setDemoItem] = useState<CaseItem | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!slug) return;
    api
      .get<CaseDto>(`/cases/${slug}`)
      .then(setTheCase)
      .catch(() => {
        setTheCase(previewCase(slug));
      });
  }, [slug, t]);

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
    if (!theCase) return;
    setError(null);
    setOpening(true);
    setRevealed(false);
    setResult(null);
    try {
      // The result is fully determined here — the reel below just animates
      // toward it, it never influences the outcome.
      const res = await api.post<OpenCaseResult>("/cases/open", { caseId: theCase.id });
      setResult(res);
      setSpinKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("caseDetail.couldNotOpenCase"));
    } finally {
      setOpening(false);
    }
  }

  // No account, no money, no server call — just a client-side preview of the
  // reel so visitors can see how it feels before logging in.
  function demoSpin() {
    if (!theCase) return;
    setRevealed(false);
    setDemoItem(weightedSample(theCase.items));
    setSpinKey((k) => k + 1);
  }

  if (error && !theCase) return <p className="form-error">{error}</p>;
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

  return (
    <div className="case-detail">
      <h1>{theCase.name}</h1>
      <p className="price">{formatMinor(theCase.priceMinor, theCase.currency)}</p>

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
          onFinished={() => setRevealed(true)}
          quick={quickSpin}
        />
      )}

      <div className="spin-mode-toggle" role="group">
        <button
          type="button"
          className={!quickSpin ? "active" : ""}
          onClick={() => toggleQuickSpin(false)}
          disabled={spinning}
        >
          {t("caseDetail.spinFull")}
        </button>
        <button
          type="button"
          className={quickSpin ? "active" : ""}
          onClick={() => toggleQuickSpin(true)}
          disabled={spinning}
        >
          {t("caseDetail.spinQuick")}
        </button>
      </div>

      {user ? (
        <button onClick={openCase} disabled={opening || spinning} className="open-button">
          {opening
            ? t("caseDetail.rolling")
            : spinning
              ? t("caseDetail.spinning")
              : t("caseDetail.openFor", { price: formatMinor(theCase.priceMinor, theCase.currency) })}
        </button>
      ) : (
        <>
          <button onClick={demoSpin} disabled={spinning} className="open-button demo-button">
            {spinning ? t("caseDetail.spinning") : t("caseDetail.demoSpin")}
          </button>
          <p className="hint">
            {t("caseDetail.demoHint")} <Link to="/login">{t("caseDetail.logIn")}</Link>
          </p>
        </>
      )}

      {error && <p className="form-error">{error}</p>}

      {result && revealed && (
        <div className="result-panel" role="status" aria-live="polite" style={{ "--rarity-color": rarityColor(result.item.rarity) } as CSSProperties}>
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
        <div className="result-panel demo-result" style={{ "--rarity-color": rarityColor(demoItem.rarity) } as CSSProperties}>
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

      <h2 className="section-heading">{t("caseDetail.itemsHeading")}</h2>
      <div className="item-grid">
        {theCase.items.map((item, i) => (
          <div
            className="item-card"
            key={item.id}
            style={{ "--rarity-color": rarityColor(item.rarity), "--index": i } as CSSProperties}
          >
            <span className="item-chance-badge">{dropChancePercent(item, theCase.items)}%</span>
            <img src={item.imageUrl} alt={item.name} />
            <p>{item.name}</p>
            <p className="value">{formatMinor(item.valueMinor, item.currency)}</p>
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
  const decimals = pct < 1 ? 2 : 1;
  return pct.toFixed(decimals).replace(/\.?0+$/, "");
}
