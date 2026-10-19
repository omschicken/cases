import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GameEmptyState } from "../components/GameEmptyState";
import { GameSteps } from "../components/GameSteps";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_LABELS, rarityColor } from "../lib/rarity";
import type { CaseItem, GameOperationDto, InventoryItemDto } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { SelectableItem, Step, Gate } from "../components/dz/SelectableItem";

type UpgradeResult = { operation: GameOperationDto; won: boolean; item: CaseItem | null; target: CaseItem; chance: number };

/** Roll staging: bar fills to the win chance, the marker lands on the real roll, then the verdict. */
function UpgradeRollOverlay({
  roll, onClose, t,
}: {
  roll: { data: UpgradeResult; stage: "roll" | "done"; lost?: { name: string; imageUrl: string } };
  onClose: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { data, stage, lost } = roll;
  const chancePct = data.chance * 100;
  const rollPct = Math.min(100, data.operation.roll * 100);
  const done = stage === "done";
  return (
    <div className={`upgrade-roll${done ? (data.won ? " is-won" : " is-lost") : ""}`} role="dialog" aria-modal="true" aria-live="polite">
      <div className="upgrade-roll__panel">
        {!done ? (
          <>
            <span className="upgrade-roll__label">{t("upgrader.ux.rolling", { defaultValue: "Бросок…" })}</span>
            <div className="upgrade-roll__bar" style={{ "--chance": `${chancePct}%`, "--roll": `${rollPct}%` } as CSSProperties}>
              <span className="upgrade-roll__zone" />
              <span className="upgrade-roll__marker" />
            </div>
            <span className="upgrade-roll__pct">{chancePct.toFixed(1)}%</span>
          </>
        ) : (
          <>
            {data.won && <div className="dz-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>}
            <span className="upgrade-roll__verdict">
              {data.won ? t("upgrader.won") : t("upgrader.lost")}
            </span>
            <div className="upgrade-roll__item">
              {data.won && data.item ? (
                <img className="upgrade-roll__win" src={data.item.imageUrl} alt="" />
              ) : (
                lost && <img className="upgrade-roll__shatter" src={lost.imageUrl} alt="" />
              )}
            </div>
            <strong className="upgrade-roll__name">{data.won && data.item ? data.item.name : lost?.name}</strong>
            <span className="upgrade-roll__meta">
              ROLL {data.operation.roll.toFixed(5)} / {chancePct.toFixed(1)}%
            </span>
            <button type="button" className="upgrade-core__btn" onClick={onClose} autoFocus>
              {t("upgrader.ux.retry", { defaultValue: "Попробовать ещё" })}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function UpgraderPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItemDto[]>([]);
  const [targets, setTargets] = useState<CaseItem[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [loading, setLoading] = useState(Boolean(user));
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpgradeResult | null>(null);
  // Roll overlay: the outcome is already decided server-side; this only stages it.
  const [roll, setRoll] = useState<{ data: UpgradeResult; stage: "roll" | "done"; lost?: { name: string; imageUrl: string } } | null>(null);
  const rollTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(rollTimer.current), []);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.get<InventoryItemDto[]>("/cases/inventory/me"), api.get<CaseItem[]>("/games/upgrade-targets")])
      .then(([items, nextTargets]) => { setInventory(items); setTargets(nextTargets); })
      .catch(() => setError(t("upgrader.loadError")))
      .finally(() => setLoading(false));
  }, [user, t]);

  const source = inventory.find((item) => item.id === sourceId);
  const eligibleTargets = useMemo(
    () => source ? targets.filter((item) => BigInt(item.valueMinor) > BigInt(source.caseItem.valueMinor)).slice(0, 120) : [],
    [source, targets]
  );
  const target = eligibleTargets.find((item) => item.id === targetId);
  const chance = source && target
    ? Math.max(.01, Math.min(.75, Number(BigInt(source.caseItem.valueMinor) * 90_000n / BigInt(target.valueMinor)) / 100_000))
    : 0;

  const multiplier = source && target ? Number(BigInt(target.valueMinor) * 100n / BigInt(source.caseItem.valueMinor)) / 100 : 0;

  async function execute() {
    if (!source || !target || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setError(null);
    try {
      const next = await api.post<UpgradeResult>("/games/upgrades", { inventoryItemId: source.id, targetCaseItemId: target.id });
      setResult(next);
      setRoll({ data: next, stage: "roll", lost: { name: source.caseItem.name, imageUrl: source.caseItem.imageUrl } });
      clearTimeout(rollTimer.current);
      rollTimer.current = setTimeout(() => setRoll((r) => (r ? { ...r, stage: "done" } : r)), 2100);
      setInventory((items) => items.filter((item) => item.id !== source.id));
      setSourceId(""); setTargetId(""); setConfirming(false);
      const currentItems = await api.get<InventoryItemDto[]>("/cases/inventory/me").catch(() => null);
      if (currentItems) setInventory(currentItems);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? t("upgrader.networkError") : err instanceof ApiError ? err.message : t("upgrader.executeError"));
    } finally { submittingRef.current = false; setSubmitting(false); }
  }

  if (!user) return (
    <Gate
      kicker="CASECROW / UPGRADER"
      title={t("upgrader.title")}
      body={t("upgrader.authBody")}
      action={<Link to="/login" className="dz-commit">{t("nav.signIn")} <span aria-hidden="true">↗</span></Link>}
    />
  );

  return (
    <div className="dz-workspace">
      <PageHeader
        kicker={t("upgrader.kicker")}
        title={t("upgrader.title")}
        lede={t("upgrader.lede")}
        aside={<Readout label={t("upgrader.chance")} value={`${(chance * 100).toFixed(1)}${t("upgrader.chanceSuffix")}`} />}
      />

      {error && (
        <div role="alert" style={{ margin: "var(--dz-s4) 0", padding: "var(--dz-s3) var(--dz-s4)", border: "1px solid var(--dz-danger)", borderRadius: "var(--dz-r-sm)", color: "var(--dz-danger)", fontSize: "var(--dz-type-sm)" }}>
          {error}
        </div>
      )}


      {loading ? (
        <p style={{ color: "var(--dz-text-4)", fontSize: "var(--dz-type-sm)" }}>{t("common.loading")}</p>
      ) : (
        <div className="upgrade-layout">
          <section>
            <Step label={t("upgrader.ux.yourItem", { defaultValue: "Ваш предмет" })} count={inventory.length} />
            {source && (
              <div className="upgrade-selected" style={{ "--dz-rarity": rarityColor(source.caseItem.rarity) } as CSSProperties}>
                <img src={source.caseItem.imageUrl} alt="" />
                <strong>{source.caseItem.name}</strong>
                <span>{formatMinor(source.caseItem.valueMinor, source.caseItem.currency)}</span>
              </div>
            )}
            {inventory.length === 0 ? (
              <GameEmptyState
                variant="upgrade-source"
                label="СТАРТ / ИНВЕНТАРЬ"
                title={t("upgrader.noSourceTitle")}
                description={t("upgrader.noSourceBody")}
                action={<Link to="/#collections">{t("home.discoveryHeading", { defaultValue: "Открыть каталог" })} <span aria-hidden="true">↗</span></Link>}
              />
            ) : (
              <div className="dz-pick-grid">
                {inventory.map((item) => (
                  <SelectableItem
                    key={item.id}
                    name={item.caseItem.name}
                    imageUrl={item.caseItem.imageUrl}
                    value={formatMinor(item.caseItem.valueMinor, item.caseItem.currency)}
                    rarity={item.caseItem.rarity}
                    rarityLabel={t(`rarity.${item.caseItem.rarity}`, { defaultValue: RARITY_LABELS[item.caseItem.rarity] })}
                    selected={sourceId === item.id}
                    disabled={submitting}
                    onSelect={() => { setSourceId(item.id); setTargetId(""); setResult(null); setConfirming(false); }}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="upgrade-core">
            <span className="upgrade-core__arrow" aria-hidden="true">➜</span>
            <span className="upgrade-core__chance">{target ? `${(chance * 100).toFixed(1)}%` : "—"}</span>
            <span className="upgrade-core__mult">{target ? `×${multiplier.toFixed(2)}` : t("upgrader.ux.pickBoth", { defaultValue: "Выберите оба предмета" })}</span>
            <p className="upgrade-core__note">{t("upgrader.fairNote")}</p>
            {confirming ? (
              <div className="dz-confirm">
                <button type="button" className="upgrade-core__btn" onClick={() => void execute()} disabled={submitting}>
                  {submitting ? t("upgrader.executing") : t("upgrader.confirm")}
                </button>
                <button type="button" className="dz-confirm__cancel" onClick={() => setConfirming(false)} disabled={submitting}>
                  {t("common.cancel")}
                </button>
              </div>
            ) : (
              <button type="button" className="upgrade-core__btn" disabled={!source || !target} onClick={() => setConfirming(true)}>
                {t("upgrader.ux.upgrade", { defaultValue: "АПГРЕЙД" })}
              </button>
            )}
          </div>

          <section>
            <Step label={t("upgrader.ux.targetItem", { defaultValue: "Целевой предмет" })} count={eligibleTargets.length} />
            {target && (
              <div className="upgrade-selected" style={{ "--dz-rarity": rarityColor(target.rarity) } as CSSProperties}>
                <img src={target.imageUrl} alt="" />
                <strong>{target.name}</strong>
                <span>{formatMinor(target.valueMinor, target.currency)}</span>
              </div>
            )}
            {!source ? (
              <GameEmptyState
                variant="upgrade-target"
                label="ЦЕЛЬ / ЗАБЛОКИРОВАНА"
                title={t("upgrader.noTargetTitle")}
                description={t("upgrader.noTargetBody")}
              />
            ) : eligibleTargets.length === 0 ? (
              <GameEmptyState
                variant="upgrade-target"
                label="ЦЕЛЬ / НЕТ ВАРИАНТОВ"
                title={t("upgrader.noTargetsTitle")}
                description={t("upgrader.noTargetsBody")}
              />
            ) : (
              <div className="dz-pick-grid">
                {eligibleTargets.map((item) => (
                  <SelectableItem
                    key={item.id}
                    name={item.name}
                    imageUrl={item.imageUrl}
                    value={formatMinor(item.valueMinor, item.currency)}
                    rarity={item.rarity}
                    rarityLabel={t(`rarity.${item.rarity}`, { defaultValue: RARITY_LABELS[item.rarity] })}
                    selected={targetId === item.id}
                    disabled={submitting}
                    onSelect={() => { setTargetId(item.id); setResult(null); setConfirming(false); }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}


      {roll && createPortal(
        <UpgradeRollOverlay
          roll={roll}
          onClose={() => { setRoll(null); setResult(null); }}
          t={t}
        />,
        document.body,
      )}

      {!loading && inventory.length === 0 && (
        <GameSteps
          label={t("upgrader.stepsHeading")}
          steps={[
            { title: t("upgrader.step_1_title"), description: t("upgrader.step_1_body") },
            { title: t("upgrader.step_2_title"), description: t("upgrader.step_2_body") },
            { title: t("upgrader.step_3_title"), description: t("upgrader.step_3_body") },
          ]}
        />
      )}
    </div>
  );
}
