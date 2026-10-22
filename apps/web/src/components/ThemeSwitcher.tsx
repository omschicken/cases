import { useEffect, useState } from "react";

type ThemePreference = "light" | "dark" | "system";
const STORAGE_KEY = "casecrow:theme";

function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch { return "system"; }
}

function applyTheme(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.casecrowTheme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#101210" : "#f5f2ea");
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemePreference>(readPreference);
  useEffect(() => {
    applyTheme(theme);
    const update = () => applyTheme(readPreference());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    const storage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) setTheme(readPreference()); };
    window.addEventListener("storage", storage);
    return () => { media.removeEventListener("change", update); window.removeEventListener("storage", storage); };
  }, [theme]);

  return <select className="fidelity-theme-select" aria-label="Тема оформления" title="Тема оформления"
    value={theme} onChange={(event) => {
      const next = event.target.value as ThemePreference;
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Storage may be unavailable. */ }
      setTheme(next);
      applyTheme(next);
    }}>
      <option value="light">Светлая</option>
      <option value="dark">Тёмная</option>
      <option value="system">Система</option>
    </select>;
}
