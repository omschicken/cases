import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatMinor } from "../../lib/money";
import { RARITY_LABELS, rarityColor } from "../../lib/rarity";
import type { CaseItem, OpenCaseResult } from "../../lib/types";
import { DropChamber } from "./DropChamber";

export type ProtocolPhase = "arming" | "reveal";

const PHASE_ORDER: ProtocolPhase[] = ["arming", "reveal"];

interface DropProtocolProps {
  phase: ProtocolPhase;
  caseName: string;
  /** The item that dropped. Null until the server has answered. */
  item: CaseItem | null;
  /** Full server payload, when this was a real opening rather than a demo. */
  result: OpenCaseResult | null;
  /** The item's real chance, from the same weights the server rolls against. */
  oddsPercent?: string;
  /** Rendered chest during ARMING — owns its own fullscreen burst/reveal
   *  sequence once opening=true, so this component's stage underneath it
   *  doesn't matter visually. */
  caseChest?: ReactNode;
  /** True while the chest's opening animation is running — adds screen-wide flash. */
  isOpening?: boolean;
  /** Rarity of the dropped item — drives per-rarity reveal styling. */
  itemRarity?: string;
  /** Ends the animation early. The outcome is already final, so this only
   *  stops the animation — it never re-rolls. */
  onSkip: () => void;
  onClose: () => void;
  onOpenAgain?: () => void;
  canOpenAgain?: boolean;
}

/**
 * DROP PROTOCOL — the opening staged as one scene.
 *
 * Presentation only. The result arrives already decided; this component
 * cannot influence it, and intentionally offers no near-miss effect.
 */
