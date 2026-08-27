"use client";
/**
 * Tastenjagd: ein Zeichen, eine Taste, gemessene Zeit.
 *
 * Der Modus misst absichtlich nicht das Tempo im Text, sondern den Weg des
 * Fingers zu jeder einzelnen Taste. Am Ende steht deshalb keine Bestzeit,
 * sondern die Liste der zähesten Tasten — das ist die Auskunft, mit der ein
 * Schüler etwas anfangen kann.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { LEKTIONEN, zeichenBis } from "@/lib/tippen/lektionen";
import {
  starteJagd, jagdStart, jagdZiel, jagdTreffer, jagdVorbei, langsamste, schnitt, zieleFuer,
  type Jagd,
} from "@/lib/tippen/tastenjagd";
import { zeichenZuTaste } from "@/lib/tippen/layout";
import { useTippEingabe } from "@/hooks/useTippEingabe";
import { Tastatur } from "@/components/tippen/Tastatur";
import { Wert, Klickhinweis } from "@/components/tippen/Wert";

const RUNDE = 20;

export default function Tastenjagd({ zeigeFinger }: { zeigeFinger: boolean }) {
  const [bisLektion, setBisLektion] = useState(LEKTIONEN.length - 1);
  const [jagd, setJagd] = useState<Jagd>(() => starteJagd([]));
  const [verfehlt, setVerfehlt] = useState(false);
  // Spiegel des Standes, damit der Tastendruck ihn synchron lesen kann.
  const jagdRef = useRef(jagd);

  const erlaubt = useMemo(() => zeichenBis(bisLektion), [bisLektion]);
  const laeuft = jagd.ziele.length > 0 && !jagdVorbei(jagd);

  const anschlag = useCallback((zeichen: string) => {
    const vorher = jagdRef.current;
    if (vorher.ziele.length === 0 || jagdVorbei(vorher)) return;
    const nachher = jagdTreffer(vorher, zeichen, performance.now());
    jagdRef.current = nachher;
    setJagd(nachher);
    setVerfehlt(nachher.fehler > vorher.fehler);
  }, []);

  const { gedrueckt, fokus, feldProps, fokussieren } = useTippEingabe(anschlag);

  function starten() {
    const frisch = jagdStart(starteJagd(zieleFuer(erlaubt, RUNDE, Math.random)), performance.now());
    jagdRef.current = frisch;
    setJagd(frisch);
    setVerfehlt(false);
    fokussieren();
  }

  const ziel = jagdZiel(jagd);
  const naechste = laeuft && ziel !== undefined ? zeichenZuTaste(ziel) : undefined;
  const fertig = jagd.ziele.length > 0 && jagdVorbei(jagd);
  const zaeh = langsamste(jagd, 5);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={bisLektion}
          onChange={e => setBisLektion(Number(e.target.value))}
          aria-label="Tasten bis Lektion"
          disabled={laeuft}
          className="text-sm bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          {LEKTIONEN.map((l, i) => (
            <option key={l.id} value={i}>Tasten bis Lektion {i + 1}</option>
          ))}
        </select>
        <div className="flex-1" />
        {laeuft && (
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            Taste {jagd.index + 1} von {jagd.ziele.length}
          </span>
        )}
      </div>

      <div
        {...feldProps}
        aria-label="Tastenjagd — angezeigte Taste treffen"
        className="relative outline-none h-48 sm:h-56 flex items-center justify-center rounded-2xl
          border border-[var(--border)] bg-[var(--surface)] focus:border-[var(--accent)] cursor-text"
      >
        {laeuft && (
          <span
            data-ziel={ziel}
            className="font-mono font-black leading-none"
            style={{ fontSize: "6rem", color: verfehlt ? "var(--red)" : "var(--accent)" }}
          >
            {ziel === " " ? "␣" : ziel}
          </span>
        )}

        {jagd.ziele.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="text-4xl">🎯</div>
            <p className="text-sm text-[var(--text-muted)] max-w-sm">
              Ein Zeichen erscheint — triff es so schnell du kannst. {RUNDE} Tasten,
              danach siehst du, welche dich am meisten Zeit kosten.
            </p>
            <button
              onClick={starten}
              className="border border-[var(--accent)] text-[var(--accent)] rounded-lg px-4 py-2 text-sm font-bold"
            >
              ▶ Los
            </button>
          </div>
        )}

        {fertig && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6
            bg-[var(--surface)]/90">
            <div className="text-lg font-black">🎯 Runde fertig</div>
            <div className="text-sm text-[var(--text-muted)]">
              Im Schnitt {schnitt(jagd)} ms je Taste, {jagd.fehler} Fehlgriffe.
            </div>
            {zaeh.length > 0 && (
              <div className="text-sm">
                Zäheste Tasten:{" "}
                {zaeh.map(z => (
                  <b key={z.zeichen} className="mx-1 font-mono">
                    {z.zeichen === " " ? "␣" : z.zeichen} ({z.ms} ms)
                  </b>
                ))}
              </div>
            )}
            <button
              onClick={starten}
              className="mt-1 border border-[var(--accent)] text-[var(--accent)] rounded-lg px-4 py-2 text-sm font-bold"
            >
              ↺ Nochmal
            </button>
          </div>
        )}

        {laeuft && !fokus && <Klickhinweis />}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 py-1">
        <Wert label="Schnitt" wert={schnitt(jagd) ? `${schnitt(jagd)} ms` : "—"} farbe="var(--accent)" />
        <Wert label="Getroffen" wert={`${jagd.index}/${jagd.ziele.length || RUNDE}`} />
        <Wert label="Fehlgriffe" wert={String(jagd.fehler)} farbe={jagd.fehler > 0 ? "var(--red)" : undefined} />
      </div>

      <Tastatur naechste={naechste} gedrueckt={gedrueckt} zeigeFinger={zeigeFinger} />
    </div>
  );
}
