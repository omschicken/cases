import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import staticCase from "../assets/armory/static-case.png";
import ignitionCase from "../assets/armory/ignition-case.png";
import dragonCase from "../assets/armory/dragon-case.png";
import heroScene from "../assets/editorial/hero-static-case-v2.jpg";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { WalletDto } from "../lib/types";
import "../styles/design-lab.css";

const cases = [
  { name: "Static Case", price: "29,00 ₽", note: "Точная серия", image: staticCase, tone: "static" },
  { name: "Ignition Case", price: "8,25 ₽", note: "Тепловая серия", image: ignitionCase, tone: "ignition" },
  { name: "Dragon Case", price: "499,00 ₽", note: "Коллекционная серия", image: dragonCase, tone: "dragon" },
] as const;

const modes = [
  ["01", "Открытие кейсов", "Выбирай коллекцию и получай результат, рассчитанный на сервере."],
  ["02", "Сражения", "Соревнуйся за общую стоимость выпавших предметов."],
  ["03", "Контракты", "Объединяй предметы из инвентаря в один новый результат."],
] as const;

export function DesignLabPage() {
  const { user } = useAuth();
  const [balanceMinor, setBalanceMinor] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return setBalanceMinor(null);
    api.get<WalletDto>("/wallet/me").then((wallet) => setBalanceMinor(wallet.balanceMinor)).catch(() => setBalanceMinor(null));
  }, [user]);

  const visibleCases = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru");
    return needle ? cases.filter((item) => item.name.toLocaleLowerCase("ru").includes(needle)) : cases;
  }, [query]);

  return (
    <div className="editorial-lab">
      <header className="editorial-nav">
        <Link className="editorial-brand" to="/" aria-label="DROPZONE"><b>D</b><span>Dropzone</span></Link>
        <nav className="editorial-links" aria-label="Навигация Design Lab">
          <a className="is-active" href="#catalog">Кейсы</a><Link to="/battles">Сражения</Link><Link to="/contracts">Контракты</Link><Link to="/upgrader">Апгрейд</Link><Link to="/cards">Коллекции</Link>
        </nav>
        <div className="editorial-tools">
          <label className="editorial-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти кейс" aria-label="Поиск кейсов" /></label>
          {user && <Link className="editorial-balance" to="/wallet">{balanceMinor === null ? "—" : formatMinor(balanceMinor)}</Link>}
          <Link className="editorial-login" to={user ? "/profile" : "/login"}>{user ? "Профиль" : "Войти"}</Link>
          <LanguageSwitcher />
        </div>
      </header>

      <div className="editorial-layout">
        <aside className="editorial-sidebar" aria-label="Разделы">
          <nav>
            <a className="is-active" href="#catalog"><span>▣</span>Кейсы</a>
            <Link to="/battles"><span>⚔</span>Сражения</Link>
            <Link to="/contracts"><span>◇</span>Контракты</Link>
            <Link to="/upgrader"><span>↥</span>Апгрейд</Link>
            <Link to="/inventory"><span>□</span>Инвентарь</Link>
          </nav>
          <Link className="editorial-reward" to="/bonuses"><span>♙</span><b>Ежедневные<br />награды</b><i>↗</i></Link>
        </aside>
        <main className="editorial-main">
        <section className="editorial-hero" aria-labelledby="editorial-title">
          <div className="editorial-hero__copy">
            <p className="editorial-eyebrow">Коллекция · Counter-Strike 2</p>
            <h1 id="editorial-title">Предметы<br />с характером.</h1>
            <p className="editorial-hero__lead">Открывай кейсы, собирай редкие скины и формируй собственную коллекцию.</p>
            <div className="editorial-actions">
              <a className="editorial-primary" href="#catalog">Открыть кейсы <span>→</span></a>
            </div>
          </div>
          <div className="editorial-product">
            <img className="editorial-product__scene" src={heroScene} alt="Static Case в светлом архитектурном пространстве" />
          </div>
        </section>

        <section className="editorial-catalog" id="catalog" aria-labelledby="catalog-title">
          <header className="editorial-section-head">
            <div><p className="editorial-eyebrow">Выбор редакции</p><h2 id="catalog-title">Три разных характера</h2></div>
            <div className="editorial-filters" aria-label="Фильтры каталога">
              <button className="is-active" type="button">Все</button><button type="button">До 100 ₽</button><button type="button">Коллекционные</button>
            </div>
          </header>
          <div className="editorial-grid">
            {visibleCases.map((item) => (
              <article className={`editorial-card editorial-card--${item.tone}`} key={item.name} tabIndex={0}>
                <div className="editorial-card__visual"><img src={item.image} alt={item.name} /><span /></div>
                <div className="editorial-card__body">
                  <small>{item.note}</small><h3>{item.name}</h3>
                  <footer><strong>{item.price}</strong><button type="button" aria-label={`Открыть ${item.name}`}>Открыть</button></footer>
                </div>
              </article>
            ))}
            {visibleCases.length === 0 && <p className="editorial-empty">По вашему запросу кейсов не найдено.</p>}
          </div>
        </section>

        <section className="editorial-feature" id="about" aria-label="Featured Collection">
          <div className="editorial-feature__copy">
            <p className="editorial-eyebrow">Featured collection</p><h2>Три материала.<br />Одна коллекция.</h2>
            <p>Керамика, термически обработанная сталь и титан задают каждому кейсу собственную форму и настроение.</p>
            <a href="#catalog">Открыть подборку <span>→</span></a>
          </div>
          <div className="editorial-feature__objects" aria-hidden="true"><img src={staticCase} alt="" /><img src={ignitionCase} alt="" /><img src={dragonCase} alt="" /></div>
        </section>

        <section className="editorial-modes" id="modes" aria-labelledby="modes-title">
          <header><p className="editorial-eyebrow">Как играть</p><h2 id="modes-title">Выбери свой формат</h2></header>
          <div className="editorial-modes__grid">
            {modes.map(([number, title, text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>
        </main>
      </div>
    </div>
  );
}
