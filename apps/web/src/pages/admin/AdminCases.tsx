import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { formatMinor } from "../../lib/money";
import type { CaseDto } from "../../lib/types";

interface ItemForm {
  name: string;
  imageUrl: string;
  weight: string;
  valueMinor: string;
  currency: string;
}

function emptyItem(): ItemForm {
  return { name: "", imageUrl: "", weight: "10", valueMinor: "500", currency: "USD" };
}

export function AdminCases() {
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
      .catch(() => setError("Could not load cases"));
  }

  useEffect(load, []);

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
        })),
      });
      setInfo("Case created.");
      setSlug("");
      setName("");
      setImageUrl("");
      setItems([emptyItem()]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create case");
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await api.patch(`/admin/cases/${id}/active`, { isActive: !isActive });
    load();
  }

  return (
    <div>
      <h2>Cases</h2>
      {error && <p className="form-error">{error}</p>}
      {info && <p className="form-info">{info}</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Price</th>
            <th>Items</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{formatMinor(c.priceMinor, c.currency)}</td>
              <td>{c.items.length}</td>
              <td>{c.isActive ? "Yes" : "No"}</td>
              <td>
                <button onClick={() => toggleActive(c.id, c.isActive)}>
                  {c.isActive ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Create case</h3>
      <form onSubmit={createCase} className="auth-form">
        <label>
          Slug
          <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Price (minor units, e.g. cents)
          <input value={priceMinor} onChange={(e) => setPriceMinor(e.target.value)} required />
        </label>
        <label>
          Currency
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
        </label>
        <label>
          Image URL
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required />
        </label>

        <h4>Items</h4>
        {items.map((item, i) => (
          <div key={i} className="item-form-row">
            <input
              placeholder="Name"
              value={item.name}
              onChange={(e) => updateItem(i, { name: e.target.value })}
              required
            />
            <input
              placeholder="Image URL"
              value={item.imageUrl}
              onChange={(e) => updateItem(i, { imageUrl: e.target.value })}
              required
            />
            <input
              placeholder="Weight"
              value={item.weight}
              onChange={(e) => updateItem(i, { weight: e.target.value })}
              required
            />
            <input
              placeholder="Value (minor units)"
              value={item.valueMinor}
              onChange={(e) => updateItem(i, { valueMinor: e.target.value })}
              required
            />
            <input
              placeholder="Currency"
              value={item.currency}
              onChange={(e) => updateItem(i, { currency: e.target.value })}
              required
            />
          </div>
        ))}
        <button type="button" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
          + Add item
        </button>
        <button type="submit">Create case</button>
      </form>
    </div>
  );
}
