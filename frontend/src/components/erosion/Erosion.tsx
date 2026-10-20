"use client";
/**
 * Erosion — Wasser formt Gelände. Zwei Reiter:
 *   Flüsse & Täler  Regen, Jahreszeiten, neue Flüsse und Seen
 *                   (Vorbild terrain-erosion-3-ways von Daniel Andrino, MIT)
 *   Küste           Steilküste, Flachküste, Marsch mit Deich (eigenes Modell)
 *   Gesteine        Querschnitte (Granit, Sandstein, Karst …) unter Sonne, Wind,
 *                   Wasser, Frost, Chemie und Pflanzen (eigenes Modell)
 * Dasselbe Zufallsgelände wie die Stadtentwicklung. ?modus=kueste&typ=steil
 * öffnet direkt die Küste (Verweis aus der Küstendynamik).
 */
import { useEffect, useState, type ReactNode } from "react";
import { wahl as vorgabeWahl, type Vorgabe } from "@/lib/vorgabe";
import { KUESTEN, type KuestenTyp } from "@/lib/gelaende/kuestenErosion";
import FlussErosion, { ANSICHTEN } from "./FlussErosion";
import KuestenModus from "./KuestenModus";
import VerwitterungModus from "./VerwitterungModus";
import { GESTEINE } from "@/lib/gelaende/verwitterung";

const MODI = [
  { id: "fluss", label: "🏞️ Flüsse & Täler" },
  { id: "kueste", label: "🌊 Küste" },
  { id: "gestein", label: "🪨 Gesteine & Verwitterung" },
] as const;
type Modus = (typeof MODI)[number]["id"];
const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

/** `vorgabe` (TaskCrawler-Station): { modus, ansicht, kueste, gestein } */
export default function Erosion({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const fest = vorgabeWahl(vorgabe, "modus", MODI.map(m => m.id));
  const [modus, setModus] = useState<Modus>(fest ?? "fluss");
  const [typ, setTyp] = useState<KuestenTyp | undefined>(vorgabeWahl(vorgabe, "kueste", KUESTEN.map(k => k.id)));
  useEffect(() => {
    if (fest) return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("modus") === "kueste") setModus("kueste");
    if (q.get("modus") === "gestein") setModus("gestein");
    const t = KUESTEN.find(k => k.id === q.get("typ"));
    if (t) setTyp(t.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🌧️ Erosion</h1>
          <p className="text-muted text-sm mt-1">Wasser formt Gelände: Regen gräbt Täler, Flüsse schwellen in der Regenzeit an, Seen füllen Senken — und an der Küste nagt die Brandung.</p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {!fest && (
        <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
          {MODI.map(m => <button key={m.id} onClick={() => setModus(m.id)} className={chip(modus === m.id)}>{m.label}</button>)}
        </div>
      )}
      {modus === "fluss" && <FlussErosion startAnsicht={vorgabeWahl(vorgabe, "ansicht", ANSICHTEN.map(a => a.id))} />}
      {modus === "kueste" && <KuestenModus key={typ ?? "x"} startTyp={typ} />}
      {modus === "gestein" && <VerwitterungModus startGestein={vorgabeWahl(vorgabe, "gestein", GESTEINE.map(g => g.id))} />}
      <p className="text-xs text-muted">Vorbild: <a className="underline" href="https://github.com/dandrino/terrain-erosion-3-ways" target="_blank" rel="noreferrer">terrain-erosion-3-ways</a> (MIT), 3D nach <a className="underline" href="https://github.com/s-macke/VoxelSpace" target="_blank" rel="noreferrer">Voxel Space</a> (MIT) — neu geschrieben. Küsten- und Verwitterungsmodell sind eigene, stark vereinfachte Rechnungen für den Unterricht.</p>
    </div>
  );
}
