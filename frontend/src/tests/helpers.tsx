import { ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

export function makeClass(overrides = {}) {
  return {
    id: 1,
    code: "5a",
    display_name: "",
    symbol_emoji: null,
    symbol_image: null,
    total_points: 0,
    ...overrides,
  };
}
