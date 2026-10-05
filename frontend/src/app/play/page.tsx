"use client";
/**
 * Der Playhub: Code eingeben, Identität wählen, rein — für jedes Werkzeug gleich.
 *
 * An der Tafel steht nur der Beitritts-Code, nicht ob dahinter Caputh, Bingo
 * oder ein Lückentext läuft. Der Hub fragt den Server, wer den Code kennt,
 * holt Name (und Avatar, wo das Werkzeug einen benutzt) und legt beides für
 * die Werkzeugseite ab. Die tritt damit selbst bei — der Hub ruft nie die
 * Beitritts-API eines einzelnen Werkzeugs auf und bleibt so werkzeugfrei.
 *
 * Gäste bekommen hier zusätzlich ihren 60-Minuten-Token; ohne den lässt keine
 * Spielerseite sie herein.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, PlayMatch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PlayerIdentityForm } from "@/components/PlayerIdentityForm";
import { useGuestSession } from "@/hooks/useGuestSession";
import { savePlayIdentity } from "@/lib/playIdentity";

/** Nur die beiden Status, die "hier ist nichts mehr zu holen" bedeuten. */
const BEENDET = new Set(["closed", "finished"]);

export default function JoinPage() {
  const router = useRouter();
  const { auth } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Codes sind nur pro Werkzeug eindeutig — passt einer auf mehrere, fragen wir nach.
  const [choices, setChoices] = useState<PlayMatch[]>([]);
  // Aufgelöst und ausgewählt: jetzt ist die Identität dran.
  const [target, setTarget] = useState<PlayMatch | null>(null);
  // Der Token muss über den Hook laufen, nicht über den nackten API-Aufruf: nur
  // der Hook legt ihn so ab (`hp_guest_<CODE>` samt Ablauf), wie die Spielerseite
  // ihn später sucht.
  const guest = useGuestSession(target?.code ?? "");

  /** Avatar nur, wo das Werkzeug ihn auch verwendet. */
  const wantsAvatar = (m: PlayMatch) =>
    m.avatar === "always" || (m.avatar === "guests" && !auth);

  /**
   * Angemeldete haben schon einen Namen — für sie lohnt der Schritt nur, wenn
   * noch ein Avatar zu wählen ist. Gäste müssen immer durch (Name + Token).
   */
  const needsIdentity = (m: PlayMatch) => !auth || wantsAvatar(m);

  function edit(value: string) {
    setCode(value.toUpperCase());
    setError(null);
    setChoices([]);
    setTarget(null);
  }

  function go(m: PlayMatch) {
    if (needsIdentity(m)) setTarget(m);
    else router.push(m.join_url);
  }

  async function resolve() {
    const c = code.trim().toUpperCase();
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    setChoices([]);
    try {
      const { matches } = await api.play.resolve(c);
      if (matches.length === 1) {
        go(matches[0]);
        if (!needsIdentity(matches[0])) return; // busy bleibt an, die Seite wechselt
      } else {
        setChoices(matches);
      }
    } catch {
      setError("Kein Spiel mit diesem Code gefunden.");
    }
    setBusy(false);
  }

  async function submitIdentity(name: string, avatar: string) {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      // Ohne Konto braucht die Spielerseite den Gast-Token; er liegt unter
      // demselben Code, den sie gleich selbst ausliest.
      if (!auth) await guest.join(target.tool, name);
      savePlayIdentity(target.code, { name, avatar });
      router.push(target.join_url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(/freigeschaltet|403/.test(msg)
        ? "Für diese Sitzung sind Gäste nicht freigeschaltet. Bitte melde dich an."
        : "Beitritt nicht möglich.");
      setBusy(false);
    }
  }

  // ── Schritt 2: Identität ──────────────────────────────────────────────
  if (target) {
    return (
      <PlayerIdentityForm
        gameCode={target.code}
        gameIcon={target.label.split(" ")[0]}
        gameTitle={target.label}
        error={error}
        submitting={busy}
        showAvatar={wantsAvatar(target)}
        onJoin={(name, avatar) => submitIdentity(name, avatar)}
      />
    );
  }

  // ── Schritt 1: Code ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
      <h1 className="text-3xl font-black">Spiel beitreten</h1>
      <p className="text-sm text-muted -mt-2">
        Gib den Code ein — wir finden das passende Spiel.
      </p>

      <input
        autoFocus
        aria-label="Beitritts-Code"
        className="w-full max-w-xs bg-page border border-line rounded-lg px-4 py-3
          text-center text-2xl font-black tracking-[0.2em] uppercase"
        placeholder="CODE"
        maxLength={8}
        value={code}
        onChange={(e) => edit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && resolve()}
      />
      <button
        onClick={resolve}
        disabled={!code.trim() || busy}
        className="btn-primary w-full max-w-xs py-3"
      >
        {busy ? "Suche …" : "Beitreten"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-(--danger,#dc2626) font-bold">
          {error}
        </p>
      )}

      {choices.length > 1 && (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <p className="text-sm text-muted text-center">
            Diesen Code gibt es mehrfach. Welches Spiel ist gemeint?
          </p>
          {choices.map((m) => (
            <button
              key={m.tool}
              onClick={() => go(m)}
              className="w-full px-4 py-3 rounded-lg border border-line bg-surface
                text-left font-bold hover:border-accent"
            >
              {m.label}
              {m.status && BEENDET.has(m.status) && (
                <span className="ml-2 text-xs font-normal text-muted">(beendet)</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
