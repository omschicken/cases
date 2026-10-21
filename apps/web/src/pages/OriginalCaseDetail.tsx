import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { CASECROW_ORIGINALS, CASECROW_ORIGINALS_BY_SLUG } from "../lib/casecrowOriginals";
import { formatMinor } from "../lib/money";
import type { CaseDto, CaseItem } from "../lib/types";
import "../styles/casecrow-original-collections.css";

function rollDemo(items: CaseItem[]): CaseItem {
  const weights = items.map((item) => Math.max(0, Number(item.weight) || 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * sum;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}

export function OriginalCaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const entry = slug ? CASECROW_ORIGINALS_BY_SLUG.get(slug) : undefined;
  const [data, setData] = useState<CaseDto | null>(null);
  const [catalog, setCatalog] = useState<CaseDto[]>([]);
  const [demoResult, setDemoResult] = useState<CaseItem | null>(null);
  const [rolling, setRolling] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setDemoResult(null);
    setRolling(false);
    setLoadError(false);
    if (entry) {
      api.get<CaseDto>(`/cases/${entry.slug}`).then((response) => {
        if (active) setData(response);
      }).catch(() => { if (active) setData(null); });
      api.get<CaseDto[]>("/cases").then((response) => {
        if (active) setCatalog(response);
      }).catch(() => { if (active) setLoadError(true); });
    }
    return () => { active = false; };
  }, [entry]);

  const related = useMemo(() => {
    if (!entry) return [];
    const matches = new Map<string, CaseItem>();
    for (const theCase of catalog) {
      for (const item of theCase.items) {
        if (!entry.keywords.some((word) => item.name.toLowerCase().includes(word.toLowerCase()))) continue;
        const old = matches.get(item.name);
        if (!old || Number(item.valueMinor) > Number(old.valueMinor)) matches.set(item.name, item);
      }
    }
    return [...matches.values()].sort((a,b) => Number(b.valueMinor) - Number(a.valueMinor)).slice(0,16);
  }, [catalog,entry]);

  if (!entry) return <main className="cco-detail"><h1>Кейс не найден</h1><Link to="/">Вернуться в каталог</Link></main>;
  const active = Boolean(data?.isActive && data.canOpen !== false);

  function demo() {
    if (rolling || !related.length) return;
    setRolling(true);
    setDemoResult(null);
    // Presentation only: no paid opening, no wallet or inventory operations.
    setDemoResult(rollDemo(related));
    setRolling(false);
  }

  return <main className="cco-detail">
    <Link to="/#new-collections" className="cco-detail-back">← Все коллекции</Link>
    <section className="cco-detail-main">
      <div className={`cco-detail-art ${entry.series === "crystals" ? "cco-detail-crystal" : ""}`} role="img" aria-label={`Кейс ${entry.name}`}>
        <img className="cco-case-full-art" src={entry.imageUrl} alt={entry.name} />
      </div>
      <div className="cco-detail-copy">
        <small>CASECROW / {entry.series === "crystals" ? "Кристальная коллекция" : "Авторская коллекция"}</small>
        <h1>{entry.name}</h1>
        {active ? <>
          <p>Стоимость открытия: <strong>{formatMinor(data!.priceMinor, data!.currency)}</strong></p>
          <Link className="cco-detail-action" to={`/cases/${entry.slug}`}>Перейти к открытию →</Link>
        </> : <>
          <p>Оригинальный дизайн коллекционного кейса. Пока серверные наборы выпадения не опубликованы, можно бесплатно просмотреть тематические скины и попробовать демонстрацию.</p>
          <div className="cco-detail-state" role="status">Реальное открытие ещё не запущено. Демо не списывает средства и не выдаёт предметы.</div>
          <button className="cco-detail-action" type="button" disabled={rolling || related.length === 0} onClick={demo}>
            {rolling ? "Запуск…" : related.length ? "Попробовать демо-открытие" : "Подбор скинов загружается"}
          </button>
          {loadError && <p role="alert">Не удалось получить список скинов с сервера.</p>}
        </>}
      </div>
    </section>
    {demoResult && !active && <section className="cco-demo-result" role="status" aria-live="polite">
      <span>ДЕМО / ПРЕДМЕТ НЕ ВЫДАН</span>
      <img src={demoResult.imageUrl} alt={demoResult.name} />
      <h2>{demoResult.name}</h2>
      <p>Предпросмотр: {formatMinor(demoResult.valueMinor, demoResult.currency)}</p>
      <button type="button" onClick={demo}>Ещё раз ↻</button>
    </section>}
    <section className="cco-detail-related">
      <h2>Тематические скины</h2>
      {related.length ? <div className="cco-skins-grid">{related.map((item) =>
        <article className="cco-skin" key={item.id}>
          <img src={item.imageUrl} alt={item.name} loading="lazy" />
          <strong>{item.name}</strong>
          <span>{formatMinor(item.valueMinor, item.currency)}</span>
        </article>,
      )}</div> : <p>{loadError ? "Не удалось загрузить каталог." : "Загружаем скины…"}</p>}
      <p className="cco-disclaimer">Это тематический предпросмотр из действующего каталога CS2. Точный состав кейса, шансы и цена будут показаны после настройки серверного кейса.</p>
    </section>
    <section className="cco-detail-related">
      <h2>Другие коллекции</h2>
      <div className="cco-related-links">{CASECROW_ORIGINALS.filter((item) => item.slug !== entry.slug && item.series === entry.series).slice(0,7).map((item) =>
        <Link key={item.slug} to={`/collections/${item.slug}`}>{item.name} ↗</Link>)}</div>
    </section>
  </main>;
}
