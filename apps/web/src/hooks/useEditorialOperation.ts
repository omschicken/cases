import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { GameOperationDto } from "../lib/types";

type Pending = { type: GameOperationDto["type"]; started: number; ids: string[]; caseId?: string; previousIds: string[] };
type StoredOperation = GameOperationDto & { inputInventoryItemIds?: string[] };

/** Persist intent before a consuming request. An uncertain request can only be checked, never replayed. */
export function useEditorialOperation() {
  const { user } = useAuth();
  const key = `casecrow:editorial-operation:v1:${user?.id ?? "guest"}`;
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const running = useRef(false);
  useEffect(() => {
    const sync = () => {
      try { setPending(JSON.parse(localStorage.getItem(key) ?? "null")); }
      catch { setError("Не удалось прочитать состояние операции. Проверьте историю перед продолжением."); }
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);

  async function run<T>(intent: Omit<Pending, "started" | "previousIds">, path: string, body: unknown): Promise<T | undefined> {
    if (!user || running.current) return;
    running.current = true;
    setBusy(true); setError(""); setNotice("");
    const execute = async () => {
      if (localStorage.getItem(key)) { setPending(JSON.parse(localStorage.getItem(key)!)); return; }
      const previous = await api.get<GameOperationDto[]>("/games/operations/me");
      const record = { ...intent, started: Date.now(), previousIds: previous.map((value) => value.id) };
      localStorage.setItem(key, JSON.stringify(record));
      setPending(record);
      try {
        const result = await api.post<T>(path, body);
        localStorage.removeItem(key); setPending(null);
        window.dispatchEvent(new Event("casecrow:wallet-updated"));
        return result;
      } catch (reason) {
        if (reason instanceof ApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 408) {
          localStorage.removeItem(key); setPending(null);
        }
        throw reason;
      }
    };
    try {
      return navigator.locks ? await navigator.locks.request(key, { ifAvailable: true }, async (lock) => {
        if (!lock) { setError("Операция уже выполняется в другой вкладке. Дождитесь результата."); return; }
        return execute();
      }) : await execute();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выполнить операцию");
    } finally { running.current = false; setBusy(false); }
  }

  async function reconcile() {
    if (!pending || running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const history = await api.get<StoredOperation[]>("/games/operations/me");
      const found = history.find((operation) => operation.type === pending.type && !pending.previousIds.includes(operation.id) &&
        (pending.type === "BATTLE" ? operation.metadata?.caseId === pending.caseId : pending.ids.length === operation.inputInventoryItemIds?.length && pending.ids.every((id) => operation.inputInventoryItemIds?.includes(id))));
      if (found) {
        localStorage.removeItem(key); setPending(null);
        setNotice(`Операция найдена в истории: ${found.status === "WON" ? "успешный результат" : "без выигрыша"}. Инвентарь обновлён.`);
        window.dispatchEvent(new Event("casecrow:wallet-updated"));
        return true;
      }
      setError("Подтверждения в истории пока нет. Повторная операция заблокирована: обратитесь в поддержку с временем операции.");
    } catch { setError("Не удалось проверить историю. Повторное списание заблокировано."); }
    finally { running.current = false; setBusy(false); }
    return false;
  }
  return { run, reconcile, pending, busy, error, notice };
}
