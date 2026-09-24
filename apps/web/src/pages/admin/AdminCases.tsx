import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../../lib/api";
import { formatMinor } from "../../lib/money";
import { RARITY_LABELS } from "../../lib/rarity";
import type { CaseDto, ItemRarity } from "../../lib/types";

interface ItemForm {
  name: string;
  imageUrl: string;
  weight: string;
  valueMinor: string;
  currency: string;
  rarity: ItemRarity;
}

const RARITY_OPTIONS = Object.keys(RARITY_LABELS) as ItemRarity[];

function emptyItem(): ItemForm {
  return { name: "", imageUrl: "", weight: "10", valueMinor: "500", currency: "USD", rarity: "MIL_SPEC" };
}

export function AdminCases() {
  const { t } = useTranslation();
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [priceMinor, setPriceMinor] = useState("250");
  const [currency, setCurrency] = useState("USD");
  const [imageUrl, setImageUrl] = useState("");
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);

  function load() {
    api
      .get<CaseDto[]>("/admin/cases")
      .then(setCases)
      .catch(() => setError(t("admin.cases.couldNotLoad")));
  }

  useEffect(load, [t]);

  function updateItem(index: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function createCase(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.post("/admin/cases", {
        slug,
        name,
        priceMinor: Number(priceMinor),
        currency,
        imageUrl,
        items: items.map((it) => ({
          name: it.name,
          imageUrl: it.imageUrl,
          weight: Number(it.weight),
          valueMinor: Number(it.valueMinor),
          currency: it.currency,
          rarity: it.rarity,
        })),
      });
      setInfo(t("admin.cases.created"));
      setSlug("");
      setName("");
      setImageUrl("");
      setItems([emptyItem()]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.cases.couldNotCreate"));
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await api.patch(`/admin/cases/${id}/active`, { isActive: !isActive });
    load();
  }

  return (
    <div>
      <h2>{t("admin.cases.heading")}</h2>
      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-info">{info}</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>{t("admin.cases.name")}</th>
            <th>{t("admin.cases.price")}</th>
            <th>{t("admin.cases.items")}</th>
            <th>{t("admin.cases.active")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{formatMinor(c.priceMinor, c.currency)}</td>
              <td>{c.items.length}</td>
              <td>{c.isActive ? t("admin.cases.yes") : t("admin.cases.no")}</td>
              <td>
                <button onClick={() => toggleActive(c.id, c.isActive)}>
                  {c.isActive ? t("admin.cases.disable") : t("admin.cases.enable")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>{t("admin.cases.createHeading")}</h3>
      <form onSubmit={createCase} className="auth-form">
        <label>
          {t("admin.cases.slug")}
          <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </label>
        <label>
          {t("admin.cases.nameField")}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          {t("admin.cases.priceField")}
          <input value={priceMinor} onChange={(e) => setPriceMinor(e.target.value)} required />
        </label>
        <label>
          {t("admin.cases.currency")}
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
        </label>
        <label>
          {t("admin.cases.imageUrl")}
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required />
        </label>

        <h4>{t("admin.cases.itemsHeading")}</h4>
        {items.map((item, i) => (
          <div key={i} className="item-form-row">
            <input
              placeholder={t("admin.cases.itemName")}
              value={item.name}
              onChange={(e) => updateItem(i, { name: e.target.value })}
              required
            />
            <input
              placeholder={t("admin.cases.itemImageUrl")}
              value={item.imageUrl}
              onChange={(e) => updateItem(i, { imageUrl: e.target.value })}
              required
            />
            <input
              placeholder={t("admin.cases.weight")}
              value={item.weight}
              onChange={(e) => updateItem(i, { weight: e.target.value })}
              required
            />
            <input
              placeholder={t("admin.cases.value")}
              value={item.valueMinor}
              onChange={(e) => updateItem(i, { valueMinor: e.target.value })}
              required
            />
            <input
              placeholder={t("admin.cases.itemCurrency")}
              value={item.currency}
              onChange={(e) => updateItem(i, { currency: e.target.value })}
              required
            />
            <select
              value={item.rarity}
              onChange={(e) => updateItem(i, { rarity: e.target.value as ItemRarity })}
            >
              {RARITY_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {RARITY_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button type="button" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
          {t("admin.cases.addItem")}
        </button>
        <button type="submit">{t("admin.cases.createCase")}</button>
      </form>
    </div>
  );
}
