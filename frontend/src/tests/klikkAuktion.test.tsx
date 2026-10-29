/**
 * Werbeauktion in Klikk: erst nach Zustimmung geht das Profil (nur Titel/Wert)
 * an den Server, dann bietet man als Firma; das eigene Profil ist erkennbar.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { KlikkAuktion } from "@/lib/api";

const leer: KlikkAuktion = { profile: 0, lehrkraft: false, ich: null, aktuell: null, verkauft: [] };
const stand = { aktuell: leer };
const profil = vi.fn(async () => {
  stand.aktuell = {
    ...leer, profile: 2, ich: { nr: 1, firma: "SlimFast Pro", sucht: "Körperbild", budget: 100 },
    aktuell: { nr: 1, merkmale: [{ titel: "Körperbild", wert: "unzufrieden", heikel: true }], offen: true, gebote: 3, hoechstes: null, eigenes: true, mein_gebot: null },
  };
  return stand.aktuell.ich!;
});
vi.mock("@/lib/api", () => ({ api: { klikk: { auktion: async () => stand.aktuell, profil: (...a: unknown[]) => profil(...(a as [])), bieten: vi.fn() } } }));

import { AuktionSchueler } from "@/components/klikk/Werbeauktion";

describe("Werbeauktion (Schülersicht)", () => {
  it("zeigt vor der Zustimmung genau die Merkmale und schickt sie erst auf Knopfdruck", async () => {
    const merkmale = [{ titel: "Körperbild", wert: "unzufrieden", heikel: true }, { titel: "Alter", wert: "13–14", heikel: false }];
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><AuktionSchueler zugang={{ code: "ABC", token: "t" }} merkmale={merkmale} /></QueryClientProvider>);

    expect(await screen.findByText("13–14")).toBeTruthy();
    expect(profil).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(/Anonym abgeben/));
    await waitFor(() => expect(profil).toHaveBeenCalledWith({ code: "ABC", token: "t" }, merkmale));
    expect(await screen.findByText("SlimFast Pro")).toBeTruthy();
    expect(screen.getByText(/Das ist dein Profil/)).toBeTruthy();
    expect(screen.queryByText(/Bieten/)).toBeNull();
  });
});
