"use client";
/**
 * Zeichenfläche für die Demos: Hieroglyphen nachmalen (Papyrus, Tinte) und
 * die Höhlenwand (Fels, Ocker, Holzkohle, Hand pusten). Maus, Stift und
 * Finger über Pointer-Events. `vorlage` liegt blass darunter zum Nachmalen.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type Farbe = { name: string; wert: string };
export type ZeichenGriff = {
  /** Bild als data-URL (WebP, klein genug zum Verschicken) */
  bild(): string;
  leeren(): void;
  /** Anteil der Vorlage, der übermalt ist, und Anteil der Striche, die auf der Vorlage liegen (0–1) */
  treffer(): { abgedeckt: number; daneben: number } | null;
  leer(): boolean;
};

type Props = {
  breite: number;
  hoehe: number;
  /** Untergrund, auf den gemalt wird (wird mit ins Bild übernommen) */
  untergrund: (ctx: CanvasRenderingContext2D, b: number, h: number) => void;
  farben: Farbe[];
  /** Zeichen oder Emoji, blass als Vorlage zum Nachmalen */
  vorlage?: string;
  /** Knopf »Hand pusten« wie in der Cueva de las Manos */
  hand?: boolean;
  label: string;
};

const VORLAGE_SCHRIFT = "'Segoe UI Historic', 'Noto Sans Egyptian Hieroglyphs', 'Segoe UI Emoji', serif";

