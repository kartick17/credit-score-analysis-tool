import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const adapter = vi.hoisted(() => ({
  authenticated: true,
  token: "memory-only-token" as string | undefined,
  init: vi.fn(async () => true),
  updateToken: vi.fn(async () => false),
  clearToken: vi.fn(),
  login: vi.fn(),
  createLogoutUrl: vi.fn(),
  onAuthLogout: undefined as (() => void) | undefined,
  onAuthRefreshError: undefined as (() => void) | undefined,
  onTokenExpired: undefined as (() => void) | undefined,
}));
vi.mock("keycloak-js", () => ({
  default: class {
    constructor() {
      return adapter;
    }
  },
}));
const access = {
  subject: "sample-user",
  roles: ["OFFICER"],
  branchId: "BR-001",
  canRead: true,
  canWrite: true,
};
let cache: QueryClient;
let auth: typeof import("./session");
let request: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("VITE_MOCK_MODE", "false");
  vi.clearAllMocks();
  adapter.authenticated = true;
  adapter.token = "memory-only-token";
  adapter.init.mockResolvedValue(true);
  adapter.updateToken.mockResolvedValue(false);
  adapter.clearToken.mockImplementation(() => {
    adapter.token = undefined;
  });
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  request = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json(access));
  vi.stubGlobal("fetch", request);
  auth = await import("./session");
});
afterEach(() => {
  cache.clear();
  history.replaceState(null, "", "/");
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("uses code flow with PKCE and sends the in-memory bearer token", async () => {
  await auth.initializeSession(cache);
  expect(adapter.init).toHaveBeenCalledWith(
    expect.objectContaining({ flow: "standard", pkceMethod: "S256" }),
  );
  expect(auth.session.getSnapshot()).toEqual({ status: "ready", access });
  const headers = request.mock.calls.find(
    ([path]) => path === "/api/v1/customers/access",
  )?.[1]?.headers as Headers;
  expect(headers.get("Authorization")).toBe("Bearer memory-only-token");
  expect(localStorage.getItem("token")).toBeNull();
  expect(sessionStorage.getItem("token")).toBeNull();
});
test("clears account data on logout even before leaving the page", async () => {
  await auth.initializeSession(cache);
  cache.setQueryData(["customers"], ["private-value"]);
  await auth.signOut();
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
  expect(auth.session.getSnapshot().status).toBe("signed-out");
  expect(adapter.clearToken).toHaveBeenCalled();
});
test("coordinates concurrent token refresh", async () => {
  await auth.initializeSession(cache);
  adapter.updateToken.mockClear();
  await Promise.all([
    auth.apiFetch("/api/v1/customers/access"),
    auth.apiFetch("/api/v1/reports/access"),
  ]);
  expect(adapter.updateToken).toHaveBeenCalledTimes(1);
});
test("an expired session clears data and stops protected calls", async () => {
  await auth.initializeSession(cache);
  cache.setQueryData(["customers"], ["private-value"]);
  adapter.updateToken.mockRejectedValueOnce(new Error("expired"));
  await expect(auth.apiFetch("/api/v1/customers")).rejects.toThrow(
    "Sign in required",
  );
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
  expect(auth.session.getSnapshot().status).toBe("signed-out");
});
test("a late response from a former account cannot return data", async () => {
  await auth.initializeSession(cache);
  let finish!: (value: Response) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = auth.apiFetch("/api/v1/customers");
  await vi.waitFor(() => expect(finish).toBeDefined());
  auth.expireSession();
  finish(Response.json({ private: "former-account" }));
  await expect(pending).rejects.toThrow("Session changed");
});
test("401 ends a session while 403 preserves it", async () => {
  await auth.initializeSession(cache);
  request.mockResolvedValueOnce(new Response(null, { status: 403 }));
  expect((await auth.apiFetch("/api/v1/customers")).status).toBe(403);
  expect(auth.session.getSnapshot().status).toBe("ready");
  cache.setQueryData(["customers"], ["private-value"]);
  request.mockResolvedValueOnce(new Response(null, { status: 401 }));
  expect((await auth.apiFetch("/api/v1/customers")).status).toBe(401);
  expect(auth.session.getSnapshot().status).toBe("signed-out");
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
});
test("identity failure stays visible without sample records", async () => {
  adapter.init.mockRejectedValueOnce(new Error("offline"));
  await auth.initializeSession(cache);
  expect(auth.session.getSnapshot().status).toBe("error");
  expect(
    request.mock.calls.some(([path]) => path === "/api/v1/customers/access"),
  ).toBe(false);
});

test("a late refresh cannot restore tokens after logout", async () => {
  await auth.initializeSession(cache);
  let finish!: () => void;
  adapter.updateToken.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => {
          adapter.token = "former-session-token";
          resolve(true);
        };
      }),
  );
  const pending = auth.apiFetch("/api/v1/customers");
  await vi.waitFor(() => expect(finish).toBeDefined());
  auth.expireSession();
  finish();
  await expect(pending).rejects.toThrow("Session changed");
  expect(adapter.token).toBeUndefined();
});

test("restores an allowed page after the fixed sign-in callback", async () => {
  history.replaceState(null, "", "/sign-in");
  sessionStorage.setItem("credit-risk.return-path", "/reports");
  await auth.initializeSession(cache);
  expect(location.pathname).toBe("/reports");
  expect(sessionStorage.getItem("credit-risk.return-path")).toBeNull();
});

test("ignores an external return address", async () => {
  history.replaceState(null, "", "/sign-in");
  sessionStorage.setItem("credit-risk.return-path", "https://wrong.invalid");
  await auth.initializeSession(cache);
  expect(location.pathname).toBe("/sign-in");
  expect(sessionStorage.getItem("credit-risk.return-path")).toBeNull();
});
