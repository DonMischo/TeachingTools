"use client";
/**
 * Anwenden: eine Mission von Anfang bis Ende — Wort wählen, codieren, Adresse
 * suchen, packen, routen, auspacken. Jede Stufe zählt Fehlversuche.
 */
import { useState } from "react";
import { text } from "@/lib/schichten/bytes";
import { ZIELE, type Ziel } from "@/lib/schichten/netz";
import type { Modell, Niveau } from "../Bausteine";
import { StufeAscii, StufeBits, WORT_LAENGE, istAscii } from "./Codierung";
import DnsJagd from "./DnsJagd";
import Packen, { SPIEL_ISN, SPIEL_MSS } from "./Packen";
import Routing from "./Routing";
import AuftragsKasten from "./Auftrag";

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

export default function Mission({ modell, niveau = "fortgeschritten" }: { modell: Modell; niveau?: Niveau }) {
  const [stufe, setStufe] = useState(0);
  const [erreicht, setErreicht] = useState(0);
  const [ziel, setZiel] = useState<Ziel>(ZIELE[0]);
  const [wort, setWort] = useState("");
  const [ip, setIp] = useState<string | null>(null);
  const [fehler, setFehler] = useState<number[]>(() => STUFEN.map(() => 0));
  const [runde, setRunde] = useState(0);

  const plusFehler = (i: number) => () => setFehler(f => f.map((v, k) => (k === i ? v + 1 : v)));
  const geschafft = (i: number) => () => setErreicht(e => Math.max(e, i + 1));
  const wortOk = wort.length === WORT_LAENGE && istAscii(wort);
  const neu = () => { setStufe(0); setErreicht(0); setWort(""); setIp(null); setFehler(STUFEN.map(() => 0)); setRunde(r => r + 1); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {STUFEN.map((s, i) => (
          <button key={s.id} disabled={i > erreicht} onClick={() => setStufe(i)}
            className={`chip ${i === stufe ? "chip-on" : ""} ${i > erreicht ? "opacity-40" : ""}`}>
            {i < erreicht ? "✓" : s.icon} {s.label}
          </button>
        ))}
      </div>

      <AuftragsKasten stufe={STUFEN[stufe].id} niveau={niveau} ziel={ziel} />

      {stufe === 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm max-w-3xl">
            Lena will mit PurrMsg eine Nachricht aus genau <b>{WORT_LAENGE} Zeichen</b> verschicken. Diesmal machst du alles selbst: Zeichen in Zahlen und Bits verwandeln,
            die Adresse des Empfängers suchen, das Paket packen und Router für Router ans Ziel bringen.
          </p>
          <div className="flex flex-col gap-2">
            <span className="label">An wen?</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,200px),1fr))] gap-2">
              {ZIELE.map(z => (
                <button key={z.id} onClick={() => setZiel(z)} className={`card p-3 text-left transition ${ziel.id === z.id ? "ring-2 ring-accent" : "hover:bg-surface-hover"}`}>
                  <div className="font-bold">{z.wer}</div>
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
        </div>
      )}
      {stufe === 1 && <StufeAscii key={runde + niveau} niveau={niveau} wort={wort} fehler={plusFehler(1)} fertig={() => { geschafft(1)(); setStufe(2); }} />}
      {stufe === 2 && <StufeBits key={runde} niveau={niveau} wort={wort} fehler={plusFehler(2)} fertig={geschafft(2)} />}
      {stufe === 3 && <DnsJagd key={runde + ziel.id} niveau={niveau} ziel={ziel} fehler={plusFehler(3)} fertig={x => { setIp(x); geschafft(3)(); }} />}
      {stufe === 4 && ip && <Packen key={runde + niveau} niveau={niveau} ziel={ziel} wort={wort} ip={ip} modell={modell} fehler={plusFehler(4)} fertig={geschafft(4)} />}
      {stufe === 5 && <Routing key={runde + ziel.id} niveau={niveau} ziel={ziel} fehler={plusFehler(5)} fertig={geschafft(5)} />}
      {stufe === 6 && <Ankunft wort={wort} ziel={ziel} fehler={fehler} neu={neu} />}

      {stufe > 0 && stufe < 6 && erreicht > stufe && (
        <button className="btn btn-primary self-start" onClick={() => setStufe(stufe + 1)}>Weiter zu {STUFEN[stufe + 1].icon} {STUFEN[stufe + 1].label} ▶</button>
      )}
    </div>
  );
}

function Ankunft({ wort, ziel, fehler, neu }: { wort: string; ziel: Ziel; fehler: number[]; neu: () => void }) {
  const bytes = text(wort);
  const summe = fehler.reduce((s, v) => s + v, 0);
  const sterne = summe <= 1 ? 3 : summe <= 5 ? 2 : 1;
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
      <div className="card p-4 flex flex-col gap-2">
        <div className="text-3xl">{"⭐".repeat(sterne)}{"☆".repeat(3 - sterne)}</div>
        <div className="text-sm">
          Fehlversuche: ASCII {fehler[1]} · Bits {fehler[2]} · DNS {fehler[3]} · Packen {fehler[4]} · Routing {fehler[5]}
        </div>
        <button className="btn btn-primary self-start" onClick={neu}>🔁 Neue Mission</button>
      </div>
    </div>
  );
}
