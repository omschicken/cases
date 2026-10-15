import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GameEmptyState } from "../components/GameEmptyState";
import { GameSteps } from "../components/GameSteps";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import { RARITY_LABELS, rarityColor } from "../lib/rarity";
import type { InventoryItemDto, ItemRarity } from "../lib/types";
import { PageHeader, Readout } from "../components/dz/PageHeader";
import { Gate } from "../components/dz/SelectableItem";
import { ItemCard } from "../components/dz/ItemCard";

const rarities: Array<ItemRarity | "ALL"> = ["ALL", "GOLD", "COVERT", "CLASSIFIED", "RESTRICTED", "MIL_SPEC", "INDUSTRIAL", "CONSUMER"];

export function CardsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItemDto[]>([]);
  const [filter, setFilter] = useState<ItemRarity | "ALL">("ALL");
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      api.get<InventoryItemDto[]>("/cases/inventory/me")
        .then(setInventory)
        .catch(() => setError(t("cards.loadError")))
        .finally(() => setLoading(false));
    }
  }, [user, t]);

  const cards = useMemo(() => {
    const map = new Map<string, { item: InventoryItemDto["caseItem"]; count: number }>();
    inventory.forEach(({ caseItem }) => {
      const current = map.get(caseItem.id);
      map.set(caseItem.id, { item: caseItem, count: (current?.count ?? 0) + 1 });
    });
    return [...map.values()].sort((a, b) => Number(BigInt(b.item.valueMinor) - BigInt(a.item.valueMinor)));
  }, [inventory]);

  const visible = filter === "ALL" ? cards : cards.filter(({ item }) => item.rarity === filter);
  const totalValue = inventory.reduce((sum, item) => sum + BigInt(item.caseItem.valueMinor), 0n);

  if (!user) return (
    <Gate
      kicker="DROPZONE / CARDS"
      title={t("cards.title")}
      body={t("cards.authBody")}
      action={<Link to="/login" className="dz-commit">{t("nav.signIn")} <span aria-hidden="true">↗</span></Link>}
    />
  );

  return (
    <div className="dz-workspace">
      <PageHeader
        kicker={t("cards.kicker")}
        title={t("cards.title")}
        lede={t("cards.lede")}
        aside={
          <>
            <Readout label={t("cards.unique")} value={String(cards.length)} />
            <Readout label={t("cards.archive")} value={formatMinor(totalValue.toString())} />
          </>
        }
      />

      {error && (
        <div role="alert" style={{ margin: "var(--dz-s4) 0", padding: "var(--dz-s3) var(--dz-s4)", border: "1px solid var(--dz-danger)", borderRadius: "var(--dz-r-sm)", color: "var(--dz-danger)", fontSize: "var(--dz-type-sm)" }}>
          {error}
        </div>
      )}

      {cards.length > 0 && (
        <nav className="dz-chips" aria-label={t("cards.filterLabel")} style={{ marginTop: "var(--dz-s4)" }}>
          {rarities.map((rarity) => (
            <button
              type="button"
              key={rarity}
              className="dz-chip"
              aria-pressed={filter === rarity}
              style={rarity === "ALL" ? undefined : ({ "--dz-rarity": rarityColor(rarity) } as CSSProperties)}
              onClick={() => setFilter(rarity)}
            >
              {rarity === "ALL" ? t("cards.all") : t(`rarity.${rarity}`, { defaultValue: RARITY_LABELS[rarity] })}
              {" "}<b>{rarity === "ALL" ? cards.length : cards.filter(({ item }) => item.rarity === rarity).length}</b>
            </button>
          ))}
        </nav>
      )}

      {loading ? (
        <p style={{ color: "var(--dz-text-4)", fontSize: "var(--dz-type-sm)", marginTop: "var(--dz-s4)" }}>{t("common.loading")}</p>
      ) : error ? null : visible.length === 0 ? (
        <GameEmptyState
          variant="cards"
          label="АРХИВ / КОЛЛЕКЦИЯ"
          title={cards.length === 0 ? t("cards.noCardsTitle") : t("cards.noRarityTitle")}
          description={cards.length === 0 ? t("cards.noCardsBody") : t("cards.noRarityBody")}
          action={
            cards.length === 0
              ? <Link to="/#collections">{t("home.discoveryHeading", { defaultValue: "Перейти к кейсам" })} <span aria-hidden="true">↗</span></Link>
              : <button type="button" onClick={() => setFilter("ALL")}>{t("cards.showAll")} <span aria-hidden="true">↗</span></button>
          }
        />
      ) : (
        <section className="dz-item-grid">
          {visible.map(({ item, count }) => (
            <ItemCard
              key={item.id}
              name={item.name}
              imageUrl={item.imageUrl}
              rarity={item.rarity}
              rarityLabel={t(`rarity.${item.rarity}`, { defaultValue: RARITY_LABELS[item.rarity] })}
              value={formatMinor(item.valueMinor, item.currency)}
              badge={count > 1 ? `×${count}` : undefined}
              meta={count > 1 ? t("cards.duplicate") : t("cards.uniqueItem")}
            />
          ))}
        </section>
      )}

      {!loading && !error && cards.length === 0 && (
        <GameSteps
          label={t("cards.stepsHeading")}
          steps={[
            { title: t("cards.step_1_title"), description: t("cards.step_1_body") },
            { title: t("cards.step_2_title"), description: t("cards.step_2_body") },
            { title: t("cards.step_3_title"), description: t("cards.step_3_body") },
          ]}
        />
      )}
    </div>
  );
}
