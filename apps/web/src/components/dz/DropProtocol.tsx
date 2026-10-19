import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMinor } from "../../lib/money";
import { RARITY_LABELS, rarityColor } from "../../lib/rarity";
import type { CaseItem, OpenCaseResult } from "../../lib/types";
import { EditorialItemImage } from "../editorial/EditorialItemImage";

export type ProtocolPhase = "arming" | "reveal";

interface DropProtocolProps {
  phase: ProtocolPhase;
  caseName: string;
  caseImageUrl: string;
  item: CaseItem | null;
  result: OpenCaseResult | null;
  oddsPercent?: string;
  isOpening?: boolean;
  onSkip: () => void;
  onClose: () => void;
  onOpenAgain?: () => void;
  canOpenAgain?: boolean;
}

function splitCondition(name: string) {
  const match = name.match(/^(.*?)\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/);
  return match ? { base: match[1], condition: match[2] } : { base: name, condition: "" };
}

export function DropProtocol({
  phase, caseName, caseImageUrl, item, result, oddsPercent, isOpening = false,
  onSkip, onClose, onOpenAgain, canOpenAgain = false,
}: DropProtocolProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      returnFocusRef.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        phase === "reveal" ? onClose() : onSkip();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = rootRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),summary,[tabindex]:not([tabindex="-1"])');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [phase, onClose, onSkip]);

  const isDemo = Boolean(item && !result);
  const accent = item ? rarityColor(item.rarity) : "#879184";
  const itemName = item ? splitCondition(item.name) : null;

  return createPortal(
    <div ref={rootRef} className="dze-opening" role="dialog" aria-modal="true" aria-label={t("caseDetail.openingStation", { defaultValue: "Открытие кейса" })} style={{ "--dze-accent": accent } as CSSProperties}>
      <div className="dze-opening__dialog">
        <header className="dze-opening__head">
          <span>CASECROW / OPENING</span>
          {phase === "reveal" && <button type="button" onClick={onClose} aria-label={t("common.close", { defaultValue: "Закрыть" })}>×</button>}
        </header>
        <div className={`dze-opening__visual ${phase === "reveal" ? "is-result" : "is-opening"}`}>
          <span className="dze-opening__ring" aria-hidden="true" />
          {phase === "reveal" && item
            ? <EditorialItemImage className="dze-opening__item" name={item.name} imageUrl={item.imageUrl} loading="eager" />
            : <img className="dze-opening__case" src={caseImageUrl} alt={caseName} />}
        </div>
        <div className="dze-opening__bottom">
          <div>
            <small>{phase === "reveal" ? (isDemo ? t("caseDetail.demoResultLabel", { defaultValue: "ДЕМО — предмет не зачислен" }) : t("caseDetail.resultKicker", { defaultValue: "ПРЕДМЕТ ПОЛУЧЕН" })) : t("caseDetail.unlocking", { defaultValue: "ОТКРЫВАЕМ КЕЙС" })}</small>
            <h2>{phase === "reveal" && itemName ? itemName.base : caseName}</h2>
            {phase === "reveal" && item
              ? <p>{itemName?.condition ? `${itemName.condition} · ` : ""}{RARITY_LABELS[item.rarity]} · {formatMinor(item.valueMinor, item.currency)}{oddsPercent ? ` · ${oddsPercent}%` : ""}</p>
              : <p>{isOpening ? t("caseDetail.awaitingServer", { defaultValue: "Результат определяется сервером. Анимация не влияет на выигрыш." }) : t("caseDetail.unlocking", { defaultValue: "Открываем кейс" })}</p>}
          </div>
          <div className="dze-opening__actions">
            {phase === "reveal" ? <>
              <button ref={primaryRef} type="button" className="dze-opening__primary" onClick={onClose}>{t("caseDetail.continue", { defaultValue: "Продолжить" })}</button>
              {!isDemo && <Link to="/inventory">{t("caseDetail.claim", { defaultValue: "В инвентарь" })}</Link>}
              {canOpenAgain && onOpenAgain && <button type="button" onClick={onOpenAgain}>{t("caseDetail.openAgain", { defaultValue: "Открыть ещё" })}</button>}
            </> : <button ref={primaryRef} type="button" className="dze-opening__primary" onClick={onSkip}>{t("caseDetail.skipAnimation", { defaultValue: "Пропустить анимацию" })}</button>}
          </div>
        </div>
        <footer className="dze-opening__note">
          {isDemo ? "ДЕМО · БЕЗ ТРАНЗАКЦИЙ" : result ? <Link to={`/verify/${result.openEventId}`}>{t("caseDetail.verifyThisResult", { defaultValue: "Проверить результат" })}</Link> : "SERVER RESULT PENDING"}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
