import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import type { KycStatus } from "../lib/types";

interface KycMeResponse {
  status: KycStatus;
  latest: { status: KycStatus; rejectionReason?: string } | null;
}

interface SeedInfo {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [kyc, setKyc] = useState<KycMeResponse | null>(null);
  const [seed, setSeed] = useState<SeedInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [documentFrontUrl, setDocumentFrontUrl] = useState("");
  const [selfieUrl, setSelfieUrl] = useState("");

  const [nextClientSeed, setNextClientSeed] = useState("");

  function load() {
    api.get<KycMeResponse>("/kyc/me").then(setKyc).catch(() => undefined);
    api.get<SeedInfo>("/cases/seed/me").then(setSeed).catch(() => undefined);
  }

  useEffect(load, []);

  async function submitKyc(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.post("/kyc/submit", {
        fullName,
        dateOfBirth,
        documentType: "PASSPORT",
        documentFrontUrl,
        selfieUrl,
      });
      setInfo(t("profile.kyc.submitted"));
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.kyc.submitFailed"));
    }
  }

  async function rotateSeed(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.post("/cases/seed/rotate", { nextClientSeed: nextClientSeed || undefined });
      setInfo(t("profile.seed.rotated"));
      setNextClientSeed("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.seed.rotateFailed"));
    }
  }

  return (
    <div className="profile-page">
      <h1>{t("profile.title")}</h1>
      <p>{user?.email}</p>

      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-info">{info}</p>}

      <section>
        <h2>{t("profile.kyc.heading")}</h2>
        <p>
          {t("profile.kyc.status")} <strong>{kyc?.status ?? "…"}</strong>
        </p>
        {kyc?.latest?.rejectionReason && (
          <p className="form-error">{t("profile.kyc.reason", { reason: kyc.latest.rejectionReason })}</p>
        )}
        {(kyc?.status === "UNVERIFIED" || kyc?.status === "REJECTED") && (
          <form onSubmit={submitKyc} className="auth-form">
            <label>
              {t("profile.kyc.fullName")}
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              {t("profile.kyc.dob")}
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </label>
            <label>
              {t("profile.kyc.docFront")}
              <input
                type="url"
                value={documentFrontUrl}
                onChange={(e) => setDocumentFrontUrl(e.target.value)}
                required
              />
            </label>
            <label>
              {t("profile.kyc.selfie")}
              <input type="url" value={selfieUrl} onChange={(e) => setSelfieUrl(e.target.value)} required />
            </label>
            <p className="hint">{t("profile.kyc.uploadHint")}</p>
            <button type="submit">{t("profile.kyc.submit")}</button>
          </form>
        )}
      </section>

      <section>
        <h2>{t("profile.seed.heading")}</h2>
        {seed && (
          <ul>
            <li>{t("profile.seed.serverSeedHash", { hash: seed.serverSeedHash })}</li>
            <li>{t("profile.seed.clientSeed", { seed: seed.clientSeed })}</li>
            <li>{t("profile.seed.roundsPlayed", { n: seed.nonce })}</li>
          </ul>
        )}
        <form onSubmit={rotateSeed} className="auth-form">
          <label>
            {t("profile.seed.newClientSeed")}
            <input value={nextClientSeed} onChange={(e) => setNextClientSeed(e.target.value)} />
          </label>
          <button type="submit">{t("profile.seed.rotateButton")}</button>
        </form>
      </section>
    </div>
  );
}
