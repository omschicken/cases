import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/dz/PageHeader";

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

/** Same formula the server uses: HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`), first 4 bytes / 2^32. */
async function computeRoll(serverSeed: string, clientSeed: string, nonce: number): Promise<number> {
  const key = await crypto.subtle.importKey("raw", enc.encode(serverSeed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${clientSeed}:${nonce}`)));
  const uint32 = ((mac[0] << 24) | (mac[1] << 16) | (mac[2] << 8) | mac[3]) >>> 0;
  return uint32 / 0x100000000;
}

export function FairPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [serverSeed, setServerSeed] = useState("");
  const [seedHash, setSeedHash] = useState("");
  const [hashResult, setHashResult] = useState<{ ok: boolean; computed: string } | null>(null);

  const [clientSeed, setClientSeed] = useState("");
  const [nonce, setNonce] = useState("0");
  const [roll, setRoll] = useState<number | null>(null);

  async function onCheckHash(e: FormEvent) {
    e.preventDefault();
    const computed = await sha256Hex(serverSeed.trim());
    setHashResult({ ok: computed === seedHash.trim().toLowerCase(), computed });
  }

  async function onComputeRoll(e: FormEvent) {
    e.preventDefault();
    const n = Number(nonce);
    if (!serverSeed.trim() || !Number.isInteger(n) || n < 0) return setRoll(null);
    setRoll(await computeRoll(serverSeed.trim(), clientSeed.trim(), n));
  }

  const steps = [
    {
      icon: "🔒",
      title: t("fair.step1.title", { defaultValue: "1. Сервер фиксирует seed" }),
      text: t("fair.step1.text", {
        defaultValue:
          "До любых открытий сервер создаёт случайный serverSeed и сразу показывает вам его хэш SHA-256. Сам seed остаётся секретным, а хэш — это «запечатанный конверт»: подменить seed потом нельзя, хэш перестанет совпадать.",
      }),
    },
    {
      icon: "🎲",
      title: t("fair.step2.title", { defaultValue: "2. Результат зависит и от вас" }),
      text: t("fair.step2.text", {
        defaultValue:
          "Вы задаёте свой clientSeed. Каждое открытие считает HMAC-SHA256(serverSeed, clientSeed:nonce); nonce растёт на 1 с каждым открытием. Первые 4 байта дают число от 0 до 1, и оно выбирает предмет по весам. Сервер не знает ваш clientSeed заранее, а вы не знаете serverSeed — подогнать результат не может никто.",
      }),
    },
    {
      icon: "✅",
      title: t("fair.step3.title", { defaultValue: "3. Раскрытие и проверка" }),
      text: t("fair.step3.text", {
        defaultValue:
          "Когда вы меняете seed в профиле, сервер раскрывает старый serverSeed. Вы проверяете, что его SHA-256 совпадает с хэшем, который вам показывали ранее, и пересчитываете любой свой бросок ниже.",
      }),
    },
  ];

  return (
    <div className="fair-page">
      <PageHeader
        kicker="DROPZONE / PROVABLY FAIR"
        title={t("fair.title", { defaultValue: "Честная игра" })}
        lede={t("fair.lede", {
          defaultValue: "Результат каждого открытия можно проверить самостоятельно — без доверия к нам на слово.",
        })}
      />

      <section className="fair-steps" aria-label={t("fair.stepsLabel", { defaultValue: "Как это работает" })}>
        {steps.map((s) => (
          <article key={s.title} className="fair-step">
            <span className="fair-step__icon" aria-hidden="true">{s.icon}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </article>
        ))}
      </section>

      <section className="fair-calc">
        <h2>{t("fair.calc.title", { defaultValue: "Калькулятор проверки" })}</h2>

        <form onSubmit={onCheckHash} className="auth-form">
          <h3>{t("fair.calc.hashTitle", { defaultValue: "1. Совпадает ли хэш" })}</h3>
          <label>
            Server Seed
            <input value={serverSeed} onChange={(e) => { setServerSeed(e.target.value); setHashResult(null); }} autoComplete="off" spellCheck={false} />
          </label>
          <label>
            Server Seed Hash
            <input value={seedHash} onChange={(e) => { setSeedHash(e.target.value); setHashResult(null); }} autoComplete="off" spellCheck={false} />
          </label>
          <button type="submit" disabled={!serverSeed.trim() || !seedHash.trim()}>
            {t("fair.calc.check", { defaultValue: "Проверить" })}
          </button>
          {hashResult && (
            <p className={hashResult.ok ? "form-info" : "form-error"} role="status">
              {hashResult.ok
                ? t("fair.calc.match", { defaultValue: "✅ Совпадает" })
                : t("fair.calc.mismatch", { defaultValue: "❌ Не совпадает" })}
              <br />
              <small>SHA-256(serverSeed) = <code>{hashResult.computed}</code></small>
            </p>
          )}
        </form>

        <form onSubmit={onComputeRoll} className="auth-form">
          <h3>{t("fair.calc.rollTitle", { defaultValue: "2. Пересчитать бросок" })}</h3>
          <p className="hint">
            {t("fair.calc.rollHint", {
              defaultValue: "Используется Server Seed из формы выше. Client Seed и nonce берите со страницы открытия.",
            })}
          </p>
          <label>
            Client Seed
            <input value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label>
            Nonce
            <input value={nonce} onChange={(e) => setNonce(e.target.value)} inputMode="numeric" />
          </label>
          <button type="submit" disabled={!serverSeed.trim()}>
            {t("fair.calc.compute", { defaultValue: "Рассчитать" })}
          </button>
          {roll !== null && (
            <p className="form-info" role="status">
              roll = <code>{roll.toFixed(10)}</code>
            </p>
          )}
        </form>
      </section>

      {user && (
        <p className="fair-history-link">
          <Link to="/history">{t("fair.checkMine", { defaultValue: "Проверить своё открытие →" })}</Link>
        </p>
      )}
    </div>
  );
}
