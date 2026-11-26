"use client";
/**
 * Klikk — eine Schulwoche mit einer Social-Media-App.
 *   Start → Anmeldung (AGB, Rechte) → fünf Nachmittage → Jonas' Handy → Datenspiegel
 * Der Stand liegt nur im Browser (localStorage), nichts geht an den Server.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ergaenze, klassenZeit, klassenZiel, neuerStand, starte, zeit, zumSpiegel } from "@/lib/klikk/motor";
import { api, type KlikkUhr } from "@/lib/api";
import { TAGE } from "@/lib/klikk/geschichte";
import type { Stand } from "@/lib/klikk/typen";
import Handy from "./Handy";
import Tag, { Nacht } from "./Tag";
import JonasSicht from "./JonasSicht";
import Datenspiegel from "./Datenspiegel";
import Lehrkraft from "./Lehrkraft";
import { Vorbereitung } from "./Einstellungen";
import OpferWoche from "./OpferWoche";
import Morgen from "./Morgen";
import type { MausZugang } from "@/lib/api";
import { SimKopf } from "@/components/SimKopf";

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
  const [opfer, setOpfer] = useState(false);

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

  // Klassenmodus: die Uhr der Lehrkraft zieht alle gleichzeitig durch die Woche
  const [uhr, setUhr] = useState<{ u: KlikkUhr; versatz: number } | null>(null);
  useEffect(() => {
    if (!code) return;
    const laden = () => api.klikk.uhr({ code, token }).then(u => setUhr({ u, versatz: u.jetzt_ms - Date.now() })).catch(() => {});
    laden();
    const t = setInterval(laden, 5000);
    return () => clearInterval(t);
  }, [code, token]);
  useEffect(() => {
    if (!uhr) return;
    const { u, versatz } = uhr;
    if (!u.laeuft || !u.start_ms) {
      setze(st => (st.flags.klassenuhr ? { ...st, flags: { ...st.flags, klassenuhr: false } } : st));
      return;
    }
    const schritt = () => {
      const jetzt = u.pausiert_ms ?? Date.now() + versatz;
      const z = klassenZiel(jetzt - u.start_ms!, u.minuten_pro_tag);
      setze(st => klassenZeit(st, z.tag, z.uhr));
    };
    schritt();
    const t = setInterval(schritt, 1000);
    return () => clearInterval(t);
  }, [uhr, setze]);
  const neu = () => setStand(neuerStand(Math.floor(Math.random() * 1e6)));

  return (
    <div className="page">
      <SimKopf titel={<>📱 Klikk</>}
        action={<>
          {uhr?.u.laeuft && stand?.flags.klassenuhr && (
            <span className="rounded-full bg-accent text-accent-fg text-xs font-bold px-3 py-1">
              🏫 Klassenzeit {uhr.u.pausiert ? "⏸" : "▶"} {TAGE[stand.tag]?.slice(0, 2)} {zeit(stand.uhr)}
            </span>
          )}
          {action}
        </>}>
        Eine Schulwoche mit einer Social-Media-App. Was du tust, zählt — auch das, was du nicht tust.
      </SimKopf>

      {verwaltung && (
        <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
          {([["spiel", "📱 Woche spielen"], ["auktion", "👩‍🏫 Lehrkraft: Übersicht & Auktion"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAnsicht(id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold ${ansicht === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>{label}</button>
          ))}
        </div>
      )}

      {opfer ? <OpferWoche zurueck={() => setOpfer(false)} /> : verwaltung && ansicht === "auktion" ? <Lehrkraft /> : !stand ? null : stand.phase === "start" ? (
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
          <button className="text-sm underline self-start text-muted" onClick={() => setOpfer(true)}>🔄 Oder: die Woche als Jonas oder Emma erleben</button>
          <Vorbereitung s={stand} setze={setze} los={() => setze(starte)} />
        </div>
      ) : stand.phase === "onboarding" ? (
        <Handy s={stand} setze={setze} online={online} />
      ) : stand.phase === "woche" || stand.phase === "morgen" ? (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr] items-start">
          <Handy s={stand} setze={setze} online={online} />
          {stand.phase === "morgen" ? <Morgen s={stand} setze={setze} /> : <Tag s={stand} setze={setze} />}
        </div>
      ) : stand.phase === "nacht" ? (
        <Nacht s={stand} setze={setze} />
      ) : stand.phase === "schlaf" ? (
        <div className="max-w-md mx-auto w-full rounded-3xl bg-neutral-950 text-neutral-100 p-8 flex flex-col gap-3 items-center text-center">
          <div className="text-6xl">💤</div>
          <div className="text-4xl font-thin tabular-nums">{zeit(stand.uhr)}</div>
          <p className="text-sm text-neutral-400">Du schläfst. Für alle in der Klasse beginnt der nächste Morgen gleichzeitig.</p>
        </div>
      ) : stand.phase === "jonas" ? (
        <JonasSicht s={stand} weiter={() => setze(zumSpiegel)} />
      ) : (
        <Datenspiegel s={stand} neu={neu} zugang={zugang} perspektive={() => setOpfer(true)} />
      )}
    </div>
  );
}
