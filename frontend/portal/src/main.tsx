import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initializeSession } from "./auth/session";
import { App } from "./app/App";
import "./styles/index.css";
async function start() {
  if (import.meta.env.VITE_MOCK_MODE === "true") {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledFrame: "bypass" });
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <main className="min-h-screen p-8">
      <h1>Credit Risk Assessment Platform</h1>
      <p role="status" className="mt-4">
        Opening your session…
      </p>
    </main>,
  );
  await initializeSession(queryClient);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
void start();
