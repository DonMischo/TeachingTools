"use client";
/**
 * Rahmen für die three.js-Szene der Körper. three.js wird erst geladen, wenn
 * der Rahmen erscheint; ohne WebGL (und im Test) steht stattdessen das
 * Schrägbild als `ersatz` da.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Ansicht, KoerperSzene, ZAnsicht } from "./szene";

const nieAendern = () => () => {};
const webglDa = () => typeof window !== "undefined" && "WebGL2RenderingContext" in window;

type Props = {
  ansicht: Ansicht | ZAnsicht;
  onKlick?: (teil: string | null) => void;
  ersatz: ReactNode;
  hoehe?: number;
  titel: string;
};

export default function Raum3D({ ansicht, onKlick, ersatz, hoehe = 460, titel }: Props) {
  const mitGL = useSyncExternalStore(nieAendern, webglDa, () => false);
  const halter = useRef<HTMLDivElement>(null);
  const [szene, setSzene] = useState<KoerperSzene | null>(null);
  const [drehen, setDrehen] = useState(false);
  const klick = useRef(onKlick);
  klick.current = onKlick;

  useEffect(() => {
    if (!mitGL || !halter.current) return;
    let s: KoerperSzene | null = null, weg = false;
    import("./szene").then(({ KoerperSzene }) => {
      if (weg || !halter.current) return;
      // Dunkel, wenn der Seitenhintergrund dunkel ist (die Farbthemen setzen nur data-theme).
      const rgb = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255];
      const dunkel = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] < 110;
      s = new KoerperSzene(halter.current, dunkel, t => klick.current?.(t));
      setSzene(s);
    });
    return () => { weg = true; s?.zerstoere(); setSzene(null); };
  }, [mitGL]);

  useEffect(() => {
    if (!szene) return;
    if ("zkey" in ansicht) szene.zeigeZusammen(ansicht);
    else szene.zeige(ansicht);
  }, [szene, ansicht]);
  useEffect(() => { if (szene) szene.drehen = drehen; }, [szene, drehen]);

  if (!mitGL) return <>{ersatz}</>;

  const bild = () => {
    const url = szene?.alsPng();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titel.replace(/[^\wäöüß-]+/gi, "_")}-3D.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-2">
      <div ref={halter} className="relative w-full rounded-xl overflow-hidden border border-line bg-surface"
        style={{ height: hoehe, background: "radial-gradient(ellipse at 50% 35%, rgba(120,160,225,0.16), transparent 70%)" }}
        role="img" aria-label={`${titel} in 3D`} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Ziehen dreht, Mausrad zoomt{onKlick ? ", Klick auf eine Fläche hebt sie hervor" : ""}.</span>
        <span className="flex-1" />
        <button className={`chip ${drehen ? "chip-on" : ""}`} aria-pressed={drehen} onClick={() => setDrehen(d => !d)}>🔄 Drehen</button>
        <button className="chip" onClick={bild}>📷 Bild</button>
      </div>
    </div>
  );
}
