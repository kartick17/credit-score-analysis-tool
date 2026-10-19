import { apiFetch } from "../../auth/session";
export interface Customer {
  id: string;
  displayName: string;
  externalReference: string;
  branchId: string;
  active: boolean;
  version: number;
}
export interface CustomerPage {
  items: Customer[];
  page: number;
  size: number;
  totalElements: number;
}
export type Scenario =
  "success" | "empty" | "slow" | "error" | "forbidden" | "invalid";
export class ApiError extends Error {
  constructor(public status: number) {
    super(
      status === 403
        ? "Access denied"
        : status === 400
          ? "The request is invalid"
          : "Unable to load customers",
    );
  }
}
export async function getCustomers(
  search: string,
  active: string,
  page: number,
  scenario: Scenario,
  signal?: AbortSignal,
): Promise<CustomerPage> {
  const params = new URLSearchParams({
    search,
    active,
    page: String(page),
    size: "20",
  });
  if (import.meta.env.VITE_MOCK_MODE === "true")
    params.set("scenario", scenario);
  const response = await apiFetch(`/api/v1/customers?${params}`, { signal });
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}
