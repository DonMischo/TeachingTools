"use client";
/**
 * Markieren & Bearbeiten — Anschluss an den Maus-Führerschein (Stufe 5/6):
 *   📘 Techniken    je Technik eine Lektion mit drei Aufgaben
 *   🔤 Schreiben    Großbuchstaben, Satz- und Sonderzeichen bis Alt Gr, Rechtschreibung
 *   ⏱️ Challenge    gewürfelte Aufgaben auf Zeit (auch »Nur Tastatur«), Bestzeit im Browser
 *   📚 Quellen      Zitat und Literaturangabe aus Buch oder Webseite kopieren
 *   🏆 Bestenliste  die schnellsten Challenge-Runden (nur mit Server, nicht in der Offline-Datei)
 *   📋 Spickzettel  alle Kürzel auf einen Blick, auch als PDF
 *   👩‍🏫 Übersicht   nur Lehrkraft: wer in der gewählten Sitzung wie weit ist
 *
 * Der Stand liegt je Person im Browser (`speicherSchluessel`: Konto, Gastname
 * bzw. Gast-Id) und geht mit Code zusätzlich an die Übersicht der Lehrkraft.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { liesStand, schreibStand, speicherName, type MarkierStand } from "@/lib/markieren/speicher";
import { api, type MausZugang } from "@/lib/api";
import { mitTasten } from "@/components/maus/Taste";
import Lektionen from "./Lektionen";
import Challenge from "./Challenge";
import Bestenliste from "./Bestenliste";
import Quellen from "./Quellen";
import Schreiben from "./Schreiben";
import { SPICKZETTEL, speichereSpickzettelPdf } from "@/lib/markieren/spickzettel";

const BLAETTER = [
  { id: "techniken", icon: "📘", label: "Techniken" },
  { id: "schreiben", icon: "🔤", label: "Schreiben" },
  { id: "challenge", icon: "⏱️", label: "Challenge" },
  { id: "quellen", icon: "📚", label: "Quellen" },
  { id: "beste", icon: "🏆", label: "Bestenliste" },
  { id: "spick", icon: "📋", label: "Spickzettel" },
  { id: "uebersicht", icon: "👩‍🏫", label: "Übersicht" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

function Spickzettel() {
  const [laedt, setLaedt] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button type="button" className="btn-secondary" disabled={laedt}
          onClick={async () => { setLaedt(true); try { await speichereSpickzettelPdf(); } finally { setLaedt(false); } }}>
          {laedt ? "…" : "📄 Als PDF herunterladen"}
        </button>
      </div>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]">
        {SPICKZETTEL.map(g => (
          <div key={g.titel} className="card p-4">
            <h2 className="font-black mb-2">{g.icon} {g.titel}</h2>
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
  /** Lehrkraft: die gewählte Sitzung (je Klasse eine) — für »Diese Sitzung«. */
  sitzungCode?: string | null;
};

/** Stand je Schlüssel; Laden im Effekt, Schreiben nur beim Ändern (sonst überschreibt StrictMode den Stand). */
function useStand(schluessel?: string) {
  const name = speicherName(schluessel);
  const [s, setS] = useState<{ name: string; stand: MarkierStand } | null>(null);
  useEffect(() => { setS({ name, stand: liesStand(schluessel) }); }, [name, schluessel]);
  const aendern = useCallback((f: (s: MarkierStand) => MarkierStand) => {
    setS(alt => {
      if (!alt || alt.name !== name) return alt;
      const stand = f(alt.stand);
      schreibStand(schluessel, stand);
      return { name, stand };
    });
  }, [name, schluessel]);
  return { stand: s && s.name === name ? s.stand : null, aendern };
}

export default function Markieren({ action, rangliste, vorgabe, speicherSchluessel, uebersicht }: {
  action?: ReactNode;
  rangliste?: MarkierRangliste;
  vorgabe?: Vorgabe;
  /** Je Person ein eigener Stand im Browser (Konto, Gastname bzw. Gast-Id). */
  speicherSchluessel?: string;
  /** Nur Lehrkraft: die Übersicht der Sitzung. */
  uebersicht?: ReactNode;
}) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "techniken");
  const zugang = rangliste?.zugang;
  const { stand, aendern } = useStand(speicherSchluessel);
  const [aktuell, setAktuell] = useState<string | null>(null);

  // Mit Code: Stand und »gerade dabei« an die Übersicht der Lehrkraft (gebündelt, still bei Fehlern).
  const code = zugang?.code, token = zugang?.token ?? null;
  useEffect(() => {
    if (!code || !stand) return;
    const t = setTimeout(() => {
      api.markieren.fortschritt({ code, token }, { ...stand, aktuell: aktuell?.slice(0, 120) ?? null }).catch(() => { /* nur für die Übersicht */ });
    }, 800);
    return () => clearTimeout(t);
  }, [code, token, stand, aktuell]);

  const teile = { stand, aendern, onAktuell: setAktuell };
  const INHALT: Record<Blatt, () => ReactNode> = {
    techniken: () => <Lektionen {...teile} />,
    schreiben: () => <Schreiben {...teile} />,
    challenge: () => (
      <Challenge {...teile} melden={rangliste
        ? (modus, zeit_ms, aktionen) => api.markierBestenliste.eintragen({ modus, zeit_ms, aktionen }, zugang)
        : undefined} />
    ),
    quellen: () => <Quellen {...teile} />,
    beste: () => <Bestenliste zugang={zugang} verwaltung={rangliste?.verwaltung} klasse={rangliste?.klasse} sitzungCode={rangliste?.sitzungCode} />,
    spick: () => <Spickzettel />,
    uebersicht: () => uebersicht,
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
        {BLAETTER.filter(b => (b.id !== "beste" || rangliste) && (b.id !== "uebersicht" || uebersicht)).map(b => (
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
