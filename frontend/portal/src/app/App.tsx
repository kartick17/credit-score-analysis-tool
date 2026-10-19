import { AuthBoundary, Account, LiveWorkspace } from "../auth/AuthBoundary";
import { useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  Users,
  FileCheck2,
  Files,
  ShieldCheck,
  Menu,
  CircleHelp,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Sheet } from "../components/ui/sheet";
import { CustomersPage } from "../features/customers/CustomersPage";
const navigation = [
  { to: "/customers", label: "Customers", Icon: Users },
  { to: "/assessments", label: "Assessments", Icon: FileCheck2 },
  { to: "/reports", label: "Reports", Icon: Files },
];
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {navigation.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${isActive ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-100"}`
          }
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
function DeferredPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <div className="mb-8">
        <p className="eyebrow">CREDIT RISK</p>
        <h1>{title}</h1>
        <p className="mt-2 text-slate-600">{description}</p>
      </div>
      <section className="panel flex min-h-72 flex-col items-center justify-center p-8 text-center">
        <FileCheck2
          className="mb-5 text-blue-700"
          size={30}
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold">Ready for a later milestone</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
          This page is a navigation preview. No assessment has been calculated
          and no report has been generated.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/customers">Back to customers</Link>
        </Button>
      </section>
    </>
  );
}
export function App() {
  return (
    <AuthBoundary>
      <AppContent />
    </AuthBoundary>
  );
}
function AppContent() {
  const [open, setOpen] = useState(false),
    location = useLocation();
  const current =
    navigation.find((n) => location.pathname.startsWith(n.to))?.label ??
    "Workspace";
  const mock = import.meta.env.VITE_MOCK_MODE === "true";
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <Link
            to="/customers"
            className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6 text-lg font-bold tracking-tight"
          >
            <ShieldCheck
              className="text-blue-700"
              size={25}
              aria-hidden="true"
            />
            Credit Risk
          </Link>
          <div className="flex flex-1 flex-col p-4">
            <p className="eyebrow mb-3 mt-5 px-3">WORKSPACE</p>
            <Navigation />
            <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <CircleHelp size={16} aria-hidden="true" />
                Built for learning
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Synthetic records. Demonstration model. No lending decisions.
              </p>
            </div>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden">
                <Sheet
                  open={open}
                  onOpenChange={setOpen}
                  trigger={
                    <Button
                      variant="ghost"
                      aria-label="Open navigation"
                      className="px-2"
                    >
                      <Menu size={21} />
                    </Button>
                  }
                >
                  <Navigation onNavigate={() => setOpen(false)} />
                </Sheet>
              </div>
              <p className="truncate text-sm">
                <span className="hidden text-slate-500 sm:inline">
                  Workspace <span className="mx-2 text-slate-300">/</span>
                </span>
                {current}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <Badge className="border-slate-300 bg-slate-50 text-slate-600">
                Local demo
              </Badge>
              {mock ? (
                <div className="hidden border-l border-slate-200 pl-4 text-right sm:block">
                  <p className="text-xs font-semibold">Demo workspace</p>
                  <p className="text-xs text-slate-500">
                    No authenticated session
                  </p>
                </div>
              ) : (
                <Account />
              )}
            </div>
          </header>
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8"
          >
            <div
              role="note"
              className="mb-8 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <ShieldCheck
                size={19}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p>
                <strong>
                  {mock ? "Mock mode · Synthetic data only" : "API mode"}
                </strong>
                <span className="mt-0.5 block text-xs leading-5">
                  {mock
                    ? "You are exploring sample records. Changes are not saved. This preview has no staff session."
                    : "Real staff session · Synthetic accounts only. Customer records are not connected yet."}
                </span>
              </p>
            </div>
            <Routes>
              <Route path="/" element={<Navigate replace to="/customers" />} />
              <Route
                path="/customers"
                element={mock ? <CustomersPage /> : <LiveWorkspace />}
              />
              <Route
                path="/assessments"
                element={
                  <DeferredPage
                    title="Assessments"
                    description="An explainable review, with every input accounted for."
                  />
                }
              />
              <Route
                path="/reports"
                element={
                  <DeferredPage
                    title="Reports"
                    description="A clear record of each completed assessment."
                  />
                }
              />
              <Route
                path="/sign-in"
                element={
                  <>
                    <h1>Credit Risk Assessment Platform</h1>
                    <p className="my-4 text-slate-600">
                      This preview has no staff session. Start the app in API
                      mode to sign in.
                    </p>
                    <Button disabled>Preview has no sign-in</Button>
                  </>
                }
              />
              <Route
                path="/forbidden"
                element={
                  <>
                    <h1>Access denied</h1>
                    <p className="my-4">This view requires permission.</p>
                    <Link to="/customers" className="text-blue-700 underline">
                      Back to customers
                    </Link>
                  </>
                }
              />
              <Route
                path="*"
                element={
                  <>
                    <h1>Page not found</h1>
                    <p className="my-4 text-slate-600">
                      This page is unavailable.
                    </p>
                    <Link to="/customers" className="text-blue-700 underline">
                      Back to customers
                    </Link>
                  </>
                }
              />
            </Routes>
            <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500">
              <p>Credit Risk Assessment Platform</p>
              <p>Preview</p>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
