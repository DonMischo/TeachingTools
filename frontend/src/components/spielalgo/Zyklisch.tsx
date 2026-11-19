"use client";
/** Zyklische Generierung nach Dormans: erst der Ablauf-Graph, dann die Karte. */
import { useMemo, useRef, useState } from "react";
import { zufall } from "@/lib/regeln/maschine";
import { KZ, ZYKLEN, erzeugeAblauf, karte, neuerAblauf, pruefe, type Ablauf, type KantenArt, type KnotenArt, type Zyklus } from "@/lib/spielalgo/zyklisch";
import { Buehne, Frage, Legende, Notiz, Rahmen, Regler, Steuerung, auswahl, useAblauf } from "./gemeinsam";

const ART: Record<KnotenArt, { icon: string; name: string; farbe: string }> = {
  start: { icon: "🟢", name: "Start", farbe: "#16a34a" },
  ziel: { icon: "🏁", name: "Ziel", farbe: "#e11d48" },
  raum: { icon: "▫️", name: "Raum", farbe: "#94a3b8" },
  schluessel: { icon: "🗝️", name: "Schlüssel", farbe: "#eab308" },
  belohnung: { icon: "💎", name: "Belohnung", farbe: "#06b6d4" },
  raetsel: { icon: "🧩", name: "Rätsel/Station", farbe: "#8b5cf6" },
  kampf: { icon: "⚔️", name: "Kampf/Minispiel", farbe: "#ef4444" },
  ruhe: { icon: "🌿", name: "Ruhe", farbe: "#22c55e" },
};
const KANTE: Record<KantenArt, { name: string; strich?: string; farbe: string }> = {
  weg: { name: "Weg", farbe: "#64748b" },
  tuer: { name: "verschlossene Tür", farbe: "#eab308" },
  einweg: { name: "Einbahn (nur in Pfeilrichtung)", farbe: "#0ea5e9" },
  sicht: { name: "Sicht (Gitter, Balkon)", strich: "4 4", farbe: "#a855f7" },
};
const KPX = 9;
const KFARBE: Record<number, string> = {
  [KZ.FELS]: "#292524", [KZ.RAUM]: "#f5efe6", [KZ.GANG]: "#d6c7a1", [KZ.TUER]: "#eab308", [KZ.GITTER]: "#a855f7", [KZ.EINWEG]: "#0ea5e9",
};

