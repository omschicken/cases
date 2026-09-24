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

  useEffect(() => {
    if (!slug) return;
    api
      .get<CaseDto>(`/cases/${slug}`)
      .then(setTheCase)
      .catch(() => setError(t("caseDetail.caseNotFound")));
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
  if (!theCase) return <p>{t("common.loading")}</p>;

  const winningItem = result?.item ?? demoItem;
  const spinning = winningItem !== null && !revealed;

  return (
    <div className="case-detail">
      <h1>{theCase.name}</h1>
      <p className="price">{formatMinor(theCase.priceMinor, theCase.currency)}</p>

      {winningItem && (
        <CaseOpeningReel
          key={spinKey}
          poolItems={theCase.items}
          winningItem={winningItem}
          onFinished={() => setRevealed(true)}
        />
      )}

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
        <div className="result-panel" style={{ "--rarity-color": rarityColor(result.item.rarity) } as CSSProperties}>
          <h2>{t("caseDetail.youGot", { name: result.item.name })}</h2>
          <img src={result.item.imageUrl} alt={result.item.name} className="result-image" />
          <p className="value">{formatMinor(result.item.valueMinor, result.item.currency)}</p>
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
        {theCase.items.map((item) => (
          <div
            className="item-card"
            key={item.id}
            style={{ "--rarity-color": rarityColor(item.rarity) } as CSSProperties}
          >
            <img src={item.imageUrl} alt={item.name} />
            <p>{item.name}</p>
            <p className="value">{formatMinor(item.valueMinor, item.currency)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
