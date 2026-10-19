import { http, HttpResponse, delay } from "msw";
export const customers = Array.from({ length: 26 }, (_, index) => ({
  id: `sample-${String(index + 1).padStart(3, "0")}`,
  displayName: `Sample Customer ${String(index + 1).padStart(3, "0")}`,
  externalReference: `DEMO-${String(index + 1).padStart(3, "0")}`,
  branchId: index % 3 === 0 ? "BR-002" : "BR-001",
  active: index % 5 !== 4,
  version: 0,
}));
// Fixtures only. No customer, score, or report is stored in a backend database.
export const assessmentFixtures = {
  pending: { status: "PENDING_DATA" },
  failed: { status: "FAILED", code: "INSUFFICIENT_DATA" },
};
export const handlers = [
  http.get("/api/v1/customers", async ({ request }) => {
    const url = new URL(request.url),
      scenario = url.searchParams.get("scenario");
    await delay(scenario === "slow" ? 1800 : 150);
    if (scenario === "forbidden")
      return HttpResponse.json({ title: "Access denied" }, { status: 403 });
    if (scenario === "invalid")
      return HttpResponse.json({ title: "Invalid request" }, { status: 400 });
    if (scenario === "error")
      return HttpResponse.json(
        { title: "Synthetic service unavailable" },
        { status: 503 },
      );
    const search = (url.searchParams.get("search") ?? "").toLowerCase(),
      active = url.searchParams.get("active");
    const filtered =
      scenario === "empty"
        ? []
        : customers.filter(
            (c) =>
              `${c.displayName} ${c.externalReference}`
                .toLowerCase()
                .includes(search) &&
              (active === "all" || String(c.active) === active),
          );
    const page = Math.max(0, Number(url.searchParams.get("page")) || 0),
      size = 20;
    return HttpResponse.json({
      items: filtered.slice(page * size, (page + 1) * size),
      page,
      size,
      totalElements: filtered.length,
    });
  }),
];
