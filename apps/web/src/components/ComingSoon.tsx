import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export function ComingSoon({ title, description, icon }: ComingSoonProps) {
  const { t } = useTranslation();
  return (
    <div className="coming-soon">
      <div className="coming-soon-icon">{icon}</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link to="/" className="open-button">
        {t("comingSoon.browseCases")}
      </Link>
    </div>
  );
}
