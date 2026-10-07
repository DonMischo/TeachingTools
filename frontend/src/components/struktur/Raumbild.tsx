"use client";
/**
 * Das Kugel-Stab-Modell im Rahmen: three.js-Szene, Legende der Atomfarben und
 * die Winkel, um die es geht.
 *
 * Wird nur geladen, wenn jemand auf »3D« schaltet — three.js ist groß.
 */
import { useEffect, useRef, useState } from "react";
import { baueRaum, RAUMFARBE, winkel, type Raummodell } from "@/lib/struktur/raum";
import type { Molekuel } from "@/lib/struktur/molekuel";
import { RaumSzene } from "./raumSzene";

/** Die Elemente im Molekül, für die Legende. */
const elementeIn = (modell: Raummodell): string[] =>
  [...new Set(modell.atome.map(a => a.el))];

/**
 * Ein gemessener Bindungswinkel zum Anzeigen: gesucht wird das Atom mit den
 * meisten Bindungen, denn dort sieht man die Form am besten.
 */
function beispielWinkel(modell: Raummodell): { text: string; grad: number } | null {
  let bestes = -1, meiste = 1;
  const nachbarnVon = (i: number) =>
    modell.bindungen.flatMap(b => (b.a === i ? [b.b] : b.b === i ? [b.a] : []));
  modell.atome.forEach((a, i) => {
    if (a.el === "H") return;
    const n = nachbarnVon(i).length;
    if (n > meiste) { meiste = n; bestes = i; }
  });
  if (bestes < 0) return null;
  const n = nachbarnVon(bestes);
  const grad = winkel(modell, n[0], bestes, n[1]);
  return {
    text: `${modell.atome[n[0]].el}–${modell.atome[bestes].el}–${modell.atome[n[1]].el}`,
    grad,
  };
}

export default function Raumbild({ m, titel }: { m: Molekuel; titel?: string }) {
  const halter = useRef<HTMLDivElement>(null);
  const szene = useRef<RaumSzene | null>(null);
  const [drehen, setDrehen] = useState(true);
  const modell = baueRaum(m);

  // Die Szene lebt so lange wie der Rahmen; das Molekül wird nur nachgereicht.
  useEffect(() => {
    if (!halter.current) return;
    const dunkel = !document.documentElement.classList.contains("hell");
    const s = new RaumSzene(halter.current, dunkel);
    szene.current = s;
    return () => { s.zerstoere(); szene.current = null; };
  }, []);

  useEffect(() => { szene.current?.zeige(modell); });
  useEffect(() => { if (szene.current) szene.current.drehen = drehen; }, [drehen]);

  const winkelInfo = beispielWinkel(modell);

  const speichern = () => {
    const bild = szene.current?.alsPng();
    if (!bild) return;
    const a = document.createElement("a");
    a.href = bild;
    a.download = `${(titel ?? "Molekuel").replace(/[^\wäöüß-]+/gi, "_")}-3D.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Ein weicher Lichtschein hinter dem Modell — er hebt die Kugeln vom
          Hintergrund ab, in hellem wie dunklem Erscheinungsbild. */}
      <div ref={halter}
        className="w-full rounded-xl overflow-hidden border border-line"
        style={{
          height: 420,
          background: "radial-gradient(ellipse at 50% 32%, rgba(120,160,225,0.18), transparent 68%)",
        }} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex flex-wrap gap-2">
          {elementeIn(modell).map(el => (
            <span key={el} className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="w-3 h-3 rounded-full border border-line"
                style={{ background: RAUMFARBE[el] ?? "#9aa3b2" }} />
              {el}
            </span>
          ))}
        </div>
        {winkelInfo && (
          <span className="text-xs text-muted">
            Bindungswinkel {winkelInfo.text}:{" "}
            <strong className="text-fg">{winkelInfo.grad.toFixed(1).replace(".", ",")}°</strong>
          </span>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={() => setDrehen(d => !d)}
            className={`px-3 py-1 rounded-lg border text-xs ${
              drehen ? "border-accent text-fg" : "border-line text-muted hover:text-fg"}`}>
            🔄 Drehen
          </button>
          <button onClick={speichern}
            className="px-3 py-1 rounded-lg border border-line text-xs text-muted hover:text-fg">
            📷 Bild
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">
        Ziehen dreht das Modell, Mausrad zoomt. Die Winkel folgen der Abstoßung der
        Elektronenpaare: vier Wolken ergeben einen Tetraeder (109,5°), drei ein flaches
        Dreieck (120°), zwei eine Gerade (180°). Eine Doppelbindung zählt dabei als eine Wolke.
      </p>
    </div>
  );
}
