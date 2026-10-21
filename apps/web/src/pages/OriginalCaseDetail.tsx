import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { CASECROW_ORIGINALS_BY_SLUG } from "../lib/casecrowOriginals";
import { formatMinor } from "../lib/money";
import type { CaseDto } from "../lib/types";
import "../styles/casecrow-original-collections.css";

function spriteStyle(order: number): CSSProperties {
  const index = order - 1;
  return {
    backgroundImage: 'url("/casecrow-originals/sprite.avif")',
    backgroundSize: "400% 400%",
    backgroundPosition: `${(index % 4) * 100 / 3}% ${Math.floor(index / 4) * 100 / 3}%`,
  };
}

export function OriginalCaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const entry = slug ? CASECROW_ORIGINALS_BY_SLUG.get(slug) : undefined;
  const [data, setData] = useState<CaseDto | null>(null);
  useEffect(() => {
    let active = true;
    setData(null);
    if (entry) api.get<CaseDto>(`/cases/${entry.slug}`)
      .then((response) => { if (active) setData(response); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, [entry]);

  if (!entry) return <div className="cco-detail"><h1>Кейс не найден</h1><Link to="/">Вернуться в каталог</Link></div>;
  const active = Boolean(data?.isActive && data.canOpen !== false);
  return <main className="cco-detail">
    <Link to="/#new-collections" className="cco-detail-back">← Все коллекции</Link>
    <section className="cco-detail-main">
      <div className="cco-detail-art" role="img" aria-label={`Кейс ${entry.name}`}>
        <div className="cco-art-sprite" style={spriteStyle(entry.order)} />
      </div>
      <div className="cco-detail-copy">
        <small>CASECROW / {entry.series === "crystals" ? "Кристальная коллекция" : "Авторская коллекция"}</small>
        <h1>{entry.name}</h1>
        <p>Оригинальный коллекционный кейс Casecrow с собственным дизайном. Состав выпадения, цены и вероятности будут доступны здесь после публикации на сервере.</p>
        {active ? <>
          <p>Стоимость открытия: <strong>{formatMinor(data!.priceMinor, data!.currency)}</strong></p>
          <Link className="cco-detail-action" to={`/cases/${entry.slug}`}>Перейти к открытию →</Link>
        </> : <div className="cco-detail-state" role="status">Кейс готовится к запуску. Открытие недоступно до настройки предметов, цен и вероятностей на сервере.</div>}
      </div>
    </section>
  </main>;
}
