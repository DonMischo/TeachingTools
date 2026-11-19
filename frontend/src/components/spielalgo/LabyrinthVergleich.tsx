"use client";
/**
 * Vier Labyrinth-Erzeuger gleichzeitig auf demselben Raster: Backtracker,
 * Prim, Kruskal und Wilson wachsen nebeneinander, danach vergleicht eine
 * Tabelle Sackgassen, Kreuzungen, Ganglänge und Lösungsweg.
 * Die Erzeuger selbst kommen aus dem Regel-Labor (`lib/regeln/labyrinth`).
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { K, durch, erzeuge, loese, neuesLab, type Erzeuger, type Lab } from "@/lib/regeln/labyrinth";
import { zufall } from "@/lib/regeln/maschine";
import { labyrinthMasse, type LabMasse } from "@/lib/spielalgo/labyrinthMasse";
import { Buehne, Frage, Legende, Notiz, Rahmen, Steuerung, auswahl, useAblauf } from "./gemeinsam";

const ARTEN: { id: Erzeuger; name: string; kurz: string }[] = [
  { id: "backtracker", name: "Backtracker", kurz: "läuft, bis es nicht weitergeht, dann zurück (Stapel)" },
  { id: "prim", name: "Prim", kurz: "wächst wie ein Fleck vom Rand aus" },
  { id: "kruskal", name: "Kruskal", kurz: "verschmilzt Inseln, Wand für Wand" },
  { id: "wilson", name: "Wilson", kurz: "Zufallsspaziergänge, Schleifen werden gelöscht" },
];

const FARBE: Record<number, string> = {
  [K.WAND]: "#1f2937", [K.OFFEN]: "#f5efe6", [K.KOPF]: "#e11d48", [K.SPUR]: "#16a34a",
  [K.RAND]: "#38bdf8", [K.BESUCHT]: "#f5efe6", [K.WEG]: "#eab308",
};

export default function LabyrinthVergleich() {
  const [n, setN] = useState(16);
  const [seed, setSeed] = useState(1);
  const [wegZeigen, setWegZeigen] = useState(true);
  const labs = useRef<Lab[]>([]);
  const masse = useRef<(LabMasse | null)[]>([]);

  const ablauf = useAblauf(() => {
    labs.current = ARTEN.map(() => neuesLab(n));
    masse.current = ARTEN.map(() => null);
    const gens = ARTEN.map((a, i) => erzeuge(labs.current[i], a.id, zufall(seed)));
    return (function* () {
      let offen = ARTEN.length;
      while (offen > 0) {
        offen = 0;
        gens.forEach((g, i) => {
          if (masse.current[i]) return;
          if (g.next().done) {
            const l = labs.current[i];
            masse.current[i] = labyrinthMasse(l);
            // Lösungsweg einzeichnen, Hilfsfarben wieder weg
            durch(loese(l, "bfs", { besucht: 0, weg: 0, gefunden: false }));
            for (let k = 0; k < l.k.length; k++) if (l.k[k] === K.BESUCHT || l.k[k] === K.RAND) l.k[k] = K.OFFEN;
          } else offen++;
        });
        const fertige = ARTEN.filter((_, i) => masse.current[i]).map(a => a.name);
        yield fertige.length ? `Fertig: ${fertige.join(", ")}. ${offen ? `Noch ${offen} am Bauen.` : ""}` : "Alle vier bauen gleichzeitig – ein Schritt für jeden.";
      }
      return "Alle vier fertig. Vergleiche die Tabelle!";
    })();
  }, [n, seed], 5);

  const R = 2 * n + 1;
  const px = Math.max(3, Math.floor(300 / R));
  const zeichne = (i: number) => (ctx: CanvasRenderingContext2D) => {
    const l = labs.current[i];
    if (!l) return;
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      const j = y * R + x;
      let f = FARBE[l.k[j]];
      if (l.k[j] === K.WEG && !wegZeigen) f = FARBE[K.OFFEN];
      if (l.k[j] === K.OFFEN && l.menge[j] >= 0) f = `hsl(${(l.menge[j] * 137.5) % 360} 60% 72%)`;
      ctx.fillStyle = f;
      ctx.fillRect(x * px, y * px, px, px);
    }
  };

  const m = masse.current;
  const zeile = (label: string, f: (x: LabMasse) => string | number, tip: string) => (
    <tr className="border-t border-line" title={tip}>
      <td className="py-1 pr-2">{label}</td>
      {ARTEN.map((a, i) => <td key={a.id} className="text-right font-mono">{m[i] ? f(m[i]!) : "…"}</td>)}
    </tr>
  );

  return (
    <Rahmen
      einstellungen={<>
        <label className="flex items-center gap-1">Größe
          <select value={n} onChange={e => setN(+e.target.value)} className={auswahl}>
            {[8, 12, 16, 24, 32].map(g => <option key={g} value={g}>{g}×{g}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={wegZeigen} onChange={e => setWegZeigen(e.target.checked)} /> Lösungsweg zeigen</label>
      </>}
      buehne={<>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {ARTEN.map((a, i) => (
            <figure key={a.id} className="flex flex-col gap-1 min-w-0">
              <figcaption className="text-sm font-bold">{a.name} <span className="font-normal text-muted text-xs">– {a.kurz}</span></figcaption>
              <Buehne b={R * px} h={R * px} takt={`${ablauf.takt}-${wegZeigen}`} zeichne={zeichne(i)} klasse="[image-rendering:pixelated]" data-labyrinth={a.id} />
            </figure>
          ))}
        </div>
        <Notiz ablauf={ablauf} />
        <Steuerung ablauf={ablauf} seed={seed} setSeed={setSeed} />
      </>}
      erklaerung={<>
        <h3 className="font-black text-lg">Vier Wege zum Labyrinth</h3>
        <p>
          Alle vier bauen ein <b>perfektes Labyrinth</b>: Jede Zelle ist erreichbar, und zwischen zwei Zellen gibt es genau einen Weg.
          Trotzdem fühlen sie sich ganz verschieden an – und das merkt man beim Spielen.
        </p>
        <Legende eintraege={[[FARBE[K.KOPF], "aktuelle Zelle"], [FARBE[K.SPUR], "Stapel/Spur"], [FARBE[K.RAND], "Rand"], [FARBE[K.WEG], "Lösungsweg"]]} />
        <table className="text-xs w-full" data-vergleich>
          <thead><tr className="text-left text-muted"><th></th>{ARTEN.map(a => <th key={a.id} className="text-right">{a.name.slice(0, 5)}</th>)}</tr></thead>
          <tbody>
            {zeile("Sackgassen", x => x.sackgassen, "Zellen mit nur einem Ausgang")}
            {zeile("Kreuzungen", x => x.kreuzungen, "Zellen mit drei oder vier Ausgängen")}
            {zeile("Geraden", x => x.geraden, "Zellen, durch die man geradeaus läuft")}
            {zeile("Ganglänge", x => x.ganglaenge.toString().replace(".", ","), "mittlere Zellen zwischen zwei Abzweigungen oder Sackgassen")}
            {zeile("Lösungsweg", x => x.weg, "Zellen von oben links nach unten rechts")}
          </tbody>
        </table>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><b>Backtracker:</b> lange, kurvige Gänge, wenige Sackgassen, langer Lösungsweg. Gut für Spannung, aber man verläuft sich selten.</li>
          <li><b>Prim:</b> viele kurze Sackgassen rund um einen Kern. Der Weg ist eher kurz und gerade.</li>
          <li><b>Kruskal und Wilson:</b> liegen dazwischen. Wilson ist »fair«: Jedes mögliche Labyrinth ist gleich wahrscheinlich.</li>
        </ul>
        <Frage>Probiere mehrere Seeds: Welcher Erzeuger hat immer die meisten Sackgassen? Welcher den längsten Lösungsweg? Welchen würdest du für ein Gruselspiel nehmen, welchen für ein Rätselspiel?</Frage>
        <p className="text-xs text-muted">
          Einzeln in Zeitlupe, mit Datenstruktur und Lösern (Tiefensuche, Breitensuche, A*): im <Link href="/simulationen/regeln" className="underline">Regel-Labor</Link>, Reiter Labyrinthe.
        </p>
      </>}
    />
  );
}
