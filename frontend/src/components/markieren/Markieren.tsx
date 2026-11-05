"use client";
/**
 * Markieren & Bearbeiten — Anschluss an den Maus-Führerschein (Stufe 5/6):
 *   📘 Techniken    je Technik eine Lektion mit drei Aufgaben
 *   ⏱️ Challenge    gewürfelte Aufgaben auf Zeit, Bestzeit im Browser
 *   📚 Quellen      Zitat und Literaturangabe aus Buch oder Webseite kopieren
 *   🏆 Bestenliste  die schnellsten Challenge-Runden (nur mit Server, nicht in der Offline-Datei)
 *   📋 Spickzettel  alle Kürzel auf einen Blick
 */
import { useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { api, type MausZugang } from "@/lib/api";
import { mitTasten } from "@/components/maus/Taste";
import Lektionen from "./Lektionen";
import Challenge from "./Challenge";
import Bestenliste from "./Bestenliste";
import Quellen from "./Quellen";

const BLAETTER = [
  { id: "techniken", icon: "📘", label: "Techniken" },
  { id: "challenge", icon: "⏱️", label: "Challenge" },
  { id: "quellen", icon: "📚", label: "Quellen" },
  { id: "beste", icon: "🏆", label: "Bestenliste" },
  { id: "spick", icon: "📋", label: "Spickzettel" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const SPICKZETTEL: { titel: string; zeilen: [string, string][] }[] = [
  {
    titel: "🖱️ Markieren mit der Maus",
    zeilen: [
      ["Doppelklick", "ein Wort"],
      ["Dreifachklick", "eine Zeile (in Word: ein Absatz)"],
      ["Ziehen mit gedrückter Taste", "beliebiges Stück"],
      ["Klick, dann [[Umschalt]] + Klick", "von der ersten bis zur zweiten Stelle"],
    ],
  },
  {
    titel: "⌨️ Markieren mit der Tastatur",
    zeilen: [
      ["[[Umschalt]] + [[←]] / [[→]]", "Buchstabe für Buchstabe"],
      ["[[Strg]] + [[Umschalt]] + [[←]] / [[→]]", "Wort für Wort"],
      ["[[Umschalt]] + [[Pos1]] / [[Ende]]", "bis zum Zeilenanfang / Zeilenende"],
      ["[[Umschalt]] + [[↑]] / [[↓]]", "Zeile für Zeile"],
      ["[[Strg]] + [[A]]", "alles"],
    ],
  },
  {
    titel: "↔️ Cursor bewegen",
    zeilen: [
      ["[[Pos1]] / [[Ende]]", "Anfang / Ende der Zeile"],
      ["[[Strg]] + [[←]] / [[→]]", "ein Wort zurück / weiter"],
      ["[[Strg]] + [[Pos1]] / [[Ende]]", "Anfang / Ende des ganzen Textes"],
    ],
  },
  {
    titel: "✂️ Bearbeiten",
    zeilen: [
      ["[[Strg]] + [[C]]", "kopieren"],
      ["[[Strg]] + [[X]]", "ausschneiden"],
      ["[[Strg]] + [[V]]", "einfügen"],
      ["[[Strg]] + [[Z]]", "rückgängig"],
      ["[[Entf]] / [[Rücktaste]]", "löschen rechts / links vom Cursor (oder die Markierung)"],
      ["markieren und tippen", "ersetzt das Markierte"],
    ],
  },
];

function Spickzettel() {
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]">
      {SPICKZETTEL.map(g => (
        <div key={g.titel} className="card p-4">
          <h2 className="font-black mb-2">{g.titel}</h2>
          <table className="w-full text-sm">
            <tbody>
              {g.zeilen.map(([k, was]) => (
                <tr key={k} className="border-t border-line first:border-t-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{mitTasten(k)}</td>
                  <td className="py-2">{was}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/** Ohne diese Angaben (Offline-Datei) gibt es keine Bestenliste. */
export type MarkierRangliste = {
  /** Beitritt über Code/QR (auch Gäste). */
  zugang?: MausZugang;
  klasse?: string | null;
  /** Lehrkraft auf der Werkzeugseite: »Diese Sitzung« = ihre eigene. */
  verwaltung?: boolean;
};

export default function Markieren({ action, rangliste, vorgabe }: { action?: ReactNode; rangliste?: MarkierRangliste; vorgabe?: Vorgabe }) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "techniken");
  const zugang = rangliste?.zugang;

  const INHALT: Record<Blatt, () => ReactNode> = {
    techniken: () => <Lektionen />,
    challenge: () => (
      <Challenge melden={rangliste
        ? (modus, zeit_ms, aktionen) => api.markierBestenliste.eintragen({ modus, zeit_ms, aktionen }, zugang)
        : undefined} />
    ),
    quellen: () => <Quellen />,
    beste: () => <Bestenliste zugang={zugang} verwaltung={rangliste?.verwaltung} klasse={rangliste?.klasse} />,
    spick: () => <Spickzettel />,
  };
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🖍️ Markieren & Bearbeiten</h1>
          <p className="text-muted text-sm mt-1">
            Markieren, kopieren, ausschneiden, einfügen, löschen und rückgängig machen — mit Maus und Tastatur,
            erst Technik für Technik, dann auf Zeit. Weiter geht es dort, wo der Maus-Führerschein aufhört.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.filter(b => b.id !== "beste" || rangliste).map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
            }`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>}

      {INHALT[blatt]()}
    </div>
  );
}
