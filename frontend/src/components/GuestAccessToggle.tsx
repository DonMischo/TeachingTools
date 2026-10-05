"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Teacher opt-in toggle for QR/join-link guest access on one session. Drop it next
 * to the join QR on any tool's host page: `<GuestAccessToggle tool="caputh" code={code} />`.
 * `tool` must match a key in the join-code registry (api/join_codes.py).
 *
 * Daneben steht »neu starten«: das entzieht die bereits ausgegebenen
 * Gast-Token, ohne den Code zu aendern. Gedacht fuer den gedruckten QR, der
 * mehrere Klassen ueberlebt — sonst haette die vorige Gruppe bis zum Ende ihres
 * Gastfensters weiter Zugang, waehrend die naechste denselben Code scannt.
 * Erst sichtbar, wenn Gaeste ueberhaupt erlaubt sind.
 *
 * `className` traegt die Schriftfarben: die Vorgabe passt auf helle Flaechen,
 * dunkle Hostansichten (Caputh-Lobby) reichen helle Toene herein.
 */
export function GuestAccessToggle({ tool, code, className = "text-sm text-muted hover:text-gray-900" }: {
  tool: string;
  code: string;
  className?: string;
}) {
  const [allow, setAllow] = useState<boolean | null>(null);
  // Laenge des Gastfensters, wie der Server sie meldet (Admin › Gastzugang) —
  // hier steht keine feste Zahl, sonst luege der Hinweis nach jeder Umstellung.
  const [minutes, setMinutes] = useState(0);
  const [saving, setSaving] = useState(false);
  const [restarted, setRestarted] = useState(false);

  useEffect(() => {
    api.guest.status(tool, code)
      .then(r => { setAllow(r.allow_guests); setMinutes(r.guest_minutes); })
      .catch(() => setAllow(null));
  }, [tool, code]);

  async function toggle() {
    if (allow === null || saving) return;
    setSaving(true);
    try {
      const r = await api.guest.setAllowed(tool, code, !allow);
      setAllow(r.allow_guests);
      setMinutes(r.guest_minutes);
    } catch { /* keep previous state */ }
    finally { setSaving(false); }
  }

  async function restart() {
    if (saving) return;
    const ok = confirm(
      "Gastzugang neu starten?\n\n" +
      "Alle Gäste, die diesen Code schon nutzen, werden ausgeloggt und müssen " +
      "neu beitreten. Der Code selbst bleibt gleich — ein gedruckter QR " +
      "funktioniert weiter. Angemeldete Schüler sind nicht betroffen."
    );
    if (!ok) return;
    setSaving(true);
    try {
      await api.guest.restart(tool, code);
      setRestarted(true);
      setTimeout(() => setRestarted(false), 4000);
    } catch { /* Fehler bleibt still — der Zustand hat sich nicht geaendert */ }
    finally { setSaving(false); }
  }

  if (allow === null) return null;

  return (
    <span className="inline-flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={saving}
        className={`flex items-center gap-2 disabled:opacity-50 ${className}`}
        title={`Ob nicht angemeldete Gäste per QR/Link beitreten dürfen${minutes ? ` (${minutes}-Minuten-Zugang)` : ""}`}
      >
        <span
          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
          style={{ background: allow ? "#4f46e5" : "#cbd5e1" }}
        >
          <span
            className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            style={{ transform: allow ? "translateX(18px)" : "translateX(2px)" }}
          />
        </span>
        Gäste erlauben
      </button>

      {allow && minutes > 0 && (
        <span className="opacity-70" title="Schulweit im Admin einstellbar">
          {minutes} Min.
        </span>
      )}

      {allow && (
        <button
          onClick={restart}
          disabled={saving}
          className={`underline decoration-dotted underline-offset-2 disabled:opacity-50 ${className}`}
          title="Bereits ausgegebene Gastzugänge entziehen — für den nächsten Kurs am selben QR. Der Code bleibt gleich."
        >
          {restarted ? "↺ neu gestartet" : "↺ neu starten"}
        </button>
      )}
    </span>
  );
}
