"use client";
/**
 * Reiter »Winkel«: Ein Winkel mit Scheitel S und den Schenkeln SA und SB.
 * B (und beim Erkunden auch A) lässt sich ziehen. Dazu ein Geodreieck oder
 * ein Vollkreis-Winkelmesser, der sich am Scheitel drehen lässt — angelegt
 * wird wie im Heft: Nullpunkt auf den Scheitel, 0° auf den ersten Schenkel.
 *
 * Drei Arten: Erkunden (Größe und Winkelart stehen da), Messen (Winkel
 * gewürfelt, Größe ablesen und eintippen) und Zeichnen (Größe vorgegeben,
 * Schenkel ziehen).
 */
import { useState } from "react";
import { leseZahl } from "@/lib/prozent";
import { GRIECHISCH, WINKELARTEN, norm, polar, richtung, winkelArt } from "@/lib/grundbegriffe";
import { LEER, zaehle } from "@/components/prozent/ui";
import { useZiehen } from "./ziehen";

const W = 640, H = 440, S = { x: 320, y: 225 }, L = 190;
/** Mathematische Richtung → Bildschirmpunkt um S. */
const B = (r: number, grad: number) => { const p = polar({ x: 0, y: 0 }, r, grad); return { x: S.x + p.x, y: S.y - p.y }; };

type Modus = "erkunden" | "messen" | "zeichnen";
type Werkzeug = "keins" | "geodreieck" | "winkelmesser";

function bogen(r: number, von: number, grad: number) {
  const a = B(r, von), b = B(r, von + grad);
  if (grad >= 359.999) return `M ${S.x + r} ${S.y} A ${r} ${r} 0 1 0 ${S.x - r} ${S.y} A ${r} ${r} 0 1 0 ${S.x + r} ${S.y} Z`;
  return `M ${S.x} ${S.y} L ${a.x} ${a.y} A ${r} ${r} 0 ${grad > 180 ? 1 : 0} 0 ${b.x} ${b.y} Z`;
}

/** Skala von 0° bis `bis`, außen gegen den Uhrzeigersinn, innen andersherum. */
function Skala({ r, bis }: { r: number; bis: number }) {
  const striche = [];
  for (let g = 0; g <= bis; g++) {
    if (bis === 360 && g === 360) break;
    const lang = g % 10 === 0 ? 14 : g % 5 === 0 ? 9 : 5;
    const a = polar({ x: 0, y: 0 }, r, g), b = polar({ x: 0, y: 0 }, r - lang, g);
    striche.push(<line key={g} x1={a.x} y1={-a.y} x2={b.x} y2={-b.y} strokeWidth={g % 10 === 0 ? 1.4 : 0.8} />);
  }
  const zahlen = [];
  for (let g = 0; g <= bis; g += 10) {
    if (bis === 360 && g === 360) break;
    const a = polar({ x: 0, y: 0 }, r - 24, g), i = polar({ x: 0, y: 0 }, r - 42, g);
    zahlen.push(
      <g key={g}>
        <text x={a.x} y={-a.y} fontSize={11} fontWeight={700} textAnchor="middle" dominantBaseline="central" transform={`rotate(${90 - g} ${a.x} ${-a.y})`}>{g}</text>
        <text x={i.x} y={-i.y} fontSize={9} textAnchor="middle" dominantBaseline="central" transform={`rotate(${90 - g} ${i.x} ${-i.y})`} style={{ fill: "#b91c1c" }}>{bis - g}</text>
      </g>,
    );
  }
  return <g style={{ stroke: "#1e3a8a" }}>{striche}<g style={{ fill: "#1e3a8a", stroke: "none" }}>{zahlen}</g></g>;
}

