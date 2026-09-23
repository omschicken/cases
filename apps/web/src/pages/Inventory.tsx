import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { InventoryItemDto } from "../lib/types";

export function InventoryPage() {
  const [items, setItems] = useState<InventoryItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);

  function load() {
    api
      .get<InventoryItemDto[]>("/cases/inventory/me")
      .then(setItems)
      .catch(() => setError("Could not load inventory"));
  }

  useEffect(load, []);

  async function sell(id: string) {
    setSellingId(id);
    setError(null);
    try {
      await api.post(`/cases/inventory/${id}/sell`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sell item");
    } finally {
      setSellingId(null);
    }
  }

  return (
    <div>
      <h1>Inventory</h1>
      {error && <p className="form-error">{error}</p>}
      <div className="item-grid">
        {items.map((inv) => (
          <div className="item-card" key={inv.id}>
            <img src={inv.caseItem.imageUrl} alt={inv.caseItem.name} />
            <p>{inv.caseItem.name}</p>
            <p className="value">{formatMinor(inv.caseItem.valueMinor, inv.caseItem.currency)}</p>
            <button onClick={() => sell(inv.id)} disabled={sellingId === inv.id}>
              {sellingId === inv.id ? "Selling…" : "Sell for balance"}
            </button>
          </div>
        ))}
        {items.length === 0 && <p>No items yet — open a case to win something.</p>}
      </div>
    </div>
  );
}
