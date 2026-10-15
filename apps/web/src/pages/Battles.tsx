import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CaseChest } from "../components/CaseChest";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { rarityColor } from "../lib/rarity";
import type { CaseDto, CaseItem, GameOperationDto, WalletDto } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { SelectableItem, Gate, Step } from "../components/dz/SelectableItem";

type BattleResult = { operation: GameOperationDto; won: boolean; battleCase: { id: string; name: string }; playerItem: CaseItem; botItem: CaseItem; winnings: string[] };

export function BattlesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<BattleResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<CaseDto[]>("/cases"), user ? api.get<WalletDto>("/wallet/me") : Promise.resolve(null)])
      .then(([nextCases, nextWallet]) => { setCases(nextCases); setWallet(nextWallet); setSelectedId(nextCases[0]?.id ?? ""); })
      .catch(() => setError(t("battles.loadError")))
      .finally(() => setLoading(false));
  }, [user, t]);

  const selected = cases.find((item) => item.id === selectedId);
  const visibleCases = cases.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  async function startBattle() {
    if (!selected || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setError(null); setResult(null);
    try {
      const next = await api.post<BattleResult>("/games/battles", { caseId: selected.id });
      setResult(next); setConfirming(false);
      setWallet(await api.get<WalletDto>("/wallet/me").catch(() => null));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? t("battles.networkError") : err instanceof ApiError ? err.message : t("battles.startError"));
    } finally { submittingRef.current = false; setSubmitting(false); }
  }

  if (!user) return (
    <Gate
      kicker="DROPZONE / BATTLES"
      title={t("battles.title")}
      body={t("battles.authBody")}
      action={<Link to="/login" className="dz-commit">{t("nav.signIn")} <span aria-hidden="true">↗</span></Link>}
    />
  );

  return (
    <div className="dz-workspace">
      <PageHeader
        kicker={t("battles.kicker")}
        title={t("battles.title")}
        lede={t("battles.lede")}
        aside={<Readout label={t("battles.balance")} value={wallet ? formatMinor(wallet.balanceMinor) : "…"} />}
      />

      {error && (
        <div role="alert" style={{ margin: "var(--dz-s4) 0", padding: "var(--dz-s3) var(--dz-s4)", border: "1px solid var(--dz-danger)", borderRadius: "var(--dz-r-sm)", color: "var(--dz-danger)", fontSize: "var(--dz-type-sm)" }}>
          {error}
        </div>
      )}

      {result && (
        <section
          className={`dz-outcome dz-outcome--${result.won ? "won" : "lost"}`}
          role="status"
          aria-live="polite"
          style={{ display: "block" }}
        >
          <span className="dz-outcome__label">{result.won ? t("battles.win") : t("battles.loss")}</span>
          <h2 className="dz-outcome__name">{result.battleCase.name}</h2>
          <div className="dz-versus">
            <BattleDrop label={t("battles.you")} item={result.playerItem} />
            <span className="dz-versus__mark">{result.won ? "WIN" : "LOSE"}</span>
            <BattleDrop label={t("battles.bot")} item={result.botItem} />
          </div>
        </section>
      )}

      <div className="dz-workspace__layout">
        <section>
          <Step label={t("battles.step1")} count={t("battles.available", { count: cases.length })} />

          {cases.length > 8 && (
            <label className="dz-field">
              <span>{t("battles.searchLabel")}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("battles.searchPlaceholder")}
                aria-label={t("battles.searchLabel")}
              />
            </label>
          )}

          {loading ? (
            <p style={{ color: "var(--dz-text-4)", fontSize: "var(--dz-type-sm)" }}>{t("common.loading")}</p>
          ) : visibleCases.length === 0 ? (
            <div className="dz-empty">
              <span className="dz-empty__mark" aria-hidden="true">⌕</span>
              <h2 className="dz-empty__title">{t("battles.noResults")}</h2>
              <p className="dz-empty__body">{t("battles.noResultsBody")}</p>
              <button type="button" className="dz-btn" onClick={() => setQuery("")}>
                {t("battles.resetSearch")} ↗
              </button>
            </div>
          ) : (
            <div className="dz-pick-grid">
              {visibleCases.map((item) => (
                <SelectableItem
                  key={item.id}
                  name={item.name}
                  value={formatMinor(item.priceMinor, item.currency)}
                  note={`${String(item.itemCount ?? item.items.length).padStart(2, "0")} ${t("battles.drops")}`}
                  selected={selectedId === item.id}
                  disabled={submitting}
                  onSelect={() => { setSelectedId(item.id); setResult(null); setConfirming(false); }}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="dz-summary">
          <span className="dz-summary__label">{t("battles.step2")}</span>
          <div className="battle-players">
            <div>
              <i>{user.displayName?.[0] ?? user.email[0]}</i>
              <span>{t("battles.you")}</span>
            </div>
            <b>VS</b>
            <div>
              <i>AI</i>
              <span>{t("battles.bot")}</span>
            </div>
          </div>
          <dl className="dz-summary__rows">
            <div className="dz-summary__row"><dt>{t("battles.caseLabel")}</dt><dd>{selected?.name ?? "—"}</dd></div>
            <div className="dz-summary__row"><dt>{t("battles.entryLabel")}</dt><dd>{selected ? formatMinor(selected.priceMinor, selected.currency) : "—"}</dd></div>
            <div className="dz-summary__row"><dt>{t("battles.roundsLabel")}</dt><dd>1</dd></div>
          </dl>
          {confirming ? (
            <div className="dz-confirm">
              <button type="button" className="dz-commit" disabled={submitting} onClick={() => void startBattle()}>
                {submitting ? t("battles.battling") : t("battles.confirm")}
              </button>
              <button type="button" className="dz-confirm__cancel" disabled={submitting} onClick={() => setConfirming(false)}>
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <button type="button" className="dz-commit" disabled={!selected} onClick={() => setConfirming(true)}>
              {t("battles.start")}
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function BattleDrop({ label, item }: { label: string; item: CaseItem }) {
  return (
    <article
      className="battle-drop"
      style={{ "--dz-rarity": rarityColor(item.rarity), "--rarity-color": rarityColor(item.rarity) } as CSSProperties}
    >
      <span>{label}</span>
      <img src={item.imageUrl} alt={item.name} />
      <strong>{item.name}</strong>
      <b>{formatMinor(item.valueMinor, item.currency)}</b>
    </article>
  );
}
