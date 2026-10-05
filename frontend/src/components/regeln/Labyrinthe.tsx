"use client";
/**
 * Labyrinth-Algorithmen im Zeitlupentempo: erst ein Erzeuger (Backtracker,
 * Prim, Kruskal, Wilson), dann Löser (Tiefensuche, Breitensuche, A*) auf
 * demselben Labyrinth — mit sichtbarer Datenstruktur und Vergleichstabelle.
 */
import { useEffect, useRef, useState } from "react";
import {
  K, START, entferneWaende, erzeuge, loese, neuesLab, ziel,
  type Erzeuger, type Lab, type Loeser, type Loesung,
} from "@/lib/regeln/labyrinth";
import { zufall } from "@/lib/regeln/maschine";

const ERZEUGER: Record<Erzeuger, { name: string; liste: string; text: string }> = {
  backtracker: {
    name: "Backtracker (Tiefensuche)", liste: "Stapel – oben liegt der Kopf",
    text: "Läuft, solange es geht, in unbesuchte Zellen und legt dabei jede Zelle auf einen Stapel (grün). In der Sackgasse nimmt er die oberste Zelle vom Stapel und geht zurück. Lange, gewundene Gänge mit wenigen Abzweigungen. Genau das macht das Regelpaar RBB=GGR, RGG=WWR aus dem Lehrgang.",
  },
  prim: {
    name: "Prim", liste: "Rand – Zellen direkt neben dem Labyrinth",
    text: "Das Labyrinth wächst wie ein Fleck: Aus dem Rand (blau) wird eine zufällige Zelle gezogen und an eine schon fertige Nachbarzelle angeschlossen. Viele kurze Sackgassen, der Weg ist meist gerader.",
  },
  kruskal: {
    name: "Kruskal", liste: "Inseln",
    text: "Jede Zelle ist anfangs eine eigene Insel (Farbe). Die Wände werden in zufälliger Reihenfolge angeschaut: Trennt eine Wand zwei verschiedene Inseln, fällt sie, und die Inseln verschmelzen. Trennt sie Zellen derselben Insel, bleibt sie stehen – sonst gäbe es einen Rundweg.",
  },
  wilson: {
    name: "Wilson", liste: "Spaziergang – neueste Zelle zuerst",
    text: "Ein Zufallsspaziergang startet irgendwo und läuft, bis er das Labyrinth trifft; dann wird sein Weg fest. Läuft er sich selbst über den Weg, wird die Schleife ausradiert. Langsam am Anfang, aber jedes mögliche Labyrinth ist gleich wahrscheinlich.",
  },
};

const LOESER: Record<Loeser, { name: string; liste: string; text: string }> = {
  dfs: { name: "Tiefensuche", liste: "Stapel – oben zuerst", text: "Geht immer den zuletzt entdeckten Gang weiter. Findet einen Weg, aber nicht unbedingt den kürzesten." },
  bfs: { name: "Breitensuche", liste: "Schlange – vorn zuerst", text: "Breitet sich gleichmäßig in alle Richtungen aus, Ring um Ring. Findet garantiert den kürzesten Weg, schaut dafür aber viel an." },
  astar: { name: "A*", liste: "offene Liste mit f = g + h", text: "Wie die Breitensuche, bevorzugt aber Zellen, die näher am Ziel liegen: f = bisheriger Weg g + Luftlinie h (in Kästchen). Kürzester Weg bei weniger Arbeit." },
};

const FARBE: Record<number, string> = {
  [K.WAND]: "#111827", [K.OFFEN]: "#f5efe6", [K.KOPF]: "#e11d48", [K.SPUR]: "#16a34a",
  [K.RAND]: "#38bdf8", [K.BESUCHT]: "#c4b5fd", [K.WEG]: "#eab308",
};

const TEMPI: [number, string][] = [
  [0.03, "super langsam"], [0.2, "sehr langsam"], [1, "langsam"], [4, "mittel"], [25, "schnell"], [100000, "sofort"],
];
const GROESSEN = [8, 12, 16, 24, 32];
const RUNDWEGE = [0, 5, 20, 60];

interface Zeile { loeser: Loeser; besucht: number; weg: number }

