import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Loaded after index.css so the dz- system wins on source order. It shares no
// selector with the legacy sheet, so this is belt-and-braces, not a fix.
import "./styles/dz-tokens.css";
import "./styles/dz-chamber.css";
import "./styles/dz-card.css";
import "./styles/dz-hero.css";
import "./styles/dz-protocol.css";
import "./i18n";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
