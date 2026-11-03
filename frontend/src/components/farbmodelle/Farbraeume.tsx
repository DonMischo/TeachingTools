"use client";
/**
 * Eine Farbe, vier Modelle: RGB (Licht, additiv), CMYK (Druck, subtraktiv),
 * HSV und HSL (Farbton + Buntheit + Helligkeit). Jedes Modell hat sein Bild
 * und seine Regler; darunter steht dieselbe Farbe in allen Schreibweisen.
 */
import { useEffect, useRef, useState, type PointerEvent as PEvent } from "react";
import { Chips } from "@/components/prozent/ui";
import {
  cmykZuRgb, grau, hexFarbe, hslZuRgb, hsvZuRgb, kurzHex, rgbZuCmyk, rgbZuHsl, rgbZuHsv, umkehren, ausHex, type Rgb,
} from "@/lib/farbmodelle";

const MODELLE = [
  { id: "rgb", label: "💡 RGB (Licht)" },
  { id: "cmyk", label: "🖨️ CMYK (Druck)" },
  { id: "hsv", label: "🎡 HSV" },
  { id: "hsl", label: "🌗 HSL" },
] as const;
type Modell = (typeof MODELLE)[number]["id"];

const gleich = (a: Rgb, b: Rgb) => a.every((k, i) => k === b[i]);
const runde = (xs: number[]) => xs.map(x => Math.round(x));

/**
 * Die Regler eines Modells halten ihre eigenen Werte: bei Grau gibt es keinen
 * Farbton, bei Schwarz keine Buntheit — aus RGB zurückgerechnet sprängen sie
 * auf 0. Erst wenn die Farbe von außen kommt, werden sie neu bestimmt.
 */
function useKoordinaten(farbe: Rgb, aus: (c: Rgb) => number[], zu: (k: number[]) => Rgb) {
  const [k, setK] = useState(() => runde(aus(farbe)));
  useEffect(() => { setK(alt => (gleich(zu(alt), farbe) ? alt : runde(aus(farbe)))); }, [farbe]); // eslint-disable-line react-hooks/exhaustive-deps
  return [k, setK] as const;
}

function Regler({ name, wert, max, einheit = "", farbe, verlauf, setze }: {
  name: string; wert: number; max: number; einheit?: string; farbe: string; verlauf?: string; setze: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <b className="w-24 shrink-0" style={{ color: farbe }}>{name}</b>
      <span className="flex-1 flex flex-col gap-0.5 min-w-24">
        <input type="range" min={0} max={max} value={wert} aria-label={name} className="w-full" style={{ accentColor: farbe }}
          onChange={e => setze(Number(e.target.value))} />
        {verlauf && <span className="h-2 rounded-full border border-line" style={{ background: verlauf }} />}
      </span>
      <input className="input w-16 text-right font-mono" inputMode="numeric" value={wert} aria-label={`${name} als Zahl`}
        onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) setze(Math.max(0, Math.min(max, Math.round(n)))); }} />
      <span className="w-4 text-muted">{einheit}</span>
    </label>
  );
}

/** Ziehfläche: meldet die Zeigerposition als 0…1 in x und y (y = 0 oben). */
function useZiehen(melde: (x: number, y: number) => void) {
  const zieht = useRef(false);
  const wo = (e: PEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    melde(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
  };
  return {
    onPointerDown: (e: PEvent<HTMLElement>) => { zieht.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); wo(e); },
    onPointerMove: (e: PEvent<HTMLElement>) => { if (zieht.current) wo(e); },
    onPointerUp: () => { zieht.current = false; },
    style: { touchAction: "none" as const },
  };
}

