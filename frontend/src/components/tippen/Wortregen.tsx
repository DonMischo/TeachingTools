"use client";
/**
 * Wortregen: Wörter fallen, wer sie fertig tippt, löscht sie.
 *
 * Die Wörter kommen nur aus den Tasten, die bis zur gewählten Lektion dran
 * waren — unter Zeitdruck nach einer nie gezeigten Taste zu suchen, übt nichts.
 *
 * Der Spielstand liegt in einem Ref, nicht im State: Die Bildschleife rechnet
 * ihn 60-mal je Sekunde weiter, und ein Zustandswechsel je Bild würde dieselbe
 * Rechnung im Entwicklungsmodus doppelt ausführen. Gerendert wird über einen
 * schlichten Bildzähler.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { LEKTIONEN, zeichenBis } from "@/lib/tippen/lektionen";
import { nachschub } from "@/lib/tippen/woerter";
import {
  starteRegen, spawn, schritt, tippe, vorbei, naechstesZeichen, stufe, LEBEN_START,
} from "@/lib/tippen/wortregen";
import { zeichenZuTaste } from "@/lib/tippen/layout";
import { useTippEingabe } from "@/hooks/useTippEingabe";
import { Tastatur } from "@/components/tippen/Tastatur";
import { Wert, Klickhinweis } from "@/components/tippen/Wert";

type Phase = "bereit" | "laeuft" | "vorbei";

export default function Wortregen({
  zeigeFinger,
  woerter,
  quelle,
  onErgebnis,
}: {
  zeigeFinger: boolean;
  /** Eigene Wortliste aus hochgeladenem Material; sonst die Lektionswörter. */
  woerter?: string[];
  /** Name der Sammlung, aus der die Wörter kommen. */
  quelle?: string;
  onErgebnis?: (e: { wert: number; anschlaege: number; fehler: number; dauer_ms: number; kontext: string }) => void;
}) {
  const [bisLektion, setBisLektion] = useState(LEKTIONEN.length - 1);
  const [phase, setPhase] = useState<Phase>("bereit");
  const [, setBild] = useState(0);

  const regenRef = useRef(starteRegen());
  const uhrRef = useRef({ letzte: 0, seitSpawn: 0 });
  // Die Bildschleife hängt nicht am Prop-Wechsel — der Melder wandert über ein Ref hinein.
  const onErgebnisRef = useRef(onErgebnis);
  useEffect(() => { onErgebnisRef.current = onErgebnis; }, [onErgebnis]);

  const eigeneWoerter = woerter && woerter.length > 0 ? woerter : undefined;
  const erlaubt = zeichenBis(bisLektion);

  const anschlag = useCallback((zeichen: string) => {
    if (vorbei(regenRef.current)) return;
    regenRef.current = tippe(regenRef.current, zeichen);
    setBild(b => b + 1);
  }, []);

  const { gedrueckt, fokus, feldProps, fokussieren } = useTippEingabe(anschlag);

  useEffect(() => {
    if (phase !== "laeuft") return;

    let raf = 0;
    uhrRef.current = { letzte: performance.now(), seitSpawn: Infinity };

    const bild = (jetzt: number) => {
      // Nach einem Tabwechsel nicht die ganze Pause nachholen.
      const dt = Math.min(jetzt - uhrRef.current.letzte, 100);
      uhrRef.current.letzte = jetzt;

      const r = regenRef.current;
      const { tempo, abstandMs } = stufe(r.laufzeit);
      let next = schritt(r, dt, tempo);

      uhrRef.current.seitSpawn += dt;
      if (uhrRef.current.seitSpawn >= abstandMs) {
        uhrRef.current.seitSpawn = 0;
        const wort = eigeneWoerter
          ? eigeneWoerter[Math.floor(Math.random() * eigeneWoerter.length)]
          : nachschub(erlaubt, Math.random);
        next = spawn(next, wort, 0.05 + Math.random() * 0.7);
      }

      regenRef.current = next;
      setBild(b => b + 1);

      if (vorbei(next)) {
        setPhase("vorbei");
        onErgebnisRef.current?.({
          wert: next.punkte,
          anschlaege: next.anschlaege,
          fehler: next.fehler,
          dauer_ms: Math.round(next.laufzeit),
          kontext: quelle ?? `bis Lektion ${bisLektion + 1}`,
        });
      } else raf = requestAnimationFrame(bild);
    };

    raf = requestAnimationFrame(bild);
    return () => cancelAnimationFrame(raf);
  }, [phase, erlaubt, eigeneWoerter]);

  function starten() {
    regenRef.current = starteRegen();
    setPhase("laeuft");
    fokussieren();
  }

  const r = regenRef.current;
  const soll = naechstesZeichen(r);
  const naechste = phase === "laeuft" && soll !== undefined ? zeichenZuTaste(soll) : undefined;
  const fehlerquote = r.anschlaege === 0 ? 0 : r.fehler / r.anschlaege;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {eigeneWoerter ? (
          <span className="text-xs text-(--text-muted)">
            es regnen die {eigeneWoerter.length} Wörter aus{" "}
            <b className="text-(--text)">{quelle ?? "der Sammlung"}</b>
          </span>
        ) : (
          <>
            <select
              value={bisLektion}
              onChange={e => setBisLektion(Number(e.target.value))}
              aria-label="Tasten bis Lektion"
              disabled={phase === "laeuft"}
              className="text-sm bg-(--surface) border border-(--border) rounded-lg px-3 py-1.5 disabled:opacity-50"
            >
              {LEKTIONEN.map((l, i) => (
                <option key={l.id} value={i}>Tasten bis Lektion {i + 1}</option>
              ))}
            </select>
            <span className="text-xs text-(--text-muted)">
              es regnet nur aus: <b className="text-(--text) font-mono">{erlaubt.trim()}</b>
            </span>
          </>
        )}
        <div className="flex-1" />
        <span className="text-lg" aria-label={`${r.leben} Leben`}>
          {"❤️".repeat(Math.max(0, r.leben))}
          <span className="opacity-25">{"❤️".repeat(Math.max(0, LEBEN_START - r.leben))}</span>
        </span>
      </div>

      <div
        {...feldProps}
        aria-label="Wortregen — fallende Wörter abtippen"
        className="relative outline-hidden h-72 sm:h-80 overflow-hidden rounded-2xl border border-(--border)
          bg-(--surface) focus:border-(--accent) cursor-text"
      >
        {phase === "laeuft" &&
          r.woerter.map(w => (
            <span
              key={w.id}
              data-wort={w.wort}
              className="absolute font-mono text-lg sm:text-xl font-bold whitespace-nowrap -translate-x-1/2"
              style={{ left: `${w.spalte * 100}%`, top: `${w.y * 100}%` }}
            >
              <span style={{ color: "var(--accent)" }}>{w.wort.slice(0, w.getippt)}</span>
              <span style={{ color: w.id === r.aktiv ? "var(--text)" : "var(--text-muted)" }}>
                {w.wort.slice(w.getippt)}
              </span>
            </span>
          ))}

        {/* Der Boden: hier kostet ein Wort ein Leben. */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-(--red) opacity-40" />

        {phase === "bereit" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className="text-4xl">🌧️</div>
            <p className="text-sm text-(--text-muted) max-w-sm">
              Tippe ein fallendes Wort, bevor es unten ankommt. Ein begonnenes Wort bleibt dran,
              bis es fertig ist. Drei Wörter dürfen durchkommen.
            </p>
            <button
              onClick={starten}
              className="border border-(--accent) text-(--accent) rounded-lg px-4 py-2 text-sm font-bold"
            >
              ▶ Los
            </button>
          </div>
        )}

        {phase === "vorbei" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6
            bg-(--surface)/90">
            <div className="text-lg font-black">Vorbei — {r.punkte} Punkte</div>
            <div className="text-sm text-(--text-muted)">
              {r.gefangen} Wörter gefangen, {r.verpasst} durchgelassen,{" "}
              {Math.round(fehlerquote * 100)} % Fehler.
            </div>
            <button
              onClick={starten}
              className="border border-(--accent) text-(--accent) rounded-lg px-4 py-2 text-sm font-bold"
            >
              ↺ Nochmal
            </button>
          </div>
        )}

        {phase === "laeuft" && !fokus && <Klickhinweis />}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 py-1">
        <Wert label="Punkte" wert={String(r.punkte)} farbe="var(--accent)" />
        <Wert label="Gefangen" wert={String(r.gefangen)} />
        <Wert
          label="Fehlerquote"
          wert={`${Math.round(fehlerquote * 100)} %`}
          farbe={fehlerquote > 0.05 ? "var(--red)" : "var(--green)"}
        />
        <Wert label="Durchgelassen" wert={String(r.verpasst)} />
      </div>

      <Tastatur naechste={naechste} gedrueckt={gedrueckt} zeigeFinger={zeigeFinger} />
    </div>
  );
}
