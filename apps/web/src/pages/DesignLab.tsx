import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import heroImage from "../assets/editorial-kit/hero-editorial.webp";
import staticImage from "../assets/editorial-kit/static-case.webp";
import ignitionImage from "../assets/editorial-kit/ignition-case.webp";
import tidalImage from "../assets/editorial-kit/tidal-case.webp";
import phantomImage from "../assets/editorial-kit/phantom-case.webp";
import promoImage from "../assets/editorial-kit/promo.webp";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import "../styles/design-lab.css";

// Isolated design-lab preview values. Production prices remain API-owned.
const previewCases = [
  { name: "Static Case", price: "100,00 ₽", tag: "Стандартный", image: staticImage, category: "standard" },
  { name: "Ignition Case", price: "599,00 ₽", tag: "Популярный", image: ignitionImage, category: "popular" },
  { name: "Tidal Case", price: "799,00 ₽", tag: "Новинка", image: tidalImage, category: "new" },
  { name: "Phantom Case", price: "1 299,00 ₽", tag: "Эксклюзивный", image: phantomImage, category: "exclusive" },
] as const;

const nav = [
  ["Кейсы", "/"], ["Сражения", "/battles"], ["Контракты", "/contracts"],
  ["Апгрейд", "/upgrader"], ["Инвентарь", "/inventory"], ["Рефералы", "/referral"],
] as const;

const sidebar = [
  ["▣", "Кейсы", "/"], ["⚔", "Сражения", "/battles"], ["◇", "Контракты", "/contracts"],
  ["↥", "Апгрейд", "/upgrader"], ["□", "Инвентарь", "/inventory"], ["♧", "Рефералы", "/referral"],
] as const;

export function DesignLabPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleCases = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    return previewCases.filter((item) => (filter === "all" || item.category === filter) && item.name.toLocaleLowerCase("ru").includes(needle));
  }, [filter, query]);

  return (
    <div className="fidelity-page">
      <header className="fidelity-header">
        <Link className="fidelity-logo" to="/">DROPZONE</Link>
        <nav className="fidelity-topnav" aria-label="Основная навигация">
          {nav.map(([label, to], index) => <Link className={index === 0 ? "active" : ""} key={to} to={to}>{label}</Link>)}
          <span aria-hidden="true">•••</span>
        </nav>
        <div className="fidelity-account">
          <label className="fidelity-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" aria-label="Поиск кейсов" /></label>
          <Link className="fidelity-wallet" to="/wallet"><span aria-hidden="true">▤</span> 0,00 ₽</Link>
          <Link className="fidelity-plus" to="/wallet" aria-label="Пополнить баланс">+</Link>
          <Link className="fidelity-profile" to="/login" aria-label="Войти в профиль">DZ</Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="fidelity-shell">
        <aside className="fidelity-rail">
          <nav aria-label="Разделы">
            {sidebar.map(([icon, label, to], index) => <Link className={index === 0 ? "active" : ""} key={`${label}-${to}`} to={to}><span>{icon}</span>{label}</Link>)}
          </nav>
          <Link className="fidelity-reward" to="/bonuses"><span>♙</span><b>Ежедневные<br />награды</b><i>↗</i></Link>
        </aside>

        <main className="fidelity-main">
          <section className="fidelity-hero" aria-labelledby="fidelity-title">
            <div className="fidelity-hero-copy">
              <p>Коллекции&nbsp; / &nbsp;Counter-Strike 2</p>
              <h1 id="fidelity-title">Предметы<br />с <span>характером.</span></h1>
              <div className="fidelity-mobile-art"><img src={heroImage} alt="Светлый коллекционный кейс и винтовка" /></div>
              <div className="fidelity-hero-bottom">
                <p>Открывай кейсы, собирай редкие скины<br />и формируй собственную коллекцию.</p>
                <a href="#catalog">Открыть кейсы <span>→</span></a>
              </div>
            </div>
            <div className="fidelity-hero-art"><img src={heroImage} alt="Светлый коллекционный кейс и винтовка" /><span>Качество<br />Стиль<br />Коллекции<br />Твой выбор</span><b>01&nbsp; / &nbsp;03</b><div className="fidelity-hero-arrows" aria-hidden="true"><i>‹</i><i>›</i></div></div>
          </section>

          <section className="fidelity-catalog" id="catalog" aria-labelledby="catalog-title">
            <div className="fidelity-catalog-head">
              <h2 id="catalog-title">Коллекции</h2>
              <div className="fidelity-filters" aria-label="Фильтры каталога">
                {[["all","Все кейсы"],["popular","Популярные"],["new","Новинки"],["standard","Стандартные"],["exclusive","Эксклюзивные"],["limited","Лимитированные"]].map(([value,label]) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} type="button" key={value}>{label}</button>)}
              </div>
              <select aria-label="Сортировка"><option>По популярности</option></select>
            </div>
            <div className="fidelity-card-grid">
              {visibleCases.map((item) => <article className="fidelity-card" key={item.name}>
                <div className="fidelity-card-art"><img src={item.image} alt={item.name} /><span>{item.tag}</span><button type="button" aria-label={`Добавить ${item.name} в избранное`}>♡</button></div>
                <div className="fidelity-card-info"><div><h3>{item.name}</h3><strong>{item.price}</strong></div><Link to="/">Открыть <span>→</span></Link></div>
              </article>)}
              {visibleCases.length === 0 && <p className="fidelity-empty">Кейсы не найдены</p>}
            </div>
          </section>

          <section className="fidelity-promo" aria-label="Коллекция недели">
            <img src={promoImage} alt="Коллекционное оружие Aurum" />
            <div><small>Limited edition</small><h2>Коллекция недели</h2><p>Уникальные предметы. Ограниченное время.</p></div>
            <Link to="/">Открыть коллекцию <span>↗</span></Link>
          </section>
        </main>
      </div>
    </div>
  );
}
