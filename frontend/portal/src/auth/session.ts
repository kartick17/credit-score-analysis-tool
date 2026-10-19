import Keycloak from "keycloak-js";
import type { QueryClient } from "@tanstack/react-query";

export interface Access {
  subject: string;
  roles: string[];
  branchId: string | null;
  canRead: boolean;
  canWrite: boolean;
}
export type Session =
  | { status: "signed-out" | "loading" | "error" }
  | { status: "ready"; access: Access };
const returnKey = "credit-risk.return-path";
const allowedPaths = ["/customers", "/assessments", "/reports", "/forbidden"];
const mock = import.meta.env.VITE_MOCK_MODE === "true";
let state: Session = { status: "signed-out" };
let client: Keycloak | undefined;
let cache: QueryClient;
let generation = 0;
let refresh: Promise<boolean> | undefined;
const listeners = new Set<() => void>();

function publish(next: Session) {
  state = next;
  listeners.forEach((listener) => listener());
}
function clear(status: "signed-out" | "error" = "signed-out") {
  generation++;
  void cache?.cancelQueries();
  cache?.clear();
  publish({ status });
}
export const session = {
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export async function initializeSession(queryClient: QueryClient) {
  cache = queryClient;
  if (mock) return;
  if (allowedPaths.includes(location.pathname))
    sessionStorage.setItem(returnKey, location.pathname);
  publish({ status: "loading" });
  const identityUrl = import.meta.env.VITE_OIDC_URL || "http://localhost:8180";
  client = new Keycloak({
    url: identityUrl,
    realm: "credit-risk",
    clientId: "credit-risk-portal",
  });
  client.onAuthLogout = () => clear();
  client.onAuthRefreshError = () => expireSession();
  client.onTokenExpired = () => {
    void accessToken().catch(() => expireSession());
  };
  try {
    const discovery = await fetch(
      `${identityUrl}/realms/credit-risk/.well-known/openid-configuration`,
      {
        signal: AbortSignal.timeout(3000),
        credentials: "omit",
      },
    );
    if (!discovery.ok) throw new Error("Identity unavailable");
    const authenticated = await client.init({
      onLoad: "check-sso",
      pkceMethod: "S256",
      flow: "standard",
      responseMode: "query",
      checkLoginIframe: false,
      messageReceiveTimeout: 3000,
      redirectUri: `${location.origin}/sign-in`,
    });
    if (!authenticated) {
      clear();
      return;
    }
    const response = await apiFetch("/api/v1/customers/access");
    if (!response.ok) throw new Error("Access unavailable");
    const access: Access = await response.json();
    const returnPath = sessionStorage.getItem(returnKey);
    sessionStorage.removeItem(returnKey);
    if (
      location.pathname === "/sign-in" &&
      returnPath &&
      allowedPaths.includes(returnPath)
    ) {
      history.replaceState(null, "", returnPath);
    }
    cache.clear();
    publish({ status: "ready", access });
  } catch {
    client.clearToken();
    clear("error");
  }
}

export function expireSession() {
  sessionStorage.removeItem(returnKey);
  client?.clearToken();
  clear();
}
async function accessToken() {
  const started = generation;
  if (!client?.authenticated) throw new Error("Sign in required");
  refresh ??= client.updateToken(30).finally(() => {
    refresh = undefined;
  });
  try {
    await refresh;
  } catch {
    expireSession();
    throw new Error("Sign in required");
  }
  if (started !== generation) {
    client.clearToken();
    throw new Error("Session changed");
  }
  if (!client.token) throw new Error("Sign in required");
  return client.token;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  if (mock) return fetch(path, options);
  const started = generation;
  const token = await accessToken();
  if (started !== generation) throw new Error("Session changed");
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  if (started !== generation) throw new Error("Session changed");
  if (response.status === 401) expireSession();
  return response;
}

export async function signIn() {
  try {
    await client?.login({ redirectUri: `${location.origin}/sign-in` });
  } catch {
    clear("error");
  }
}
export async function signOut() {
  const url = client?.createLogoutUrl({
    redirectUri: `${location.origin}/sign-in`,
  });
  expireSession();
  if (url) window.location.assign(url);
}