const N = 96;
/** Quadrat Buntheit (x) mal Helligkeit (y) beim festen Farbton. */
function Feld({ farbton, modell, x, y, setze }: {
  farbton: number; modell: "hsv" | "hsl"; x: number; y: number; setze: (s: number, h: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const bild = ctx.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const s = (i / (N - 1)) * 100, h = (1 - j / (N - 1)) * 100;
      const c = modell === "hsv" ? hsvZuRgb(farbton, s, h) : hslZuRgb(farbton, s, h);
      bild.data.set([...c, 255], (j * N + i) * 4);
    }
    ctx.putImageData(bild, 0, 0);
  }, [farbton, modell]);
  const ziehen = useZiehen((px, py) => setze(Math.round(px * 100), Math.round((1 - py) * 100)));
  return (
    <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-xl overflow-hidden border-2 border-line cursor-crosshair select-none" {...ziehen}
      role="slider" aria-label={`Buntheit und ${modell === "hsv" ? "Helligkeit" : "Hellwert"}`} aria-valuenow={x}>
      <canvas ref={ref} width={N} height={N} className="w-full h-full" />
      <span className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-[0_0_0_1px_black] pointer-events-none"
        style={{ left: `${x}%`, top: `${100 - y}%` }} />
      <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white drop-shadow pointer-events-none">S →</span>
      <span className="absolute top-1 left-1 text-[10px] font-bold text-white drop-shadow pointer-events-none">{modell === "hsv" ? "V ↑" : "L ↑"}</span>
    </div>
  );
}

const REGENBOGEN = "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";

