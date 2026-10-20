export const API_URL = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "/api";

const ACCESS_TOKEN_KEY = "cs2cases.accessToken";
const REFRESH_TOKEN_KEY = "cs2cases.refreshToken";
const REQUEST_TIMEOUT_MS = 8_000;
const MUTATION_TIMEOUT_MS = 30_000;

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  if (import.meta.env.VITE_CASECROW_AUDIT === "1") {
    const { auditRequest } = await import("./auditSandbox");
    return auditRequest(path, options) as Promise<T>;
  }
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.method && options.method !== "GET" ? MUTATION_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "Сервис отвечает слишком долго"
        : "Сервис временно недоступен";
    throw new ApiError(message, 0);
  } finally {
    window.clearTimeout(timeout);
  }

  if (res.status === 401 && retry && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(body.message ?? "Request failed", res.status);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json() as T;
  if (options.method && options.method !== "GET" &&
      /^\/(?:cases\/open(?:-batch)?|cases\/inventory\/[^/]+\/sell|games\/(?:contracts|upgrades|battles)|payments\/|wallet\/|bonuses\/)/.test(path) &&
      !path.endsWith("/quote")) {
    window.dispatchEvent(new Event("casecrow:wallet-updated"));
    window.dispatchEvent(new Event("casecrow:inventory-updated"));
    try { localStorage.setItem("casecrow:wallet-revision", String(Date.now())); } catch { /* optional cross-tab update */ }
  }
  return data;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
      signal: controller.signal,
    });
    window.clearTimeout(timeout);
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const tokens = await res.json();
    setTokens(tokens.accessToken, tokens.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

/** Deduplicate expensive, public reads while keeping account/financial data uncached. */
const publicGetCache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();
function cachedGet<T>(path: string): Promise<T> {
  if (path !== "/cases" && path !== "/games/upgrade-targets") return request<T>(path, { method: "GET" });
  const now = Date.now();
  const cached = publicGetCache.get(path);
  if (cached && cached.expiresAt > now) return cached.value as Promise<T>;
  const value = request<T>(path, { method: "GET" }).catch(error => {
    publicGetCache.delete(path);
    throw error;
  });
  publicGetCache.set(path, { expiresAt: now + 20_000, value });
  return value;
}

export const api = {
  get: <T>(path: string) => cachedGet<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
};
