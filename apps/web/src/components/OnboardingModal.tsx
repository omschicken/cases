import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "dz_onboarding_done";

const STEPS = [
  {
    icon: "01",
    title: "Пополни баланс",
    body: "Перейди в раздел «Кошелёк» и пополни счёт удобным способом. Минимальная сумма — 100 ₽.",
    action: null,
  },
  {
    icon: "02",
    title: "Открой кейс",
    body: "Выбери кейс на главной, нажми «Открыть» и смотри, как рулетка определяет твой предмет. Каждый результат провабли-фэир.",
    action: null,
  },
  {
    icon: "03",
    title: "Провабли-фэир",
    body: "Каждое открытие использует хэш серверного seed, твой клиентский seed и nonce. После ротации seed ты можешь независимо проверить любой результат.",
    action: null,
  },
  {
    icon: "04",
    title: "Игры и апгрейды",
    body: "Используй предметы из инвентаря в Контрактах или Апгрейдах — обменивай несколько предметов на один дороже.",
    action: <Link to="/#collections" className="feature-primary">К кейсам ↗</Link>,
  },
];

export function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // private mode — skip
    }
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-label="Добро пожаловать в CaseCrow">
      <div className="onboarding-modal">
        <button type="button" className="onboarding-close" onClick={dismiss} aria-label="Закрыть">✕</button>

        <div className="onboarding-steps-bar">
          {STEPS.map((_, i) => <span key={i} className={i <= step ? "active" : ""} aria-hidden="true" />)}
        </div>

        <div className="onboarding-icon" aria-hidden="true">{current.icon}</div>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-body">{current.body}</p>

        <div className="onboarding-actions">
          {current.action}
          <button type="button" className="game-run" onClick={next}>
            {step < STEPS.length - 1 ? "Далее →" : "Начать"}
          </button>
        </div>

        <span className="onboarding-counter">{step + 1} / {STEPS.length}</span>
      </div>
    </div>
  );
}
