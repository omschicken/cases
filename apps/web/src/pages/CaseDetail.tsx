import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import { useAuth } from "../context/AuthContext";
import { CaseOpeningReel } from "../components/CaseOpeningReel";
import type { CaseDto, OpenCaseResult } from "../lib/types";

export function CaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [theCase, setTheCase] = useState<CaseDto | null>(null);
  const [seedHash, setSeedHash] = useState<string | null>(null);
  const [clientSeed, setClientSeed] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<OpenCaseResult | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .get<CaseDto>(`/cases/${slug}`)
      .then(setTheCase)
      .catch(() => setError("Case not found"));
  }, [slug]);

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
      setError(err instanceof ApiError ? err.message : "Could not open case");
    } finally {
      setOpening(false);
    }
  }

  if (error && !theCase) return <p className="form-error">{error}</p>;
  if (!theCase) return <p>Loading…</p>;

  const spinning = result !== null && !revealed;

  return (
    <div className="case-detail">
      <h1>{theCase.name}</h1>
      <p className="price">{formatMinor(theCase.priceMinor, theCase.currency)}</p>

      {result && (
        <CaseOpeningReel
          key={spinKey}
          poolItems={theCase.items}
          winningItem={result.item}
          onFinished={() => setRevealed(true)}
        />
      )}

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

      {user ? (
        <button onClick={openCase} disabled={opening || spinning} className="open-button">
          {opening ? "Rolling…" : spinning ? "Spinning…" : `Open for ${formatMinor(theCase.priceMinor, theCase.currency)}`}
        </button>
      ) : (
        <p>
          <Link to="/login">Log in</Link> to open this case.
        </p>
      )}

      {error && <p className="form-error">{error}</p>}

      {seedHash && (
        <div className="fairness-panel">
          <h3>Provably fair</h3>
          <p>
            Server seed commitment (published before this roll):
            <br />
            <code>{seedHash}</code>
          </p>
          <p>
            Your client seed: <code>{clientSeed}</code>
          </p>
          <p>
            Rotate your seed on the <Link to="/profile">Profile</Link> page to reveal the server seed and
            verify any past opening.
          </p>
        </div>
      )}

      {result && revealed && (
        <div className="result-panel" style={{ "--rarity-color": rarityColor(result.item.rarity) } as CSSProperties}>
          <h2>You got: {result.item.name}</h2>
          <img src={result.item.imageUrl} alt={result.item.name} className="result-image" />
          <p className="value">{formatMinor(result.item.valueMinor, result.item.currency)}</p>
          <details>
            <summary>Round details</summary>
            <ul>
              <li>Roll: {result.roll.toFixed(8)}</li>
              <li>Nonce: {result.nonce}</li>
              <li>Server seed hash: {result.serverSeedHash}</li>
              <li>Client seed: {result.clientSeed}</li>
              <li>
                <Link to={`/verify/${result.openEventId}`}>Verify this result</Link>
              </li>
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
