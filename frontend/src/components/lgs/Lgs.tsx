"use client";
/**
 * Lineare Gleichungssysteme in sechs Blättern:
 *   📈 Grafisch            Geraden und Schnittpunkt, eine/keine/unendlich viele Lösungen
 *   ➕ Additionsverfahren  Zeilen malnehmen, aufeinander schweben lassen, eine Variable fällt weg
 *   🟰 Gleichsetzung        beide freistellen, rechte Seiten gleichsetzen
 *   🧩 Einsetzung          Term per Ziehen einsetzen
 *   ✍️ Üben                Systeme und Sachaufgaben mit echten Preisen
 *   📱 Tarif-Check         Spiel: Angebote aus dem Alltag vergleichen
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { leseGleichung, type Gleichung } from "@/lib/lgs";
import Grafisch, { Koordinaten } from "./Grafisch";
import { Addition, Einsetzung, Gleichsetzung, SystemWahl, type System } from "./Verfahren";
import Ueben from "./Ueben";
import Tarife from "./Tarife";

const BLAETTER = [
  { id: "grafisch", icon: "📈", label: "Grafisch" },
  { id: "addition", icon: "➕", label: "Additionsverfahren" },
  { id: "gleichsetzung", icon: "🟰", label: "Gleichsetzungsverfahren" },
  { id: "einsetzung", icon: "🧩", label: "Einsetzungsverfahren" },
  { id: "ueben", icon: "✍️", label: "Üben" },
  { id: "tarife", icon: "📱", label: "Tarif-Check" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const sys = (a: string, b: string): System => ({ g1: leseGleichung(a) as Gleichung, g2: leseGleichung(b) as Gleichung });
type VerfahrenId = "addition" | "gleichsetzung" | "einsetzung";
/** Startsystem je Verfahren — so gewählt, dass das Verfahren dort günstig ist (Lösung jeweils (3 | 2)) */
export const START: Record<VerfahrenId, System> = {
  // y fällt sofort weg: +2y und −2y
  addition: sys("3x + 2y = 13", "5x − 2y = 11"),
  // beide schon nach y aufgelöst
  gleichsetzung: sys("y = 2x − 4", "y = −x + 5"),
  // I schon nach y aufgelöst, II hat y zum Einsetzen
  einsetzung: sys("y = 3x − 7", "2x + 3y = 12"),
};

const HINWEIS: Record<VerfahrenId, string> = {
  addition: "Gut, wenn vor einer Variablen schon gleiche oder entgegengesetzte Zahlen stehen (3y und −3y) oder sich leicht dazu machen lassen.",
  gleichsetzung: "Gut, wenn beide Gleichungen schon nach derselben Variablen aufgelöst sind (y = … und y = …).",
  einsetzung: "Gut, wenn eine Gleichung schon nach einer Variablen aufgelöst ist oder eine Variable den Faktor 1 hat.",
};

export default function Lgs({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "grafisch");
  const [systeme, setSysteme] = useState<Record<VerfahrenId, System>>(START);
  const verfahren = blatt === "addition" || blatt === "gleichsetzung" || blatt === "einsetzung";
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🔀 Lineare Gleichungssysteme</h1>
          <p className="text-muted text-sm mt-1">
            Zwei Gleichungen, zwei Unbekannte: grafisch als Schnittpunkt zweier Geraden, rechnerisch mit Additions-,
            Gleichsetzungs- und Einsetzungsverfahren — langsam, Schritt für Schritt umgeformt. Dazu Übungen und Alltagsaufgaben.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>}
      {blatt === "grafisch" && <Grafisch />}
      {verfahren && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="card p-4 flex flex-col gap-3">
            <SystemWahl sys={systeme[blatt]} setze={s => setSysteme(x => ({ ...x, [blatt]: s }))} />
            <p className="text-sm text-muted">{HINWEIS[blatt]}</p>
            {blatt === "addition" && <Addition key={JSON.stringify(systeme.addition)} sys={systeme.addition} />}
            {blatt === "gleichsetzung" && <Gleichsetzung key={JSON.stringify(systeme.gleichsetzung)} sys={systeme.gleichsetzung} />}
            {blatt === "einsetzung" && <Einsetzung key={JSON.stringify(systeme.einsetzung)} sys={systeme.einsetzung} />}
          </div>
          <div className="card p-3 self-start"><Koordinaten gleichungen={[systeme[blatt].g1, systeme[blatt].g2]} /></div>
        </div>
      )}
      {blatt === "ueben" && <Ueben oeffnen={s => { setSysteme(x => ({ ...x, addition: s })); setBlatt("addition"); }} />}
      {blatt === "tarife" && <div className="card p-4"><Tarife /></div>}
    </div>
  );
}
