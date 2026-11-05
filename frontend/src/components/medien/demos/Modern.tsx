"use client";
/** Mitmach-Demos der jüngeren Medien: Kassette spulen, Disketten-Rechner, SMS tippen */
import { useEffect, useRef, useState } from "react";
import { TASTEN, buchstabe } from "@/lib/medien/codes";

// ── Kassette: spulen mit Batterie oder Bleistift ──
const LIEDER = [{ name: "Intro", bei: 0 }, { name: "Sommerhit", bei: 22 }, { name: "Lieblingslied ❤️", bei: 58 }, { name: "Ballade", bei: 80 }];

export function KassetteDemo() {
  const [pos, setPos] = useState(100);
  const [akku, setAkku] = useState(100);
  const [salat, setSalat] = useState(false);
  const [stifte, setStifte] = useState(0);
  const ziel = LIEDER[2];
  const spule = (d: number, mitAkku: boolean) => {
    if (salat) return;
    if (mitAkku) { if (akku <= 0) return; setAkku(a => Math.max(0, a - 12)); }
    else setStifte(s => s + 1);
    setPos(p => Math.max(0, Math.min(100, p + d)));
    if (mitAkku && Math.random() < 0.12) setSalat(true);
  };
  const links = 12 + (pos / 100) * 16, rechts = 12 + ((100 - pos) / 100) * 16;
  const da = Math.abs(100 - pos - ziel.bei) <= 4;
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <svg viewBox="0 0 240 150" className="w-64 shrink-0" role="img" aria-label="Kassette">
        <rect x="4" y="4" width="232" height="142" rx="10" fill="#1f2937" />
        <rect x="22" y="16" width="196" height="40" rx="4" fill="#fde68a" />
        <text x="120" y="34" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#78350f">MIXTAPE FÜR JULIA</text>
        <text x="120" y="49" textAnchor="middle" fontSize="9" fill="#78350f">Seite A</text>
        <rect x="52" y="66" width="136" height="50" rx="8" fill="#111827" />
        <circle cx="86" cy="91" r={links} fill="#4b2e14" /><circle cx="154" cy="91" r={rechts} fill="#4b2e14" />
        <circle cx="86" cy="91" r="9" fill="#e5e7eb" /><circle cx="154" cy="91" r="9" fill="#e5e7eb" />
        {salat && <path d="M 96 120 C 110 160 130 100 150 150 C 160 120 180 160 200 130" stroke="#4b2e14" strokeWidth="2" fill="none" />}
      </svg>
      <div className="flex flex-col gap-2 text-sm">
        <p>Spul zum <b>{ziel.name}</b> (bei {ziel.bei} %). Gerade: <b>{Math.round(100 - pos)} %</b> abgespielt.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => spule(10, true)} disabled={salat || akku <= 0}>⏪ Rückspulen (Batterie)</button>
          <button className="btn-secondary" onClick={() => spule(-10, true)} disabled={salat || akku <= 0}>⏩ Vorspulen</button>
          <button className="btn-secondary" onClick={() => spule(-2, false)} disabled={salat}>✏️ Bleistift: vor</button>
          <button className="btn-secondary" onClick={() => spule(2, false)} disabled={salat}>✏️ Bleistift: zurück</button>
        </div>
        <div className="text-xs">🔋 Batterie: {akku} % {akku <= 0 && "— leer! Jetzt hilft nur noch der Bleistift."}</div>
        {salat && <p className="text-bad font-bold">🍝 Bandsalat! <button className="underline" onClick={() => { setSalat(false); setStifte(s => s + 5); }}>Mit dem Bleistift vorsichtig aufwickeln</button></p>}
        {da && !salat && <p className="text-ok font-bold">🎶 Treffer! Play drücken. {stifte > 0 && `(${stifte}× Bleistift — echte 80er-Technik)`}</p>}
        <p className="text-xs text-muted">Musik auf Band hat einen Haken: Um ein Lied zu finden, muss man an allen anderen vorbei. Die CD springt sofort hin — das heißt »wahlfreier Zugriff«.</p>
      </div>
    </div>
  );
}

// ── Disketten-Rechner ──
const DISKETTE = 1.44e6;
const DINGE = [
  { name: "eine SMS", icon: "💬", bytes: 140 },
  { name: "ein Schulreferat (Text)", icon: "📝", bytes: 30e3 },
  { name: "ein Handyfoto", icon: "📸", bytes: 4e6 },
  { name: "ein MP3-Lied", icon: "🎵", bytes: 5e6 },
  { name: "ein Spielfilm in HD", icon: "🎬", bytes: 5e9 },
  { name: "ein großes Videospiel", icon: "🎮", bytes: 120e9 },
];
const zahl = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: n < 10 ? 1 : 0 });

