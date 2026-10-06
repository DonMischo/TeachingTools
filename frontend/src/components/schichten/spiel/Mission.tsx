"use client";
/**
 * Anwenden: eine Mission von Anfang bis Ende — Wort wählen, codieren, Adresse
 * suchen, packen, routen, auspacken. Jede Stufe zählt Fehlversuche und ob ein
 * Hilfsmittel (Binär-Rechner) benutzt wurde; daraus Punkte und Sterne
 * (lib/schichten/wertung.ts). Am Ende werden Erfolge freigeschaltet.
 */
import { useEffect, useState } from "react";
import { text } from "@/lib/schichten/bytes";
import { ZIELE, type Ziel } from "@/lib/schichten/netz";
import {
  GEWERTET, stufenWertung, verbucheMission, type Erfolg, type GewerteteStufe, type Wertung,
} from "@/lib/schichten/wertung";
import type { Modell, Niveau } from "../Bausteine";
import { StufeAscii, StufeBits, WORT_LAENGE, istAscii } from "./Codierung";
import DnsJagd from "./DnsJagd";
import Packen, { SPIEL_ISN, SPIEL_MSS } from "./Packen";
import Routing from "./Routing";
import AuftragsKasten from "./Auftrag";
import ErfolgeTafel from "./ErfolgeTafel";
import { aendereErfolge, useErfolge } from "./erfolge";

const STUFEN = [
  { id: "auftrag", icon: "✉️", label: "Auftrag" },
  { id: "ascii", icon: "🔤", label: "ASCII" },
  { id: "bits", icon: "0️⃣", label: "Bits" },
  { id: "dns", icon: "📖", label: "DNS-Jagd" },
  { id: "packen", icon: "📦", label: "Packen" },
  { id: "routing", icon: "🧭", label: "Routing" },
  { id: "ankunft", icon: "🎉", label: "Ankunft" },
] as const;

const VORSCHLAEGE = ["Hallo :)", "Katze 42", "Sushi!!!", "TT rockt", "Erfurt 1"];
const zahl = (n: number) => n.toLocaleString("de-DE");
const sternchen = (n: number) => "⭐".repeat(n) + "☆".repeat(3 - n);

