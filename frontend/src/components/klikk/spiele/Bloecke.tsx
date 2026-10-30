"use client";
/**
 * Blockregen: Blöcke fallen, ein Klick räumt sie weg. Erreicht einer den Boden,
 * ist ein Leben weg; nach drei ist Schluss. Je länger, desto schneller und
 * dichter. Kleine Blöcke bringen mehr Punkte.
 */
import { useEffect, useRef, useState } from "react";

const B = 300, H = 440;
const FARBEN = ["#f43f5e", "#f59e0b", "#22c55e", "#0ea5e9", "#a855f7"];

interface Block { x: number; y: number; g: number; v: number; farbe: string }

export default function Bloecke({ onEnde }: { onEnde: (punkte: number) => void }) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"bereit" | "laeuft" | "aus">("bereit");
  const [punkte, setPunkte] = useState(0);
  const spiel = useRef({ bloecke: [] as Block[], punkte: 0, leben: 3, zeit: 0, naechster: 0 });

  useEffect(() => {
    if (phase !== "laeuft") return;
    const g = leinwand.current!.getContext("2d")!;
    const s = spiel.current;
    let letzte = performance.now(), weiter = true;
    const bild = (jetzt: number) => {
      if (!weiter) return;
      const dt = Math.min(0.05, (jetzt - letzte) / 1000);
      letzte = jetzt;
      s.zeit += dt;
      // Neue Blöcke: alle 0,9 s am Anfang, später alle 0,35 s
      s.naechster -= dt;
      if (s.naechster <= 0) {
        const groesse = 26 + Math.random() * 30 - Math.min(14, s.zeit / 6);
        s.bloecke.push({ x: Math.random() * (B - groesse), y: -groesse, g: groesse, v: 60 + s.zeit * 4 + Math.random() * 40, farbe: FARBEN[Math.floor(Math.random() * FARBEN.length)] });
        s.naechster = Math.max(0.35, 0.9 - s.zeit / 60);
      }
      for (const b of s.bloecke) b.y += b.v * dt;
      const unten = s.bloecke.filter(b => b.y > H);
      if (unten.length) {
        s.leben -= unten.length;
        s.bloecke = s.bloecke.filter(b => b.y <= H);
      }
      g.fillStyle = "#0f172a";
      g.fillRect(0, 0, B, H);
      for (const b of s.bloecke) {
        g.fillStyle = b.farbe;
        g.beginPath();
        g.roundRect(b.x, b.y, b.g, b.g, 6);
        g.fill();
      }
      g.fillStyle = "#fff";
      g.font = "bold 14px system-ui";
      g.fillText(`⭐ ${s.punkte}`, 8, 20);
      g.fillText("❤️".repeat(Math.max(0, s.leben)), B - 60, 20);
      if (s.leben <= 0) {
        weiter = false;
        setPunkte(s.punkte);
        setPhase("aus");
        onEnde(s.punkte);
        return;
      }
      requestAnimationFrame(bild);
    };
    requestAnimationFrame(bild);
    return () => { weiter = false; };
  }, [phase, onEnde]);

  const klick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "laeuft") return;
    const r = leinwand.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * B, y = ((e.clientY - r.top) / r.height) * H;
    const s = spiel.current;
    const i = s.bloecke.findIndex(b => x >= b.x - 4 && x <= b.x + b.g + 4 && y >= b.y - 4 && y <= b.y + b.g + 4);
    if (i < 0) return;
    const b = s.bloecke[i];
    s.punkte += Math.round(10 + (60 - b.g) + b.v / 10);
    s.bloecke.splice(i, 1);
  };

  const start = () => { spiel.current = { bloecke: [], punkte: 0, leben: 3, zeit: 0, naechster: 0 }; setPunkte(0); setPhase("laeuft"); };

  return (
    <div className="relative">
      <canvas ref={leinwand} width={B} height={H} onPointerDown={klick} className="w-full rounded-xl bg-slate-900 touch-none" />
      {phase !== "laeuft" && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 rounded-xl text-white text-center p-4">
          <div>
            <div className="text-4xl">🧱</div>
            <div className="font-black text-lg">{phase === "aus" ? `${punkte} Punkte` : "Blockregen"}</div>
            <p className="text-xs opacity-80 mb-3">Klick die Blöcke weg, bevor sie unten ankommen. Kleine bringen mehr.</p>
            <button className="btn-primary" onClick={start}>{phase === "aus" ? "Nochmal" : "Start"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
