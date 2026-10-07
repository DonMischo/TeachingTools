"use client";
/**
 * 2D-Wachstum auf einer Zeichenfläche. Gezeichnet wird nur, was neu angewachsen
 * ist; erst wenn der Haufen an den Rand stößt, wird herausgezoomt und alles neu
 * gezeichnet. Farbe = Reihenfolge des Anwachsens, Verlauf wählbar.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { farbe, type Dla, type Farbkarte } from "@/lib/dla/kern";
import Steuerung from "./Steuerung";
import { useWachstum, type Einstellung } from "./useWachstum";

const STUFEN = 48;
const palette = (karte: Farbkarte) => Array.from({ length: STUFEN }, (_, i) => {
  const [r, g, b] = farbe(i / (STUFEN - 1), karte);
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
});
export const HINTERGRUND = "#060a14";

type Modus = "aeste" | "punkte";

export function speichereBild(canvas: HTMLCanvasElement | null, name: string) {
  canvas?.toBlob(b => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}

export default function Flaeche({ karte, setKarte }: { karte: Farbkarte; setKarte: (k: Farbkarte) => void }) {
  const [e, setE] = useState<Einstellung>({ anzahl: 50_000, haftung: 1, saat: "punkt" });
  const [lauf, setLauf] = useState(0);
  const [modus, setModus] = useState<Modus>("aeste");
  const canvas = useRef<HTMLCanvasElement>(null);
  const zustand = useRef({ radius: 0, gezeichnet: 0, breite: 0, modus: "aeste" as Modus, karte });
  const PALETTE = useMemo(() => palette(karte), [karte]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const anpassen = () => {
      const dpr = window.devicePixelRatio || 1;
      const b = c.clientWidth;
      if (!b) return;
      c.width = Math.round(b * dpr);
      c.height = Math.round(b * dpr);
      zustand.current.gezeichnet = 0;
      zustand.current.radius = 0;
    };
    anpassen();
    const ro = new ResizeObserver(anpassen);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const zeichne = (dla: Dla, neu: boolean) => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const z = zustand.current;
    // Anderer Verlauf oder andere Darstellung → alles neu zeichnen
    if (neu || z.modus !== modus || z.karte !== karte || dla.rmax > z.radius * 0.92) {
      z.radius = Math.max(dla.rmax * 1.35, 25);
      z.gezeichnet = 0;
      z.modus = modus;
      z.karte = karte;
      ctx.fillStyle = HINTERGRUND;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    if (z.gezeichnet >= dla.anzahl) return;
    const m = c.width / (2 * z.radius), mx = c.width / 2, my = c.height / 2;
    const p = dla.pos, el = dla.eltern, kap = dla.kapazitaet;
    const dicke = Math.max(0.8, m * 0.9);
    let stufe = -1;
    ctx.lineCap = "round";
    ctx.lineWidth = dicke;
    ctx.beginPath();
    const fertig = () => { if (modus === "aeste") ctx.stroke(); else ctx.fill(); };
    for (let i = z.gezeichnet; i < dla.anzahl; i++) {
      const s = Math.min(STUFEN - 1, Math.floor((i / kap) * STUFEN));
      if (s !== stufe) {
        fertig();
        ctx.beginPath();
        ctx.strokeStyle = ctx.fillStyle = PALETTE[s];
        stufe = s;
      }
      const x = mx + p[i * 3] * m, y = my - p[i * 3 + 1] * m;
      if (modus === "punkte") {
        ctx.rect(x - dicke / 2, y - dicke / 2, dicke, dicke);
      } else {
        const e = el[i];
        if (e < 0) continue;
        ctx.moveTo(mx + p[e * 3] * m, my - p[e * 3 + 1] * m);
        ctx.lineTo(x, y);
      }
    }
    fertig();
    z.gezeichnet = dla.anzahl;
  };

  const { stand, laeuft, setLaeuft } = useWachstum(2, e, lauf, zeichne);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="flex flex-col gap-2">
        <canvas ref={canvas} className="w-full max-w-[min(100%,78vh)] mx-auto aspect-square rounded-xl" style={{ background: HINTERGRUND }}
          aria-label="Wachsender Haufen in der Ebene" />
      </div>
      <Steuerung dim={2} karte={karte} setKarte={setKarte} e={e} setE={setE} neu={() => setLauf(l => l + 1)} laeuft={laeuft} setLaeuft={setLaeuft} stand={stand}
        extra={
          <div className="flex flex-wrap items-center gap-1">
            <button className={`chip ${modus === "aeste" ? "chip-on" : ""}`} onClick={() => setModus("aeste")}>🌿 Äste</button>
            <button className={`chip ${modus === "punkte" ? "chip-on" : ""}`} onClick={() => setModus("punkte")}>⠿ Punkte</button>
            <button className="btn btn-secondary ml-auto" onClick={() => speichereBild(canvas.current, "wachstum-2d.png")}>📷 Bild</button>
          </div>
        } />
    </div>
  );
}