export default function Labyrinthe() {
  const [n, setN] = useState(12);
  const [erzeuger, setErzeuger] = useState<Erzeuger>("backtracker");
  const [seed, setSeed] = useState(1);
  const [rundwege, setRundwege] = useState(0);
  const [neu, setNeu] = useState(0);
  const [loeser, setLoeser] = useState<Loeser | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(4);
  const [vergleich, setVergleich] = useState<Zeile[]>([]);
  const [, setTakt] = useState(0);
  const neuZeichnen = () => setTakt(t => t + 1);

  const lab = useRef<Lab>(neuesLab(n));
  const gen = useRef<Generator<void> | null>(null);
  const fertig = useRef(false);
  const erg = useRef<Loesung>({ besucht: 0, weg: 0, gefunden: false });
  const rundwegeRef = useRef(rundwege);
  rundwegeRef.current = rundwege;

  // Neues Labyrinth bei jeder Änderung der Einstellungen
  useEffect(() => {
    lab.current = neuesLab(n);
    gen.current = erzeuge(lab.current, erzeuger, zufall(seed));
    gen.current.next();
    fertig.current = false;
    setLoeser(null);
    setLaeuft(false);
    setVergleich([]);
    neuZeichnen();
  }, [n, erzeuger, seed, neu]);

  /** Ein Schritt; `false`, wenn der laufende Algorithmus fertig ist. */
  const schritt = (): boolean => {
    const g = gen.current;
    if (!g) return false;
    if (!g.next().done) return true;
    gen.current = null;
    if (!fertig.current) {
      fertig.current = true;
      if (rundwegeRef.current) {
        const z = entferneWaende(lab.current, rundwegeRef.current, zufall(seed + 1000));
        lab.current.notiz = `fertig – ${z} Wände zusätzlich eingerissen (Rundwege)`;
      }
    } else if (loeser) {
      const e = erg.current;
      setVergleich(v => [...v, { loeser, besucht: e.besucht, weg: e.weg }]);
    }
    return false;
  };

  useEffect(() => {
    if (!laeuft) return;
    let id = 0;
    let guthaben = 1; // der erste Schritt kommt sofort
    const tick = () => {
      let weiter = true;
      guthaben += tempo;
      for (; guthaben >= 1 && weiter; guthaben--) weiter = schritt();
      neuZeichnen();
      if (weiter) id = requestAnimationFrame(tick);
      else setLaeuft(false);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laeuft, tempo]);

  const loesen = (art: Loeser) => {
    setLoeser(art);
    erg.current = { besucht: 0, weg: 0, gefunden: false };
    gen.current = loese(lab.current, art, erg.current);
    gen.current.next();
    setLaeuft(true);
    neuZeichnen();
  };

  const l = lab.current;
  const canvas = useRef<HTMLCanvasElement>(null);
  const px = Math.max(6, Math.floor(640 / l.R));
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    for (let y = 0; y < l.R; y++) for (let x = 0; x < l.R; x++) {
      const i = y * l.R + x;
      ctx.fillStyle = l.k[i] === K.OFFEN && l.menge[i] >= 0 ? `hsl(${(l.menge[i] * 137.5) % 360} 65% 72%)` : FARBE[l.k[i]];
      ctx.fillRect(x * px, y * px, px, px);
    }
    if (fertig.current) {
      const mark = ([x, y]: [number, number], f: string) => {
        ctx.strokeStyle = f;
        ctx.lineWidth = Math.max(2, px / 4);
        ctx.strokeRect((2 * x + 1) * px + 1, (2 * y + 1) * px + 1, px - 2, px - 2);
      };
      mark(START, "#16a34a");
      mark(ziel(l), "#e11d48");
    }
  });

  const info = loeser ? LOESER[loeser] : ERZEUGER[erzeuger];
  const aktiv = gen.current !== null;
  const knopf = "px-3 py-1.5 rounded-lg text-sm font-bold border border-line bg-surface hover:border-accent disabled:opacity-40";
  const auswahl = "rounded-lg border border-line bg-surface px-2 py-1";

  return (
    <div className="flex flex-col gap-3">
      <div className="card flex flex-wrap items-center gap-3 text-sm p-3">
        <label className="flex items-center gap-1">Erzeuger
          <select value={erzeuger} onChange={e => setErzeuger(e.target.value as Erzeuger)} className={auswahl}>
            {Object.entries(ERZEUGER).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Größe
          <select value={n} onChange={e => setN(+e.target.value)} className={auswahl}>
            {GROESSEN.map(g => <option key={g} value={g}>{g}×{g}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">danach Wände einreißen
          <select value={rundwege} onChange={e => { setRundwege(+e.target.value); setNeu(x => x + 1); }} className={auswahl}>
            {RUNDWEGE.map(r => <option key={r} value={r}>{r === 0 ? "keine (perfekt)" : r}</option>)}
          </select>
        </label>
        <button className={knopf} onClick={() => setSeed(s => s + 1)}>🎲 Zufall {seed}</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
        <div className="flex flex-col gap-2 min-w-0">
          <canvas ref={canvas} width={l.R * px} height={l.R * px} data-fertig={fertig.current ? "1" : "0"}
            className="w-full max-w-[640px] max-h-[60vh] object-contain rounded-xl border border-line [image-rendering:pixelated] self-center" />
          <div className="flex flex-wrap items-center gap-2 justify-center">
            <button onClick={() => setLaeuft(x => !x)} disabled={!aktiv}
              className="btn-primary px-3 py-1.5 text-sm">
              {laeuft ? "⏸ anhalten" : "▶ abspielen"}
            </button>
            <button className={knopf} disabled={!aktiv} onClick={() => { setLaeuft(false); schritt(); neuZeichnen(); }}>⏭ ein Schritt</button>
            <button className={knopf} disabled={!aktiv} onClick={() => { setLaeuft(false); while (schritt()); neuZeichnen(); }}>⏩ bis zum Ende</button>
            <button className={knopf} onClick={() => setNeu(x => x + 1)}>↺ neu</button>
            <select value={tempo} onChange={e => setTempo(+e.target.value)} className={auswahl + " py-1.5"}>
              {TEMPI.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <p className="text-sm text-center text-muted min-h-[1.5em]">{l.notiz}</p>
          {fertig.current && (
            <div className="flex flex-wrap items-center gap-2 justify-center">
              <span className="text-sm">Weg suchen von <b className="text-green-600">Start</b> (oben links) zum <b className="text-rose-600">Ziel</b>:</span>
              {(Object.keys(LOESER) as Loeser[]).map(k => (
                <button key={k} className={knopf} disabled={laeuft} onClick={() => loesen(k)}>🔎 {LOESER[k].name}</button>
              ))}
            </div>
          )}
        </div>

        <section className="card flex flex-col gap-3 p-4 text-sm leading-relaxed">
          <h3 className="font-black text-lg">{info.name}</h3>
          <p>{info.text}</p>
          <div>
            <p className="text-xs font-bold text-muted mb-1">{info.liste}{l.liste.length > 0 && ` · ${l.liste.length}`}</p>
            <div className="flex flex-wrap gap-1 font-mono text-[11px] max-h-40 overflow-auto" data-liste>
              {l.liste.slice(0, 40).map((e, i) => (
                <span key={i} className={`px-1.5 py-0.5 rounded-sm border ${i === 0 ? "border-accent font-bold" : "border-line"}`}>{e}</span>
              ))}
              {l.liste.length > 40 && <span className="text-muted">… {l.liste.length - 40} mehr</span>}
            </div>
          </div>
          <Legende />
          {vergleich.length > 0 && (
            <table className="text-xs w-full">
              <thead><tr className="text-left text-muted"><th>Löser</th><th className="text-right">angeschaut</th><th className="text-right">Weglänge</th></tr></thead>
              <tbody>
                {vergleich.map((z, i) => (
                  <tr key={i} className="border-t border-line">
                    <td>{LOESER[z.loeser].name}</td><td className="text-right font-mono">{z.besucht}</td><td className="text-right font-mono">{z.weg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {fertig.current && vergleich.length === 0 && (
            <p className="text-xs rounded-lg bg-page border border-line p-2">
              🤔 Lass alle drei Löser laufen und vergleiche. Stelle dann »Wände einreißen« auf 20: Welcher Löser findet jetzt nicht mehr den kürzesten Weg?
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function Legende() {
  const eintraege: [number, string][] = [[K.KOPF, "Kopf / aktuelle Zelle"], [K.SPUR, "Spur (auf dem Stapel)"], [K.RAND, "Rand / wartet"], [K.BESUCHT, "angeschaut"], [K.WEG, "gefundener Weg"]];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {eintraege.map(([k, t]) => (
        <span key={k} className="flex items-center gap-1"><span className="w-3 h-3 rounded-xs inline-block" style={{ background: FARBE[k] }} />{t}</span>
      ))}
    </div>
  );
}
