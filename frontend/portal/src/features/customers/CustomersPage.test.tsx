import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CustomersPage } from "./CustomersPage";
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
test("loads synthetic records, paginates and resets pagination on search", async () => {
  const user = mount();
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  expect(await screen.findByText("Sample Customer 001")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  expect(await screen.findByText("Sample Customer 021")).toBeVisible();
  await user.type(screen.getByLabelText("Search customers"), "DEMO-003");
  expect(await screen.findByText("Sample Customer 003")).toBeVisible();
  expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
});
test("distinguishes empty from error and preserves search input", async () => {
  const user = mount();
  await screen.findByText("Sample Customer 001");
  await user.type(screen.getByLabelText("Search customers"), "missing");
  expect(await screen.findByText("No customers found")).toBeVisible();
  await user.selectOptions(screen.getByLabelText("Preview states"), "error");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Customers could not be loaded",
  );
  expect(screen.getByLabelText("Search customers")).toHaveValue("missing");
  expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
});
test("forbidden state exposes no records", async () => {
  const user = mount();
  await screen.findByText("Sample Customer 001");
  await user.selectOptions(
    screen.getByLabelText("Preview states"),
    "forbidden",
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
  expect(screen.queryByText("Sample Customer 001")).not.toBeInTheDocument();
});
