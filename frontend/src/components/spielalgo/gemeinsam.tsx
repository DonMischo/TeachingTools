"use client";
/**
 * Bausteine, die alle Reiter der Spielalgorithmen teilen: ein Hook, der einen
 * Generator Schritt für Schritt (oder abgespielt) laufen lässt, die
 * Knopfleiste dazu und der Rahmen aus Bühne + Erklärung.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

export const TEMPI: [number, string][] = [
  [0.05, "Zeitlupe"], [0.25, "langsam"], [1, "mittel"], [5, "schnell"], [40, "sehr schnell"], [100000, "sofort"],
];

export interface Ablauf {
  /** zählt bei jedem Schritt hoch – als Abhängigkeit fürs Neuzeichnen */
  takt: number;
  notiz: string;
  schritte: number;
  laeuft: boolean;
  fertig: boolean;
  tempo: number;
  setTempo: (t: number) => void;
  umschalten: () => void;
  einSchritt: () => void;
  bisEnde: () => void;
  neu: () => void;
}

/**
 * `start` baut den Generator (und setzt dabei den Stand zurück); er wird neu
 * gebaut, sobald sich `deps` ändern oder `neu()` gerufen wird. Danach läuft er
 * von selbst los.
 */
export function useAblauf(start: () => Generator<string, unknown>, deps: unknown[], anfangsTempo = 5): Ablauf {
  const gen = useRef<Generator<string, unknown> | null>(null);
  const [takt, setTakt] = useState(0);
  const [notiz, setNotiz] = useState("");
  const [schritte, setSchritte] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [tempo, setTempo] = useState(anfangsTempo);
  const [runde, setRunde] = useState(0);
  const startRef = useRef(start);
  startRef.current = start;

  useEffect(() => {
    gen.current = startRef.current();
    setSchritte(0);
    setFertig(false);
    setNotiz("");
    setLaeuft(true);
    setTakt(t => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, runde]);

  /** ein Schritt; `false`, wenn der Generator fertig ist */
  const schritt = (): boolean => {
    const g = gen.current;
    if (!g) return false;
    const r = g.next();
    if (r.done) {
      gen.current = null;
      setFertig(true);
      if (typeof r.value === "string" && r.value !== "fertig") setNotiz(r.value);
      return false;
    }
    setNotiz(r.value);
    setSchritte(s => s + 1);
    return true;
  };

  useEffect(() => {
    if (!laeuft) return;
    let id = 0;
    let guthaben = 1;
    const tick = () => {
      guthaben = Math.min(guthaben + tempo, 1e6);
      let weiter = true;
      // höchstens ~30 ms pro Bild rechnen, damit »sofort« nicht einfriert
      const t0 = performance.now();
      for (; guthaben >= 1 && weiter; guthaben--) {
        weiter = schritt();
        if (performance.now() - t0 > 30) break;
      }
      setTakt(t => t + 1);
      if (weiter) id = requestAnimationFrame(tick);
      else setLaeuft(false);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laeuft, tempo, runde]);

  return {
    takt, notiz, schritte, laeuft, fertig, tempo, setTempo,
    umschalten: () => setLaeuft(l => !l && gen.current !== null),
    einSchritt: () => { setLaeuft(false); schritt(); setTakt(t => t + 1); },
    bisEnde: () => { setLaeuft(false); for (let i = 0; i < 2_000_000 && schritt(); i++); setTakt(t => t + 1); },
    neu: () => setRunde(r => r + 1),
  };
}

export const knopf = "px-3 py-1.5 rounded-lg text-sm font-bold border border-line bg-surface hover:border-accent disabled:opacity-40";
export const auswahl = "rounded-lg border border-line bg-surface px-2 py-1";

/** Abspielen / ein Schritt / bis zum Ende / Tempo, dazu der Seed. */
export function Steuerung({ ablauf, seed, setSeed }: { ablauf: Ablauf; seed?: number; setSeed?: (s: number) => void }) {
  const aktiv = !ablauf.fertig;
  return (
    <div className="flex flex-wrap items-center gap-2 justify-center" data-steuerung>
      <button onClick={ablauf.umschalten} disabled={!aktiv} className="btn-primary px-3 py-1.5 text-sm">
        {ablauf.laeuft ? "⏸ anhalten" : "▶ abspielen"}
      </button>
      <button className={knopf} disabled={!aktiv} onClick={ablauf.einSchritt}>⏭ ein Schritt</button>
      <button className={knopf} disabled={!aktiv} onClick={ablauf.bisEnde}>⏩ bis zum Ende</button>
      <button className={knopf} onClick={ablauf.neu}>↺ von vorn</button>
      <select value={ablauf.tempo} onChange={e => ablauf.setTempo(+e.target.value)} className={auswahl + " py-1.5"} aria-label="Tempo">
        {TEMPI.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {setSeed && seed !== undefined && (
        <span className="flex items-center gap-1 text-sm">
          <button className={knopf} onClick={() => setSeed(seed + 1)} title="neuer Zufall">🎲</button>
          <label className="flex items-center gap-1">Seed
            <input type="number" value={seed} min={0} onChange={e => setSeed(Math.max(0, Math.floor(+e.target.value || 0)))}
              className={auswahl + " w-20"} />
          </label>
        </span>
      )}
    </div>
  );
}

/** Notizzeile unter der Bühne. */
export function Notiz({ ablauf }: { ablauf: Ablauf }) {
  return (
    <p className="text-sm text-center min-h-[2.5em]" data-notiz>
      <span className="text-muted font-mono mr-2">#{ablauf.schritte}</span>{ablauf.notiz}
    </p>
  );
}

/** Zweispaltiger Rahmen: links Bühne, rechts Erklärung. */
export function Rahmen({ buehne, erklaerung, einstellungen }: { buehne: ReactNode; erklaerung: ReactNode; einstellungen?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      {einstellungen && <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 text-sm p-3">{einstellungen}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className="flex flex-col gap-2 min-w-0">{buehne}</div>
        <section className="card flex flex-col gap-3 p-4 text-sm leading-relaxed">{erklaerung}</section>
      </div>
    </div>
  );
}

/** Schieberegler mit Beschriftung und Wert. */
export function Regler({ label, wert, min, max, schritt = 1, setWert, anzeige }: {
  label: string; wert: number; min: number; max: number; schritt?: number; setWert: (v: number) => void; anzeige?: string;
}) {
  return (
    <label className="flex items-center gap-2">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={schritt} value={wert} onChange={e => setWert(+e.target.value)} className="w-28 accent-[var(--color-accent)]" />
      <span className="font-mono text-xs w-10">{anzeige ?? wert}</span>
    </label>
  );
}

/** Farbkästchen für Legenden. */
export function Legende({ eintraege }: { eintraege: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {eintraege.map(([f, t]) => (
        <span key={t} className="flex items-center gap-1"><span className="w-3 h-3 rounded-xs inline-block border border-line" style={{ background: f }} />{t}</span>
      ))}
    </div>
  );
}

/** Kleines Denkanstoß-Kästchen. */
export function Frage({ children }: { children: ReactNode }) {
  return <p className="text-xs rounded-lg bg-page border border-line p-2">🤔 {children}</p>;
}

/** Canvas, das bei jedem Takt neu gezeichnet wird. */
export function Buehne({ b, h, zeichne, takt, klasse = "", ...rest }: {
  b: number; h: number; zeichne: (ctx: CanvasRenderingContext2D) => void; takt: unknown; klasse?: string;
} & Omit<React.CanvasHTMLAttributes<HTMLCanvasElement>, "width" | "height">) {
  const ref = useRef<HTMLCanvasElement>(null);
  const zeichneRef = useRef(zeichne);
  zeichneRef.current = zeichne;
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (ctx) zeichneRef.current(ctx);
  }, [takt, b, h]);
  return (
    <canvas ref={ref} width={b} height={h} {...rest}
      className={`w-full max-h-[62vh] object-contain rounded-xl border border-line bg-page self-center ${klasse}`} />
  );
}