function Farbkreis({ farbton, setze }: { farbton: number; setze: (h: number) => void }) {
  const ziehen = useZiehen((x, y) => {
    const w = (Math.atan2(y - 0.5, x - 0.5) * 180) / Math.PI;
    setze(Math.round((w + 90 + 360) % 360));
  });
  const w = ((farbton - 90) * Math.PI) / 180;
  return (
    <div className="relative w-40 h-40 rounded-full cursor-pointer select-none" {...ziehen} aria-label="Farbkreis"
      style={{ ...ziehen.style, background: "conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}>
      <div className="absolute inset-6 rounded-full bg-surface flex items-center justify-center text-center text-xs font-bold pointer-events-none">
        H = {farbton}°
      </div>
      <span className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-[0_0_0_1px_black] pointer-events-none"
        style={{ left: `${50 + 42 * Math.cos(w)}%`, top: `${50 + 42 * Math.sin(w)}%`, background: `hsl(${farbton} 100% 50%)` }} />
    </div>
  );
}

/** Drei Lichtkegel auf schwarzer Wand: wo sie sich überlappen, addiert sich das Licht. */
function Lichtkreise({ farbe: [r, g, b] }: { farbe: Rgb }) {
  return (
    <svg viewBox="0 0 200 190" className="w-56 sm:w-64 rounded-xl border-2 border-line" style={{ background: "#000" }} aria-label="Additive Mischung">
      <g style={{ isolation: "isolate" }}>
        <circle cx={100} cy={70} r={55} fill={`rgb(${r},0,0)`} stroke="#ffffff40" style={{ mixBlendMode: "screen" }} />
        <circle cx={70} cy={120} r={55} fill={`rgb(0,${g},0)`} stroke="#ffffff40" style={{ mixBlendMode: "screen" }} />
        <circle cx={130} cy={120} r={55} fill={`rgb(0,0,${b})`} stroke="#ffffff40" style={{ mixBlendMode: "screen" }} />
      </g>
      <text x={100} y={22} fill="#fff" fontSize={11} textAnchor="middle">Rot</text>
      <text x={14} y={180} fill="#fff" fontSize={11}>Grün</text>
      <text x={186} y={180} fill="#fff" fontSize={11} textAnchor="end">Blau</text>
    </svg>
  );
}

/** Drei Farbschichten auf weißem Papier: jede Tinte schluckt Licht, übereinander wird es dunkler. */
function Tintenkreise({ cmyk: [c, m, y, k] }: { cmyk: number[] }) {
  const t = (x: number) => Math.round(255 * (1 - x / 100));
  return (
    <svg viewBox="0 0 200 190" className="w-56 sm:w-64 rounded-xl border-2 border-line" style={{ background: "#fff" }} aria-label="Subtraktive Mischung">
      <g style={{ isolation: "isolate" }}>
        <circle cx={100} cy={70} r={55} fill={`rgb(${t(c)},255,255)`} style={{ mixBlendMode: "multiply" }} />
        <circle cx={70} cy={120} r={55} fill={`rgb(255,${t(m)},255)`} style={{ mixBlendMode: "multiply" }} />
        <circle cx={130} cy={120} r={55} fill={`rgb(255,255,${t(y)})`} style={{ mixBlendMode: "multiply" }} />
        <circle cx={100} cy={103} r={20} fill={`rgb(${t(k)},${t(k)},${t(k)})`} style={{ mixBlendMode: "multiply" }} />
      </g>
      <text x={100} y={11} fill="#0e7490" fontSize={11} textAnchor="middle">Cyan</text>
      <text x={8} y={186} fill="#be185d" fontSize={11}>Magenta</text>
      <text x={192} y={186} fill="#a16207" fontSize={11} textAnchor="end">Gelb</text>
    </svg>
  );
}

const ROT = "#ef4444", GRUEN = "#22c55e", BLAU = "#3b82f6";

export default function Farbraeume({ farbe, setFarbe }: { farbe: Rgb; setFarbe: (c: Rgb) => void }) {
  const [modell, setModell] = useState<Modell>("rgb");
  const [cmyk, setCmyk] = useKoordinaten(farbe, rgbZuCmyk, k => cmykZuRgb(k as [number, number, number, number]));
  const [hsv, setHsv] = useKoordinaten(farbe, rgbZuHsv, ([h, s, v]) => hsvZuRgb(h, s, v));
  const [hsl, setHsl] = useKoordinaten(farbe, rgbZuHsl, ([h, s, l]) => hslZuRgb(h, s, l));

  const neuCmyk = (k: number[]) => { setCmyk(k); setFarbe(cmykZuRgb(k as [number, number, number, number])); };
  const neuHsv = (k: number[]) => { setHsv(k); setFarbe(hsvZuRgb(k[0], k[1], k[2])); };
  const neuHsl = (k: number[]) => { setHsl(k); setFarbe(hslZuRgb(k[0], k[1], k[2])); };
  const setzeKanal = (i: number, n: number) => setFarbe(farbe.map((k, j) => (j === i ? n : k)) as Rgb);

  const hex = hexFarbe(farbe);
  const [r, g, b] = farbe;
  const zeilen: [string, string][] = [
    ["Hex", hex + (kurzHex(farbe) ? `  (kurz ${kurzHex(farbe)})` : "")],
    ["RGB", `rgb(${r}, ${g}, ${b})`],
    ["RGB in %", farbe.map(k => `${Math.round((k / 255) * 100)} %`).join(", ")],
    ["CMYK", `${runde(rgbZuCmyk(farbe)).map(x => x + " %").join(", ")}`],
    ["HSV", `${runde(rgbZuHsv(farbe)).map((x, i) => (i ? x + " %" : x + "°")).join(", ")}`],
    ["HSL", `hsl(${runde(rgbZuHsl(farbe)).map((x, i) => (i ? x + "%" : x)).join(" ")})`],
    ["Grauwert", `${grau(farbe)} von 255`],
    ["Gegenfarbe", hexFarbe(umkehren(farbe))],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Chips wahl={modell} setze={setModell} optionen={MODELLE} />
      <div className="card p-4 sm:p-5 flex flex-wrap gap-6 items-start">
        <div className="flex flex-col items-center gap-3">
          {modell === "rgb" && <Lichtkreise farbe={farbe} />}
          {modell === "cmyk" && <Tintenkreise cmyk={cmyk} />}
          {modell === "hsv" && <Feld farbton={hsv[0]} modell="hsv" x={hsv[1]} y={hsv[2]} setze={(s, v) => neuHsv([hsv[0], s, v])} />}
          {modell === "hsl" && <Feld farbton={hsl[0]} modell="hsl" x={hsl[1]} y={hsl[2]} setze={(s, l) => neuHsl([hsl[0], s, l])} />}
        </div>

        <div className="flex-1 min-w-64 flex flex-col gap-3">
          {modell === "rgb" && (
            <>
              <p className="text-sm text-muted">
                Bildschirme mischen <b>Licht</b>: Jedes Pixel hat ein rotes, grünes und blaues Lämpchen, je 0 (aus) bis 255 (voll).
                Mehr Licht macht heller — alle drei voll ergibt <b>Weiß</b>, Rot + Grün ergibt <b>Gelb</b>. Das heißt <b>additiv</b>.
              </p>
              {[["Rot", ROT], ["Grün", GRUEN], ["Blau", BLAU]].map(([n, f], i) => (
                <Regler key={n} name={n} wert={farbe[i]} max={255} farbe={f} setze={x => setzeKanal(i, x)}
                  verlauf={`linear-gradient(to right, ${hexFarbe(farbe.map((k, j) => (j === i ? 0 : k)) as Rgb)}, ${hexFarbe(farbe.map((k, j) => (j === i ? 255 : k)) as Rgb)})`} />
              ))}
            </>
          )}
          {modell === "cmyk" && (
            <>
              <p className="text-sm text-muted">
                Drucker mischen <b>Farbe auf Papier</b>: Cyan, Magenta und Gelb schlucken je einen Teil des Lichts, das das weiße Papier
                zurückwirft. Mehr Tinte macht dunkler — das heißt <b>subtraktiv</b>. Weil C + M + Y zusammen nur ein schmutziges Braun
                geben, kommt Schwarz (<b>K</b>, »Key«) extra dazu.
              </p>
              {[["Cyan", "#06b6d4"], ["Magenta", "#db2777"], ["Gelb", "#ca8a04"], ["Schwarz (K)", "#525252"]].map(([n, f], i) => (
                <Regler key={n} name={n} wert={cmyk[i]} max={100} einheit="%" farbe={f} setze={x => neuCmyk(cmyk.map((k, j) => (j === i ? x : k)))} />
              ))}
            </>
          )}
          {(modell === "hsv" || modell === "hsl") && (() => {
            const k = modell === "hsv" ? hsv : hsl;
            const neu = modell === "hsv" ? neuHsv : neuHsl;
            return (
              <>
                <p className="text-sm text-muted">
                  {modell === "hsv"
                    ? <>So wählen Menschen Farben: erst der <b>Farbton</b> H im Farbkreis, dann wie <b>bunt</b> (S, Sättigung) und wie <b>hell</b> (V, Hellwert) sie ist. V = 0 ist immer Schwarz, S = 0 ist Grau bis Weiß.</>
                    : <>Wie HSV, aber mit <b>Helligkeit</b> L als Mitte: L = 0 ist Schwarz, L = 100 ist Weiß, die reine Farbe liegt bei L = 50. So rechnet CSS: <span className="font-mono">hsl(…)</span>.</>}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <Farbkreis farbton={k[0]} setze={h => neu([h, k[1], k[2]])} />
                  <div className="flex-1 min-w-56 flex flex-col gap-2">
                    <Regler name="Farbton H" wert={k[0]} max={359} einheit="°" farbe={`hsl(${k[0]} 80% 45%)`} verlauf={REGENBOGEN} setze={h => neu([h, k[1], k[2]])} />
                    <Regler name="Sättigung S" wert={k[1]} max={100} einheit="%" farbe="#64748b" setze={s => neu([k[0], s, k[2]])} />
                    <Regler name={modell === "hsv" ? "Hellwert V" : "Helligkeit L"} wert={k[2]} max={100} einheit="%" farbe="#64748b" setze={v => neu([k[0], k[1], v])} />
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      <div className="card p-4 sm:p-5 flex flex-wrap gap-5 items-start">
        <div className="flex flex-col items-center gap-2">
          <div className="w-32 h-32 rounded-2xl shadow-lg border-2 border-line" style={{ background: hex }} aria-label="Aktuelle Farbe" data-testid="farbfeld" />
          <label className="text-xs text-muted flex items-center gap-2">
            Farbwähler
            <input type="color" value={hex.toLowerCase()} onChange={e => { const c = ausHex(e.target.value); if (c) setFarbe(c); }} />
          </label>
        </div>
        <div className="flex-1 min-w-64">
          <h3 className="font-black mb-2">Dieselbe Farbe in allen Schreibweisen</h3>
          <table className="text-sm w-full">
            <tbody>
              {zeilen.map(([n, w]) => (
                <tr key={n} className="border-b border-line last:border-0">
                  <td className="py-1 pr-3 font-bold w-28">{n}</td>
                  <td className="py-1 font-mono">{w}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted mt-2">
            Zurückgerechnet kann eine Farbe um 1 abweichen: HSV, HSL und CMYK werden hier auf ganze Zahlen gerundet.
            Echte Drucker brauchen außerdem ein Farbprofil — CMYK hier ist die einfache Schulformel.
          </p>
        </div>
      </div>
    </div>
  );
}
