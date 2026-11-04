"use client";
/**
 * Hund oder Wolf? Eine kleine echte KI (naiver Bayes) lernt aus
 * Beispielbildern. Mit einseitigen Daten lernt sie »Schnee = Wolf« statt der
 * Tiere. Wer vielfältige Beispiele ergänzt, sieht die Vorhersagen kippen.
 */
import { useState } from "react";
import {
  EINSEITIG, TESTFAELLE, wahrscheinlichkeitHund, type Beispiel, type Hintergrund, type Tier,
} from "@/lib/kikompass/interaktiv";

const HG: Record<Hintergrund, { farbe: string; icon: string; name: string }> = {
  wiese: { farbe: "#bfe3a5", icon: "🌿", name: "Wiese" },
  schnee: { farbe: "#e6f0fa", icon: "❄️", name: "Schnee" },
};

function Bildchen({ tier, hintergrund, halsband, klein }: { tier?: Tier; hintergrund: Hintergrund; halsband: boolean; klein?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center rounded ${klein ? "w-9 h-9 text-lg" : "w-14 h-14 text-3xl"} relative`}
      style={{ background: HG[hintergrund].farbe }}
      title={`${tier ? (tier === "hund" ? "Hund" : "Wolf") : "?"}, ${HG[hintergrund].name}${halsband ? ", Halsband" : ""}`}>
      {tier ? (tier === "hund" ? "🐕" : "🐺") : "❔"}
      {halsband && <span className="absolute bottom-0 right-0 text-xs">🔴</span>}
    </span>
  );
}

const NEU: (Beispiel & { titel: string })[] = [
  { titel: "Hund im Schnee", tier: "hund", hintergrund: "schnee", halsband: true },
  { titel: "Hund im Schnee (ohne Halsband)", tier: "hund", hintergrund: "schnee", halsband: false },
  { titel: "Wolf auf der Wiese", tier: "wolf", hintergrund: "wiese", halsband: false },
];

export function HundOderWolf({ onFertig }: { onFertig?: () => void }) {
  const [daten, setDaten] = useState<Beispiel[]>(EINSEITIG);
  const ergebnisse = TESTFAELLE.map(t => {
    const p = wahrscheinlichkeitHund(daten, t);
    const sagt: Tier = p >= 0.5 ? "hund" : "wolf";
    return { ...t, p, sagt, ok: sagt === t.wahr };
  });
  const richtig = ergebnisse.filter(e => e.ok).length;

  function hinzu(b: Beispiel) {
    const neu = [...daten, b];
    setDaten(neu);
    if (TESTFAELLE.every(t => (wahrscheinlichkeitHund(neu, t) >= 0.5 ? "hund" : "wolf") === t.wahr)) onFertig?.();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">Hund oder Wolf? Eine Mini-KI trainieren</p>
      <p className="text-sm text-muted">
        Die KI lernt aus den Trainingsbildern unten. Sie sieht nur zwei Dinge: den Hintergrund und ob ein rotes Halsband 🔴 da ist.
        Schau dir an, was sie vorhersagt. Wo liegt sie falsch, und warum?
      </p>
      <div className="card p-3">
        <p className="text-xs text-muted mb-1">Trainingsdaten ({daten.length} Bilder)</p>
        <div className="flex flex-wrap gap-1">{daten.map((d, i) => <Bildchen key={i} {...d} klein />)}</div>
      </div>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {ergebnisse.map(e => (
          <div key={e.titel} className="card p-2 flex flex-col items-center gap-1 text-center">
            <Bildchen tier={e.wahr} hintergrund={e.hintergrund} halsband={e.halsband} />
            <span className="text-xs">{e.titel}</span>
            <span className={`text-sm font-medium ${e.ok ? "text-ok" : "text-bad"}`}>
              KI sagt: {e.sagt === "hund" ? "Hund" : "Wolf"} ({Math.round((e.sagt === "hund" ? e.p : 1 - e.p) * 100)} %) {e.ok ? "✅" : "❌"}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm font-medium">{richtig} von {TESTFAELLE.length} richtig erkannt.</p>
      {richtig < TESTFAELLE.length && daten.length === EINSEITIG.length && (
        <p className="text-sm">
          🤔 Alle Hunde im Training standen auf der Wiese, alle Wölfe im Schnee. Die KI hat gelernt: <strong>Schnee = Wolf</strong>.
          Das ist Bias durch einseitige Daten. Ergänze vielfältigere Beispiele:
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {NEU.map(n => (
          <button key={n.titel} className="btn-secondary text-sm flex items-center gap-1" onClick={() => hinzu(n)}>
            + <Bildchen {...n} klein /> {n.titel}
          </button>
        ))}
        <button className="btn-secondary text-sm" onClick={() => setDaten(EINSEITIG)}>↺ Zurück zu den einseitigen Daten</button>
      </div>
      {richtig === TESTFAELLE.length && daten.length > EINSEITIG.length && (
        <p className="text-sm text-ok">Geschafft: Mit vielfältigen Daten achtet die KI auf das Halsband statt auf den Schnee. Aber Achtung: Ein Hund ohne Halsband im Schnee? Probier es aus.</p>
      )}
    </div>
  );
}
