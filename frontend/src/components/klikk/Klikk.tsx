"use client";
/**
 * Klikk — eine Schulwoche mit einer Social-Media-App.
 *   Start → Anmeldung (AGB, Rechte) → fünf Nachmittage → Jonas' Handy → Datenspiegel
 * Der Stand liegt nur im Browser (localStorage), nichts geht an den Server.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ergaenze, neuerStand, starte, zumSpiegel } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";
import Handy from "./Handy";
import Tag, { Nacht } from "./Tag";
import JonasSicht from "./JonasSicht";
import Datenspiegel from "./Datenspiegel";
import { AuktionLeitung } from "./Werbeauktion";
import type { MausZugang } from "@/lib/api";

const SCHLUESSEL = "hp_klikk_stand";

/**
 * `zugang`: über Code/QR beigetreten — dann gibt es im Datenspiegel die Werbeauktion.
 * `verwaltung`: Lehrkraft auf der Werkzeugseite — sie führt die Auktion.
 */
export default function Klikk({ action, zugang, verwaltung, konto }: { action?: ReactNode; zugang?: MausZugang; verwaltung?: boolean; konto?: boolean }) {
  // Die Play-Seite baut `zugang` bei jedem Rendern neu — an Code und Token festmachen, sonst lädt alles ständig neu
  const code = zugang?.code, token = zugang?.token ?? null;
  const online = useMemo(() => ({ zugang: code ? { code, token } : undefined, konto: !!konto }), [code, token, konto]);
  const [stand, setStand] = useState<Stand | null>(null);
  const [ansicht, setAnsicht] = useState<"spiel" | "auktion">("spiel");

  // Laden nach dem Mounten, Speichern erst danach — sonst überschreibt der
  // leere Anfangsstand den gespeicherten (StrictMode führt Effekte doppelt aus).
  useEffect(() => {
    let s: Stand | null = null;
    try { const roh = localStorage.getItem(SCHLUESSEL); if (roh) s = JSON.parse(roh); } catch { /* leer */ }
    setStand(s ? ergaenze(s) : neuerStand(Math.floor(Math.random() * 1e6)));
  }, []);
  useEffect(() => {
    if (!stand) return;
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(stand)); } catch { /* voll oder gesperrt */ }
  }, [stand]);

  const setze = useCallback((f: (s: Stand) => Stand) => setStand(s => (s ? f(s) : s)), []);
  const neu = () => setStand(neuerStand(Math.floor(Math.random() * 1e6)));

  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📱 Klikk</h1>
          <p className="text-muted text-sm mt-1">Eine Schulwoche mit einer Social-Media-App. Was du tust, zählt — auch das, was du nicht tust.</p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {verwaltung && (
        <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
          {([["spiel", "📱 Woche spielen"], ["auktion", "🔨 Werbeauktion leiten"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAnsicht(id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${ansicht === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>{label}</button>
          ))}
        </div>
      )}

      {verwaltung && ansicht === "auktion" ? <AuktionLeitung /> : !stand ? null : stand.phase === "start" ? (
        <div className="card p-6 max-w-xl flex flex-col gap-3">
          <h2 className="text-xl font-black">Du bist 14 und gehst in die 8b.</h2>
          <p className="text-sm">
            Seit dem Wochenende hast du ein neues Handy. Alle aus deiner Klasse sind auf <b>Klikk</b> — nur du noch nicht.
            Vor dir liegen fünf Nachmittage, Montag bis Freitag, jeweils ab 14 Uhr.
          </p>
          <p className="text-sm">
            Neben dem Handy gibt es Hausaufgaben, Freunde und irgendwann das Bett. Zeit vergeht, wenn du etwas tust.
            Es gibt keine richtigen oder falschen Knöpfe. Spiel so, wie du wirklich bist.
          </p>
          <p className="text-xs text-muted">Dauer: etwa 25–40 Minuten. Der Stand bleibt in diesem Browser gespeichert.</p>
          <button className="btn-primary self-start" onClick={() => setze(starte)}>📱 Handy einschalten</button>
        </div>
      ) : stand.phase === "onboarding" ? (
        <Handy s={stand} setze={setze} online={online} />
      ) : stand.phase === "woche" ? (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr] items-start">
          <Handy s={stand} setze={setze} online={online} />
          <Tag s={stand} setze={setze} />
        </div>
      ) : stand.phase === "nacht" ? (
        <Nacht s={stand} setze={setze} />
      ) : stand.phase === "jonas" ? (
        <JonasSicht s={stand} weiter={() => setze(zumSpiegel)} />
      ) : (
        <Datenspiegel s={stand} neu={neu} zugang={zugang} />
      )}
    </div>
  );
}
