import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/base.css";
import "./styles/dz-tokens.css";
import "./styles/casecrow-brand.css";
import "./styles/editorial-fonts.css";
import "./i18n";
import App from "./App";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