export function DropProtocol({
  phase, caseName, item, result, oddsPercent, caseChest, isOpening = false,
  itemRarity, onSkip, onClose, onOpenAgain, canOpenAgain = false,
}: DropProtocolProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Restore focus to whatever opened the scene, so keyboard users are not
  // dropped at the top of the document when it closes.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    return () => returnFocusRef.current?.focus?.();
  }, []);

  // Move focus into the scene once per phase that offers a control, so the
  // first Tab lands inside rather than behind the overlay.
  useEffect(() => {
    if (phase === "reveal") closeRef.current?.focus();
    else skipRef.current?.focus();
  }, [phase]);

  // The page behind must not scroll while the scene is up.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  // Esc skips the animation, then closes — so one key always does the
  // obvious thing at every phase.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (phase === "reveal") onClose();
        else onSkip();
        return;
      }
      if (event.key !== "Tab") return;

      // Focus trap.
      const focusable = rootRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [phase, onClose, onSkip]);

  const accent = item ? rarityColor(item.rarity) : undefined;
  const phaseIndex = PHASE_ORDER.indexOf(phase);
  const isApex = itemRarity === "COVERT" || itemRarity === "GOLD";
  const isHighRarity = isApex || itemRarity === "CLASSIFIED";

  const phaseLabel = {
    arming: t("caseDetail.unlocking", { defaultValue: "Открываем замок…" }),
    reveal: t("caseDetail.resultKicker", { defaultValue: "Предмет получен" }),
  }[phase];

  // Demo openings carry no server payload and must stay visibly distinct
  // from a real one, so nobody mistakes a free spin for a credited item.
  const isDemo = item !== null && result === null;

  // Rendered into body, not in place. Ancestors on the case page carry
  // transforms (the hero art tilt among them), and a transformed ancestor
  // becomes the containing block for position:fixed — which stretched this
  // overlay to the full 2082px page height on a 900px viewport and pushed
  // its footer, including the button that closes it, off-screen.
  const rarityClass = itemRarity ? ` dz-protocol--rarity-${itemRarity}` : "";

  return createPortal(
    <div
      ref={rootRef}
      className={`dz-protocol${isOpening ? " dz-protocol--opening" : ""}${rarityClass}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("caseDetail.openingStation", { defaultValue: "Case opening" })}
      style={accent ? ({ "--dz-rarity": accent } as CSSProperties) : undefined}
    >
      <p className="dz-protocol__live" role="status" aria-live="polite">
        {phase === "reveal" && item
          ? t("caseDetail.youGot", { name: item.name, defaultValue: `Выпал предмет: ${item.name}` })
          : phaseLabel}
      </p>

      <div className="dz-protocol__bar">
        <span className="dz-protocol__phase">
          <b>{String(phaseIndex + 1).padStart(2, "0")}</b>
          <span>{phaseLabel}</span>
        </span>
        <span className="dz-protocol__pips" aria-hidden="true">
          {PHASE_ORDER.map((p, i) => (
            <span key={p} className={`dz-protocol__pip${i <= phaseIndex ? " is-done" : ""}`} />
          ))}
        </span>
      </div>

      {/* Apex darkness veil: covers the stage for COVERT/GOLD reveal, then fades */}
      {isApex && phase === "reveal" && (
        <div className="dz-protocol__veil" aria-hidden="true" />
      )}

      <div className="dz-protocol__stage">
        {phase === "reveal" && item ? (
          isApex ? (
            // Apex reveal: no chamber frame — item fills the stage freely
            <div className="dz-protocol__reveal dz-protocol__reveal--apex">
              <div className="dz-protocol__item-art dz-protocol__item-art--apex">
                <img src={item.imageUrl} alt={item.name} />
              </div>
              <div className="dz-protocol__item">
                <span className="dz-protocol__item-rarity">
                  {t(`rarity.${item.rarity}`, { defaultValue: RARITY_LABELS[item.rarity] })}
                </span>
                <h2 className="dz-protocol__item-name">{item.name}</h2>
                <p className="dz-protocol__item-value">
                  {formatMinor(item.valueMinor, item.currency)}
                </p>
                {oddsPercent && (
                  <p className="dz-protocol__item-odds">
                    {t("caseDetail.thisChance", {
                      chance: oddsPercent,
                      defaultValue: `Шанс этого предмета — ${oddsPercent}%`,
                    })}
                  </p>
                )}
                {isDemo && (
                  <p className="dz-protocol__item-odds">
                    {t("caseDetail.demoResultLabel", { defaultValue: "ДЕМО — предмет не зачислен" })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            // Standard reveal: item stays in the chamber it came from
            <div className="dz-protocol__reveal">
              <DropChamber
                className="dz-protocol__chamber"
                state="revealed"
                rarityColor={accent}
                depth={220}
                hudLeft={caseName}
                hudRight={t(`rarity.${item.rarity}`, { defaultValue: RARITY_LABELS[item.rarity] })}
              >
                <div className={`dz-protocol__item-art${isHighRarity ? " dz-protocol__item-art--high" : ""}`}>
                  <img src={item.imageUrl} alt={item.name} />
                </div>
              </DropChamber>
              <div className="dz-protocol__item">
                <span className="dz-protocol__item-rarity">
                  {t(`rarity.${item.rarity}`, { defaultValue: RARITY_LABELS[item.rarity] })}
                </span>
                <h2 className="dz-protocol__item-name">{item.name}</h2>
                <p className="dz-protocol__item-value">
                  {formatMinor(item.valueMinor, item.currency)}
                </p>
                {oddsPercent && (
                  <p className="dz-protocol__item-odds">
                    {t("caseDetail.thisChance", {
                      chance: oddsPercent,
                      defaultValue: `Шанс этого предмета — ${oddsPercent}%`,
                    })}
                  </p>
                )}
                {isDemo && (
                  <p className="dz-protocol__item-odds">
                    {t("caseDetail.demoResultLabel", { defaultValue: "ДЕМО — предмет не зачислен" })}
                  </p>
                )}
              </div>
            </div>
          )
        ) : isOpening ? (
          // Opening burst: no chamber frame so the explosion fills the stage.
          <div className="dz-protocol__burst-stage">
            {caseChest ?? null}
          </div>
        ) : (
          <DropChamber
            className="dz-protocol__chamber"
            state="armed"
            rarityColor={accent}
            depth={220}
            hudLeft={caseName}
            status={phaseLabel}
          >
            <div className="dz-protocol__case">
              {caseChest ?? null}
            </div>
          </DropChamber>
        )}
      </div>

      <div className="dz-protocol__actions">
        {phase === "reveal" ? (
          <>
            <button
              ref={closeRef}
              type="button"
              className="dz-protocol__btn dz-protocol__btn--primary"
              onClick={onClose}
            >
              {t("caseDetail.continue", { defaultValue: "Продолжить" })}
            </button>
            {!isDemo && (
              <Link to="/inventory" className="dz-protocol__btn">
                {t("caseDetail.claim", { defaultValue: "Забрать в инвентарь" })}
              </Link>
            )}
            {canOpenAgain && onOpenAgain && (
              <button type="button" className="dz-protocol__btn" onClick={onOpenAgain}>
                {t("caseDetail.openAgain", { defaultValue: "Открыть ещё" })}
              </button>
            )}
          </>
        ) : (
          <button
            ref={skipRef}
            type="button"
            className="dz-protocol__btn dz-protocol__skip"
            onClick={onSkip}
          >
            {t("caseDetail.skipAnimation", { defaultValue: "Пропустить анимацию" })}
          </button>
        )}
      </div>

      {phase === "reveal" && result && (
        <details className="dz-protocol__fair">
          <summary>{t("caseDetail.roundDetails", { defaultValue: "Детали раунда" })}</summary>
          <dl>
            <dt>roll</dt><dd>{result.roll.toFixed(8)}</dd>
            <dt>nonce</dt><dd>{result.nonce}</dd>
            <dt>server seed hash</dt><dd>{result.serverSeedHash}</dd>
            <dt>client seed</dt><dd>{result.clientSeed}</dd>
          </dl>
          <Link to={`/verify/${result.openEventId}`}>
            {t("caseDetail.verifyThisResult", { defaultValue: "Проверить результат" })}
          </Link>
        </details>
      )}
    </div>,
    document.body,
  );
}
