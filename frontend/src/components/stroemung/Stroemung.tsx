"use client";
/**
 * Druck & Strömung — Flüssigkeiten und Gase in Rohren, Behältern und Zylindern.
 * Ein Rohrnetz rechnet wie ein Stromkreis (lib/stroemung/loeser.ts):
 * Druck ≙ Spannung, Volumenstrom ≙ Strom, Strömungswiderstand ≙ Widerstand.
 *
 * Reiter nach Stufen: Kl. 7/8 Druck, Kl. 9/10 Strömung, Technik & Beruf,
 * dazu der Baukasten. Fertige Stationen hängen in STATION_INHALT.
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { STATIONEN, STUFEN, type Station } from "@/lib/stroemung/stationen";
import Tauchen from "./Tauchen";
import Wasserturm from "./Wasserturm";
import Presse from "./Presse";
import Luftdruck from "./Luftdruck";

/** Fertige Stationen; was hier fehlt, zeigt eine Vorschau. */
const STATION_INHALT: Record<string, () => ReactNode> = {
  tauchen: () => <Tauchen />,
  roehren: () => <Wasserturm />,
  hydraulik: () => <Presse />,
  luftdruck: () => <Luftdruck />,
};

export default function Stroemung({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  // Station mit festem Reiter (TaskCrawler): ohne Reiterleiste.
  const fest = wahl(vorgabe, "reiter", STATIONEN.map(s => s.id));
  const [id, setId] = useState(fest ?? STATIONEN[0].id);
  const station = STATIONEN.find(s => s.id === id) ?? STATIONEN[0];
  const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">💧 Druck & Strömung</h1>
          <p className="text-muted text-sm mt-1">
            Wasser und Luft in Behältern, Rohren und Zylindern: Schweredruck, Pascal, Luftdruck, Rohrreibung, Bernoulli —
            bis zu Heizkreis, Hausanschluss und Druckluft. Wer mag, blendet den passenden Stromkreis darüber.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {!fest && (
        <div className="flex flex-wrap gap-3">
          {STUFEN.map(stufe => (
            <div key={stufe.id} className="flex flex-col gap-1">
              <div className="text-xs font-bold text-muted px-1">{stufe.label}</div>
              <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
                {STATIONEN.filter(s => s.stufe === stufe.id).map(s => (
                  <button key={s.id} className={chip(s.id === id)} onClick={() => setId(s.id)}>{s.icon} {s.titel}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {STATION_INHALT[station.id]?.() ?? <Vorschau station={station} />}
    </div>
  );
}

function Vorschau({ station }: { station: Station }) {
  return (
    <div className="card p-6 flex flex-col gap-2 max-w-2xl">
      <div className="text-3xl">{station.icon}</div>
      <h2 className="text-xl font-black">{station.titel}</h2>
      <p>{station.kurz}</p>
      <p className="text-sm text-muted">Diese Station ist noch in Arbeit.</p>
    </div>
  );
}
