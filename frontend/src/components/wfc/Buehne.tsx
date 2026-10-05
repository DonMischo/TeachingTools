"use client";
/**
 * Bühne für beide WFC-Modelle: Feld, Knöpfe, Tempo, Festlegen. Offene Zellen
 * zeigen ihre Überlagerung (Mischfarbe aller noch möglichen Muster), wahlweise
 * mit der Zahl der Möglichkeiten. Bei einem Widerspruch wird die Zelle rot und
 * der Lauf beginnt mit neuem Zufall von vorn — die Festlegungen bleiben.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { festlegen, neueWelle, schritt, type Modell, type Welle } from "@/lib/wfc/kern";

export interface Pinsel { name: string; farbe: string; erlaubt: (p: number) => boolean }

interface Props {
  modell: Modell;
  b: number;
  h: number;
  pinsel: Pinsel[];
  /** eine festgelegte Zelle (Muster p) zeichnen */
  zeichneZelle: (ctx: CanvasRenderingContext2D, p: number, x: number, y: number, g: number) => void;
  /** Farbe einer Musterauswahl als Überlagerung (Mischfarbe) */
  mischfarbe: (w: Welle, i: number) => string;
}

const TEMPI: [number, string][] = [
  [0.03, "super langsam"], [0.2, "sehr langsam"], [1, "langsam"], [5, "mittel"], [40, "schnell"], [100000, "sofort"],
];

