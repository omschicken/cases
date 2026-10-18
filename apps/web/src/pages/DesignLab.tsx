import { Link } from "react-router-dom";
import staticCase from "../assets/armory/static-case.png";
import ignitionCase from "../assets/armory/ignition-case.png";
import dragonCase from "../assets/armory/dragon-case.png";
import ak47 from "../assets/ak47.png";
import "../styles/design-lab.css";

const cases = [
  {
    name: "Static Case",
    code: "ST—01",
    price: "29,00 ₽",
    note: "Precision series",
    image: staticCase,
    tone: "static",
  },
  {
    name: "Ignition Case",
    code: "IG—07",
    price: "8,25 ₽",
    note: "Thermal series",
    image: ignitionCase,
    tone: "ignition",
  },
  {
    name: "Dragon Case",
    code: "DR—09",
    price: "499,00 ₽",
    note: "Relic series",
    image: dragonCase,
    tone: "dragon",
  },
] as const;

export function DesignLabPage() {
  return (
    <div className="armory-lab">
      <header className="armory-nav">
        <Link className="armory-brand" to="/" aria-label="DROPZONE">
          <span className="armory-brand__mark">DZ</span>
          <span>DROPZONE</span>
        </Link>
        <span className="armory-nav__edition">THE ARMORY · DESIGN LAB 01</span>
        <Link className="armory-nav__exit" to="/">Вернуться на сайт</Link>
      </header>

      <main>
        <section className="armory-hero" aria-labelledby="armory-title">
          <div className="armory-hero__copy">
            <p className="armory-kicker"><span>01</span> Digital weapons archive</p>
            <h1 id="armory-title">YOUR NEXT<br /><em>ICON.</em></h1>
            <p className="armory-hero__lead">
              Открывай коллекции с проверяемым результатом. Собирай редкие предметы и формируй собственный цифровой арсенал.
            </p>
            <div className="armory-actions">
              <a className="armory-cta" href="#armory-catalog">Исследовать коллекцию <span>↗</span></a>
              <span className="armory-proof">PROVABLY FAIR<br />SERVER VERIFIED</span>
            </div>
          </div>

          <div className="armory-stage" aria-label="Static Case и AK-47">
            <span className="armory-stage__halo" />
            <span className="armory-stage__rail armory-stage__rail--top">DROPZONE / OBJECT 001</span>
            <img className="armory-stage__weapon" src={ak47} alt="AK-47" />
            <img className="armory-stage__case" src={staticCase} alt="Static Case" />
            <div className="armory-stage__plate">
              <span>FEATURED OBJECT</span>
              <strong>STATIC CASE</strong>
              <small>Graphite / Ceramic / Cobalt</small>
            </div>
            <span className="armory-stage__index">01</span>
          </div>
        </section>

        <section className="armory-catalog" id="armory-catalog" aria-labelledby="catalog-title">
          <header className="armory-section-head">
            <div>
              <p className="armory-kicker"><span>02</span> Curated containers</p>
              <h2 id="catalog-title">SELECTED<br />CASES</h2>
            </div>
            <p>Три объекта. Три материала. Три самостоятельных характера. Каждый контейнер узнаваем ещё до прочтения названия.</p>
          </header>

          <div className="armory-grid">
            {cases.map((item, index) => (
              <article className={`armory-card armory-card--${item.tone}`} key={item.name} tabIndex={0}>
                <div className="armory-card__visual">
                  <span className="armory-card__code">{item.code}</span>
                  <span className="armory-card__number">0{index + 1}</span>
                  <img src={item.image} alt={item.name} />
                  <span className="armory-card__floor" />
                </div>
                <div className="armory-card__body">
                  <span>{item.note}</span>
                  <h3>{item.name}</h3>
                  <footer>
                    <strong>{item.price}</strong>
                    <button type="button" aria-label={`Открыть ${item.name}`}>Открыть <span>↗</span></button>
                  </footer>
                </div>
              </article>
            ))}
            <article className="armory-card armory-card--next" aria-label="Следующая коллекция">
              <span>04</span>
              <p>Следующий объект<br />в разработке</p>
              <strong>CLASSIFIED</strong>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
