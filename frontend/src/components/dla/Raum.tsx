"use client";
/** 3D-Wachstum als drehbare Punktwolke (three.js). */
import { useEffect, useRef, useState } from "react";
import type { Dla } from "@/lib/dla/kern";
import Steuerung from "./Steuerung";
import { speichereBild } from "./Flaeche";
import { RaumSzene, type Modus } from "./raumSzene";
import { useWachstum, type Einstellung } from "./useWachstum";

export default function Raum() {
  const [e, setE] = useState<Einstellung>({ anzahl: 50_000, haftung: 1, saat: "punkt" });
  const [lauf, setLauf] = useState(0);
  const [modus, setModus] = useState<Modus>("punkte");
  const [drehen, setDrehen] = useState(true);
  const halter = useRef<HTMLDivElement>(null);
  const szene = useRef<RaumSzene | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    if (!halter.current) return;
    try {
      szene.current = new RaumSzene(halter.current);
    } catch {
      setFehler(true);
    }
    return () => { szene.current?.entsorgen(); szene.current = null; };
  }, []);

  useEffect(() => { szene.current?.setzeModus(modus); }, [modus]);
  useEffect(() => { if (szene.current) szene.current.drehen = drehen; }, [drehen]);

  const zeichne = (dla: Dla, neu: boolean) => {
    const s = szene.current;
    if (!s) return;
    if (neu) s.neu(dla);
    s.bild();
  };

  const { stand, laeuft, setLaeuft } = useWachstum(3, e, lauf, zeichne);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="flex flex-col gap-2">
        <div ref={halter} className="w-full aspect-square max-h-[78vh] rounded-xl overflow-hidden bg-[#060a14] touch-none" />
        {fehler && <p className="text-sm text-bad">Dieses Gerät kann kein WebGL — die 3D-Ansicht geht hier leider nicht.</p>}
        <p className="text-xs text-muted">Ziehen dreht, Mausrad zoomt, Rechtsklick verschiebt.</p>
      </div>
      <Steuerung dim={3} e={e} setE={setE} neu={() => setLauf(l => l + 1)} laeuft={laeuft} setLaeuft={setLaeuft} stand={stand}
        extra={
          <div className="flex flex-wrap items-center gap-1">
            <button className={`chip ${modus === "punkte" ? "chip-on" : ""}`} onClick={() => setModus("punkte")}>⠿ Punkte</button>
            <button className={`chip ${modus === "aeste" ? "chip-on" : ""}`} onClick={() => setModus("aeste")}>🌿 Äste</button>
            <button className={`chip ${drehen ? "chip-on" : ""}`} onClick={() => setDrehen(!drehen)}>🔄 Drehen</button>
            <button className="btn btn-secondary ml-auto" onClick={() => speichereBild(szene.current?.renderer.domElement ?? null, "wachstum-3d.png")}>📷 Bild</button>
          </div>
        } />
    </div>
  );
}
