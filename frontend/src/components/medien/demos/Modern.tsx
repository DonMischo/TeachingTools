"use client";
/** Mitmach-Demos der jüngeren Medien: Kassette spulen, Disketten-Rechner, SMS tippen */
import { useEffect, useRef, useState } from "react";
import { TASTEN, buchstabe } from "@/lib/medien/codes";
import { t9Vorschlaege } from "@/lib/medien/t9";
import { useErprobt } from "@/lib/medien/erprobt";
import { SendenLeiste } from "./Live";
import TOENE from "@/lib/medien/toene.json";
import { dtmf, fsk, rauschen, ton } from "./ton";

// ── Kassette: spulen mit Batterie oder Bleistift ──
const LIEDER = [{ name: "Intro", bei: 0 }, { name: "Sommerhit", bei: 22 }, { name: "Lieblingslied ❤️", bei: 58 }, { name: "Ballade", bei: 80 }];

export function KassetteDemo() {
  const [pos, setPos] = useState(100);
  const erprobt = useErprobt();
  const [akku, setAkku] = useState(100);
  const [salat, setSalat] = useState(false);
  const [stifte, setStifte] = useState(0);
  const [spielt, setSpielt] = useState(false);
  const band = useRef<HTMLAudioElement | null>(null);
  const leiern = useRef<number | null>(null);
  const ziel = LIEDER[2];
  // Das Band ist ein echtes Lied: Die Stelle auf dem Band ist die Stelle im Lied
  const halt = () => {
    band.current?.pause();
    if (leiern.current) clearInterval(leiern.current);
    setSpielt(false);
  };
  useEffect(() => () => halt(), []);
  const abspielen = () => {
    if (salat) return;
    const a = band.current ?? new Audio(TOENE.mixtape.datei);
    band.current = a;
    // Ohne Tonhöhen-Ausgleich leiert das Band hörbar, wenn das Tempo schwankt
    (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
    const los = () => { a.currentTime = ((100 - pos) / 100) * (a.duration || 0); void a.play().catch(() => setSpielt(false)); };
    if (a.readyState >= 1) los(); else a.addEventListener("loadedmetadata", los, { once: true });
    let w = 0;
    if (leiern.current) clearInterval(leiern.current);
    leiern.current = window.setInterval(() => {
      w += 0.35;
      a.playbackRate = (akku > 0 ? 1 : 0.9) + Math.sin(w) * 0.006 + (Math.random() - 0.5) * 0.004;
      if (a.duration) setPos(100 - (a.currentTime / a.duration) * 100);
      if (Math.random() < 0.02) rauschen(0.25, 0, 0.012);
    }, 120);
    setSpielt(true);
  };
  const spule = (d: number, mitAkku: boolean) => {
    if (salat) return;
    if (spielt) halt();
    if (mitAkku) { if (akku <= 0) return; setAkku(a => Math.max(0, a - 12)); fsk([2600, 3100, 3500], 0.35, 0, 60, 0.03, "triangle"); }
    else { setStifte(s => s + 1); rauschen(0.12, 0, 0.03, { freq: 700 }); }
    setPos(p => Math.max(0, Math.min(100, p + d)));
    if (mitAkku && Math.random() < 0.12) setSalat(true);
  };
  const links = 12 + (pos / 100) * 16, rechts = 12 + ((100 - pos) / 100) * 16;
  const da = Math.abs(100 - pos - ziel.bei) <= 4;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (da && !salat) erprobt("kassette"); }, [da, salat]);
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
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={spielt ? halt : abspielen} disabled={salat}>{spielt ? "⏹ Stopp" : "▶ Play"}</button>
          <span className="text-xs">🔋 Batterie: {akku} % {akku <= 0 && "— leer! Jetzt leiert das Band."}</span>
        </div>
        {salat && <p className="text-bad font-bold">🍝 Bandsalat! <button className="underline" onClick={() => { setSalat(false); setStifte(s => s + 5); }}>Mit dem Bleistift vorsichtig aufwickeln</button></p>}
        {da && !salat && <p className="text-ok font-bold">🎶 Treffer! Play drücken. {stifte > 0 && `(${stifte}× Bleistift — echte 80er-Technik)`}</p>}
        <p className="text-xs text-muted">Musik auf Band hat einen Haken: Um ein Lied zu finden, muss man an allen anderen vorbei. Die CD springt sofort hin — das heißt »wahlfreier Zugriff«.</p>
        <p className="text-[11px] text-muted">Musik: <a className="underline" href={TOENE.mixtape.quelle} target="_blank" rel="noreferrer">»{TOENE.mixtape.titel.replace(/^Steve Combs - \d+ - /, "")}«</a> von {TOENE.mixtape.urheber}, {TOENE.mixtape.lizenz}.</p>
      </div>
    </div>
  );
}

