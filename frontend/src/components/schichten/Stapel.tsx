"use client";
import { useEffect, useRef, useState } from "react";
import { StapelSzene } from "./stapelSzene";
import type { Modell } from "./Bausteine";

export default function Stapel({ schritt, modell, bild }: { schritt: number; modell: Modell; bild: string | null }) {
  const halter = useRef<HTMLDivElement>(null);
  const szene = useRef<StapelSzene | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    if (!halter.current) return;
    let s: StapelSzene;
    try {
      s = new StapelSzene(halter.current);
    } catch {
      setFehler(true);
      return;
    }
    szene.current = s;
    let raf = 0;
    const tick = () => { s.bild(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); s.entsorgen(); szene.current = null; };
  }, []);

  useEffect(() => { szene.current?.setzeSchritt(schritt); }, [schritt]);
  useEffect(() => { szene.current?.setzeModell(modell); }, [modell]);
  useEffect(() => { szene.current?.setzeBild(bild); }, [bild]);

  if (fehler) return <p className="text-sm text-bad">Dieses Gerät kann kein WebGL — der 3D-Stapel fehlt, die Erklärungen darunter gehen trotzdem.</p>;
  return (
    <div className="relative">
      <div ref={halter} className="relative w-full h-[min(56vh,520px)] rounded-xl overflow-hidden touch-none" />
      <button className="absolute bottom-2 right-2 chip bg-surface/80" onClick={() => szene.current?.folgen()} title="Kamera folgt wieder dem Paket">🎥 Folgen</button>
    </div>
  );
}
