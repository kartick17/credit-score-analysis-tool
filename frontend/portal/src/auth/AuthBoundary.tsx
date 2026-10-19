import { useSyncExternalStore, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { session, signIn, signOut } from "./session";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const location = useLocation();
  if (import.meta.env.VITE_MOCK_MODE === "true") return children;
  if (current.status === "ready") {
    if (location.pathname === "/sign-in")
      return <Navigate replace to="/customers" />;
    return children;
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section
        className="panel w-full max-w-md p-8"
        aria-labelledby="sign-in-heading"
      >
        <ShieldCheck
          size={32}
          className="mb-6 text-blue-700"
          aria-hidden="true"
        />
        <p className="eyebrow">LOCAL LEARNING ENVIRONMENT</p>
        <h1 id="sign-in-heading">Credit Risk Assessment Platform</h1>
        <p className="my-5 text-sm leading-6 text-slate-600">
          Sign in with your sample staff account. Your role and branch decide
          which areas you can use.
        </p>
        {current.status === "loading" ? (
          <p role="status">Opening your session…</p>
        ) : current.status === "error" ? (
          <div role="alert">
            <p className="mb-4 text-sm text-red-800">
              Sign-in could not finish. Make sure the identity server, gateway,
              and customer service are running.
            </p>
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </div>
        ) : (
          <Button onClick={() => void signIn()}>Sign in</Button>
        )}
        <p className="mt-6 text-xs leading-5 text-slate-500">
          Synthetic accounts only. Demonstration model. No lending decisions.
        </p>
      </section>
    </main>
  );
}

export function Account() {
  const current = useSyncExternalStore(session.subscribe, session.getSnapshot);
  if (current.status !== "ready")
    return (
      <span className="text-xs text-slate-600">No authenticated session</span>
    );
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <div className="hidden max-w-56 text-right sm:block">
        <p className="text-xs font-semibold">
          {current.access.roles.join(", ") || "No staff role"}
        </p>
        <p className="text-xs text-slate-500">
          {current.access.branchId || "No branch assigned"}
        </p>
      </div>
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}

export function LiveWorkspace() {
  const current = useSyncExternalStore(session.subscribe, session.getSnapshot);
  if (current.status !== "ready") return null;
  if (!current.access.canRead)
    return (
      <section className="panel p-6" role="alert">
        <h1>Access denied</h1>
        <p className="mt-4 text-sm text-slate-600">
          Your account has no financial access. A technical administrator role
          alone does not grant access to customer records.
        </p>
      </section>
    );
  return (
    <section className="panel p-6 sm:p-8">
      <p className="eyebrow">STAFF WORKSPACE</p>
      <h1>Access is ready</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
        Your signed session reached the gateway and customer service. Customer
        records and editing arrive in the next milestone.
      </p>
      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Role</dt>
          <dd className="mt-1 font-semibold">
            {current.access.roles.join(", ")}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Customer access</dt>
          <dd className="mt-1 font-semibold">
            {current.access.branchId || "Across branches"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Customer editing</dt>
          <dd className="mt-1 font-semibold">
            {current.access.canWrite ? "Officer permission" : "Read only"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
