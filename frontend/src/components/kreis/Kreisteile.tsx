"use client";
/**
 * Kreisteile: Kreisausschnitt (Sektor), Kreisbogen, Kreisabschnitt (Segment),
 * Kreisring, Halb- und Viertelkreis — mit Mittelpunktswinkel α und Radius am
 * Regler, Formel und Rechenweg. Gezeichnet über die gemeinsame Skizze.
 */
import { useState } from "react";
import { Regler } from "@/components/groessen/bausteine";
import { SkizzenInhalt } from "@/components/geometrie/Skizze";
import { z } from "@/lib/prozent";
import { P, bogenPunkt, type Skizze } from "@/lib/geometrie/skizze";
import { bogen, flaeche, ring, sehne, sektor, sektorDreieck, segment, umfang } from "@/lib/kreis";

type Teil = "sektor" | "bogen" | "segment" | "ring" | "halb" | "viertel";
const TEILE: { id: Teil; label: string }[] = [
  { id: "sektor", label: "🍰 Kreisausschnitt" },
  { id: "bogen", label: "🌈 Kreisbogen" },
  { id: "segment", label: "🌗 Kreisabschnitt" },
  { id: "ring", label: "🍩 Kreisring" },
  { id: "halb", label: "◗ Halbkreis" },
  { id: "viertel", label: "◔ Viertelkreis" },
];
const ORANGE = "#f59e0b", ROT = "#dc2626";
const W = 520, H = 440, RAHMEN = 10.5;
const M = P(0, 0);

function skizze(teil: Teil, r: number, R: number, alpha: number): Skizze {
  // Unsichtbare Diagonale: fester Maßstab, damit der Regler die Größe wirklich ändert.
  const rahmen = { a: P(-RAHMEN, -RAHMEN), b: P(RAHMEN, RAHMEN), art: "unsichtbar" as const };
  const voll = { m: M, r, gestrichelt: true, deckkraft: 0 };
  const radius = (w: number) => ({ a: M, b: bogenPunkt(M, r, w), text: "r", art: "hilfe" as const });
  const winkel = alpha <= 180 ? [{ p: M, von: bogenPunkt(M, r, 0), bis: bogenPunkt(M, r, alpha), text: "α" }] : [];
  const mitte = [{ p: M, text: "M" }];
  switch (teil) {
    case "sektor":
      return { kreise: [voll], boegen: [{ m: M, r, von: 0, bis: alpha, flaeche: "sektor", farbe: ORANGE, deckkraft: 0.4 }], strecken: [rahmen, radius(0)], winkel, marken: mitte };
    case "bogen":
      return { kreise: [voll], boegen: [{ m: M, r, von: 0, bis: alpha, farbe: ROT, text: "b" }], strecken: [rahmen, radius(0), { a: M, b: bogenPunkt(M, r, alpha), art: "hilfe" }], winkel, marken: mitte };
    case "segment":
      return {
        kreise: [voll],
        boegen: [{ m: M, r, von: 0, bis: alpha, flaeche: "segment", farbe: ORANGE, deckkraft: 0.45 }],
        strecken: [rahmen, radius(0), { a: M, b: bogenPunkt(M, r, alpha), art: "hilfe" }, { a: bogenPunkt(M, r, 0), b: bogenPunkt(M, r, alpha), text: "s", art: "gesucht" }],
        winkel, marken: mitte,
      };
    case "ring":
      return {
        kreise: [{ m: M, r: R, farbe: ORANGE, deckkraft: 0.4 }, { m: M, r, farbe: "var(--surface)", deckkraft: 1 }],
        strecken: [rahmen, { a: M, b: bogenPunkt(M, R, 30), text: "R", art: "hilfe" }, { a: M, b: bogenPunkt(M, r, 210), text: "r", art: "hilfe" }],
        marken: mitte,
      };
    case "halb":
    case "viertel":
      return {
        kreise: [voll],
        boegen: [{ m: M, r, von: 0, bis: teil === "halb" ? 180 : 90, flaeche: "sektor", farbe: ORANGE, deckkraft: 0.4 }],
        strecken: [rahmen, radius(0)], marken: mitte,
      };
  }
}

