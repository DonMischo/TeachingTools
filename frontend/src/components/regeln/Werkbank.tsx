"use client";
/**
 * Werkbank des Regel-Labors: links die Bühne mit dem Raster, rechts das
 * Programm — als Farbkästchen zum Anklicken oder als Text. Jede Änderung am
 * Programm startet den Lauf neu (gleicher Zufall, damit man vergleichen kann).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FARBEN, JOKER, blockText, kandidaten, laufeDurch, programm, programmText, regel, regelText, schritt, starte,
  type Art, type Block, type Muster, type Programm, type Raster, type Start, type Symmetrie,
} from "@/lib/regeln/maschine";
import { zeichneRaster, zellPx } from "./zeichnen";

interface Props {
  vorlage: string;
  start: Start;
  maxRegeln?: number;
  pruefe?: (r: Raster) => string | null;
  onGeloest?: () => void;
}

// Schritte je Bild (60 Bilder/s); unter 1 heißt: nur in manchen Bildern ein Schritt
const TEMPI: [number, string][] = [
  [0.03, "super langsam"], [0.2, "sehr langsam"], [1, "langsam"], [5, "mittel"], [40, "schnell"], [5000, "sofort"],
];
const ARTEN: [Art, string][] = [["eins", "eins – ein Treffer"], ["markov", "markov – erste Regel zuerst"], ["alle", "alle – alle Treffer"]];
const SYMMETRIEN: [Symmetrie, string][] = [["alle", "↻ gedreht & gespiegelt"], ["spiegel", "⇆ nur gespiegelt"], ["fest", "• genau so"]];
const PINSEL = [...Object.keys(FARBEN), JOKER];

export default function Werkbank({ vorlage, start, maxRegeln, pruefe, onGeloest }: Props) {
  const [prog, setProg] = useState<Programm>(() => programm(vorlage));
  const [seed, setSeed] = useState(1);
  const [neustart, setNeustart] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(5);
  const [zeigeTreffer, setZeigeTreffer] = useState(true);
  const [pinsel, setPinsel] = useState("W");
  const [textModus, setTextModus] = useState(false);
  const [, setTakt] = useState(0);
  const neuZeichnen = () => setTakt(t => t + 1);

  // Der Lauf wird in place weitergerechnet; `takt` stößt das Neuzeichnen an.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lauf = useMemo(() => starte(prog, start, seed), [prog, start, seed, neustart]);

  useEffect(() => {
    if (!laeuft) return;
    let id = 0;
    let guthaben = 1; // der erste Schritt kommt sofort
    const tick = () => {
      guthaben += tempo;
      for (; guthaben >= 1; guthaben--) if (!schritt(prog, lauf)) break;
      neuZeichnen();
      if (lauf.fertig) setLaeuft(false);
      else id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [laeuft, tempo, prog, lauf]);

  const canvas = useRef<HTMLCanvasElement>(null);
  const px = zellPx(lauf.raster);
  const moeglich = zeigeTreffer && !laeuft ? kandidaten(prog, lauf) : [];
  useEffect(() => {
    const c = canvas.current;
    // Hunderte gestrichelte Rahmen sind nur noch Schraffur — dann bleibt es bei der Zahl.
    if (c) zeichneRaster(c.getContext("2d")!, lauf.raster, px, zeigeTreffer ? lauf.letzte : [], moeglich.length <= 150 ? moeglich : []);
  });

  const regelZahl = prog.bloecke.reduce((n, b) => n + b.regeln.length, 0);
  const zuViele = maxRegeln !== undefined && regelZahl > maxRegeln;
  const ergebnis = lauf.fertig && pruefe ? pruefe(lauf.raster) : undefined;
  const geloest = ergebnis === null && !zuViele;
  const gemeldet = useRef(false);
  useEffect(() => {
    if (geloest && !gemeldet.current) { gemeldet.current = true; onGeloest?.(); }
  }, [geloest, onGeloest]);

  const aendere = (f: (p: Programm) => void) => {
    const neu = structuredClone(prog);
    f(neu);
    setProg(neu);
  };

  const knopf = "px-3 py-1.5 rounded-lg text-sm font-bold border border-line bg-surface hover:border-accent";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
      <div className="flex flex-col gap-2 min-w-0">
        <canvas ref={canvas} width={lauf.raster.b * px} height={lauf.raster.h * px}
          data-schritte={lauf.gesamt} data-fertig={lauf.fertig ? "1" : "0"}
          className="w-full max-w-[640px] max-h-[60vh] object-contain rounded-xl border border-line [image-rendering:pixelated] self-center" />
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <button onClick={() => setLaeuft(l => !l)} disabled={lauf.fertig}
            className="btn-primary px-3 py-1.5 text-sm">
            {laeuft ? "⏸ anhalten" : "▶ abspielen"}
          </button>
          <button className={knopf} disabled={lauf.fertig} onClick={() => { setLaeuft(false); schritt(prog, lauf); neuZeichnen(); }}>⏭ ein Schritt</button>
          <button className={knopf} disabled={lauf.fertig} onClick={() => { setLaeuft(false); laufeDurch(prog, lauf); neuZeichnen(); }}>⏩ bis zum Ende</button>
          <button className={knopf} onClick={() => { setLaeuft(false); setNeustart(n => n + 1); }}>↺ neu</button>
          <button className={knopf} title="anderer Zufall" onClick={() => { setLaeuft(false); setSeed(s => s + 1); }}>🎲 Zufall {seed}</button>
          <select value={tempo} onChange={e => setTempo(+e.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
            {TEMPI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => setZeigeTreffer(z => !z)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${zeigeTreffer ? "bg-accent text-accent-fg border-transparent" : "border-line text-muted"}`}>
            🔍 Treffer zeigen
          </button>
        </div>
        <p className="text-sm text-center text-muted">
          Schritt <b className="text-fg">{lauf.gesamt}</b>
          {" · "}
          {lauf.fertig ? <b className="text-fg">fertig – keine Regel passt mehr</b>
            : <>Block <b className="text-fg">{lauf.block + 1}</b> von {prog.bloecke.length}</>}
          {zeigeTreffer && !laeuft && !lauf.fertig && <> · <span className="text-sky-500 font-bold">{moeglich.length}</span> Stellen passen</>}
          {zeigeTreffer && lauf.letzte.length > 0 && <> · <span className="text-yellow-500 font-bold">gelb</span> = eben ersetzt</>}
        </p>
        {pruefe && (
          <div className={`rounded-xl border p-3 text-sm ${geloest ? "border-green-500 bg-green-500/10" : "border-line bg-surface"}`}>
            {zuViele ? <>⚠️ Du benutzt {regelZahl} Regeln – erlaubt sind höchstens {maxRegeln}.</>
              : !lauf.fertig ? <>Lass das Programm bis zum Ende laufen, dann wird geprüft.</>
              : geloest ? <b>✅ Geschafft!</b>
              : <>❌ {ergebnis}</>}
          </div>
        )}
      </div>

      <section className="card flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black">Programm</h3>
          <span className="text-xs text-muted">
            {regelZahl} {regelZahl === 1 ? "Regel" : "Regeln"}{maxRegeln !== undefined && ` (höchstens ${maxRegeln})`}
          </span>
          <button onClick={() => setTextModus(t => !t)} className="text-xs underline text-muted">
            {textModus ? "🎨 als Kästchen" : "⌨️ als Text"}
          </button>
        </div>
        {textModus ? <TextEditor prog={prog} onProg={setProg} /> : (
          <>
            <div className="flex flex-wrap gap-1 items-center" aria-label="Pinsel">
              <span className="text-xs text-muted mr-1">Pinsel:</span>
              {PINSEL.map(f => (
                <button key={f} onClick={() => setPinsel(f)} title={f === JOKER ? "Joker: passt auf alles, lässt alles stehen" : FARBEN[f].name}
                  className={`w-7 h-7 rounded-md border-2 text-xs font-black ${pinsel === f ? "border-accent scale-110" : "border-line"}`}
                  style={zellStil(f)}>
                  {f === JOKER ? "*" : ""}
                </button>
              ))}
            </div>
            {prog.bloecke.map((b, bi) => (
              <BlockKarte key={bi} block={b} nr={bi} aktiv={!lauf.fertig && lauf.block === bi}
                zaehler={lauf.zaehler[bi] ?? []} pinsel={pinsel}
                darfLoeschen={prog.bloecke.length > 1}
                onAendere={f => aendere(p => f(p.bloecke[bi]))}
                onLoeschen={() => aendere(p => { p.bloecke.splice(bi, 1); })} />
            ))}
            <button className={knopf} onClick={() => aendere(p => { p.bloecke.push({ art: "eins", regeln: [regel("B=W")] }); })}>
              + Block
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function zellStil(f: string): React.CSSProperties {
  if (f === JOKER) return { background: "repeating-conic-gradient(#9ca3af 0 25%, #e5e7eb 0 50%) 0 0 / 8px 8px", color: "#111" };
  return { background: FARBEN[f]?.hex ?? "#f0f" };
}

function TextEditor({ prog, onProg }: { prog: Programm; onProg: (p: Programm) => void }) {
  const [text, setText] = useState(() => programmText(prog));
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <textarea value={text} rows={6} spellCheck={false}
        onChange={e => {
          setText(e.target.value);
          try { onProg(programm(e.target.value)); setFehler(null); } catch (err) { setFehler((err as Error).message); }
        }}
        className="font-mono text-sm rounded-lg border border-line bg-page p-2" />
      {fehler ? <p className="text-xs text-red-500">{fehler}</p> : (
        <p className="text-xs text-muted">
          Eine Zeile je Block: <code>markov: RBB=GGR, RGG=WWR</code> · Schrittgrenze: <code>eins x12: …</code> · mehrzeilige Muster mit <code>/</code> · <code>*</code> = Joker ·
          gleichrangig in markov: <code>a | b</code> · Richtung: <code>spiegel</code>, <code>fest</code> · Chance: <code>alle p40: …</code> ·
          Weg: <code>pfad: A → U über E = G</code> · Zellautomat: <code>nachbarn: A=D bei 5-8 D</code>.
          Farben: {Object.entries(FARBEN).map(([k, v]) => `${k} ${v.name}`).join(", ")}.
        </p>
      )}
    </div>
  );
}

function BlockKarte({ block, nr, aktiv, zaehler, pinsel, darfLoeschen, onAendere, onLoeschen }: {
  block: Block; nr: number; aktiv: boolean; zaehler: number[]; pinsel: string; darfLoeschen: boolean;
  onAendere: (f: (b: Block) => void) => void; onLoeschen: () => void;
}) {
  const rahmen = `rounded-xl border-2 p-2 flex flex-col gap-2 ${aktiv ? "border-accent" : "border-line"}`;
  if (block.art === "pfad" || block.art === "nachbarn") {
    return (
      <div className={rahmen}>
        <div className="flex items-center gap-2 text-sm">
          <b>Block {nr + 1}</b>
          <span className="text-xs text-muted">{block.art === "pfad" ? "🧭 Weg (Breitensuche)" : "🧫 Nachbarn zählen (Zellautomat)"}</span>
          <span className="text-xs text-muted font-mono ml-auto" title="so oft angewandt">{zaehler.reduce((a, b) => a + b, 0)}×</span>
          {darfLoeschen && <button onClick={onLoeschen} className="text-xs" title="Block löschen">🗑</button>}
        </div>
        <code className="text-xs break-all">{blockText(block)}</code>
        <p className="text-[11px] text-muted">Ändern im Text-Modus (⌨️ oben).</p>
      </div>
    );
  }
  return (
    <div className={rahmen}>
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <b>Block {nr + 1}</b>
        <select value={block.art} onChange={e => onAendere(b => { b.art = e.target.value as Art; })}
          className="rounded-md border border-line bg-page px-1 py-0.5 text-xs">
          {ARTEN.map(([a, l]) => <option key={a} value={a}>{l}</option>)}
        </select>
        <select value={block.sym ?? "alle"} title="In welchen Lagen gilt die Regel?"
          onChange={e => onAendere(b => { if (e.target.value === "alle") delete b.sym; else b.sym = e.target.value as Symmetrie; })}
          className="rounded-md border border-line bg-page px-1 py-0.5 text-xs">
          {SYMMETRIEN.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
        </select>
        <label className="text-xs text-muted flex items-center gap-1">
          höchstens
          <input type="number" min={1} value={block.grenze ?? ""} placeholder="∞"
            onChange={e => onAendere(b => { if (e.target.value) b.grenze = Math.max(1, +e.target.value); else delete b.grenze; })}
            className="w-14 rounded-md border border-line bg-page px-1 py-0.5" />
          Schritte
        </label>
        {darfLoeschen && <button onClick={onLoeschen} className="ml-auto text-xs" title="Block löschen">🗑</button>}
      </div>
      {block.regeln.map((r, ri) => (
        <div key={ri} className="flex items-center gap-2 flex-wrap">
          <MusterGitter m={r.aus} onKlick={i => onAendere(b => { b.regeln[ri].aus = setze(b.regeln[ri].aus, i, pinsel); })} />
          <span className="font-black">→</span>
          <MusterGitter m={r.ein} onKlick={i => onAendere(b => { b.regeln[ri].ein = setze(b.regeln[ri].ein, i, pinsel); })} />
          <div className="flex flex-col text-[10px] leading-none gap-0.5">
            <span className="flex gap-0.5">
              <Mini title="breiter" onClick={() => onAendere(b => { groesse(b, ri, 1, 0); })}>↔+</Mini>
              <Mini title="schmaler" onClick={() => onAendere(b => { groesse(b, ri, -1, 0); })}>↔−</Mini>
            </span>
            <span className="flex gap-0.5">
              <Mini title="höher" onClick={() => onAendere(b => { groesse(b, ri, 0, 1); })}>↕+</Mini>
              <Mini title="flacher" onClick={() => onAendere(b => { groesse(b, ri, 0, -1); })}>↕−</Mini>
            </span>
          </div>
          <span className="text-xs text-muted font-mono" title="so oft angewandt">{zaehler[ri] ?? 0}×</span>
          <span className="ml-auto flex gap-1">
            {ri > 0 && block.art === "markov" && (
              <Mini title={r.oder ? "gleichrangig mit der Regel davor — antippen für Nachrang" : "Nachrang — antippen: gleichrangig mit der Regel davor"}
                onClick={() => onAendere(b => { if (b.regeln[ri].oder) delete b.regeln[ri].oder; else b.regeln[ri].oder = true; })}>
                {r.oder ? "＝" : "↓"}
              </Mini>
            )}
            {ri > 0 && <Mini title="nach oben (bei markov: Vorrang)" onClick={() => onAendere(b => { [b.regeln[ri - 1], b.regeln[ri]] = [b.regeln[ri], b.regeln[ri - 1]]; })}>↑</Mini>}
            {block.regeln.length > 1 && <Mini title="Regel löschen" onClick={() => onAendere(b => { b.regeln.splice(ri, 1); })}>🗑</Mini>}
          </span>
          <code className="w-full min-w-0 break-all text-[11px] text-muted">{regelText(r)}</code>
        </div>
      ))}
      <button className="self-start text-xs underline text-muted"
        onClick={() => onAendere(b => { b.regeln.push(regel("B=W")); })}>+ Regel</button>
    </div>
  );
}

function Mini({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} aria-label={title} onClick={onClick}
      className="px-1 py-0.5 rounded-sm border border-line bg-page hover:border-accent">
      {children}
    </button>
  );
}

function MusterGitter({ m, onKlick }: { m: Muster; onKlick: (i: number) => void }) {
  const px = m.b > 4 || m.h > 4 ? 14 : 20;
  return (
    <div className="grid gap-px bg-line p-px rounded-sm" style={{ gridTemplateColumns: `repeat(${m.b}, ${px}px)` }}>
      {[...m.z].map((c, i) => (
        <button key={i} onClick={() => onKlick(i)} style={{ ...zellStil(c), width: px, height: px }}
          className="text-[10px] font-black leading-none" aria-label={c === JOKER ? "Joker" : FARBEN[c]?.name}>
          {c === JOKER ? "*" : ""}
        </button>
      ))}
    </div>
  );
}

function setze(m: Muster, i: number, f: string): Muster {
  return { ...m, z: m.z.slice(0, i) + f + m.z.slice(i + 1) };
}

function umformen(m: Muster, b: number, h: number): Muster {
  let z = "";
  for (let y = 0; y < h; y++) for (let x = 0; x < b; x++) z += x < m.b && y < m.h ? m.z[y * m.b + x] : JOKER;
  return { b, h, z };
}

/** Muster und Ersatz einer Regel gemeinsam vergrößern/verkleinern (1…7). */
function groesse(block: Block, ri: number, db: number, dh: number) {
  const r = block.regeln[ri];
  const b = Math.min(7, Math.max(1, r.aus.b + db)), h = Math.min(7, Math.max(1, r.aus.h + dh));
  block.regeln[ri] = { aus: umformen(r.aus, b, h), ein: umformen(r.ein, b, h) };
}