export const Zeichenflaeche = forwardRef<ZeichenGriff, Props>(function Zeichenflaeche({ breite, hoehe, untergrund, farben, vorlage, hand, label }, ref) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const striche = useRef<HTMLCanvasElement | null>(null);
  const [farbe, setFarbe] = useState(farben[0].wert);
  const [dicke, setDicke] = useState(6);
  const [handModus, setHandModus] = useState(false);
  const zuletzt = useRef<{ x: number; y: number } | null>(null);
  const gemalt = useRef(false);

  const neuZeichnen = () => {
    const c = leinwand.current, s = striche.current;
    if (!c || !s) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    untergrund(ctx, breite, hoehe);
    if (vorlage) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#000";
      ctx.font = `${hoehe * 0.78}px ${VORLAGE_SCHRIFT}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(vorlage, breite / 2, hoehe / 2);
      ctx.restore();
    }
    ctx.drawImage(s, 0, 0);
  };

  useEffect(() => {
    const s = document.createElement("canvas");
    s.width = breite; s.height = hoehe;
    striche.current = s;
    gemalt.current = false;
    neuZeichnen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breite, hoehe, vorlage]);

  const punkt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * breite, y: ((e.clientY - r.top) / r.height) * hoehe };
  };
  const strich = (von: { x: number; y: number }, nach: { x: number; y: number }) => {
    const ctx = striche.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = farbe; ctx.lineWidth = dicke; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(von.x, von.y); ctx.lineTo(nach.x, nach.y); ctx.stroke();
    gemalt.current = true;
    neuZeichnen();
  };
  /** Farbe um die Hand herum pusten — die Hand selbst bleibt frei */
  const pusten = (p: { x: number; y: number }) => {
    const ctx = striche.current?.getContext("2d");
    if (!ctx) return;
    const s = hoehe / 260;
    const finger = [[-34, -62, 9, 34], [-14, -78, 9, 42], [6, -80, 9, 44], [25, -70, 8, 38], [46, -6, 10, 28]];
    const inHand = (x: number, y: number) => {
      const dx = (x - p.x) / s, dy = (y - p.y) / s;
      if ((dx / 34) ** 2 + ((dy + 4) / 40) ** 2 < 1) return true;
      return finger.some(([fx, fy, rx, ry], i) => {
        // Daumen: schräg nach außen oben (≈ 43°), sein Ansatz liegt im Handballen
        const w = i === 4 ? 0.75 : -0.12 + i * 0.08;
        const ax = dx - fx, ay = dy - fy;
        const ux = ax * Math.cos(w) + ay * Math.sin(w), uy = -ax * Math.sin(w) + ay * Math.cos(w);
        return (ux / rx) ** 2 + (uy / ry) ** 2 < 1;
      });
    };
    ctx.fillStyle = farbe;
    // Dicht an der Hand viel Farbe, nach außen ausfransend — wie aus dem Mund gepustet
    for (let i = 0; i < 14000; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() ** 0.8 * 110 * s;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d - 25 * s;
      if (inHand(x, y)) continue;
      ctx.globalAlpha = (0.35 + Math.random() * 0.4) * (1 - d / (115 * s));
      ctx.fillRect(x, y, 2.2, 2.2);
    }
    ctx.globalAlpha = 1;
    gemalt.current = true;
    neuZeichnen();
  };

  useImperativeHandle(ref, () => ({
    bild: () => leinwand.current?.toDataURL("image/webp", 0.6) ?? "",
    leeren: () => { striche.current?.getContext("2d")?.clearRect(0, 0, breite, hoehe); gemalt.current = false; neuZeichnen(); },
    leer: () => !gemalt.current,
    treffer: () => {
      if (!vorlage || !striche.current) return null;
      // Großzügig, weil mit der Maus gemalt wird:
      // - »getroffen« zählt den UMRISS der Vorlage — Nachfahren der Kontur reicht, ausmalen muss man nicht;
      //   ein Umrisspunkt gilt als getroffen, wenn ein Strich bis zu TOLERANZ Pixel daneben liegt.
      // - »daneben« zählt nur Striche außerhalb eines breiten Bands um das Zeichen.
      const TOLERANZ = 9;
      const flaeche = (zeichne: (c: CanvasRenderingContext2D) => void) => {
        const c = document.createElement("canvas");
        c.width = breite; c.height = hoehe;
        const x = c.getContext("2d");
        if (!x) return null;
        x.font = `${hoehe * 0.78}px ${VORLAGE_SCHRIFT}`;
        x.textAlign = "center"; x.textBaseline = "middle";
        x.strokeStyle = "#000"; x.fillStyle = "#000";
        zeichne(x);
        return x.getImageData(0, 0, breite, hoehe).data;
      };
      const umriss = flaeche(x => { x.lineWidth = 3; x.strokeText(vorlage, breite / 2, hoehe / 2); });
      const band = flaeche(x => { x.lineWidth = 2 * 14; x.fillText(vorlage, breite / 2, hoehe / 2); x.strokeText(vorlage, breite / 2, hoehe / 2); });
      // Striche verdicken: die Strichfläche in alle Richtungen um TOLERANZ verschoben übereinanderlegen
      const dick = flaeche(x => {
        for (let w = 0; w < 16; w++) {
          for (const r of [TOLERANZ / 2, TOLERANZ]) x.drawImage(striche.current!, Math.cos((w * Math.PI) / 8) * r, Math.sin((w * Math.PI) / 8) * r);
        }
        x.drawImage(striche.current!, 0, 0);
      });
      const sd = striche.current.getContext("2d")?.getImageData(0, 0, breite, hoehe).data;
      if (!umriss || !band || !dick || !sd) return null;
      let umrissPx = 0, abgedeckt = 0, strichPx = 0, daneben = 0;
      for (let i = 3; i < sd.length; i += 16) {
        if (umriss[i] > 40) { umrissPx++; if (dick[i] > 40) abgedeckt++; }
        if (sd[i] > 40) { strichPx++; if (band[i] <= 40) daneben++; }
      }
      return { abgedeckt: umrissPx ? abgedeckt / umrissPx : 0, daneben: strichPx ? daneben / strichPx : 0 };
    },
  }));

  return (
    <div className="flex flex-col gap-2">
      <canvas ref={leinwand} width={breite} height={hoehe} aria-label={label}
        className="w-full rounded-2xl shadow-inner touch-none cursor-crosshair" style={{ maxWidth: breite * 1.6, aspectRatio: `${breite} / ${hoehe}` }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = punkt(e);
          if (handModus) { pusten(p); return; }
          zuletzt.current = p; strich(p, { x: p.x + 0.1, y: p.y });
        }}
        onPointerMove={e => { if (!zuletzt.current) return; const p = punkt(e); strich(zuletzt.current, p); zuletzt.current = p; }}
        onPointerUp={() => { zuletzt.current = null; }}
        onPointerCancel={() => { zuletzt.current = null; }} />
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {farben.map(f => (
          <button key={f.wert} onClick={() => { setFarbe(f.wert); setHandModus(false); }} title={f.name} aria-label={f.name}
            className={`w-7 h-7 rounded-full border-2 ${farbe === f.wert && !handModus ? "border-accent scale-110" : "border-line"}`} style={{ background: f.wert }} />
        ))}
        {[3, 6, 12].map(d => <button key={d} className={`chip ${dicke === d && !handModus ? "chip-on" : ""}`} onClick={() => { setDicke(d); setHandModus(false); }}>{d === 3 ? "fein" : d === 6 ? "mittel" : "dick"}</button>)}
        {hand && <button className={`chip ${handModus ? "chip-on" : ""}`} onClick={() => setHandModus(h => !h)}>🖐️ Hand pusten</button>}
      </div>
    </div>
  );
});

/** Papyrus: warmes Gelb mit Fasern */
export function papyrus(ctx: CanvasRenderingContext2D, b: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#f3e3b5"); g.addColorStop(1, "#e2c98a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, b, h);
  ctx.globalAlpha = 0.12; ctx.strokeStyle = "#8a6a2c";
  for (let y = 3; y < h; y += 7) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(b, y + ((y * 7) % 5) - 2); ctx.stroke(); }
  for (let x = 5; x < b; x += 11) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + ((x * 3) % 4) - 2, h); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

/** Felswand: Braungrau mit Flecken, gleich bei jedem Aufruf (fester Zufall) */
export function fels(ctx: CanvasRenderingContext2D, b: number, h: number) {
  const g = ctx.createRadialGradient(b * 0.45, h * 0.4, 10, b * 0.5, h * 0.5, b * 0.8);
  g.addColorStop(0, "#c8ad8a"); g.addColorStop(1, "#7d6247");
  ctx.fillStyle = g; ctx.fillRect(0, 0, b, h);
  let s = 7;
  const z = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    ctx.globalAlpha = 0.05 + z() * 0.1;
    ctx.fillStyle = z() < 0.5 ? "#5a4532" : "#e7d3b3";
    ctx.beginPath(); ctx.ellipse(z() * b, z() * h, 4 + z() * 30, 3 + z() * 14, z() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