export default function Buehne({ modell, b, h, pinsel, zeichneZelle, mischfarbe }: Props) {
  const [seed, setSeed] = useState(1);
  const [neustart, setNeustart] = useState(0);
  const [festgelegt, setFestgelegt] = useState<Map<number, number>>(new Map());
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(5);
  const [zahlen, setZahlen] = useState(false);
  const [modus, setModus] = useState<"schauen" | "festlegen">("schauen");
  const [pinselNr, setPinselNr] = useState(0);
  const [, setTakt] = useState(0);
  const neuZeichnen = () => setTakt(t => t + 1);

  // Neue Welle samt Festlegungen; passen die nicht zusammen, gleich melden.
  const baue = (s: number): Welle => {
    const w = neueWelle(modell, b, h, s);
    for (const [i, k] of festgelegt) if (!festlegen(w, i, pinsel[k].erlaubt)) break;
    return w;
  };
  // Der Lauf wird in place weitergerechnet; ändern sich Modell, Größe, Zufall
  // oder Festlegungen, beginnt ein neuer (Schlüssel-Objekt aus useMemo).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const schluessel = useMemo(() => ({}), [modell, b, h, seed, neustart, festgelegt]);
  const lauf = useRef<{ schluessel: object; w: Welle; versuche: number; unmoeglich: boolean } | null>(null);
  if (lauf.current?.schluessel !== schluessel) {
    const w = baue(seed);
    lauf.current = { schluessel, w, versuche: 1, unmoeglich: w.widerspruch !== null };
  }

  /** ein Schritt; bei Widerspruch neu mit anderem Zufall (die Festlegungen bleiben) */
  const einSchritt = (): boolean => {
    const l = lauf.current!;
    const s = schritt(l.w);
    if (s === "widerspruch") {
      if (l.w.schritte === 0) { l.unmoeglich = true; return false; }
      l.w = baue(seed + l.versuche * 7919);
      l.versuche++;
      return l.versuche < 60;
    }
    return s === "weiter";
  };

  useEffect(() => {
    if (!laeuft) return;
    let id = 0, guthaben = 1;
    const tick = () => {
      guthaben += tempo;
      let weiter = true;
      for (; guthaben >= 1 && weiter; guthaben--) weiter = einSchritt();
      neuZeichnen();
      if (weiter) id = requestAnimationFrame(tick);
      else setLaeuft(false);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laeuft, tempo]);

  const canvas = useRef<HTMLCanvasElement>(null);
  const g = Math.max(8, Math.floor(560 / Math.max(b, h)));
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const w = lauf.current!.w;
    const T = modell.anzahl;
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < b * h; i++) {
      const x = (i % b) * g, y = Math.floor(i / b) * g;
      if (w.zahl[i] === 1) {
        let p = 0;
        while (!w.moeglich[i * T + p]) p++;
        zeichneZelle(ctx, p, x, y, g);
      } else if (w.zahl[i] === 0) {
        ctx.fillStyle = "#e11d48";
        ctx.fillRect(x, y, g, g);
      } else {
        ctx.fillStyle = mischfarbe(w, i);
        ctx.fillRect(x, y, g, g);
        if (zahlen && g >= 14) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = `bold ${Math.floor(g * 0.4)}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(w.zahl[i]), x + g / 2, y + g / 2);
        }
      }
    }
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#ffffff";
    for (const i of festgelegt.keys()) ctx.strokeRect((i % b) * g + 1, Math.floor(i / b) * g + 1, g - 2, g - 2);
    ctx.setLineDash([]);
    if (w.letzte !== null) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 3;
      ctx.strokeRect((w.letzte % b) * g + 1.5, Math.floor(w.letzte / b) * g + 1.5, g - 3, g - 3);
    }
  });

  const klick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (modus !== "festlegen") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * b), y = Math.floor(((e.clientY - r.top) / r.height) * h);
    const i = y * b + x;
    setLaeuft(false);
    setFestgelegt(alt => {
      const neu = new Map(alt);
      if (neu.get(i) === pinselNr) neu.delete(i); else neu.set(i, pinselNr);
      return neu;
    });
  };
  const randFestlegen = () => {
    setLaeuft(false);
    setFestgelegt(alt => {
      const neu = new Map(alt);
      for (let i = 0; i < b * h; i++) {
        const x = i % b, y = Math.floor(i / b);
        if (x === 0 || y === 0 || x === b - 1 || y === h - 1) neu.set(i, pinselNr);
      }
      return neu;
    });
  };

  const { w, versuche, unmoeglich } = lauf.current!;
  const offen = w.zahl.reduce((n, z) => n + (z > 1 ? 1 : 0), 0);
  const knopf = "px-3 py-1.5 rounded-lg text-sm font-bold border border-line bg-surface hover:border-accent disabled:opacity-40";
  const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold border ${an ? "bg-accent text-accent-fg border-transparent" : "border-line text-muted"}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
      <div className="flex flex-col gap-2 min-w-0">
        <canvas ref={canvas} width={b * g} height={h * g} onClick={klick} data-wfc data-offen={offen} data-fertig={w.fertig ? "1" : "0"}
          className={`w-full max-w-[560px] self-center rounded-xl border border-line [image-rendering:pixelated] ${modus === "festlegen" ? "cursor-crosshair" : ""}`} />
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <button onClick={() => setLaeuft(l => !l)} disabled={w.fertig || unmoeglich}
            className="btn-primary px-3 py-1.5 text-sm">
            {laeuft ? "⏸ anhalten" : "▶ abspielen"}
          </button>
          <button className={knopf} disabled={w.fertig || unmoeglich} onClick={() => { setLaeuft(false); einSchritt(); neuZeichnen(); }}>⏭ ein Schritt</button>
          <button className={knopf} disabled={w.fertig || unmoeglich} onClick={() => { setLaeuft(false); while (einSchritt()); neuZeichnen(); }}>⏩ bis zum Ende</button>
          <button className={knopf} onClick={() => { setLaeuft(false); setNeustart(n => n + 1); }}>↺ neu</button>
          <button className={knopf} onClick={() => { setLaeuft(false); setSeed(s => s + 1); }}>🎲 Zufall {seed}</button>
          <select value={tempo} onChange={e => setTempo(+e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
            {TEMPI.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          <button onClick={() => setZahlen(z => !z)} className={chip(zahlen)}>🔢 Möglichkeiten</button>
        </div>
        <p className="text-sm text-center text-muted" data-status>
          {unmoeglich ? <b className="text-red-500">❌ Diese Festlegungen passen nicht zusammen — entferne eine.</b>
            : w.fertig ? <><b className="text-fg">fertig</b> nach {w.schritte} Schritten{versuche > 1 && <> · {versuche - 1}× Widerspruch, neu begonnen</>}</>
            : <>Schritt <b className="text-fg">{w.schritte}</b> · noch <b className="text-fg">{offen}</b> Zellen offen{versuche > 1 && <> · {versuche - 1}× Widerspruch</>}</>}
        </p>
      </div>
      <section className="card flex flex-col gap-3 p-4 text-sm">
        <div className="inline-flex rounded-lg border border-line p-0.5 self-start">
          <button onClick={() => setModus("schauen")} className={`px-2 py-1 rounded-md text-xs font-bold ${modus === "schauen" ? "bg-accent text-accent-fg" : "text-muted"}`}>👀 zuschauen</button>
          <button onClick={() => setModus("festlegen")} className={`px-2 py-1 rounded-md text-xs font-bold ${modus === "festlegen" ? "bg-accent text-accent-fg" : "text-muted"}`}>📌 festlegen</button>
        </div>
        {modus === "festlegen" ? (
          <>
            <p className="text-xs text-muted">
              Tippe Zellen an, um sie vorab festzulegen — WFC füllt den Rest so, dass alles passt. Noch einmal tippen löst die Festlegung.
            </p>
            <div className="flex flex-wrap gap-1">
              {pinsel.map((p, k) => (
                <button key={p.name} onClick={() => setPinselNr(k)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg border-2 text-xs font-bold ${pinselNr === k ? "border-accent" : "border-line"}`}>
                  <span className="w-4 h-4 rounded-sm" style={{ background: p.farbe }} />{p.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <button className={knopf} onClick={randFestlegen}>🖼️ ganzer Rand</button>
              <button className={knopf} disabled={!festgelegt.size} onClick={() => { setLaeuft(false); setFestgelegt(new Map()); }}>🗑 alle lösen</button>
            </div>
            <p className="text-xs text-muted">{festgelegt.size} Zellen festgelegt.</p>
          </>
        ) : (
          <p className="text-xs text-muted leading-relaxed">
            Offene Zellen zeigen die Mischung aller Muster, die dort noch möglich sind — je klarer die Farbe, desto weniger bleibt übrig.
            Gelb umrandet ist die Zelle, die zuletzt festgelegt wurde: immer eine mit der kleinsten Entropie.
          </p>
        )}
      </section>
    </div>
  );
}
