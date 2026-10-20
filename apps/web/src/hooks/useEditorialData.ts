import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

export function useEditorialData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!path?.startsWith("/cases/inventory/")) return;
    window.addEventListener("casecrow:inventory-updated", refresh);
    return () => window.removeEventListener("casecrow:inventory-updated", refresh);
  }, [path, refresh]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    setLoading(!!path);
    if (path) api.get<T>(path).then((result) => { if (active) setData(result); }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Не удалось загрузить данные");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, revision]);
  return { data, loading, error, refresh };
}