// ── Modem: Einwählen ins Internet, 1995 ──
/** Ablauf der Einwahl in Sekunden — Töne und Lämpchen folgen derselben Liste */
const EINWAHL = [
  { ab: 0, text: "Hörer ab: Wählton", lampen: ["OH"] },
  { ab: 1.3, text: "Wählen: 0 19 19 …", lampen: ["OH"] },
  { ab: 2.8, text: "Gegenstelle hebt ab: Antwortton 2100 Hz", lampen: ["OH", "AA"] },
  { ab: 4.4, text: "Begrüßung: Welche Sprache sprichst du? (Verfahren aushandeln)", lampen: ["OH", "AA", "SD", "RD"] },
  { ab: 5.5, text: "Leitung abtasten: Wie gut ist das Kabel? (Rauschen)", lampen: ["OH", "AA", "SD", "RD", "CD"] },
  { ab: 8.6, text: "Verbunden mit 56 000 bit/s!", lampen: ["OH", "AA", "CD", "HS", "TR"] },
] as const;
const ENDE_EINWAHL = 8.6;
const LAMPEN = ["HS", "AA", "CD", "OH", "RD", "SD", "TR"];

function einwahlTon() {
  ton(350, 1.2, 0, "sine", 0.07); ton(440, 1.2, 0, "sine", 0.07);
  dtmf("0191911", 1.3);
  ton(2100, 1.5, 2.85, "sine", 0.09);
  fsk([980, 1180, 1650, 1850], 1.0, 4.45, 300, 0.07);
  rauschen(1.4, 5.5, 0.12, { freq: 1800, q: 0.7 });
  fsk([1200, 2400], 0.6, 6.0, 1200, 0.05, "square");
  rauschen(1.6, 6.9, 0.1, { freq: 1500, q: 0.5 });
  ton(1800, 0.3, 7.2, "sawtooth", 0.03);
}