export function DisketteDemo() {
  const [wahl, setWahl] = useState(2);
  const d = DINGE[wahl];
  const anzahl = Math.ceil(d.bytes / DISKETTE);
  const hoehe = anzahl * 3.3 / 1000; // m
  const gewicht = anzahl * 0.02; // kg
  const vergleich = hoehe < 0.05 ? "passt locker in die Hosentasche" : hoehe < 2 ? "ein Stapel bis zum Knie oder Bauch" : hoehe < 50 ? "so hoch wie ein Haus" : hoehe < 300 ? "höher als der Erfurter Dom" : "fast so hoch wie ein Berg";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {DINGE.map((x, i) => <button key={x.name} className={`chip ${wahl === i ? "chip-on" : ""}`} onClick={() => setWahl(i)}>{x.icon} {x.name}</button>)}
      </div>
      <div className="grid sm:grid-cols-3 gap-3 text-center">
        <div className="card p-3"><div className="text-3xl font-black">{zahl(anzahl)}</div><div className="text-xs text-muted">Disketten à 1,44 MB</div></div>
        <div className="card p-3"><div className="text-3xl font-black">{hoehe < 1 ? `${zahl(hoehe * 100)} cm` : `${zahl(hoehe)} m`}</div><div className="text-xs text-muted">Stapelhöhe — {vergleich}</div></div>
        <div className="card p-3"><div className="text-3xl font-black">{gewicht < 1 ? `${zahl(gewicht * 1000)} g` : `${zahl(gewicht)} kg`}</div><div className="text-xs text-muted">Gewicht</div></div>
      </div>
      <p className="text-xs text-muted">Eine 3,5-Zoll-Diskette ist etwa 3,3 mm dick und wiegt rund 20 g. Eine microSD-Karte so groß wie ein Fingernagel fasst heute so viel wie über 700 000 Disketten.</p>
    </div>
  );
}

// ── SMS tippen (Mehrfachtippen wie 1999) ──
const REIHEN = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["*", "0", "#"]];
export function SmsDemo() {
  const [text, setText] = useState("");
  const [tipps, setTipps] = useState(0);
  const letzte = useRef<{ taste: string; mal: number; zeit: number } | null>(null);
  const [cursor, setCursor] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setCursor(c => !c), 500); return () => clearInterval(t); }, []);
  const druecke = (taste: string) => {
    if (taste === "*") { setText(t => t.slice(0, -1)); letzte.current = null; return; }
    if (taste === "#") { letzte.current = null; return; }
    setTipps(n => n + 1);
    const jetzt = Date.now(), l = letzte.current;
    if (l && l.taste === taste && jetzt - l.zeit < 900) {
      const mal = l.mal + 1;
      letzte.current = { taste, mal, zeit: jetzt };
      setText(t => t.slice(0, -1) + buchstabe(taste, mal));
    } else {
      if (text.length >= 160) return;
      letzte.current = { taste, mal: 1, zeit: jetzt };
      setText(t => t + buchstabe(taste, 1));
    }
  };
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start">
      <div className="w-56 shrink-0 rounded-[2rem] p-4 flex flex-col gap-3" style={{ background: "linear-gradient(#1e3a8a, #172554)" }}>
        <div className="rounded-lg p-2 h-28 font-mono text-sm overflow-hidden break-all" style={{ background: "#9fbc8b", color: "#1b2a12" }}>
          <div className="flex justify-between text-[10px] mb-1"><span>📶 Neue SMS</span><span>{160 - text.length}</span></div>
          {text}<span className={cursor ? "" : "opacity-0"}>▌</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {REIHEN.flat().map(t => (
            <button key={t} onClick={() => druecke(t)} className="rounded-xl py-1.5 text-white font-black leading-tight active:scale-95" style={{ background: "#334155" }}>
              {t}<div className="text-[9px] font-normal opacity-80">{t === "*" ? "löschen" : t === "#" ? "weiter" : TASTEN[t].replace(/\d/, "").replace(" ", "␣")}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm max-w-sm">
        <p>Schreib »hdl« oder »bin gleich da« wie 1999: Für »c« dreimal die 2 drücken. Gleiche Taste noch mal? Kurz warten oder # drücken.</p>
        <p className="text-lg font-black">{tipps} Tastendrücke für {text.length} Zeichen</p>
        <p className="text-xs text-muted">Darum gab es Abkürzungen: »gn8«, »hdgdl«, »lol«. Später half T9: Das Handy erriet das Wort aus einem Druck pro Buchstabe — und machte aus »Hallo« manchmal »Gallo«.</p>
      </div>
    </div>
  );
}
