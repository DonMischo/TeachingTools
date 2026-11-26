"use client";
/**
 * Spielalgorithmen — wie Computerspiele ihre Welten selbst bauen.
 * Je Reiter ein Verfahren mit Erklärung und Schritt-für-Schritt-Ablauf.
 * Rechenkerne in `lib/spielalgo/`, Labyrinth-Erzeuger aus `lib/regeln`.
 */
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import LabyrinthVergleich from "./LabyrinthVergleich";
import BspRaeume from "./BspRaeume";
import Hoehlen from "./Hoehlen";
import Verteilen from "./Verteilen";
import Gelaende from "./Gelaende";
import Wegsuche from "./Wegsuche";
import Zyklisch from "./Zyklisch";
import { SimKopf } from "@/components/SimKopf";

const REITER = [
  { id: "labyrinth", icon: "🌀", label: "Labyrinthe" },
  { id: "bsp", icon: "🏢", label: "BSP-Räume" },
  { id: "hoehle", icon: "🕳️", label: "Höhlen" },
  { id: "verteilen", icon: "🌳", label: "Verteilen" },
  { id: "gelaende", icon: "🏔️", label: "Gelände" },
  { id: "wege", icon: "🧭", label: "Wegsuche" },
  { id: "zyklus", icon: "🔁", label: "Ablauf-Graph" },
  { id: "mehr", icon: "➕", label: "Mehr davon" },
] as const;
type Reiter = (typeof REITER)[number]["id"];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

/** `vorgabe` (TaskCrawler-Station): { reiter: "labyrinth" | "bsp" | … } */
export default function Spielalgorithmen({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const fest = wahl(vorgabe, "reiter", REITER.map(r => r.id));
  const [reiter, setReiter] = useState<Reiter>(fest ?? "labyrinth");
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <SimKopf titel="🎲 Spielalgorithmen" action={action}>
        Wie bauen Spiele ihre Welten selbst? Labyrinthe, Räume, Höhlen, Wälder, Gebirge, Wege und ganze Abenteuer – Schritt für Schritt zum Zuschauen und Ausprobieren.
      </SimKopf>
      {!fest && (
        <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface" role="tablist">
          {REITER.map(r => (
            <button key={r.id} role="tab" aria-selected={reiter === r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>
          ))}
        </div>
      )}
      {reiter === "labyrinth" && <LabyrinthVergleich />}
      {reiter === "bsp" && <BspRaeume />}
      {reiter === "hoehle" && <Hoehlen />}
      {reiter === "verteilen" && <Verteilen />}
      {reiter === "gelaende" && <Gelaende />}
      {reiter === "wege" && <Wegsuche />}
      {reiter === "zyklus" && <Zyklisch />}
      {reiter === "mehr" && <Mehr />}
    </div>
  );
}

const VERWANDTE: { href: string; icon: string; titel: string; text: string }[] = [
  { href: "/simulationen/regeln", icon: "🧬", titel: "Regel-Labor", text: "Markov-Regeln wie MarkovJunior: Aus wenigen Ersetzungsregeln wachsen Labyrinthe, Höhlen und Gebäude. Mit Labyrinth-Lösern in Zeitlupe." },
  { href: "/simulationen/wfc", icon: "🧩", titel: "Wellenfunktionskollaps", text: "Kacheln, die nur zu bestimmten Nachbarn passen: Der Algorithmus legt Stück für Stück eine Welt, die überall die Regeln einhält." },
  { href: "/simulationen/dla", icon: "🪸", titel: "Fraktales Wachstum", text: "Zufällig wandern, dann haften: So wachsen Korallen, Eisblumen – und verzweigte Höhlensysteme." },
  { href: "/simulationen/algo", icon: "🤖", titel: "Algorithmen-Werkstatt", text: "Automaten, Flussdiagramme und ein Code-Abenteuer: die Grundlagen, auf denen alle diese Verfahren aufbauen." },
  { href: "/simulationen/erosion", icon: "🌧️", titel: "Erosion", text: "Regen formt ein Rauschgelände: Täler, Flüsse und Schwemmfächer, wie sie viele Spielwelten nachträglich bekommen." },
  { href: "/simulationen/stadt", icon: "🏘️", titel: "Stadtentwicklung", text: "Städte, die nach Regeln wachsen – vom Römerlager bis zur Eisenbahnstadt." },
];

function Mehr() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted max-w-3xl">
        Diese Verfahren gibt es in TT schon als eigene Simulation. Sie gehören in dieselbe Werkzeugkiste: Echte Spiele kombinieren oft mehrere davon,
        zum Beispiel erst einen Ablauf-Graphen, dann Höhlen per Zellautomat, Wege per A* und zum Schluss Details per Wellenfunktionskollaps.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {VERWANDTE.map(v => (
          <Link key={v.href} href={v.href} className="card p-4 flex flex-col gap-1 hover:border-accent transition-colors">
            <span className="text-2xl">{v.icon}</span>
            <span className="font-black">{v.titel}</span>
            <span className="text-sm text-muted">{v.text}</span>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted">Später geplant: L-Systeme (Pflanzen aus Wortregeln) und Boids (Schwärme aus drei einfachen Regeln).</p>
    </div>
  );
}