export function ModemDemo() {
  const [zeit, setZeit] = useState(-1);
  const [getrennt, setGetrennt] = useState(false);
  const bild = useRef<number | null>(null);
  useEffect(() => () => { if (bild.current) cancelAnimationFrame(bild.current); }, []);
  const einwaehlen = () => {
    setGetrennt(false);
    einwahlTon();
    const t0 = performance.now();
    const schritt = (t: number) => {
      const s = (t - t0) / 1000;
      setZeit(Math.min(s, ENDE_EINWAHL));
      if (s < ENDE_EINWAHL) bild.current = requestAnimationFrame(schritt);
    };
    bild.current = requestAnimationFrame(schritt);
  };
  const mama = () => { rauschen(0.6, 0, 0.18); ton(480, 0.6, 0.6, "square", 0.04); setGetrennt(true); setZeit(-1); };
  const stufe = [...EINWAHL].reverse().find(e => zeit >= e.ab);
  const an: readonly string[] = stufe?.lampen ?? [];
  const verbunden = zeit >= ENDE_EINWAHL;
  const erprobt = useErprobt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (verbunden) erprobt("modem"); }, [verbunden]);
  const waehlt = zeit >= 0 && !verbunden;
  const MB = 4; // ein Handyfoto
  const dauer = (bitS: number) => { const s = (MB * 8e6) / bitS; return s >= 60 ? `${(s / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Minuten` : `${s.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Sekunden`; };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="w-64 shrink-0 rounded-xl p-3 shadow-lg" style={{ background: "linear-gradient(#e7e5e4, #a8a29e)" }} role="img" aria-label="Modem mit Lämpchen">
          <div className="text-[10px] font-black tracking-widest text-stone-700 mb-2">SPEEDMODEM 56K</div>
          <div className="flex justify-between">
            {LAMPEN.map(l => (
              <div key={l} className="flex flex-col items-center gap-1">
                <span className="w-3 h-3 rounded-full" style={{ background: an.includes(l) ? (l === "CD" || l === "HS" ? "#22c55e" : "#ef4444") : "#57534e", boxShadow: an.includes(l) ? "0 0 6px currentColor" : "none" }} />
                <span className="text-[9px] font-bold text-stone-700">{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm flex-1">
          <p className="font-bold min-h-5" aria-live="polite">{getrennt ? "📵 NO CARRIER — Verbindung weg!" : stufe ? stufe.text : "Bereit. Ton an?"}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={einwaehlen} disabled={waehlt}>📞 Einwählen</button>
            <button className="btn-secondary" onClick={mama} disabled={!verbunden}>👩 Mama nimmt das Telefon ab</button>
          </div>
          {verbunden && (
            <p className="text-xs">Ein Handyfoto ({MB} MB) laden: mit diesem Modem <b>{dauer(56_000)}</b>, mit DSL (16 Mbit/s) <b>{dauer(16e6)}</b>, mit Glasfaser (1 Gbit/s) <b>{dauer(1e9)}</b>.</p>
          )}
          <p className="text-xs text-muted">Das Modem verwandelt Daten in Töne, damit sie durchs Telefonkabel passen — und am anderen Ende zurück. Das Pfeifen und Rauschen ist die Begrüßung der beiden Geräte. Solange man online war, war das Telefon besetzt.</p>
        </div>
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
  const erprobt = useErprobt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (DINGE[wahl].bytes >= 1e11) erprobt("diskette"); }, [wahl]);
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

// ── SMS tippen: Mehrfachtippen wie 1997 oder T9 wie 2000 ──
const REIHEN = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["*", "0", "#"]];
export function SmsDemo({ an, antwortAuf }: { an?: string; antwortAuf?: string } = {}) {
  const [text, setText] = useState("");
  const [tipps, setTipps] = useState(0);
  const [t9, setT9] = useState(false);
  const [folge, setFolge] = useState(""); // T9: Tasten des Worts, das gerade entsteht
  const [wahl, setWahl] = useState(0);
  const erprobt = useErprobt();
  const letzte = useRef<{ taste: string; mal: number; zeit: number } | null>(null);
  const [cursor, setCursor] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setCursor(c => !c), 500); return () => clearInterval(t); }, []);
  const vorschlaege = t9Vorschlaege(folge);
  const wort = vorschlaege[wahl % Math.max(1, vorschlaege.length)] ?? "";
  const fertig = text + wort;
  const uebernehmen = () => { setText(t => (t + wort).slice(0, 160)); setFolge(""); setWahl(0); };
  const druecke = (taste: string) => {
    ton(1400, 0.05, 0, "square", 0.03);
    setTipps(n => n + 1);
    if (t9) {
      if (taste === "*") setWahl(w => w + 1); // nächster Vorschlag
      else if (taste === "#") { if (folge) { setFolge(f => f.slice(0, -1)); setWahl(0); } else setText(t => t.slice(0, -1)); }
      else if (taste === "0") { setText(t => (t + wort + " ").slice(0, 160)); setFolge(""); setWahl(0); if (wort && text.trim()) erprobt("sms"); }
      else if (taste === "1") { setText(t => (t + wort + ".").slice(0, 160)); setFolge(""); setWahl(0); }
      else if (fertig.length < 160) { setFolge(f => f + taste); setWahl(0); }
      return;
    }
    if (taste === "*") { setText(t => t.slice(0, -1)); letzte.current = null; return; }
    if (taste === "#") { letzte.current = null; return; }
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
  const beschriftung = (t: string) => t9
    ? (t === "*" ? "Vorschlag" : t === "#" ? "löschen" : t === "0" ? "␣" : t === "1" ? "." : TASTEN[t].replace(/\d/, ""))
    : (t === "*" ? "löschen" : t === "#" ? "weiter" : TASTEN[t].replace(/\d/, "").replace(" ", "␣"));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-56 shrink-0 rounded-[2rem] p-4 flex flex-col gap-3" style={{ background: "linear-gradient(#1e3a8a, #172554)" }}>
          <div className="rounded-lg p-2 h-28 font-mono text-sm overflow-hidden break-all" style={{ background: "#9fbc8b", color: "#1b2a12" }}>
            <div className="flex justify-between text-[10px] mb-1"><span>📶 {t9 ? "T9" : "abc"}</span><span>{160 - fertig.length}</span></div>
            {text}{wort && <span className="underline">{wort}</span>}<span className={cursor ? "" : "opacity-0"}>▌</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {REIHEN.flat().map(t => (
              <button key={t} onClick={() => druecke(t)} className="rounded-xl py-1.5 text-white font-black leading-tight active:scale-95" style={{ background: "#334155" }}>
                {t}<div className="text-[9px] font-normal opacity-80">{beschriftung(t)}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm max-w-sm">
          <div className="flex gap-2">
            <button className={`chip ${!t9 ? "chip-on" : ""}`} onClick={() => { if (folge) uebernehmen(); setT9(false); }}>Mehrfachtippen</button>
            <button className={`chip ${t9 ? "chip-on" : ""}`} onClick={() => setT9(true)}>T9</button>
          </div>
          {t9
            ? <p>Ein Druck pro Buchstabe — das Handy rät das Wort. Für »hallo«: 4-2-5-5-6. Falsches Wort? <b>*</b> zeigt den nächsten Vorschlag ({vorschlaege.length > 1 ? `${vorschlaege.length} passen: ${vorschlaege.join(", ")}` : "probier »gut« und »hut«"}). <b>0</b> = Leerzeichen.</p>
            : <p>Schreib »hdl« oder »bin gleich da« wie 1997: Für »c« dreimal die 2 drücken. Gleiche Taste noch mal? Kurz warten oder # drücken.</p>}
          <p className="text-lg font-black">{tipps} Tastendrücke für {fertig.length} Zeichen</p>
          <p className="text-xs text-muted">Darum gab es Abkürzungen: »gn8«, »hdgdl«, »lol«. T9 sparte Drücke — und machte aus »Hallo« manchmal »Gallo«, weil beide 4-2-5-5-6 sind.</p>
        </div>
      </div>
      <SendenLeiste art="sms" inhalt={() => ({ text: fertig })} bereit={fertig.trim().length > 0} an={an} antwortAuf={antwortAuf} nachSenden={() => { setText(""); setFolge(""); }} />
    </div>
  );
}
