/** »Umfrage zurücksetzen« löscht alle Antworten — erst nach zwei Bestätigungen. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({ useParams: () => ({ code: "RESET1" }) }));
vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useLanUrl", () => ({ useLanUrl: (p: string) => p }));
vi.mock("@/components/JoinQR", () => ({ JoinQR: () => null }));
vi.mock("@/components/GuestAccessToggle", () => ({ GuestAccessToggle: () => null }));
const send = vi.fn();
vi.mock("@/hooks/useLiveSocket", () => ({ useLiveSocket: () => ({ send }) }));
vi.mock("@/lib/api", async (orig) => {
  const real = await orig<typeof import("@/lib/api")>();
  return { ...real, api: { ...real.api, barometer: { get: () => Promise.resolve({ code: "RESET1", title: "T", questions: [], results_public: false }) } } };
});

import HostPage from "@/app/tools/barometer/host/[code]/page";

function zeigen() {
  render(<QueryClientProvider client={new QueryClient()}><HostPage /></QueryClientProvider>);
  return screen.getByRole("button", { name: /Umfrage zurücksetzen/ });
}

describe("Umfrage zurücksetzen", () => {
  beforeEach(() => send.mockReset());

  it("setzt erst nach zwei Bestätigungen zurück", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(zeigen());
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({ action: "restart" });
    confirm.mockRestore();
  });

  it("bricht bei der zweiten Rückfrage ab", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(true).mockReturnValueOnce(false);
    await userEvent.click(zeigen());
    expect(send).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("bricht bei der ersten Rückfrage ab", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.click(zeigen());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
