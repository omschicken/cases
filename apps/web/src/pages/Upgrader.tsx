import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GameEmptyState } from "../components/GameEmptyState";
import { GameSteps } from "../components/GameSteps";
import { useAuth } from "../context/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_LABELS } from "../lib/rarity";
import type { CaseItem, GameOperationDto, InventoryItemDto } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { SelectableItem, Step, Outcome, Gate } from "../components/dz/SelectableItem";

type UpgradeResult = { operation: GameOperationDto; won: boolean; item: CaseItem | null; target: CaseItem; chance: number };

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

  async function execute() {
    if (!source || !target || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true); setError(null);
    try {
      const next = await api.post<UpgradeResult>("/games/upgrades", { inventoryItemId: source.id, targetCaseItemId: target.id });
      setResult(next);
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
      kicker="DROPZONE / UPGRADER"
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

      {result && (
        <Outcome
          won={result.won}
          label={result.won ? t("upgrader.won") : t("upgrader.lost")}
          name={result.won ? result.target.name : t("upgrader.lostItem")}
          meta={`ROLL ${result.operation.roll.toFixed(5)} / ${(result.chance * 100).toFixed(1)}${t("upgrader.chanceSuffix")}`}
          imageUrl={result.won && result.item ? result.item.imageUrl : undefined}
        />
      )}

      {loading ? (
        <p style={{ color: "var(--dz-text-4)", fontSize: "var(--dz-type-sm)" }}>{t("common.loading")}</p>
      ) : (
        <div className="upgrade-layout">
          <section>
            <Step label={t("upgrader.step1")} count={inventory.length} />
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

          <div className="upgrade-arrow" aria-hidden="true">→</div>

          <section>
            <Step label={t("upgrader.step2")} count={eligibleTargets.length} />
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

      <aside className="dz-summary">
        <span className="dz-summary__label">{t("upgrader.chanceLabel")}</span>
        <span className="dz-summary__figure">{(chance * 100).toFixed(1)}{t("upgrader.chanceSuffix")}</span>
        <p className="dz-summary__label">{t("upgrader.fairNote")}</p>
        {confirming ? (
          <div className="dz-confirm">
            <button type="button" className="dz-commit" onClick={() => void execute()} disabled={submitting}>
              {submitting ? t("upgrader.executing") : t("upgrader.confirm")}
            </button>
            <button type="button" className="dz-confirm__cancel" onClick={() => setConfirming(false)} disabled={submitting}>
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button type="button" className="dz-commit" disabled={!source || !target} onClick={() => setConfirming(true)}>
            {t("upgrader.start")}
          </button>
        )}
      </aside>

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
