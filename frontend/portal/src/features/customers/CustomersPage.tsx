import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Users,
  ArrowRight,
  RotateCw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getCustomers, ApiError, type Scenario } from "../../lib/api/customers";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
export function CustomersPage() {
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [active, setActive] = useState("all"),
    [page, setPage] = useState(0),
    [scenario, setScenario] = useState<Scenario>("success");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useQuery({
    queryKey: ["customers", debounced, active, page, scenario],
    queryFn: ({ signal }) =>
      getCustomers(debounced, active, page, scenario, signal),
  });
  const data = query.data;
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">CUSTOMER WORKSPACE</p>
          <h1>Customers</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            A clear starting point for every credit review.
          </p>
        </div>
        <div>
          <Button disabled aria-describedby="add-hint">
            <Plus size={17} aria-hidden="true" />
            Add customer
          </Button>
          <p id="add-hint" className="mt-2 text-xs text-slate-500">
            Adding customers is not available yet
          </p>
        </div>
      </div>
      <section
        aria-labelledby="directory-heading"
        className="panel overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
              <Users size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="directory-heading" className="text-base font-semibold">
                Customer directory
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Synthetic profiles for exploring the workspace
              </p>
            </div>
          </div>
          <Badge className="border-slate-200 text-slate-600">
            Preview only
          </Badge>
        </div>
        <div className="grid gap-4 border-b border-slate-200 bg-slate-50/50 p-5 sm:grid-cols-[minmax(0,1fr)_180px] sm:px-6">
          <div>
            <label
              htmlFor="customer-search"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Search customers
            </label>
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-3 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="customer-search"
                type="search"
                placeholder="Search by name or reference"
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="active-filter"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              Status
            </label>
            <select
              id="active-filter"
              value={active}
              onChange={(e) => {
                setActive(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        {query.isPending ? (
          <div
            role="status"
            className="px-6 py-16 text-center text-sm text-slate-600"
          >
            Loading synthetic customers…
          </div>
        ) : query.isError ? (
          <div role="alert" className="px-6 py-14 text-center">
            <h3 className="font-semibold">
              {query.error instanceof ApiError && query.error.status === 403
                ? "Access denied"
                : "Customers could not be loaded"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {query.error instanceof ApiError && query.error.status === 403
                ? "This preview simulates a permission error. No records are displayed."
                : "The request failed. Your filters have been preserved. Please try again."}
            </p>
            <Button
              variant="outline"
              className="mt-5"
              onClick={() => void query.refetch()}
            >
              <RotateCw size={15} aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : data?.items.length === 0 ? (
          <div role="status" className="px-6 py-16 text-center">
            <Search
              size={26}
              className="mx-auto mb-4 text-slate-400"
              aria-hidden="true"
            />
            <h3 className="font-semibold">No customers found</h3>
            <p className="mt-2 text-sm text-slate-600">
              Try a different name, reference, or status.
            </p>
          </div>
        ) : (
          <>
            <div
              role="region"
              aria-label="Customer results, scroll horizontally on small screens"
              tabIndex={0}
              className="overflow-x-auto"
            >
              <table className="w-full min-w-[600px] text-left text-sm">
                <caption className="sr-only">
                  Synthetic customer directory. These records are not real
                  customers.
                </caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th scope="col" className="px-6 py-3 font-medium">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Reference
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Branch
                    </th>
                    <th scope="col" className="px-6 py-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                    >
                      <th scope="row" className="px-6 py-4 font-medium">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600"
                            aria-hidden="true"
                          >
                            SC
                          </span>
                          <div>
                            <span>{customer.displayName}</span>
                            <p className="mt-0.5 text-xs font-normal text-slate-500">
                              Synthetic customer
                            </p>
                          </div>
                        </div>
                      </th>
                      <td className="px-4 py-4 font-mono text-xs text-slate-600">
                        {customer.externalReference}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {customer.branchId}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          className={
                            customer.active
                              ? "border-green-200 bg-green-50 text-green-800"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }
                        >
                          <span className="text-[8px]" aria-hidden="true">
                            ●
                          </span>
                          {customer.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
              <p role="status" className="text-xs text-slate-600">
                Showing {page * 20 + 1}–
                {Math.min((page + 1) * 20, data?.totalElements ?? 0)} of{" "}
                {data?.totalElements} synthetic customers
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  aria-label="Previous page"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2"
                >
                  <ChevronLeft size={17} />
                </Button>
                <span className="px-2 text-xs text-slate-600">
                  Page {page + 1}
                </span>
                <Button
                  variant="outline"
                  aria-label="Next page"
                  disabled={(page + 1) * 20 >= (data?.totalElements ?? 0)}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2"
                >
                  <ChevronRight size={17} />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
      <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
          <h2 className="text-sm font-semibold text-blue-900">
            Every assessment starts with good data
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Customer profiles, financial inputs, and explainable results will
            connect as the platform grows.
          </p>
          <Link
            to="/assessments"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700"
          >
            Explore assessment workspace{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </section>
        {import.meta.env.VITE_MOCK_MODE === "true" && (
          <section className="rounded-xl border border-dashed border-slate-300 p-5">
            <label htmlFor="scenario" className="text-sm font-semibold">
              Preview states
            </label>
            <p
              id="scenario-hint"
              className="mb-3 mt-1 text-xs leading-5 text-slate-600"
            >
              Choose a synthetic response to explore loading and failures.
            </p>
            <select
              id="scenario"
              aria-describedby="scenario-hint"
              value={scenario}
              onChange={(e) => {
                setScenario(e.target.value as Scenario);
                setPage(0);
              }}
            >
              <option value="success">Sample records</option>
              <option value="empty">Empty directory</option>
              <option value="slow">Slow response</option>
              <option value="error">Service error</option>
              <option value="forbidden">Access denied</option>
              <option value="invalid">Invalid request</option>
            </select>
          </section>
        )}
      </div>
    </>
  );
}
