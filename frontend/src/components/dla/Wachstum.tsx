"use client";
/**
 * Fraktales Wachstum — diffusionsbegrenzte Aggregation (DLA) in 2D und 3D.
 * Vorbild: dlaf von Michael Fogleman (github.com/fogleman/dlaf, MIT).
 *
 * Reiter:
 *   Fläche    — 2D bis 250 000 Teilchen, Äste oder Punkte, Dimension live
 *   Raum      — 3D bis 500 000 Teilchen als drehbare Punktwolke
 *   So geht's — Zeitlupe eines einzelnen Wanderers und Erklärung
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import Flaeche from "./Flaeche";
import Raum from "./Raum";
import Erklaerung from "./Erklaerung";

const REITER = [
  { id: "flaeche", icon: "🌿", label: "Fläche (2D)" },
  { id: "raum", icon: "🪸", label: "Raum (3D)" },
  { id: "erklaerung", icon: "📘", label: "So geht's" },
] as const;
type Reiter = (typeof REITER)[number]["id"];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

/** `vorgabe` (TaskCrawler-Station): { reiter: "flaeche" | "raum" | "erklaerung" } */
export default function Wachstum({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const fest = wahl(vorgabe, "reiter", REITER.map(r => r.id));
  const [reiter, setReiter] = useState<Reiter>(fest ?? "flaeche");
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🪸 Fraktales Wachstum</h1>
          <p className="text-muted text-sm mt-1">
            Tausende Teilchen, eine Regel: zufällig wandern, dann haften. Daraus wachsen Äste wie bei Korallen, Eisblumen und Blitzen.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {!fest && (
        <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
          {REITER.map(r => <button key={r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>)}
        </div>
      )}
      {reiter === "flaeche" && <Flaeche />}
      {reiter === "raum" && <Raum />}
      {reiter === "erklaerung" && <Erklaerung />}
    </div>
  );
}
