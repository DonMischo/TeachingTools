"use client";
/**
 * Stellenwerttafeln — Zehner-, Zweier- und Sechzehnersystem in vier Blättern:
 *   🧱 Tafel      Plättchen legen, bündeln, entbündeln; dieselbe Zahl in allen drei Systemen
 *   💡 Verstehen  Bündeln, Ziffernvorrat, Stellenwerte, Umrechnen Schritt für Schritt, Päckchen
 *   ✍️ Üben       Aufgaben in drei Stufen mit Lösungsweg
 *   🎮 Spiele     Bit-Fall, Zählwerk-Rennen, Geheimbotschaft
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import Tafel from "./Tafel";
import Verstehen from "./Verstehen";
import Ueben from "./Ueben";
import Spiele from "./Spiele";
import { Eingang, useGeheimpost, type Empfangen, type Geheimpost } from "./spiele/Geheimpost";
import { SimKopf } from "@/components/SimKopf";

const BLAETTER = [
  { id: "tafel", icon: "🧱", label: "Tafel" },
  { id: "verstehen", icon: "💡", label: "Verstehen" },
  { id: "ueben", icon: "✍️", label: "Üben" },
  { id: "spiele", icon: "🎮", label: "Spiele" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

/** Sitzungscode (und Gast-Token) — die Geheimpost braucht ihn. */
export type StellenwertZugang = { code: string; token?: string | null };

type Post = { post?: Geheimpost; empfangen: Empfangen | null };
const INHALT: Record<Blatt, (p: Post) => ReactNode> = {
  tafel: () => <Tafel />,
  verstehen: () => <Verstehen />,
  ueben: () => <Ueben />,
  spiele: p => <Spiele post={p.post} empfangen={p.empfangen} />,
};

export default function Stellenwert({ action, zugang, vorgabe }: { action?: ReactNode; zugang?: StellenwertZugang; vorgabe?: Vorgabe }) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "tafel");
  // Geheimpost: anwesend ist, wer die Simulation offen hat — egal welches Blatt
  const geheimpost = useGeheimpost(zugang);
  const post = geheimpost.code ? geheimpost : undefined;
  const [empfangen, setEmpfangen] = useState<Empfangen | null>(null);
  return (
    <div className="page">
      <SimKopf titel="🔢 Stellenwerttafeln" action={action}>
        Zehnersystem, Zweiersystem (binär) und Sechzehnersystem (hexadezimal) in der Stellenwerttafel:
        Plättchen legen und bündeln, umrechnen Schritt für Schritt, üben — und drei Spiele.
      </SimKopf>

      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
            }`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>}

      {post && <Eingang post={post} angenommen={e => { setEmpfangen(e); setBlatt("spiele"); }} />}

      {INHALT[blatt]({ post, empfangen })}
    </div>
  );
}
