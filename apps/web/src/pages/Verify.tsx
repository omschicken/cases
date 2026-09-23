import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

interface VerifyResult {
  verifiable: boolean;
  reason?: string;
  serverSeedHash?: string;
  hashMatches?: boolean;
  itemMatches?: boolean;
  roll?: number;
  valid?: boolean;
}

export function VerifyPage() {
  const { openEventId } = useParams<{ openEventId: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!openEventId) return;
    api
      .get<VerifyResult>(`/cases/open-events/${openEventId}/verify`)
      .then(setResult)
      .catch(() => setError("Could not load this round"));
  }, [openEventId]);

  return (
    <div className="verify-page">
      <h1>Verify round</h1>
      {error && <p className="form-error">{error}</p>}
      {!result && !error && <p>Loading…</p>}
      {result && !result.verifiable && (
        <p>
          {result.reason}
          <br />
          Published server seed hash: <code>{result.serverSeedHash}</code>
        </p>
      )}
      {result && result.verifiable && (
        <div>
          <p className={result.valid ? "verify-ok" : "verify-fail"}>
            {result.valid ? "✅ Verified — this result is genuine." : "❌ Verification failed."}
          </p>
          <ul>
            <li>Server seed hash matches: {String(result.hashMatches)}</li>
            <li>Item matches recomputed roll: {String(result.itemMatches)}</li>
            <li>Roll: {result.roll?.toFixed(8)}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
