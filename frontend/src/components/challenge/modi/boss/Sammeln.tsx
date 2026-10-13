"use client";
/** Sammelphase des Bosskampfs: Truhen öffnen, Mini-Monster verscheuchen (5 Klicks); jedes gibt 1–2 Fakten. */
import { useEffect, useMemo, useState } from "react";
import type { ChallengeFakt } from "@/lib/api";
import type { ThemeDef } from "@/lib/challenge/themes";
import { Kachelfeld, Sprite } from "@/components/challenge/pixel/Sprite";
import { Inhalt } from "../teile";

const OBJ = "/challenge/pixel/gfx/objects.png";
const TRUHE = { x: 148, y: 0, w: 22, h: 16 };
const TRUHE_AUF = { x: 181, y: 0, w: 20, h: 16 };
const LOG = "/challenge/pixel/gfx/log.png";
const MONSTER = { x: 0, y: 0, w: 32, h: 32 };
const B = 8, H = 5, T = 48; // Kacheln der Karte, Kantenlänge in px
const PLAETZE = Array.from({ length: 3 }, (_, r) => Array.from({ length: 6 }, (_, c) => [c + 1, r + 1] as const)).flat();
const KLICKS = 5;

export const reduziert = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export default function Sammeln({ fakten, theme, gefunden, setGefunden, weiter }: {
  fakten: ChallengeFakt[]; theme: ThemeDef; gefunden: string[]; setGefunden(f: (g: string[]) => string[]): void; weiter(): void;
}) {
  const schluessel = fakten.map((f) => f.id).join(",");
  const objekte = useMemo(() => {
    const o: { id: number; art: "truhe" | "monster"; fakten: ChallengeFakt[] }[] = [];
    for (let i = 0; i < fakten.length; i += 2) o.push({ id: o.length, art: o.length % 2 === 0 ? "truhe" : "monster", fakten: fakten.slice(i, i + 2) });
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
  const [offen, setOffen] = useState<number[]>([]);
  const [klicks, setKlicks] = useState<Record<number, number>>({});
  const [zeige, setZeige] = useState<ChallengeFakt[]>([]);
  const [ueberspringen, setUeberspringen] = useState(reduziert);

  useEffect(() => {
    const t = setTimeout(() => setUeberspringen(true), 20000);
    return () => clearTimeout(t);
  }, []);

  const alle = fakten.length > 0 && fakten.every((f) => gefunden.includes(f.id));
  const nimm = (fs: ChallengeFakt[]) => setGefunden((g) => [...g, ...fs.map((f) => f.id).filter((id) => !g.includes(id))]);
  const oeffne = (o: (typeof objekte)[number]) => {
    setOffen((x) => (x.includes(o.id) ? x : [...x, o.id]));
    nimm(o.fakten); setZeige(o.fakten);
  };
  const klick = (o: (typeof objekte)[number]) => {
    const n = (klicks[o.id] ?? 0) + 1;
    setKlicks({ ...klicks, [o.id]: n });
    if (n >= KLICKS) oeffne(o);
  };
  const alleEinsammeln = () => { nimm(fakten); setOffen(objekte.map((o) => o.id)); setZeige([]); weiter(); };

  const h = theme.hintergrund;
  const karte = Array.from({ length: H }, (_, y) => Array.from({ length: B }, (_, x) =>
    h ? ((x + y * 3) % 7 === 0 && (x === 0 || y === 0 || x === B - 1 || y === H - 1) ? h.muster.deko[0] : h.muster.boden[(x + y) % h.muster.boden.length]) : 0));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted">Sammle Fakten: Truhen anklicken, Mini-Monster {KLICKS}× anklicken. Gefunden: {gefunden.length}/{fakten.length}</p>
      <div className="overflow-x-auto">
        <div className="relative rounded-lg overflow-hidden" style={{ width: B * T, height: H * T, background: h ? undefined : theme.farben.boden === "transparent" ? "#35a541" : theme.farben.boden }}>
          {h && <Kachelfeld src={h.src} tile={h.tile} cols={h.cols} karte={karte} scale={T / h.tile} />}
          {objekte.map((o) => {
            const [c, r] = PLAETZE[o.id % PLAETZE.length];
            const pos = { left: c * T + Math.floor(o.id / PLAETZE.length) * 6, top: r * T, width: T, height: T };
            const auf = offen.includes(o.id);
            if (o.art === "monster" && auf) return null;
            return (
              <button key={o.id} style={pos} disabled={auf}
                aria-label={o.art === "truhe" ? (auf ? "Truhe (leer)" : "Truhe öffnen") : `Mini-Monster verscheuchen (${klicks[o.id] ?? 0}/${KLICKS})`}
                onClick={() => (o.art === "truhe" ? oeffne(o) : klick(o))}
                className="absolute flex items-center justify-center focus-visible:outline-2 focus-visible:outline-accent">
                {o.art === "truhe"
                  ? <Sprite src={OBJ} frame={auf ? TRUHE_AUF : TRUHE} scale={2} />
                  : <span style={{ transform: (klicks[o.id] ?? 0) % 2 ? "translateX(3px)" : undefined }}><Sprite src={LOG} frame={MONSTER} scale={1.4} /></span>}
              </button>
            );
          })}
        </div>
      </div>
      {zeige.length > 0 && (
        <div className="card p-3 flex flex-col gap-2" role="status">
          <strong>Gefunden!</strong>
          {zeige.map((f) => (
            <div key={f.id}><Inhalt x={f} />{f.info && <p className="text-muted text-sm">{f.info.text}</p>}</div>
          ))}
          <button className="btn-secondary self-start" onClick={() => setZeige([])}>OK</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {alle && <button className="btn-primary" onClick={weiter}>Zum Kampf</button>}
        {!alle && ueberspringen && <button className="btn-secondary" onClick={alleEinsammeln}>Alles einsammeln</button>}
      </div>
    </div>
  );
}
