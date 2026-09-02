"use client";
/**
 * Der Lektionsmodus: Übungstext abtippen, mit Fehlersperre.
 *
 * Bis Phase 2 stand das hier direkt in Tippen.tsx; seit es mehrere Modi gibt,
 * ist Tippen.tsx nur noch die Hülle mit dem Umschalter.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { type Lektion } from "@/lib/tippen/lektionen";
import {
  start, feed, werte, erwartet, schwacheZeichen, stehtAufFehler, type Stand,
} from "@/lib/tippen/engine";
import { zeichenZuTaste } from "@/lib/tippen/layout";
import { useTippEingabe } from "@/hooks/useTippEingabe";
import { Tastatur } from "@/components/tippen/Tastatur";
import { Wert, Klickhinweis } from "@/components/tippen/Wert";

/** Kürzer als das lohnt keinen Eintrag — auf zehn Zeichen ist jeder schnell. */
const MINDESTLAENGE = 60;

export default function Lektionen({
  zeigeFinger,
  texte,
  sperre = true,
  onErgebnis,
}: {
  zeigeFinger: boolean;
  texte: Lektion[];
  /** Fehlersperre — hochgeladenes Material darf sie abschalten. */
  sperre?: boolean;
  /** Meldet das Ergebnis an die Bestenliste (nur mit eigenem Zugang gesetzt). */
  onErgebnis?: (e: { wert: number; anschlaege: number; fehler: number; dauer_ms: number; kontext: string }) => void;
}) {
  const [lektion, setLektion] = useState(0);
  const [stand, setStand] = useState<Stand>(() => start(texte[0].text));
  // Wurde die aktuelle Stelle gerade verfehlt? Bleibt rot, bis sie sitzt.
  const [verfehlt, setVerfehlt] = useState(false);
  const [, setTick] = useState(0);

  // Spiegel des Stands: der Tastatur-Handler braucht ihn synchron, um den
  // Fehler zu erkennen, ohne den State-Updater unrein zu machen.
  const standRef = useRef(stand);
  // Ein Ergebnis wird genau einmal gemeldet, nicht bei jedem Rendern danach.
  const gemeldetRef = useRef(false);

  const w = werte(stand, performance.now());

  const anschlag = useCallback((zeichen: string) => {
    const vorher = standRef.current;
    const nachher = feed(vorher, zeichen, performance.now(), sperre);
    standRef.current = nachher;
    setStand(nachher);
    setVerfehlt(stehtAufFehler(nachher));
  }, [sperre]);

  const { gedrueckt, fokus, feldProps, fokussieren } = useTippEingabe(anschlag);

  // Die Uhr läuft nur, solange getippt wird — sonst rendert nichts.
  useEffect(() => {
    if (stand.startMs === null || w.fertig) return;
    const id = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, [stand.startMs, w.fertig]);

  useEffect(() => {
    if (!w.fertig || gemeldetRef.current) return;
    gemeldetRef.current = true;
    if (stand.text.length < MINDESTLAENGE) return;
    onErgebnis?.({
      wert: w.anschlaegeProMinute,
      anschlaege: stand.anschlaege,
      fehler: stand.fehler,
      dauer_ms: Math.round(w.dauer * 1000),
      kontext: texte[lektion].titel,
    });
  }, [w.fertig]);  // eslint-disable-line react-hooks/exhaustive-deps

  function neu(index: number) {
    const s = start(texte[index].text);
    standRef.current = s;
    setLektion(index);
    setStand(s);
    setVerfehlt(false);
    gemeldetRef.current = false;
    fokussieren();
  }

  const soll = erwartet(stand);
  const naechste = soll === undefined ? undefined : zeichenZuTaste(soll);
  const schwach = schwacheZeichen(stand, 4);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={lektion}
          onChange={e => neu(Number(e.target.value))}
          aria-label="Lektion"
          className="text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5"
        >
          {texte.map((l, i) => (
            <option key={l.id} value={i}>{i + 1}. {l.titel}</option>
          ))}
        </select>
        {texte[lektion].neueZeichen && (
          <span className="text-xs text-[var(--text-muted)]">
            neue Tasten: <b className="text-[var(--text)]">{texte[lektion].neueZeichen}</b>
          </span>
        )}
        {!sperre && (
          <span className="text-xs text-[var(--text-muted)]">ohne Fehlersperre</span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => neu(lektion)}
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]"
        >
          ↺ Neu
        </button>
      </div>

      <div
        {...feldProps}
        aria-label="Übungstext tippen"
        className="relative outline-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6
          focus:border-[var(--accent)] cursor-text"
      >
        <p className="font-mono text-lg sm:text-xl leading-relaxed whitespace-pre-wrap break-words">
          {stand.text.split("").map((c, i) => {
            const erledigt = i < stand.pos;
            const aktuell = i === stand.pos;
            return (
              <span
                key={i}
                data-index={i}
                data-aktuell={aktuell || undefined}
                className={erledigt ? "text-[var(--green)]" : aktuell ? "rounded-sm" : "text-[var(--text-muted)]"}
                style={aktuell ? { background: verfehlt ? "var(--red)" : "var(--accent)", color: "var(--bg)" } : undefined}
              >
                {c}
              </span>
            );
          })}
        </p>

        {!fokus && <Klickhinweis />}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 py-1">
        <Wert label="Anschläge/Min" wert={String(w.anschlaegeProMinute)} farbe="var(--accent)" />
        <Wert
          label="Fehlerquote"
          wert={`${Math.round(w.fehlerquote * 100)} %`}
          farbe={w.fehlerquote > 0.05 ? "var(--red)" : "var(--green)"}
        />
        <Wert label="Zeit" wert={`${w.dauer.toFixed(0)} s`} />
        <Wert label="Fehler" wert={String(stand.fehler)} />
      </div>

      <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-150"
          style={{ width: `${w.fortschritt * 100}%` }}
        />
      </div>

      <Tastatur naechste={naechste} gedrueckt={gedrueckt} zeigeFinger={zeigeFinger} />

      {w.fertig && (
        <div className="rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-5 flex flex-col gap-3 text-center">
          <div className="text-lg font-black">🎉 Lektion geschafft</div>
          <div className="text-sm text-[var(--text-muted)]">
            {w.anschlaegeProMinute} Anschläge pro Minute bei {Math.round(w.fehlerquote * 100)} % Fehlern.
          </div>
          {schwach.length > 0 && (
            <div className="text-sm">
              Schwächste Tasten:{" "}
              {schwach.map(s => (
                <b key={s.zeichen} className="mx-1 font-mono">
                  {s.zeichen === " " ? "␣" : s.zeichen} ({s.fehler})
                </b>
              ))}
            </div>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => neu(lektion)}
              className="border border-[var(--border)] rounded-lg px-4 py-2 text-sm hover:border-[var(--accent)]"
            >
              ↺ Nochmal
            </button>
            {lektion + 1 < texte.length && (
              <button
                onClick={() => neu(lektion + 1)}
                className="border border-[var(--accent)] text-[var(--accent)] rounded-lg px-4 py-2 text-sm font-bold"
              >
                Weiter →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
