import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export function ComingSoon({ title, description, icon }: ComingSoonProps) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-icon">{icon}</div>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link to="/" className="open-button">
        Browse cases instead
      </Link>
    </div>
  );
}
