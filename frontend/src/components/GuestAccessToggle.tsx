"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type GuestStatus } from "@/lib/api";

/**
 * Teacher opt-in toggle for QR/join-link guest access on one session. Drop it next
 * to the join QR on any tool's host page: `<GuestAccessToggle tool="caputh" code={code} />`.
 * `tool` must match a key in the join-code registry (api/join_codes.py).
 *
 * Das Opt-in ist befristet: es beginnt mit dem Einschalten und läuft nach der
 * eingestellten Fensterlänge von selbst ab. Der Schalter zeigt deshalb die
 * Restzeit und legt sich am Ende selbst um — vorher stand »Gäste erlauben« an
 * Sitzungen, die seit Tagen liefen, weiter offen.
 *
 * Daneben steht »neu starten«: das entzieht die bereits ausgegebenen
 * Gast-Token und beginnt ein neues Fenster, ohne den Code zu aendern. Gedacht
 * fuer den gedruckten QR, der mehrere Klassen ueberlebt — sonst haette die
 * vorige Gruppe bis zum Ende ihres Gastfensters weiter Zugang, waehrend die
 * naechste denselben Code scannt. Erst sichtbar, wenn Gaeste ueberhaupt
 * erlaubt sind.
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
  // Ende des laufenden Fensters als Zeitpunkt, plus ein Takt, der die Anzeige
  // weiterzaehlt. Der Server schickt nur die Restminuten; daraus wird hier ein
  // Ende, damit die Zahl ohne weitere Abfragen stimmt.
  const [endet, setEndet] = useState<number | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [restarted, setRestarted] = useState(false);

  const uebernehmen = useCallback((r: GuestStatus) => {
    setAllow(r.allow_guests);
    setMinutes(r.guest_minutes);
    setJetzt(Date.now());
    // Nur ein Ende, wenn wirklich noch Zeit uebrig ist — mit 0 Minuten waere
    // das Ende sofort erreicht und die Nachfrage unten liefe im Kreis.
    const left = r.guest_minutes_left ?? 0;
    setEndet(r.allow_guests && left > 0 ? Date.now() + left * 60_000 : null);
  }, []);

  useEffect(() => {
    api.guest.status(tool, code).then(uebernehmen).catch(() => setAllow(null));
  }, [tool, code, uebernehmen]);

  // Laeuft ein Fenster, zaehlt die Anzeige mit.
  useEffect(() => {
    if (endet === null) return;
    const id = setInterval(() => setJetzt(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [endet]);

  // Am Ende den Stand nachholen: der Server hat das Opt-in beim Lesen
  // geschlossen, danach steht der Schalter von selbst auf aus.
  useEffect(() => {
    if (endet === null || jetzt < endet) return;
    api.guest.status(tool, code).then(uebernehmen).catch(() => {});
  }, [endet, jetzt, tool, code, uebernehmen]);

  const restMinuten = endet === null ? 0 : Math.max(Math.ceil((endet - jetzt) / 60_000), 0);

  async function toggle() {
    if (allow === null || saving) return;
    setSaving(true);
    try {
      uebernehmen(await api.guest.setAllowed(tool, code, !allow));
    } catch { /* keep previous state */ }
    finally { setSaving(false); }
  }

  async function restart() {
    if (saving) return;
    const ok = confirm(
      "Gastzugang neu starten?\n\n" +
      "Alle Gäste, die diesen Code schon nutzen, werden ausgeloggt und müssen " +
      "neu beitreten. Das Gastfenster beginnt von vorn. Der Code selbst bleibt " +
      "gleich — ein gedruckter QR funktioniert weiter. Angemeldete Schüler sind " +
      "nicht betroffen."
    );
    if (!ok) return;
    setSaving(true);
    try {
      uebernehmen(await api.guest.restart(tool, code));
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
        title={`Ob nicht angemeldete Gäste per QR/Link beitreten dürfen${minutes ? ` (${minutes} Minuten ab dem Einschalten, danach schließt er von selbst)` : ""}`}
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

      {/* 0 Minuten = diese Sitzung hält den Gastzugang offen, bis sie geschlossen wird */}
      {allow && minutes === 0 && endet === null && (
        <span className="opacity-70" title="Für diese Sitzung eingestellt: der Gastzugang bleibt offen, bis die Sitzung geschlossen wird.">
          bis geschlossen
        </span>
      )}

      {allow && restMinuten > 0 && (
        <span className="opacity-70" title={`Danach schließt der Gastzugang von selbst. Fensterlänge: ${minutes} Min. (Schulvorgabe im Admin, bei Umfragen auch je Umfrage einstellbar)`}>
          noch {restMinuten} Min.
        </span>
      )}

      {allow && (
        <button
          onClick={restart}
          disabled={saving}
          className={`underline decoration-dotted underline-offset-2 disabled:opacity-50 ${className}`}
          title="Bereits ausgegebene Gastzugänge entziehen und das Gastfenster neu starten — für den nächsten Kurs am selben QR. Der Code bleibt gleich."
        >
          {restarted ? "↺ neu gestartet" : "↺ neu starten"}
        </button>
      )}
    </span>
  );
}
