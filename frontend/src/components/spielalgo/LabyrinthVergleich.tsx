"use client";
/**
 * Vier Labyrinth-Erzeuger gleichzeitig auf demselben Raster: Backtracker,
 * Prim, Kruskal und Wilson wachsen nebeneinander, danach vergleicht eine
 * Tabelle Sackgassen, Kreuzungen, Ganglänge und Lösungsweg. Die Erzeuger
 * selbst kommen aus dem Regel-Labor (`lib/regeln/labyrinth`).
 * In »Genauer hinschauen« läuft als fünfter ein Growing Tree mit Reglern.
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { K, durch, erzeuge, loese, neuesLab, type Erzeuger, type Lab } from "@/lib/regeln/labyrinth";
import { zufall } from "@/lib/regeln/maschine";
import { labyrinthMasse, type LabMasse } from "@/lib/spielalgo/labyrinthMasse";
import { BAUM_STANDARD, wachsenderBaum, type BaumOptionen } from "@/lib/spielalgo/wachsenderBaum";
import { Buehne, Frage, Legende, Notiz, Rahmen, Regler, Steuerung, auswahl, useAblauf } from "./gemeinsam";
import { Hinweis, Vertiefung, Wahl } from "./Vertiefung";
import { CODE_LABYRINTH } from "./code";

type Art = Erzeuger | "eigen";
const ARTEN: { id: Art; name: string; kurz: string }[] = [
  { id: "backtracker", name: "Backtracker", kurz: "läuft, bis es nicht weitergeht, dann zurück (Stapel)" },
  { id: "prim", name: "Prim", kurz: "wächst wie ein Fleck vom Rand aus" },
  { id: "kruskal", name: "Kruskal", kurz: "verschmilzt Inseln, Wand für Wand" },
  { id: "wilson", name: "Wilson", kurz: "Zufallsspaziergänge, Schleifen werden gelöscht" },
  { id: "eigen", name: "Growing Tree", kurz: "dein eigener Erzeuger mit Reglern" },
];
const EIGEN = 4;

const FARBE: Record<number, string> = {
  [K.WAND]: "#1f2937", [K.OFFEN]: "#f5efe6", [K.KOPF]: "#e11d48", [K.SPUR]: "#16a34a",
  [K.RAND]: "#38bdf8", [K.BESUCHT]: "#f5efe6", [K.WEG]: "#eab308",
};

export default function LabyrinthVergleich() {
  const [n, setN] = useState(16);
  const [seed, setSeed] = useState(1);
  const [wegZeigen, setWegZeigen] = useState(true);
  const [baum, setBaum] = useState<BaumOptionen>(BAUM_STANDARD);
  const labs = useRef<Lab[]>([]);
  const masse = useRef<(LabMasse | null)[]>([]);
  const setze = <Kk extends keyof BaumOptionen>(k: Kk) => (v: BaumOptionen[Kk]) => setBaum(b => ({ ...b, [k]: v }));

  const ablauf = useAblauf(() => {
    labs.current = ARTEN.map(() => neuesLab(n));
    masse.current = ARTEN.map(() => null);
    const gens: Generator<unknown, unknown>[] = ARTEN.map((a, i) =>
      a.id === "eigen" ? wachsenderBaum(labs.current[i], baum, zufall(seed)) : erzeuge(labs.current[i], a.id, zufall(seed)));
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
        yield fertige.length ? `Fertig: ${fertige.join(", ")}. ${offen ? `Noch ${offen} am Bauen.` : ""}` : "Alle bauen gleichzeitig – ein Schritt für jeden.";
      }
      return "Alle fertig. Vergleiche die Tabelle!";
    })();
  }, [n, seed, baum.neueste, baum.geradeaus, baum.waagrecht, baum.start], 5);

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
  const bild = (i: number, klein = false) => (
    <figure key={ARTEN[i].id} className="flex flex-col gap-1 min-w-0">
      {/* Beschriftung wächst, Bühne steht unten: so liegen alle auf einer Linie */}
      <figcaption className="flex-1 leading-tight">
        <span className="text-sm font-bold block">{ARTEN[i].name}</span>
        <span className="text-xs text-muted">{ARTEN[i].kurz}</span>
      </figcaption>
      <Buehne b={R * px} h={R * px} takt={`${ablauf.takt}-${wegZeigen}`} zeichne={zeichne(i)}
        klasse={`[image-rendering:pixelated] aspect-square ${klein ? "max-w-[320px]" : ""}`} data-labyrinth={ARTEN[i].id} />
    </figure>
  );

  const m = masse.current;
  const zeile = (label: string, f: (x: LabMasse) => string | number, tip: string) => (
    <tr className="border-t border-line" title={tip}>
      <td className="py-1 pr-2">{label}</td>
      {ARTEN.map((a, i) => <td key={a.id} className={`text-right font-mono ${i === EIGEN ? "text-accent" : ""}`}>{m[i] ? f(m[i]!) : "…"}</td>)}
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
      vertiefung={
        <Vertiefung
          code={CODE_LABYRINTH}
          hintergrund={<>
            <p>
              Ein perfektes Labyrinth ist mathematisch ein <b>Spannbaum</b>: Alle Zellen hängen zusammen, aber es gibt keinen einzigen Kreis.
              Darum hat es bei n×n Zellen immer genau n·n − 1 Durchgänge, egal welcher Erzeuger es baut. Die Erzeuger unterscheiden sich nur darin, <i>welchen</i> Baum sie wählen.
            </p>
            <p>
              Backtracker und Prim sind eigentlich derselbe Algorithmus, den man <b>Growing Tree</b> nennt: Beide halten eine Liste offener Zellen.
              Der Backtracker nimmt immer die neueste (Stapel), Prim eine zufällige. Mit dem Regler »neueste« mischst du beides.
            </p>
            <p>Spiele brauchen selten perfekte Labyrinthe. Meist reißt man danach ein paar Wände ein, damit Rundwege entstehen (im Regel-Labor: »Wände einreißen«).</p>
          </>}
          stellschrauben={<>
            <Regler label="neueste Zelle" wert={baum.neueste} min={0} max={1} schritt={0.05} setWert={setze("neueste")} anzeige={`${Math.round(baum.neueste * 100)} %`} />
            <Hinweis>100 % = Backtracker (lange Gänge), 0 % = wie Prim (viele kurze Sackgassen)</Hinweis>
            <Regler label="geradeaus" wert={baum.geradeaus} min={0} max={1} schritt={0.05} setWert={setze("geradeaus")} anzeige={`${Math.round(baum.geradeaus * 100)} %`} />
            <Hinweis>wie gern ein Gang seine Richtung behält – lange Flure statt Zickzack</Hinweis>
            <Regler label="waagrecht" wert={baum.waagrecht} min={0} max={1} schritt={0.05} setWert={setze("waagrecht")} anzeige={`${Math.round(baum.waagrecht * 100)} %`} />
            <Hinweis>50 % = egal, mehr = Gänge eher von links nach rechts</Hinweis>
            <Wahl label="Start" wert={baum.start} setWert={setze("start")} optionen={[["ecke", "Ecke oben links"], ["mitte", "Mitte"]]} />
            <button className="text-xs underline self-start text-muted" onClick={() => setBaum(BAUM_STANDARD)}>zurücksetzen</button>
          </>}
          extra={bild(EIGEN, true)}
        />
      }
      buehne={<>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {ARTEN.slice(0, 4).map((_, i) => bild(i))}
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
          <thead><tr className="text-left text-muted"><th></th>{ARTEN.map((a, i) => <th key={a.id} className={`text-right ${i === EIGEN ? "text-accent" : ""}`}>{i === EIGEN ? "Eigen" : a.name.slice(0, 5)}</th>)}</tr></thead>
          <tbody>
            {zeile("Sackgassen", x => x.sackgassen, "Zellen mit nur einem Ausgang")}
            {zeile("Kreuzungen", x => x.kreuzungen, "Zellen mit drei oder vier Ausgängen")}
            {zeile("Geraden", x => x.geraden, "Zellen, durch die man geradeaus läuft")}
            {zeile("Ganglänge", x => x.ganglaenge.toString().replace(".", ","), "mittlere Zellen zwischen zwei Abzweigungen oder Sackgassen")}
            {zeile("Lösungsweg", x => x.weg, "Zellen von oben links nach unten rechts")}
          </tbody>
        </table>
        <p className="text-xs text-muted">»Eigen« ist der Growing Tree aus »Genauer hinschauen«.</p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li><b>Backtracker:</b> lange, kurvige Gänge, wenige Sackgassen, langer Lösungsweg. Gut für Spannung, aber man verläuft sich selten.</li>
          <li><b>Prim:</b> viele kurze Sackgassen rund um einen Kern. Der Weg ist eher kurz und gerade.</li>
          <li><b>Kruskal und Wilson:</b> liegen dazwischen. Wilson ist »fair«: Jedes mögliche Labyrinth ist gleich wahrscheinlich.</li>
        </ul>
        <Frage>Probiere mehrere Seeds: Welcher Erzeuger hat immer die meisten Sackgassen? Welcher den längsten Lösungsweg? Stelle dann den Growing Tree so ein, dass er dem Backtracker möglichst ähnlich wird – und dann so, dass er Prim gleicht.</Frage>
        <p className="text-xs text-muted">
          Einzeln in Zeitlupe, mit Datenstruktur und Lösern (Tiefensuche, Breitensuche, A*): im <Link href="/simulationen/regeln" className="underline">Regel-Labor</Link>, Reiter Labyrinthe.
        </p>
      </>}
    />
  );
}
