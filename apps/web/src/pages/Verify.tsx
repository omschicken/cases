import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { openEventId } = useParams<{ openEventId: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!openEventId) return;
    api
      .get<VerifyResult>(`/cases/open-events/${openEventId}/verify`)
      .then(setResult)
      .catch(() => setError(t("verify.couldNotLoad")));
  }, [openEventId, t]);

  return (
    <div className="verify-page">
      <h1>{t("verify.title")}</h1>
      {error && <p className="form-error">{error}</p>}
      {!result && !error && <p>{t("common.loading")}</p>}
      {result && !result.verifiable && (
        <p>
          {result.reason}
          <br />
          {t("verify.publishedHash")} <code>{result.serverSeedHash}</code>
        </p>
      )}
      {result && result.verifiable && (
        <div>
          <p className={result.valid ? "verify-ok" : "verify-fail"}>
            {result.valid ? t("verify.verified") : t("verify.verificationFailed")}
          </p>
          <ul>
            <li>{t("verify.hashMatches", { value: String(result.hashMatches) })}</li>
            <li>{t("verify.itemMatches", { value: String(result.itemMatches) })}</li>
            <li>{t("verify.roll", { roll: result.roll?.toFixed(8) })}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