export default function Zyklisch() {
  const [seed, setSeed] = useState(1);
  const [zyklus, setZyklus] = useState<Zyklus>("schluessel");
  const [laenge, setLaenge] = useState(3);
  const [neben, setNeben] = useState(2);
  const [organisch, setOrganisch] = useState(true);
  const a = useRef<Ablauf>(neuerAblauf());

  const ablauf = useAblauf(() => {
    a.current = neuerAblauf();
    return erzeugeAblauf(a.current, { zyklus, laenge, neben }, zufall(seed));
  }, [seed, zyklus, laenge, neben], 0.05);

  // Karte erst, wenn mindestens die Hauptschleife steht
  const k = useMemo(
    () => (a.current.kanten.length ? karte(a.current, 64, 44, organisch) : null),
    [ablauf.takt, organisch], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const p = ablauf.fertig ? pruefe(a.current) : null;

  const zeichneKarte = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = KFARBE[KZ.FELS];
    ctx.fillRect(0, 0, 64 * KPX, 44 * KPX);
    if (!k) return;
    for (let i = 0; i < k.z.length; i++) {
      ctx.fillStyle = KFARBE[k.z[i]];
      ctx.fillRect((i % k.b) * KPX, Math.floor(i / k.b) * KPX, KPX, KPX);
    }
    ctx.font = `${KPX * 2}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const r of k.raeume) ctx.fillText(ART[a.current.knoten[r.id].art].icon, (r.mx + 0.5) * KPX, (r.my + 0.5) * KPX);
  };

  return (
    <Rahmen
      einstellungen={<>
        <label className="flex items-center gap-1">Hauptschleife
          <select value={zyklus} onChange={e => setZyklus(e.target.value as Zyklus)} className={auswahl}>
            {(Object.keys(ZYKLEN) as Zyklus[]).map(z => <option key={z} value={z}>{ZYKLEN[z].name}</option>)}
          </select>
        </label>
        <Regler label="langer Weg +" wert={laenge} min={0} max={5} setWert={setLaenge} />
        <Regler label="Nebenschleifen" wert={neben} min={0} max={3} setWert={setNeben} />
        <label className="flex items-center gap-1"><input type="checkbox" checked={organisch} onChange={e => setOrganisch(e.target.checked)} /> Höhlenform</label>
      </>}
      buehne={<>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <figure className="flex flex-col gap-1 min-w-0">
            <figcaption className="text-sm font-bold">1 · Ablauf-Graph</figcaption>
            <Graph a={a.current} takt={ablauf.takt} />
          </figure>
          <figure className="flex flex-col gap-1 min-w-0">
            <figcaption className="text-sm font-bold">2 · daraus die Karte</figcaption>
            <Buehne b={64 * KPX} h={44 * KPX} takt={`${ablauf.takt}-${organisch}`} zeichne={zeichneKarte} data-karte />
          </figure>
        </div>
        <Notiz ablauf={ablauf} />
        <Steuerung ablauf={ablauf} seed={seed} setSeed={setSeed} />
        {p && (
          <p className={`text-sm text-center font-bold ${p.loesbar ? "text-green-600" : "text-rose-600"}`} data-pruefung>
            {p.loesbar ? `✔ lösbar${p.brauchtSchluessel ? " – nur mit Schlüssel" : ""}` : "✘ nicht lösbar"}
            {k && k.notloesungen > 0 && <span className="font-normal text-muted"> · {k.notloesungen} Gang musste einen anderen kreuzen</span>}
          </p>
        )}
      </>}
      erklaerung={<>
        <h3 className="font-black text-lg">Erst der Ablauf, dann die Karte</h3>
        <p>
          Viele Generatoren bauen zuerst Räume und verbinden sie irgendwie. Heraus kommt ein <b>Baum</b>: Jeder Gang führt in eine Sackgasse, und man läuft denselben Weg zurück.
        </p>
        <p>
          Joris Dormans (Spiel <i>Unexplored</i>, 2017) dreht das um: Zuerst entsteht der <b>Ablauf</b> als Graph aus Regeln. Start und Ziel liegen auf einer <b>Schleife</b>.
          So gibt es immer zwei Wege, und die Regeln geben jedem Weg eine Aufgabe.
        </p>
        <p className="rounded-lg border border-line p-2"><b>{ZYKLEN[zyklus].name}:</b> {ZYKLEN[zyklus].text}</p>
        <ol className="list-decimal pl-5 flex flex-col gap-1">
          <li>Start und Ziel</li>
          <li>Hauptschleife mit Muster (Schlüssel, Abkürzung …)</li>
          <li>Gänge durch Räume ersetzen: Der Weg wird länger.</li>
          <li>Nebenschleifen mit Belohnung, manchmal schon von Weitem sichtbar</li>
          <li>Tempo: Ruhe, Rätsel und Kampf wechseln sich ab.</li>
          <li>Prüfen: Ist das Ziel erreichbar? Braucht man den Schlüssel wirklich?</li>
        </ol>
        <p>Erst dann wird der Graph auf ein Raster gelegt. Die Gänge sucht A*, so dass sie keine fremden Räume schneiden. Mit »Höhlenform« nagt ein Zellautomat die Felsränder an.</p>
        <Legende eintraege={(Object.keys(KANTE) as KantenArt[]).map(x => [KANTE[x].farbe, KANTE[x].name])} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {(["start", "ziel", "schluessel", "belohnung", "raetsel", "kampf", "ruhe"] as KnotenArt[]).map(x => <span key={x}>{ART[x].icon} {ART[x].name}</span>)}
        </div>
        <Frage>Spiele die Karte im Kopf: Wo würdest du zuerst hingehen? Wann siehst du das Ziel zum ersten Mal? Welches Muster würde in einem TaskCrawler-Gebäude am meisten Spaß machen?</Frage>
      </>}
    />
  );
}

/** Ablauf-Graph als SVG. */
function Graph({ a, takt }: { a: Ablauf; takt: number }) {
  const B = 420, H = 300;
  // in die Fläche einpassen (Nebenschleifen ragen über die Hauptschleife hinaus)
  const xs = a.knoten.map(n => n.x), ys = a.knoten.map(n => n.y);
  const wx = Math.max(1, ...xs.map(Math.abs)), wy = Math.max(0.75, ...ys.map(Math.abs));
  const m = Math.min((B / 2 - 24) / wx, (H / 2 - 24) / wy);
  const sx = (x: number) => B / 2 + x * m, sy = (y: number) => H / 2 + y * m;
  return (
    <svg viewBox={`0 0 ${B} ${H}`} className="w-full rounded-xl border border-line bg-page" data-takt={takt} data-graph>
      <defs>
        <marker id="spielalgo-pfeil" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={KANTE.einweg.farbe} />
        </marker>
      </defs>
      {a.kanten.map((k, i) => {
        const p = a.knoten[k.a], q = a.knoten[k.b];
        const x1 = sx(p.x), y1 = sy(p.y), x2 = sx(q.x), y2 = sy(q.y);
        // Pfeil endet am Knotenrand
        const d = Math.hypot(x2 - x1, y2 - y1) || 1, kurz = 17;
        const e = KANTE[k.art];
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2 - ((x2 - x1) / d) * (k.art === "einweg" ? kurz : 0)} y2={y2 - ((y2 - y1) / d) * (k.art === "einweg" ? kurz : 0)}
              stroke={e.farbe} strokeWidth={k.art === "weg" ? 2.5 : 3.5} strokeDasharray={e.strich}
              markerEnd={k.art === "einweg" ? "url(#spielalgo-pfeil)" : undefined} />
            {k.art === "tuer" && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2} fontSize="16" textAnchor="middle" dominantBaseline="central">🔒</text>}
          </g>
        );
      })}
      {a.knoten.map(n => (
        <g key={n.id}>
          <circle cx={sx(n.x)} cy={sy(n.y)} r={15} fill="var(--color-surface, #fff)" stroke={ART[n.art].farbe} strokeWidth={3} />
          <text x={sx(n.x)} y={sy(n.y)} fontSize="15" textAnchor="middle" dominantBaseline="central">{ART[n.art].icon}</text>
        </g>
      ))}
    </svg>
  );
}