function Instrument({ art, dreh }: { art: Exclude<Werkzeug, "keins">; dreh: number }) {
  return (
    <g transform={`translate(${S.x} ${S.y}) rotate(${-dreh})`} pointerEvents="none" aria-hidden>
      {art === "geodreieck" ? (
        <>
          <path d="M -205 0 L 205 0 L 0 205 Z" transform="scale(1 -1)" style={{ fill: "#e0f2fe", fillOpacity: 0.85, stroke: "#1e3a8a", strokeWidth: 1.5 }} />
          {/* cm-Teilung an der langen Kante, Nullpunkt in der Mitte */}
          {Array.from({ length: 81 }, (_, i) => i - 40).map(i => (
            <line key={i} x1={i * 5} y1={0} x2={i * 5} y2={i % 10 === 0 ? 10 : i % 2 === 0 ? 6 : 3} style={{ stroke: "#1e3a8a" }} strokeWidth={0.8} />
          ))}
          <Skala r={140} bis={180} />
        </>
      ) : (
        <>
          <circle r={175} style={{ fill: "#e0f2fe", fillOpacity: 0.85, stroke: "#1e3a8a", strokeWidth: 1.5 }} />
          <Skala r={175} bis={360} />
        </>
      )}
      <line x1={-8} y1={0} x2={8} y2={0} style={{ stroke: "#b91c1c" }} strokeWidth={1.5} />
      <line x1={0} y1={-8} x2={0} y2={8} style={{ stroke: "#b91c1c" }} strokeWidth={1.5} />
    </g>
  );
}

const ganzGrad = (g: number) => Math.round(g);
/** Schrift mit Rand in Seitenfarbe — lesbar auf Blatt und Werkzeug. */
const HALO = (fill: string) => ({ fill, stroke: "var(--surface)", strokeWidth: 4, paintOrder: "stroke" as const, strokeLinejoin: "round" as const });
const wuerfle = () => ({ von: Math.floor(Math.random() * 12) * 30 + Math.floor(Math.random() * 3) * 10, grad: 10 + Math.floor(Math.random() * 341) });

