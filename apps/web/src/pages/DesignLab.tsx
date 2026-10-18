import { Link } from "react-router-dom";
import staticCase from "../assets/armory/static-case.png";
import ignitionCase from "../assets/armory/ignition-case.png";
import dragonCase from "../assets/armory/dragon-case.png";
import ak47 from "../assets/ak47.png";
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
  return (
    <div className="editorial-lab">
      <header className="editorial-nav">
        <Link className="editorial-brand" to="/" aria-label="DROPZONE"><b>D</b><span>Dropzone</span></Link>
        <nav className="editorial-links" aria-label="Навигация Design Lab">
          <a className="is-active" href="#catalog">Кейсы</a><a href="#modes">Сражения</a><a href="#modes">Контракты</a><a href="#modes">Апгрейд</a><a href="#about">Коллекции</a>
        </nav>
        <div className="editorial-tools">
          <button className="editorial-search" type="button" aria-label="Поиск">⌕</button>
          <button className="editorial-balance" type="button">0,00 ₽</button>
          <button className="editorial-login" type="button">Войти</button>
          <button className="editorial-lang" type="button" aria-label="Язык">RU</button>
        </div>
      </header>

      <div className="editorial-layout">
        <aside className="editorial-sidebar" aria-label="Разделы">
          <nav>
            <a className="is-active" href="#catalog"><span>▣</span>Кейсы</a>
            <a href="#modes"><span>⚔</span>Сражения</a>
            <a href="#modes"><span>◇</span>Контракты</a>
            <a href="#modes"><span>↥</span>Апгрейд</a>
            <a href="#about"><span>□</span>Инвентарь</a>
          </nav>
          <a className="editorial-reward" href="#about"><span>♙</span><b>Ежедневные<br />награды</b><i>↗</i></a>
        </aside>
        <main className="editorial-main">
        <section className="editorial-hero" aria-labelledby="editorial-title">
          <div className="editorial-hero__copy">
            <p className="editorial-eyebrow">Новая коллекция · 2026</p>
            <h1 id="editorial-title">Предметы,<br />которые хочется<br /><em>сохранить.</em></h1>
            <p className="editorial-hero__lead">Авторские коллекции кейсов и реальные предметы CS2. Честный результат, ясные правила и спокойный интерфейс без лишнего шума.</p>
            <div className="editorial-actions">
              <a className="editorial-primary" href="#catalog">Смотреть кейсы <span>↗</span></a>
              <span className="editorial-caption">18+ · Играйте ответственно</span>
            </div>
          </div>
          <div className="editorial-product" aria-label="Static Case и AK-47">
            <span className="editorial-product__wash" />
            <img className="editorial-product__weapon" src={ak47} alt="AK-47" />
            <img className="editorial-product__case" src={staticCase} alt="Static Case" />
            <div className="editorial-product__label"><span>Коллекция 01</span><strong>Static Case</strong><small>От 29,00 ₽</small></div>
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
            {cases.map((item) => (
              <article className={`editorial-card editorial-card--${item.tone}`} key={item.name} tabIndex={0}>
                <div className="editorial-card__visual"><img src={item.image} alt={item.name} /><span /></div>
                <div className="editorial-card__body">
                  <small>{item.note}</small><h3>{item.name}</h3>
                  <footer><strong>{item.price}</strong><button type="button" aria-label={`Открыть ${item.name}`}>Открыть</button></footer>
                </div>
              </article>
            ))}
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
