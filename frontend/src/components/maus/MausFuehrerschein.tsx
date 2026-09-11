"use client";
/**
 * Der Maus-Führerschein — Grundkurs am Computer für Kinder ab etwa zehn.
 *
 * Sieben Stufen in einem Werkzeug: Klicken, Doppelklick, Rechtsklick, Ziehen,
 * Markieren, Kopieren/Einfügen, Speichern. Jede Stufe hat »Vorführen« (die
 * Maus macht es langsam vor) und »Weiter« (überspringen geht immer).
 *
 * Gerechnet wird im Browser. Zum Server gehen nur die Punkte für die
 * Bestenliste — für Gäste über den Beitritts-Code, für Angemeldete über ihr
 * Konto. Fehler dabei bleiben still: ein abgelehnter Eintrag soll keinem Kind
 * die gerade geschaffte Stufe verderben.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, type MausZugang } from "@/lib/api";
import { GRENZEN, gesamt, type Ergebnisse, type MausModus, type StufeId, type StufenErgebnis } from "@/lib/maus/ergebnis";
import { MausBild, MausStile } from "./MausBild";
import Klickspiel from "./Klickspiel";
import StufeRechtsklick from "./StufeRechtsklick";
import StufeZiehen from "./StufeZiehen";
import StufeMarkieren from "./StufeMarkieren";
import StufeKopieren from "./StufeKopieren";
import StufeSpeichern from "./StufeSpeichern";
import MausBestenliste from "./MausBestenliste";

const REITER = [
  { id: "klick", label: "👆 1 Klicken" },
  { id: "doppelklick", label: "✌️ 2 Doppelklick" },
  { id: "rechtsklick", label: "📋 3 Rechtsklick" },
  { id: "ziehen", label: "✋ 4 Ziehen" },
  { id: "markieren", label: "🖍️ 5 Markieren" },
  { id: "kopieren", label: "📄 6 Kopieren" },
  { id: "speichern", label: "💾 7 Speichern" },
  { id: "bestenliste", label: "🏆 Bestenliste" },
] as const;

type Reiter = (typeof REITER)[number]["id"];

const TIER_SCHLUESSEL = "hp_maus_tier";
const EINZELLISTEN: StufeId[] = ["klick", "doppelklick", "ziehen"];

export default function MausFuehrerschein({
  action, zugang, name = "",
}: {
  action?: ReactNode;
  /** Beitritt über Code/QR — dann laufen die Einträge über den Code. */
  zugang?: MausZugang;
  /** Vorschlag für den Namen auf dem Führerschein. */
  name?: string;
}) {
  const [reiter, setReiter] = useState<Reiter>("klick");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [ergebnisse, setErgebnisse] = useState<Ergebnisse>({});
  const [nurTouch, setNurTouch] = useState(false);

  useEffect(() => {
    try { setAvatar(localStorage.getItem(TIER_SCHLUESSEL)); } catch {}
    if (typeof window.matchMedia === "function") {
      setNurTouch(window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches);
    }
  }, []);

  const waehleTier = useCallback((id: string) => {
    setAvatar(id);
    try { localStorage.setItem(TIER_SCHLUESSEL, id); } catch {}
  }, []);

  const melden = useCallback((modus: MausModus, wert: number, dauer_ms: number, kontext: string) => {
    if (wert <= 0) return;
    api.mausBestenliste
      .eintragen({ modus, wert: Math.min(wert, GRENZEN[modus]), dauer_ms, kontext }, zugang)
      .catch(() => {});
  }, [zugang]);

  function fertig(stufe: StufeId) {
    return (e: StufenErgebnis) => {
      // Nur die beste Runde je Stufe bleibt — wie in der Bestenliste.
      const vorher = ergebnisse[stufe];
      if (vorher && vorher.punkte >= e.punkte) return;
      const neu = { ...ergebnisse, [stufe]: e };
      setErgebnisse(neu);
      if (EINZELLISTEN.includes(stufe)) melden(stufe as MausModus, e.punkte, e.dauerMs, e.details[0] ?? "");
      const dauer = Object.values(neu).reduce((s, x) => s + (x?.dauerMs ?? 0), 0);
      melden("gesamt", gesamt(neu), dauer, `${Object.keys(neu).length} von 6 Stufen`);
    };
  }

  const nr = REITER.findIndex(r => r.id === reiter);
  const weiter = () => setReiter(REITER[Math.min(nr + 1, REITER.length - 1)].id);
  const tier = avatar ?? "cat";

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <MausStile />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <MausBild groesse={30} /> Maus-Führerschein
        </h1>
        <div className="flex-1" />
        <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-sm font-black tabular-nums" title="Punkte aller Stufen">
          ⭐ {gesamt(ergebnisse).toLocaleString("de-DE")}
        </span>
        {action}
      </div>

      {nurTouch && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm">
          🖱️ Dieses Training ist für die <b>Maus</b> gemacht. Rechtsklick, Doppelklick und Markieren gehen auf einem Tablet anders — nimm am besten einen Computer.
        </div>
      )}

      <div role="tablist" aria-label="Stufe" className="flex flex-wrap gap-2">
        {REITER.map(r => (
          <button
            key={r.id}
            role="tab"
            aria-selected={reiter === r.id}
            onClick={() => setReiter(r.id)}
            className={
              "text-sm rounded-lg px-3 py-1.5 border transition-colors " +
              (reiter === r.id ? "border-[var(--accent)] text-[var(--accent)] font-bold" : "border-[var(--border)] hover:border-[var(--accent)]")
            }
          >
            {r.label}{r.id in ergebnisse && " ✅"}
          </button>
        ))}
      </div>

      {/* Der Schlüssel wirft die Stufe beim Wechsel weg: kein Timer läuft im Hintergrund weiter. */}
      {reiter === "klick" && <Klickspiel key="klick" art="klick" onFertig={fertig("klick")} onWeiter={weiter} />}
      {reiter === "doppelklick" && <Klickspiel key="doppelklick" art="doppelklick" onFertig={fertig("doppelklick")} onWeiter={weiter} />}
      {reiter === "rechtsklick" && (
        <StufeRechtsklick avatar={avatar} onAvatar={waehleTier} onFertig={fertig("rechtsklick")} onWeiter={weiter} />
      )}
      {reiter === "ziehen" && <StufeZiehen avatar={tier} onFertig={fertig("ziehen")} onWeiter={weiter} />}
      {reiter === "markieren" && <StufeMarkieren avatar={tier} onFertig={fertig("markieren")} onWeiter={weiter} />}
      {reiter === "kopieren" && <StufeKopieren avatar={tier} onFertig={fertig("kopieren")} onWeiter={weiter} />}
      {reiter === "speichern" && (
        <StufeSpeichern avatar={tier} name={name} ergebnisse={ergebnisse} onWeiter={weiter} />
      )}
      {reiter === "bestenliste" && <MausBestenliste zugang={zugang} />}
    </div>
  );
}
