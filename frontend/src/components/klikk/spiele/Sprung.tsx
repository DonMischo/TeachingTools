"use client";
/**
 * Würfelsprung (Geometry-Dash-artig): Der Würfel rennt von selbst, Klick oder
 * Leertaste springt. Stacheln töten, auf Blöcken kann man landen. Die Strecke
 * ist zufällig, das Tempo steigt; Punkte = zurückgelegte Strecke.
 */
import { useEffect, useRef, useState } from "react";

const B = 300, H = 440, BODEN = 360, W = 26;
type Hindernis = { x: number; art: "stachel" | "block"; h: number };

export default function Sprung({ onEnde }: { onEnde: (punkte: number) => void }) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"bereit" | "laeuft" | "aus">("bereit");
  const [punkte, setPunkte] = useState(0);
  const sprung = useRef(false);

  useEffect(() => {
    if (phase !== "laeuft") return;
    const g = leinwand.current!.getContext("2d")!;
    let y = BODEN - W, vy = 0, dreh = 0, strecke = 0, tempo = 180, weiter = true;
    const hindernisse: Hindernis[] = [];
    let naechstesX = B + 100;
    let letzte = performance.now();

    const neues = () => {
      const r = Math.random();
      if (r < 0.5) hindernisse.push({ x: naechstesX, art: "stachel", h: 24 });
      else if (r < 0.75) { hindernisse.push({ x: naechstesX, art: "stachel", h: 24 }, { x: naechstesX + 24, art: "stachel", h: 24 }); }
      else hindernisse.push({ x: naechstesX, art: "block", h: 30 + Math.floor(Math.random() * 2) * 26 });
      naechstesX += 170 + Math.random() * 160;
    };
    while (naechstesX < B * 3) neues();

    const bild = (jetzt: number) => {
      if (!weiter) return;
      const dt = Math.min(0.033, (jetzt - letzte) / 1000);
      letzte = jetzt;
      tempo = 180 + strecke / 40;
      const dx = tempo * dt;
      strecke += dx;
      naechstesX -= dx;
      for (const h of hindernisse) h.x -= dx;
      while (hindernisse.length && hindernisse[0].x < -60) hindernisse.shift();
      while (naechstesX < B * 2) neues();

      // Boden unter dem Würfel: Boden oder ein Block
      const px = 60;
      let boden = BODEN;
      for (const h of hindernisse) if (h.art === "block" && px + W > h.x && px < h.x + 30) boden = Math.min(boden, BODEN - h.h);
      const amBoden = y >= boden - W - 0.5;
      if (sprung.current && amBoden) { vy = -560; sprung.current = false; }
      vy += 1700 * dt;
      y += vy * dt;
      if (y > boden - W) { y = boden - W; vy = 0; dreh = Math.round(dreh / (Math.PI / 2)) * (Math.PI / 2); } else dreh += 6 * dt;

      // Treffer: Stachel berührt, oder seitlich gegen einen Block gelaufen
      for (const h of hindernisse) {
        if (h.art === "stachel" && px + W - 6 > h.x && px + 6 < h.x + 24 && y + W > BODEN - h.h + 6) weiter = false;
        if (h.art === "block" && px + W > h.x + 4 && px < h.x && y + W > BODEN - h.h + 8) weiter = false;
      }

      g.fillStyle = "#1e1b4b"; g.fillRect(0, 0, B, H);
      g.fillStyle = "#312e81"; g.fillRect(0, BODEN, B, H - BODEN);
      g.strokeStyle = "#a5b4fc"; g.beginPath(); g.moveTo(0, BODEN); g.lineTo(B, BODEN); g.stroke();
      for (const h of hindernisse) {
        if (h.art === "stachel") {
          g.fillStyle = "#f43f5e"; g.beginPath();
          g.moveTo(h.x, BODEN); g.lineTo(h.x + 12, BODEN - h.h); g.lineTo(h.x + 24, BODEN); g.fill();
        } else {
          g.fillStyle = "#38bdf8"; g.fillRect(h.x, BODEN - h.h, 30, h.h);
        }
      }
      g.save(); g.translate(px + W / 2, y + W / 2); g.rotate(dreh);
      g.fillStyle = "#facc15"; g.fillRect(-W / 2, -W / 2, W, W);
      g.fillStyle = "#1e1b4b"; g.fillRect(-6, -6, 4, 4); g.fillRect(3, -6, 4, 4);
      g.restore();
      g.fillStyle = "#fff"; g.font = "bold 14px system-ui";
      g.fillText(`${Math.floor(strecke / 10)} m`, 8, 20);

      if (!weiter) {
        const p = Math.floor(strecke / 10);
        setPunkte(p); setPhase("aus"); onEnde(p);
        return;
      }
      requestAnimationFrame(bild);
    };
    requestAnimationFrame(bild);
    const taste = (e: KeyboardEvent) => { if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); sprung.current = true; } };
    window.addEventListener("keydown", taste);
    return () => { weiter = false; window.removeEventListener("keydown", taste); };
  }, [phase, onEnde]);

  return (
    <div className="relative">
      <canvas ref={leinwand} width={B} height={H} onPointerDown={() => { sprung.current = true; }} className="w-full rounded-xl touch-none" />
      {phase !== "laeuft" && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 rounded-xl text-white text-center p-4">
          <div>
            <div className="text-4xl">🟨</div>
            <div className="font-black text-lg">{phase === "aus" ? `${punkte} m` : "Würfelsprung"}</div>
            <p className="text-xs opacity-80 mb-3">Tippen oder Leertaste = springen. Über Stacheln, auf Blöcke.</p>
            <button className="btn-primary" onClick={() => setPhase("laeuft")}>{phase === "aus" ? "Nochmal" : "Start"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