export default function Mission({ modell, niveau = "fortgeschritten" }: { modell: Modell; niveau?: Niveau }) {
  const [stufe, setStufe] = useState(0);
  const [erreicht, setErreicht] = useState(0);
  const [ziel, setZiel] = useState<Ziel>(ZIELE[0]);
  const [wort, setWort] = useState("");
  const [ip, setIp] = useState<string | null>(null);
  const [fehler, setFehler] = useState<number[]>(() => STUFEN.map(() => 0));
  const [hilfe, setHilfe] = useState<boolean[]>(() => STUFEN.map(() => false));
  const [wertungen, setWertungen] = useState<(Wertung | null)[]>(() => STUFEN.map(() => null));
  const [meldung, setMeldung] = useState<string | null>(null);
  const [abschluss, setAbschluss] = useState<{ punkte: number; neu: Erfolg[] } | null>(null);
  const [runde, setRunde] = useState(0);
  const erfolge = useErfolge();

  useEffect(() => {
    if (!meldung) return;
    const t = setTimeout(() => setMeldung(null), 3500);
    return () => clearTimeout(t);
  }, [meldung]);

  const plusFehler = (i: number) => () => setFehler(f => f.map((v, k) => (k === i ? v + 1 : v)));
  const plusHilfe = (i: number) => () => setHilfe(h => h.map((v, k) => (k === i ? true : v)));

  /** Stufe i ist gelöst: Wertung einfrieren (nur beim ersten Mal), am Ende Erfolge verbuchen */
  const geschafft = (i: number) => () => {
    setErreicht(e => Math.max(e, i + 1));
    if (wertungen[i]) return;
    const w = stufenWertung(fehler[i], hilfe[i], niveau);
    setWertungen(alt => alt.map((v, k) => (k === i ? w : v)));
    setMeldung(`${STUFEN[i].icon} ${STUFEN[i].label} geschafft: +${zahl(w.punkte)} Punkte ${sternchen(w.sterne)}`);
    if (STUFEN[i].id === "routing") {
      const nachStufe = <T,>(liste: T[]) =>
        Object.fromEntries(GEWERTET.map(id => [id, liste[STUFEN.findIndex(s => s.id === id)]])) as Record<GewerteteStufe, T>;
      const r = aendereErfolge(alt => verbucheMission(alt, { ziel: ziel.id, niveau, fehler: nachStufe(fehler), hilfe: nachStufe(hilfe) }));
      setAbschluss({ punkte: r.punkte, neu: r.neu });
    }
  };

  const wortOk = wort.length === WORT_LAENGE && istAscii(wort);
  const neu = () => {
    setStufe(0); setErreicht(0); setWort(""); setIp(null);
    setFehler(STUFEN.map(() => 0)); setHilfe(STUFEN.map(() => false)); setWertungen(STUFEN.map(() => null));
    setAbschluss(null); setRunde(r => r + 1);
  };
  const punkte = wertungen.reduce((s, w) => s + (w?.punkte ?? 0), 0);
  const sterne = wertungen.reduce((s, w) => s + (w?.sterne ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STUFEN.map((s, i) => (
            <button key={s.id} disabled={i > erreicht} onClick={() => setStufe(i)}
              className={`chip ${i === stufe ? "chip-on" : ""} ${i > erreicht ? "opacity-40" : ""}`}>
              {i < erreicht ? "✓" : s.icon} {s.label}{wertungen[i] ? <span className="ml-1 text-[10px]">{"⭐".repeat(wertungen[i]!.sterne)}</span> : null}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm tabular-nums" aria-label="Punktestand">
          <span>⭐ <b>{sterne}</b>/15</span>
          <span>🏆 <b>{zahl(punkte)}</b> Punkte</span>
        </div>
      </div>
      {meldung && <div role="status" className="rounded-xl bg-accent text-accent-fg px-4 py-2 font-bold self-start shadow-lg">{meldung}</div>}

      <AuftragsKasten stufe={STUFEN[stufe].id} niveau={niveau} ziel={ziel} />

      {stufe === 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm max-w-3xl">
            Lena will mit PurrMsg eine Nachricht aus genau <b>{WORT_LAENGE} Zeichen</b> verschicken. Diesmal machst du alles selbst: Zeichen in Zahlen und Bits verwandeln,
            die Adresse des Empfängers suchen, das Paket packen und Router für Router ans Ziel bringen. Jede Stufe bringt bis zu 1000 Punkte und 3 Sterne
            {niveau === "fortgeschritten" ? " — auf Fortgeschritten × 1,2" : niveau === "experte" ? " — auf Experte × 1,5" : ""}.
          </p>
          <div className="flex flex-col gap-2">
            <span className="label">An wen?</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2">
              {ZIELE.map(z => (
                <button key={z.id} onClick={() => setZiel(z)} className={`card p-3 text-left transition ${ziel.id === z.id ? "ring-2 ring-accent" : "hover:bg-surface-hover"}`}>
                  <div className="font-bold flex justify-between gap-2">{z.wer}{erfolge.ziele.includes(z.id) && <span title="schon erreicht">✅</span>}</div>
                  <div className="text-sm text-muted">{z.ort}</div>
                  <div className="text-xs font-mono text-muted mt-1">{z.name}</div>
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1 max-w-md">
            <span className="label">Dein Wort ({wort.length}/{WORT_LAENGE} Zeichen, ohne Umlaute)</span>
            <input className="input font-mono text-2xl tracking-widest" maxLength={WORT_LAENGE} value={wort}
              onChange={e => setWort(e.target.value)} placeholder="Hallo :)" aria-label="Wort mit 8 Zeichen" />
            {!istAscii(wort) && <span className="text-xs text-bad">Nur Zeichen aus der ASCII-Tabelle — keine Umlaute, kein ß, keine Emojis.</span>}
          </label>
          <div className="flex flex-wrap gap-1">
            {VORSCHLAEGE.map(v => <button key={v} className="chip font-mono" onClick={() => setWort(v)}>{v}</button>)}
          </div>
          <button className="btn btn-primary self-start" disabled={!wortOk} onClick={() => { setErreicht(1); setStufe(1); }}>Los geht's ▶</button>
          <ErfolgeTafel stand={erfolge} />
        </div>
      )}
      {stufe === 1 && <StufeAscii key={runde + niveau} niveau={niveau} wort={wort} fehler={plusFehler(1)} fertig={() => { geschafft(1)(); setStufe(2); }} />}
      {stufe === 2 && <StufeBits key={runde} niveau={niveau} wort={wort} fehler={plusFehler(2)} fertig={geschafft(2)} onHilfe={plusHilfe(2)} />}
      {stufe === 3 && <DnsJagd key={runde + ziel.id} niveau={niveau} ziel={ziel} fehler={plusFehler(3)} fertig={x => { setIp(x); geschafft(3)(); }} />}
      {stufe === 4 && ip && <Packen key={runde + niveau} niveau={niveau} ziel={ziel} wort={wort} ip={ip} modell={modell} fehler={plusFehler(4)} fertig={geschafft(4)} />}
      {stufe === 5 && <Routing key={runde + ziel.id} niveau={niveau} ziel={ziel} fehler={plusFehler(5)} fertig={geschafft(5)} onHilfe={plusHilfe(5)} />}
      {stufe === 6 && <Ankunft wort={wort} ziel={ziel} fehler={fehler} hilfe={hilfe} wertungen={wertungen} abschluss={abschluss} neu={neu} />}

      {stufe > 0 && stufe < 6 && erreicht > stufe && (
        <button className="btn btn-primary self-start" onClick={() => setStufe(stufe + 1)}>Weiter zu {STUFEN[stufe + 1].icon} {STUFEN[stufe + 1].label} ▶</button>
      )}
    </div>
  );
}

function Ankunft({ wort, ziel, fehler, hilfe, wertungen, abschluss, neu }: {
  wort: string;
  ziel: Ziel;
  fehler: number[];
  hilfe: boolean[];
  wertungen: (Wertung | null)[];
  abschluss: { punkte: number; neu: Erfolg[] } | null;
  neu: () => void;
}) {
  const erfolge = useErfolge();
  const bytes = text(wort);
  const sterne = wertungen.reduce((s, w) => s + (w?.sterne ?? 0), 0);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm max-w-3xl">
        Beim Server in {ziel.ort} läuft alles rückwärts: Rahmen prüfen und weg, Paket prüfen und weg, die zwei Segmente nach Folgenummer sortieren
        ({SPIEL_ISN} vor {SPIEL_ISN + SPIEL_MSS}), Bits zu Bytes, Bytes zu Zeichen. Und {ziel.wer} liest:
      </p>
      <div className="card p-4 flex flex-col gap-3 items-start">
        <div className="font-mono text-xs text-cyan-500 break-all">{Array.from(bytes, b => b.toString(2).padStart(8, "0")).join(" ")}</div>
        <div className="font-mono text-sm text-muted">{Array.from(bytes).join(" ")}</div>
        <div className="text-5xl font-black font-mono tracking-widest">{wort}</div>
      </div>
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-4">
          <span className="text-3xl font-black tabular-nums">🏆 {zahl(abschluss?.punkte ?? 0)} Punkte</span>
          <span className="text-xl">⭐ {sterne} / 15</span>
        </div>
        <table className="text-sm w-full max-w-xl">
          <thead><tr className="text-left text-xs text-muted"><th>Stufe</th><th>Fehlversuche</th><th>Hilfsmittel</th><th>Sterne</th><th className="text-right">Punkte</th></tr></thead>
          <tbody>
            {STUFEN.map((s, i) => wertungen[i] && (
              <tr key={s.id} className="border-t border-line">
                <td className="py-1">{s.icon} {s.label}</td>
                <td>{fehler[i]}</td>
                <td>{hilfe[i] ? "🧮" : "—"}</td>
                <td>{sternchen(wertungen[i]!.sterne)}</td>
                <td className="text-right tabular-nums">{zahl(wertungen[i]!.punkte)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {abschluss && abschluss.neu.length > 0 && (
          <div className="rounded-xl bg-accent/15 border border-accent/40 p-3">
            <b>🎉 Neu freigeschaltet:</b>
            <div className="flex flex-wrap gap-2 mt-1">
              {abschluss.neu.map(e => <span key={e.id} className="chip chip-on">{e.icon} {e.name}</span>)}
            </div>
          </div>
        )}
        <button className="btn btn-primary self-start" onClick={neu}>🔁 Neue Mission</button>
      </div>
      <ErfolgeTafel stand={erfolge} neu={abschluss?.neu} />
    </div>
  );
}
