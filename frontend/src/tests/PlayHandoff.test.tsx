/**
 * Die Übergabe vom Playhub an die Werkzeugseite.
 *
 * Der Hub fragt Name und Avatar einmal und legt sie unter `hp_play_<CODE>` ab.
 * Die Werkzeugseite muss damit still beitreten — und eben NICHT dieselben Fragen
 * noch einmal stellen. Geprüft am Lückentext, stellvertretend für die Werkzeuge,
 * die einen eigenen Beitritt haben (Caputh, Bingo, Auktion machen es genauso).
 *
 * Die Gegenprobe gehört dazu: wer den QR direkt scannt, hat keinen Eintrag und
 * bekommt weiterhin das Formular des Werkzeugs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const CODE = "LT000001";

vi.mock("next/navigation", () => ({
  useParams: () => ({ code: CODE }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/contexts/AuthContext", () => {
  // stabil wie der echte AuthContext (Seiten laden bei jeder Änderung von auth neu)
  const wert = { auth: { user_type: "student" }, ready: true };
  return { useAuth: () => wert };
});

const { joinSession } = vi.hoisted(() => ({ joinSession: vi.fn() }));
vi.mock("@/lib/api", () => ({
  api: {
    lueckentexte: {
      sessionState: vi.fn().mockResolvedValue({ status: "waiting", board: null }),
      joinSession: (...args: unknown[]) => joinSession(...args),
      submitAttempt: vi.fn(),
    },
  },
}));

import LueckentextPlayPage from "@/app/aktivitaeten/lueckentext/play/[code]/page";
import { savePlayIdentity, readPlayIdentity } from "@/lib/playIdentity";

describe("Übergabe Playhub → Werkzeugseite", () => {
  beforeEach(() => {
    localStorage.clear();
    joinSession.mockReset();
    joinSession.mockResolvedValue({ id: 7 });
  });

  it("tritt mit der im Hub gewählten Identität bei, ohne erneut zu fragen", async () => {
    savePlayIdentity(CODE, { name: "Bob", avatar: "dog" });
    render(<LueckentextPlayPage />);

    await waitFor(() =>
      expect(joinSession).toHaveBeenCalledWith(CODE, "Bob", "dog", null),
    );
    expect(screen.queryByPlaceholderText("Dein Name")).not.toBeInTheDocument();
  });

  it("verbraucht die Identität, damit sie nicht ein zweites Mal greift", async () => {
    savePlayIdentity(CODE, { name: "Bob", avatar: "dog" });
    render(<LueckentextPlayPage />);

    await waitFor(() => expect(joinSession).toHaveBeenCalled());
    expect(readPlayIdentity(CODE)).toBeNull();
    expect(joinSession).toHaveBeenCalledTimes(1);
  });

  it("zeigt ohne Hub-Identität weiterhin das eigene Formular (QR direkt gescannt)", async () => {
    render(<LueckentextPlayPage />);

    expect(await screen.findByPlaceholderText("Dein Name")).toBeInTheDocument();
    expect(joinSession).not.toHaveBeenCalled();
  });
});
