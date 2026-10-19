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
import type { GameOperationDto, InventoryItemDto, CaseItem } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { SelectableItem, Gate, Step, Outcome, OutcomeLink } from "../components/dz/SelectableItem";

type ContractResult = { operation: GameOperationDto; item: CaseItem; inventoryItemId: string; inputValueMinor: string };

export function ContractsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContractResult | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get<InventoryItemDto[]>("/cases/inventory/me")
      .then(setItems)
      .catch(() => setError(t("contracts.loadError")))
      .finally(() => setLoading(false));
  }, [user, t]);

  const selectedItems = useMemo(() => items.filter((item) => selected.includes(item.id)), [items, selected]);
  const total = selectedItems.reduce((sum, item) => sum + BigInt(item.caseItem.valueMinor), 0n);
  const rangeLow = total * 60n / 100n;
  const rangeHigh = total * 90n / 100n;

  function toggle(id: string) {
    if (submittingRef.current) return;
    setConfirming(false); setResult(null);
    setSelected((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : current.length < 10 ? [...current, id] : current
    );
  }

  async function execute() {
    if (submittingRef.current || selected.length < 3) return;
    submittingRef.current = true;
    setSubmitting(true); setError(null);
    try {
      const next = await api.post<ContractResult>("/games/contracts", { inventoryItemIds: selected });
      setResult(next);
      setItems((current) => current.filter((item) => !selected.includes(item.id)));
      setSelected([]);
      setConfirming(false);
      const currentItems = await api.get<InventoryItemDto[]>("/cases/inventory/me").catch(() => null);
      if (currentItems) setItems(currentItems);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? t("contracts.networkError") : err instanceof ApiError ? err.message : t("contracts.executeError"));
    } finally { submittingRef.current = false; setSubmitting(false); }
  }

  if (!user) return (
    <Gate
      kicker="CASECROW / CONTRACTS"
      title={t("contracts.title")}
      body={t("contracts.authBody")}
      action={<Link to="/login" className="dz-commit">{t("nav.signIn")} <span aria-hidden="true">↗</span></Link>}
    />
  );

  return (
    <div className="dz-workspace">
      <PageHeader
        kicker={t("contracts.kicker")}
        title={t("contracts.title")}
        lede={t("contracts.lede")}
        aside={<Readout label={t("contracts.selected")} value={`${selected.length} / 10`} />}
      />

      {error && (
        <div role="alert" style={{ margin: "var(--dz-s4) 0", padding: "var(--dz-s3) var(--dz-s4)", border: "1px solid var(--dz-danger)", borderRadius: "var(--dz-r-sm)", color: "var(--dz-danger)", fontSize: "var(--dz-type-sm)" }}>
          {error}
        </div>
      )}

      {result && (
        <Outcome
          won
          label={t("contracts.success")}
          name={result.item.name}
          meta={formatMinor(result.item.valueMinor, result.item.currency)}
          imageUrl={result.item.imageUrl}
          action={<OutcomeLink to="/inventory">{t("inventory.title")} ↗</OutcomeLink>}
        />
      )}

      <div className="dz-workspace__layout">
        <section>
          <Step label={t("contracts.step1")} count={t("contracts.available", { count: items.length })} />

          {loading ? (
            <p style={{ color: "var(--dz-text-4)", fontSize: "var(--dz-type-sm)" }}>{t("common.loading")}</p>
          ) : items.length === 0 ? (
            <GameEmptyState
              variant="contracts"
              label="МАСТЕРСКАЯ / 03 → 01"
              title={t("contracts.emptyTitle")}
              description={t("contracts.emptyBody")}
              action={<Link to="/#collections">{t("home.discoveryHeading", { defaultValue: "Выбрать кейс" })} <span aria-hidden="true">↗</span></Link>}
            />
          ) : (
            <div className="dz-pick-grid">
              {items.map((item) => (
                <SelectableItem
                  key={item.id}
                  name={item.caseItem.name}
                  imageUrl={item.caseItem.imageUrl}
                  value={formatMinor(item.caseItem.valueMinor, item.caseItem.currency)}
                  rarity={item.caseItem.rarity}
                  rarityLabel={t(`rarity.${item.caseItem.rarity}`, { defaultValue: RARITY_LABELS[item.caseItem.rarity] })}
                  selected={selected.includes(item.id)}
                  disabled={submitting}
                  onSelect={() => toggle(item.id)}
                  label={`${item.caseItem.name} — ${formatMinor(item.caseItem.valueMinor, item.caseItem.currency)}`}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="dz-summary">
          <span className="dz-summary__label">{t("contracts.step2")}</span>
          <div
            className="contract-slots"
            aria-label={t("contracts.available", { count: selected.length })}
          >
            {Array.from({ length: 10 }, (_, index) => (
              <span key={index} className={index < selected.length ? "filled" : ""} />
            ))}
          </div>
          <dl className="dz-summary__rows">
            <div className="dz-summary__row"><dt>{t("contracts.items")}</dt><dd>{selected.length} / 10</dd></div>
            <div className="dz-summary__row"><dt>{t("contracts.total")}</dt><dd>{formatMinor(total.toString())}</dd></div>
            <div className="dz-summary__row">
              <dt>{t("contracts.result")}</dt>
              <dd>{selected.length >= 3
                ? t("contracts.resultRange", { low: formatMinor(rangeLow.toString()), high: formatMinor(rangeHigh.toString()) })
                : t("contracts.resultMin")}
              </dd>
            </div>
          </dl>
          <p className="dz-summary__label">{t("contracts.fairNote")}</p>
          {confirming ? (
            <div className="dz-confirm">
              <button type="button" className="dz-commit" onClick={() => void execute()} disabled={submitting}>
                {submitting ? t("contracts.executing") : t("contracts.confirm")}
              </button>
              <button type="button" className="dz-confirm__cancel" onClick={() => setConfirming(false)} disabled={submitting}>
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <button type="button" className="dz-commit" disabled={selected.length < 3} onClick={() => setConfirming(true)}>
              {t("contracts.start")}
            </button>
          )}
        </aside>
      </div>

      {!loading && items.length === 0 && (
        <GameSteps
          label={t("contracts.stepsHeading")}
          steps={[
            { title: t("contracts.step_1_title"), description: t("contracts.step_1_body") },
            { title: t("contracts.step_2_title"), description: t("contracts.step_2_body") },
            { title: t("contracts.step_3_title"), description: t("contracts.step_3_body") },
          ]}
        />
      )}
    </div>
  );
}
