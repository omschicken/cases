import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SkipForward, Volume2, VolumeX } from "lucide-react";
import type { CaseDto, CaseItem } from "../lib/types";
import { resolveCaseArt } from "../lib/caseArt";
import { CASECROW_ORIGINALS_BY_SLUG } from "../lib/casecrowOriginals";
import { CaseReel } from "./CaseReel";
import "../styles/raven-integration.css";
import { EditorialItemImage } from "./editorial/EditorialItemImage";

interface Props {
  theCase: CaseDto;
  winner: CaseItem | null;
  winners?: CaseItem[];
  opening: boolean;
  actions: ReactNode;
  resultView: ReactNode;
  onComplete: () => void;
  onSkip: () => void;
}

export function CaseOpeningScene({ theCase, winner, winners = [], opening, actions, resultView, onComplete, onSkip }: Props) {
  const [sound, setSound] = useState(false);
  const stage = useRef<HTMLElement | null>(null);
  const finishedReels = useRef(new Set<number>());
  useEffect(() => { finishedReels.current.clear(); }, [opening]);
  function reelCompleted(index: number, total: number) {
    finishedReels.current.add(index);
    if (finishedReels.current.size >= total) onComplete();
  }
  useEffect(() => {
    if (opening) stage.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [opening]);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => () => { void audio.current?.close(); }, []);
  function toggleSound() {
    if (!sound) {
      try { audio.current ??= new AudioContext(); void audio.current.resume(); } catch { return; }
    }
    setSound(!sound);
  }
  function tick() {
    const ctx = audio.current;
    if (!sound || !ctx || ctx.state !== "running") return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.setValueAtTime(640, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + .025);
    gain.gain.setValueAtTime(.018, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .025);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(); oscillator.stop(ctx.currentTime + .03);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  const isRaven = theCase.slug === "raven";
  const art = resolveCaseArt(theCase.slug, theCase.imageUrl);
  const featured = [...theCase.items].sort((a, b) => Number(BigInt(b.valueMinor) - BigInt(a.valueMinor))).slice(0, 5);
  return <div className={"cc-opening-page" + (isRaven ? " cc-raven-page" : "")} style={{ "--cc-case-art": `url("${art}")` } as CSSProperties}>
    {!isRaven && <header className="cc-opening-hero">
      <div className="cc-opening-hero__copy">
        <nav aria-label="Навигация"><Link to="/">Кейсы</Link><span>/</span><span>{theCase.name}</span></nav>
        <h1>{CASECROW_ORIGINALS_BY_SLUG.has(theCase.slug) ? theCase.name : resultView ? "Твоя новая история" : "Открытие кейса"}</h1>
        
      </div>
      <div className="cc-opening-tools">
        <button type="button" onClick={toggleSound} aria-pressed={sound}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}<span>Звук</span></button>
        {opening && <button type="button" className="cc-skip" onClick={onSkip}><SkipForward size={18} /><span>Пропустить</span></button>}
      </div>
    </header>}
    <section ref={stage} className="cc-opening-stage" aria-label="Открытие кейса" data-opening={opening}>
      {resultView || (opening && !winner
        ? <div className="cc-opening-wait" role="status"><span /><h2>Подтверждаем открытие</h2><p>Ожидаем ответ сервера. Повторное нажатие не требуется.</p><button type="button" onClick={onSkip}>Показать результат без анимации</button></div>
        : theCase.items.length > 0 && (opening && winners.length > 1
          ? <div className="cc-multi-reels" data-count={winners.length}>{winners.map((item, index) => <div className="cc-multi-reels__row" key={index}><span className="cc-multi-reels__number">{index + 1} / {winners.length}</span><CaseReel items={theCase.items} winner={item} onComplete={() => reelCompleted(index, winners.length)} onTick={tick} /></div>)}</div>
          : <CaseReel key={opening ? "spin" : "preview"} items={theCase.items} winner={winner ?? theCase.items[0]} preview={!opening} onComplete={onComplete} onTick={tick} />))}
      
      {isRaven && <div className="cc-raven-scene-tools"><nav aria-label="Навигация"><Link to="/">Кейсы</Link><span>/</span><span>Raven</span></nav><div className="cc-raven-scene-tools__right"><button type="button" onClick={toggleSound} aria-pressed={sound}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}<span>Звук</span></button>{opening && <button type="button" onClick={onSkip}><SkipForward size={17} /><span>Пропустить</span></button>}</div></div>}
      {!opening && !resultView && <div className={"cc-opening-commit" + (isRaven ? " cc-raven-scene-controls" : "")}>{actions}</div>}
    </section>
    <section className="cc-collection" aria-label="Коллекция и содержимое кейса">
      <div className="cc-collection__cover">
        <div><span className="cc-collection__badge">◈ CS2</span><h2>{theCase.name}</h2></div>
      </div>
      <div className="cc-collection__contents">
        <header><h2>Содержимое кейса</h2><a href="#all-case-items">Все скины <span>→</span></a></header>
        <div className="cc-collection__items">{featured.map(item => {
          const [weapon, finish] = item.name.replace(/ \([^)]*\)$/, "").split(" | ");
          return <article key={item.id} data-rarity={item.rarity}>
            <EditorialItemImage name={item.name} imageUrl={item.imageUrl} decorative />
            <strong>{weapon}</strong><span>{finish}</span><i />
          </article>;
        })}</div>
      </div>
    </section>
    {resultView && <div className={"cc-after-result" + (isRaven ? " cc-raven-after-result" : "")}>{actions}</div>}
  </div>;
}
