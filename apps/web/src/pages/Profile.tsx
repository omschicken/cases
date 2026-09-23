import { FormEvent, useEffect, useState } from "react";
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
      setInfo("Verification submitted — an admin will review it shortly.");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Submission failed");
    }
  }

  async function rotateSeed(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.post("/cases/seed/rotate", { nextClientSeed: nextClientSeed || undefined });
      setInfo("Seed rotated — your previous server seed is now revealed and verifiable.");
      setNextClientSeed("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rotate seed");
    }
  }

  return (
    <div className="profile-page">
      <h1>Profile</h1>
      <p>{user?.email}</p>

      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-info">{info}</p>}

      <section>
        <h2>Identity verification (KYC)</h2>
        <p>
          Status: <strong>{kyc?.status ?? "…"}</strong>
        </p>
        {kyc?.latest?.rejectionReason && <p className="form-error">Reason: {kyc.latest.rejectionReason}</p>}
        {(kyc?.status === "UNVERIFIED" || kyc?.status === "REJECTED") && (
          <form onSubmit={submitKyc} className="auth-form">
            <label>
              Full legal name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>
            <label>
              Date of birth
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
              />
            </label>
            <label>
              Document photo URL (front)
              <input
                type="url"
                value={documentFrontUrl}
                onChange={(e) => setDocumentFrontUrl(e.target.value)}
                required
              />
            </label>
            <label>
              Selfie URL
              <input type="url" value={selfieUrl} onChange={(e) => setSelfieUrl(e.target.value)} required />
            </label>
            <p className="hint">
              Document upload isn't wired to storage yet — paste a URL for now (see README).
            </p>
            <button type="submit">Submit for review</button>
          </form>
        )}
      </section>

      <section>
        <h2>Provably fair seed</h2>
        {seed && (
          <ul>
            <li>Server seed hash: {seed.serverSeedHash}</li>
            <li>Client seed: {seed.clientSeed}</li>
            <li>Rounds played on this seed: {seed.nonce}</li>
          </ul>
        )}
        <form onSubmit={rotateSeed} className="auth-form">
          <label>
            New client seed (optional)
            <input value={nextClientSeed} onChange={(e) => setNextClientSeed(e.target.value)} />
          </label>
          <button type="submit">Rotate seed &amp; reveal previous</button>
        </form>
      </section>
    </div>
  );
}
