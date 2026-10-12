import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

type Feature = "battles" | "contracts" | "upgrader" | "cards";

const content = {
  ru: {
    battles: { number: "01", eyebrow: "АРЕНА / ДУЭЛИ", lead: "Один кейс. Два игрока. Один исход.", detail: "Сражения кейсов появятся здесь после запуска серверного матчинга и проверки результатов. Сейчас можно изучить коллекцию и подготовить свой выбор.", steps: ["Выбери кейс", "Пригласи соперника", "Смотри результат"], art: ["VS", "01 / 01", "БИТВА КЕЙСОВ"] },
    contracts: { number: "02", eyebrow: "МАСТЕРСКАЯ / КОНТРАКТЫ", lead: "Собери предметы в новую возможность.", detail: "Контракты будут использовать предметы из твоего инвентаря. Мы откроем их, когда обмен и расчёт результата будут готовы на сервере.", steps: ["Собери предметы", "Проверь условия", "Подтверди обмен"], art: ["03 → 01", "ПРЕДМЕТЫ", "КОНТРАКТ"] },
    upgrader: { number: "03", eyebrow: "ЛАБОРАТОРИЯ / АПГРЕЙД", lead: "Цель выше. Решение за тобой.", detail: "Апгрейд покажет точный шанс и стоимость до подтверждения. Пока механика не подключена к серверу, предметы и баланс остаются без изменений.", steps: ["Выбери предмет", "Оцени шанс", "Подтверди попытку"], art: ["↑", "ЦЕЛЬ", "АПГРЕЙД"] },
    cards: { number: "04", eyebrow: "АРХИВ / КАРТОЧКИ", lead: "Коллекция, которую хочется собрать.", detail: "Карточки станут отдельной коллекцией с понятными сериями и редкостью. Выпуск и хранение карточек ещё готовятся.", steps: ["Открой серию", "Изучи редкость", "Собери набор"], art: ["DZ", "SERIES / 01", "КАРТОЧКИ"] },
    browse: "Смотреть кейсы", inventory: "Мой инвентарь", status: "РАЗДЕЛ ГОТОВИТСЯ", next: "КАК ЭТО БУДЕТ РАБОТАТЬ", now: "ДОСТУПНО СЕЙЧАС", nowText: "Каталог кейсов и твой инвентарь уже доступны. Игровые действия в этом разделе пока отключены.",
  },
  en: {
    battles: { number: "01", eyebrow: "ARENA / DUELS", lead: "One case. Two players. One outcome.", detail: "Case battles will appear here once server-side matchmaking and result verification are ready. Explore the collection and choose your case for now.", steps: ["Choose a case", "Invite a rival", "Watch the result"], art: ["VS", "01 / 01", "CASE BATTLE"] },
    contracts: { number: "02", eyebrow: "WORKSHOP / CONTRACTS", lead: "Turn your items into a new possibility.", detail: "Contracts will use items from your inventory. They will open when the exchange and result calculation are ready on the server.", steps: ["Select items", "Review terms", "Confirm exchange"], art: ["03 → 01", "ITEMS", "CONTRACT"] },
    upgrader: { number: "03", eyebrow: "LAB / UPGRADE", lead: "Aim higher. Make the call.", detail: "Upgrade will show exact odds and cost before confirmation. Until the server mechanic is ready, your items and balance stay untouched.", steps: ["Choose an item", "Review the odds", "Confirm attempt"], art: ["↑", "TARGET", "UPGRADE"] },
    cards: { number: "04", eyebrow: "ARCHIVE / CARDS", lead: "A collection worth completing.", detail: "Cards will have their own series and clear rarity. Issuing and storing cards is still in development.", steps: ["Explore a series", "Check rarity", "Complete a set"], art: ["DZ", "SERIES / 01", "CARDS"] },
    browse: "Browse cases", inventory: "My inventory", status: "IN DEVELOPMENT", next: "HOW IT WILL WORK", now: "AVAILABLE NOW", nowText: "The case catalog and your inventory are already available. Game actions in this section are currently disabled.",
  },
} as const;

export function FeatureShowcase({ feature, title }: { feature: Feature; title: string }) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const copy = i18n.language.startsWith("ru") ? content.ru : content.en;
  const page = copy[feature];

  return (
    <div className={`feature-page feature-page--${feature}`}>
      <div className="feature-page-top"><span>DROPZONE / {page.number}</span><span>{copy.status}</span></div>
      <section className="feature-hero">
        <div className="feature-hero-copy">
          <span className="section-kicker">{page.eyebrow}</span>
          <h1>{title}</h1>
          <p className="feature-lead">{page.lead}</p>
          <p className="feature-detail">{page.detail}</p>
          <div className="feature-actions">
            <Link to="/#collections" className="feature-primary">{copy.browse} <span aria-hidden="true">↗</span></Link>
            {user && <Link to="/inventory" className="feature-secondary">{copy.inventory}</Link>}
          </div>
        </div>
        <div className="feature-art" aria-hidden="true">
          <span className="feature-art-index">DZ / {page.number} — 26</span>
          <div className="feature-art-object"><span>{page.art[0]}</span></div>
          <div className="feature-art-base"><span>{page.art[1]}</span><strong>{page.art[2]}</strong></div>
        </div>
      </section>
      <section className="feature-steps" aria-label={copy.next}>
        <div className="feature-section-head"><span>{copy.next}</span><span>01 — 03</span></div>
        <div className="feature-step-grid">{page.steps.map((step, index) => <article key={step}><span>0{index + 1}</span><h2>{step}</h2><i aria-hidden="true">↗</i></article>)}</div>
      </section>
      <aside className="feature-availability"><span>{copy.now}</span><p>{copy.nowText}</p><Link to="/#collections">{copy.browse} ↗</Link></aside>
    </div>
  );
}