export default function Winkel() {
  const [modus, setModus] = useState<Modus>("erkunden");
  const [von, setVon] = useState(0);
  const [grad, setGrad] = useState(50);
  const [werkzeug, setWerkzeug] = useState<Werkzeug>("winkelmesser");
  const [dreh, setDreh] = useState(0);
  const [raster, setRaster] = useState(1);
  const [name, setName] = useState<string>("α");
  const [ziel, setZiel] = useState(0);
  const [eingabe, setEingabe] = useState("");
  const [urteil, setUrteil] = useState<null | { ok: boolean; text: string }>(null);
  const [punkte, setPunkte] = useState(LEER);

  const { start, props } = useZiehen<"A" | "B">((n, p) => {
    const r = richtung(S, { x: p.x, y: 2 * S.y - p.y });
    const auf = (g: number) => Math.round(g / raster) * raster;
    if (n === "A") { setVon(norm(auf(r))); setUrteil(null); return; }
    if (modus === "messen") return;
    let g = norm(auf(r - von));
    // Nahe an 0 bleibt bei Vollwinkel, wenn man von oben kommt
    if (g === 0 && grad > 300) g = 360;
    setGrad(g); setUrteil(null);
  });

  const neu = (m: Modus) => {
    setModus(m); setEingabe(""); setUrteil(null); setDreh(0);
    if (m === "messen") { const w = wuerfle(); setVon(w.von); setGrad(w.grad); }
    if (m === "zeichnen") { const w = wuerfle(); setVon(w.von); setGrad(30); setZiel(w.grad); }
    if (m === "erkunden") { setVon(0); setGrad(50); }
  };

  const pruefe = () => {
    if (modus === "messen") {
      const x = leseZahl(eingabe);
      if (x === null) { setUrteil({ ok: false, text: "Bitte eine Zahl eintippen." }); return; }
      const ok = Math.abs(x - grad) <= 1;
      setUrteil({ ok, text: ok ? `Richtig: ${name} = ${grad}°.` : `Nicht ganz — gemessen sind ${grad}°. Lege den Nullpunkt auf S und 0° auf den Schenkel SA.` });
      setPunkte(p => zaehle(p, ok));
    } else {
      const ok = Math.abs(grad - ziel) <= 1;
      setUrteil({ ok, text: ok ? `Genau: ${name} = ${grad}°.` : `Dein Winkel ist ${grad}° groß, gesucht sind ${ziel}°.` });
      setPunkte(p => zaehle(p, ok));
    }
  };

  const zeigeWert = modus === "erkunden" || urteil !== null;
  const art = winkelArt(grad);
  const a = B(L, von), b = B(L, von + grad), mitte = B(grad > 180 ? 70 : 62, von + grad / 2);
  const farbe = WINKELARTEN.find(w => w.id === art)?.farbe ?? "#64748b";
  const schenkelText = (r: number, g: number, t: string) => { const p = B(r, g); return <text x={p.x} y={p.y} fontSize={13} textAnchor="middle" style={HALO("var(--text-muted)")}>{t}</text>; };

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["erkunden", "messen", "zeichnen"] as Modus[]).map(m => (
          <button key={m} className={`chip ${modus === m ? "chip-on" : ""}`} aria-pressed={modus === m} onClick={() => neu(m)}>
            {{ erkunden: "🔍 Erkunden", messen: "📏 Messen", zeichnen: "✏️ Zeichnen" }[m]}
          </button>
        ))}
        <span className="w-3" />
        {(["winkelmesser", "geodreieck", "keins"] as Werkzeug[]).map(w => (
          <button key={w} className={`chip ${werkzeug === w ? "chip-on" : ""}`} aria-pressed={werkzeug === w} onClick={() => setWerkzeug(w)}>
            {{ winkelmesser: "⭕ Winkelmesser", geodreieck: "📐 Geodreieck", keins: "ohne Werkzeug" }[w]}
          </button>
        ))}
        <span className="flex-1" />
        {punkte.gesamt > 0 && <span className="text-sm font-black">✔ {punkte.richtig} von {punkte.gesamt}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem] items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[70vh] rounded-xl border border-line select-none" role="img" aria-label="Winkel zum Ziehen" {...props}>
          {werkzeug !== "keins" && <Instrument art={werkzeug} dreh={dreh} />}
          <path d={bogen(grad > 180 ? 55 : 48, von, grad)} style={{ fill: farbe, fillOpacity: 0.3, stroke: farbe }} strokeWidth={2} />
          {art === "recht" && (() => { const p1 = B(26, von), p2 = B(26 * Math.SQRT2, von + 45), p3 = B(26, von + 90); return <path d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y}`} fill="none" style={{ stroke: farbe }} strokeWidth={2} />; })()}
          <line x1={S.x} y1={S.y} x2={a.x} y2={a.y} style={{ stroke: "var(--text)" }} strokeWidth={3} strokeLinecap="round" />
          <line x1={S.x} y1={S.y} x2={b.x} y2={b.y} style={{ stroke: "var(--accent)" }} strokeWidth={3} strokeLinecap="round" />
          {schenkelText(L * 0.62, von - 6, "Schenkel")}
          {schenkelText(L * 0.62, von + grad + 6, "Schenkel")}
          <text x={mitte.x} y={mitte.y} fontSize={20} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={HALO(farbe)}>{name}</text>
          <circle cx={S.x} cy={S.y} r={5} style={{ fill: "var(--text)" }} />
          <text x={S.x - 16} y={S.y + 22} fontSize={16} fontWeight={800} style={HALO("var(--text)")}>S</text>
          <text x={S.x - 16} y={S.y + 38} fontSize={11} style={HALO("var(--text-muted)")}>Scheitel</text>
          <circle cx={a.x} cy={a.y} r={modus === "erkunden" ? 11 : 5} style={{ fill: "var(--text)", cursor: modus === "erkunden" ? "grab" : undefined }} fillOpacity={modus === "erkunden" ? 0.35 : 1}
            onPointerDown={modus === "erkunden" ? start("A") : undefined} aria-label="Punkt A ziehen" />
          <text x={B(L + 22, von).x} y={B(L + 22, von).y} fontSize={16} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ fill: "var(--text)" }}>A</text>
          <circle cx={b.x} cy={b.y} r={modus === "messen" ? 5 : 13} style={{ fill: "var(--accent)", cursor: modus === "messen" ? undefined : "grab" }} fillOpacity={modus === "messen" ? 1 : 0.4}
            onPointerDown={modus === "messen" ? undefined : start("B")} aria-label="Punkt B ziehen" />
          <text x={B(L + 22, von + grad).x} y={B(L + 22, von + grad).y} fontSize={16} fontWeight={800} textAnchor="middle" dominantBaseline="central" style={{ fill: "var(--accent)" }}>B</text>
        </svg>

        <div className="flex flex-col gap-3 text-sm">
          {modus === "messen" && <p className="font-bold">Miss den Winkel {name}: Drehe das Werkzeug, bis 0° auf dem Schenkel SA liegt, und lies an SB ab.</p>}
          {modus === "zeichnen" && <p className="font-bold">Zeichne {name} = {ziel}°: Ziehe den Punkt B.</p>}
          {werkzeug !== "keins" && (
            <label className="flex flex-col gap-1">
              <span className="font-bold">Werkzeug drehen: {ganzGrad(dreh)}°</span>
              <input type="range" min={0} max={359} value={dreh} onChange={e => setDreh(Number(e.target.value))} aria-label="Werkzeug drehen" />
            </label>
          )}
          {modus !== "messen" && (
            <label className="flex items-center gap-2">Einrasten
              <select className="input w-auto" value={raster} onChange={e => setRaster(Number(e.target.value))}>
                <option value={1}>1°</option><option value={5}>5°</option><option value={15}>15°</option>
              </select>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-bold mr-1">Name:</span>
            {GRIECHISCH.map(g => <button key={g} className={`chip ${name === g ? "chip-on" : ""}`} onClick={() => setName(g)}>{g}</button>)}
          </div>

          {zeigeWert ? (
            <div className="rounded-xl border border-line p-3 flex flex-col gap-1">
              <div className="text-2xl font-black" style={{ color: farbe }}>{name} = {grad}°</div>
              <div>{name} = ∠ASB · Scheitel S · Schenkel SA und SB</div>
              <div className="font-bold">{WINKELARTEN.find(w => w.id === art)?.label ?? "Nullwinkel"}</div>
            </div>
          ) : null}
          {modus === "messen" && (
            <label className="flex items-center gap-2 font-bold">{name} =
              <input className="input w-24" inputMode="decimal" value={eingabe} aria-label="gemessener Winkel"
                onChange={e => { setEingabe(e.target.value); setUrteil(null); }} onKeyDown={e => { if (e.key === "Enter") pruefe(); }} /> °
            </label>
          )}
          {modus !== "erkunden" && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={pruefe}>✔ Prüfen</button>
              <button className="btn" onClick={() => neu(modus)}>🎲 Neuer Winkel</button>
            </div>
          )}
          {urteil && <p className={urteil.ok ? "text-ok font-bold" : "text-bad font-bold"}>{urteil.ok ? "✔ " : "✘ "}{urteil.text}</p>}

          <ul className="flex flex-col gap-1">
            {WINKELARTEN.map(w => (
              <li key={w.id} className={`rounded-lg px-2 py-1 flex justify-between gap-2 ${zeigeWert && w.id === art ? "font-black" : ""}`}
                style={zeigeWert && w.id === art ? { background: w.farbe + "33" } : undefined}>
                <span><span style={{ color: w.farbe }}>●</span> {w.label}</span><span className="text-muted">{w.bereich}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