export default function Kreisteile() {
  const [teil, setTeil] = useState<Teil>("sektor");
  const [r, setR] = useState(6);
  const [R, setRR] = useState(9);
  const [alpha, setAlpha] = useState(70);
  const mitWinkel = teil === "sektor" || teil === "bogen" || teil === "segment";
  const anteil = `${alpha}° : 360°`;
  const rr = `(${z(r)} cm)²`;

  const zeilen: string[] = (() => {
    switch (teil) {
      case "sektor": return [
        "A = π · r² · α : 360°",
        `A = 3,1416 · ${rr} · ${anteil} ≈ ${z(sektor(r, alpha))} cm²`,
        `Dazu der Bogen: b = 2 · π · r · α : 360° ≈ ${z(bogen(r, alpha))} cm`,
        `Umfang des Ausschnitts: u = b + 2 · r ≈ ${z(bogen(r, alpha) + 2 * r)} cm`,
      ];
      case "bogen": return [
        "b = 2 · π · r · α : 360°",
        `b = 2 · 3,1416 · ${z(r)} cm · ${anteil} ≈ ${z(bogen(r, alpha))} cm`,
        `Der Bogen ist der ${z(alpha / 360, 3)}-te Teil des Umfangs u ≈ ${z(umfang(r))} cm.`,
      ];
      case "segment": return [
        "A = Sektor − Dreieck MS₁S₂",
        `Sektor = π · r² · α : 360° ≈ ${z(sektor(r, alpha))} cm²`,
        `Dreieck = ½ · r² · sin α ≈ ${z(sektorDreieck(r, alpha))} cm²${alpha > 180 ? " (negativ: kommt dazu)" : ""}`,
        `A ≈ ${z(sektor(r, alpha))} − ${z(sektorDreieck(r, alpha))} ≈ ${z(segment(r, alpha))} cm²`,
        `Sehne s = 2 · r · sin(α : 2) ≈ ${z(sehne(r, alpha))} cm`,
      ];
      case "ring": return [
        "A = π · R² − π · r² = π · (R² − r²)",
        `A = 3,1416 · (${z(R * R)} − ${z(r * r)}) cm² ≈ ${z(ring(R, r))} cm²`,
        `Großer Kreis ≈ ${z(flaeche(R))} cm², Loch ≈ ${z(flaeche(r))} cm²`,
      ];
      case "halb": return [
        "A = π · r² : 2",
        `A = 3,1416 · ${rr} : 2 ≈ ${z(flaeche(r) / 2)} cm²`,
        "u = π · r + d  (Bogen plus Durchmesser!)",
        `u ≈ ${z(Math.PI * r)} cm + ${z(2 * r)} cm ≈ ${z(Math.PI * r + 2 * r)} cm`,
      ];
      case "viertel": return [
        "A = π · r² : 4",
        `A = 3,1416 · ${rr} : 4 ≈ ${z(flaeche(r) / 4)} cm²`,
        "u = 2 · π · r : 4 + 2 · r  (Bogen plus zwei Radien)",
        `u ≈ ${z(umfang(r) / 4)} cm + ${z(2 * r)} cm ≈ ${z(umfang(r) / 4 + 2 * r)} cm`,
      ];
    }
  })();

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kreisteil">
        {TEILE.map(x => (
          <button key={x.id} className={`chip ${teil === x.id ? "chip-on" : ""}`} aria-pressed={teil === x.id} onClick={() => setTeil(x.id)}>{x.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <Regler label={teil === "ring" ? "Innenradius r (cm)" : "Radius r (cm)"} wert={r} setze={x => { setR(x); if (R <= x) setRR(Math.min(10, x + 1)); }} min={1} max={teil === "ring" ? 9.5 : 10} step={0.5} breit />
        {teil === "ring" && <Regler label="Außenradius R (cm)" wert={R} setze={x => { setRR(x); if (r >= x) setR(x - 0.5); }} min={1.5} max={10} step={0.5} breit />}
        {mitWinkel && <Regler label="Mittelpunktswinkel α (°)" wert={alpha} setze={setAlpha} min={1} max={359} breit />}
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[calc(100vh-10rem)] rounded-xl border border-line bg-surface" role="img"
          aria-label={TEILE.find(x => x.id === teil)!.label}>
          <SkizzenInhalt s={skizze(teil, r, R, alpha)} w={W} h={H} />
        </svg>
        <div className="flex flex-col gap-2">
          <ol className="text-sm flex flex-col gap-1">
            {zeilen.map((x, i) => <li key={i} className="rounded-lg bg-surface-hover px-3 py-2 font-mono font-bold">{x}</li>)}
          </ol>
          {mitWinkel && <p className="text-sm text-muted">Merke: Der Mittelpunktswinkel sagt, welcher Bruchteil des Kreises gemeint ist — α : 360°. Bei 90° ist es ein Viertel, bei 180° die Hälfte.</p>}
        </div>
      </div>
    </div>
  );
}
