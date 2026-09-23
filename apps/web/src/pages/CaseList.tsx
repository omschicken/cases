import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { CaseDto } from "../lib/types";

export function CaseListPage() {
  const [cases, setCases] = useState<CaseDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CaseDto[]>("/cases")
      .then(setCases)
      .catch(() => setError("Could not load cases"));
  }, []);

  return (
    <div>
      <h1>Cases</h1>
      {error && <p className="form-error">{error}</p>}
      <div className="case-grid">
        {cases.map((c) => (
          <Link to={`/cases/${c.slug}`} key={c.id} className="case-card">
            <img src={c.imageUrl} alt={c.name} />
            <h3>{c.name}</h3>
            <p className="price">{formatMinor(c.priceMinor, c.currency)}</p>
          </Link>
        ))}
        {cases.length === 0 && !error && <p>No cases available yet.</p>}
      </div>
    </div>
  );
}
