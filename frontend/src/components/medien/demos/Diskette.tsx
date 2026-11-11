"use client";
/**
 * Diskettenlaufwerk: eine 3,5-Zoll-Diskette in die Hand nehmen (Metallschieber,
 * Schreibschutz, Etikett), ins Laufwerk schieben, Dateien speichern — und
 * darunter der Rechner »Wie viele Disketten?«.
 */
import { useEffect, useRef, useState } from "react";
import bilder from "@/lib/medien/demo-bilder.json";
import { fsk, rauschen, ton } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";
import { DisketteDemo } from "./Modern";

const NACHWEISE = bilder as Record<string, { datei: string; titel: string; urheber: string; lizenz: string; quelle: string }>;
const TON = NACHWEISE.diskette_laufwerk;
const SCHRIFT = "'Segoe Script','Bradley Hand','Comic Sans MS',cursive";
const GESAMT = 1440; // KB
const SCHIEBER_MAX = 26;
const TEMPO = 24; // KB/s — wie ein echtes Laufwerk, nur schneller gespult
const DATEIEN = [
  { name: "HAUSAUF.DOC", kb: 85 },
  { name: "BILD.BMP", kb: 240 },
  { name: "TEXT.TXT", kb: 12 },
];

type Datei = { name: string; kb: number };
const kommaKb = (n: number) => n.toLocaleString("de-DE");

function klack() { ton(220, 0.05, 0, "square", 0.08); rauschen(0.04, 0, 0.12, { freq: 2500 }); }

/** Lesegeräusch: echte Aufnahme von Commons, sonst synthetisch */
function laufwerkTon(dauer: number) {
  const synth = () => { fsk([90, 140, 200], dauer, 0, 30, 0.04, "sawtooth"); rauschen(dauer, 0, 0.04, { freq: 1500, q: 3 }); };
  try {
    if (typeof Audio === "undefined" || !TON) return synth();
    const a = new Audio(TON.datei);
    a.volume = 0.5;
    const stop = setTimeout(() => a.pause(), dauer * 1000);
    void a.play()?.catch?.(() => { clearTimeout(stop); synth(); });
  } catch { synth(); }
}

export function DisketteStationDemo() {
  const erprobt = useErprobt();
  const [schieber, setSchieber] = useState(0);
  const [loslassen, setLoslassen] = useState(false);
  const [schutz, setSchutz] = useState(false);
  const [titel, setTitel] = useState("Mathe 9b");
  const [drin, setDrin] = useState(false);
  const [zug, setZug] = useState({ x: 0, y: 0, aktiv: false });
  const [led, setLed] = useState<"aus" | "gruen" | "rot">("aus");
  const [dateien, setDateien] = useState<Datei[]>([{ name: "README.TXT", kb: 3 }, { name: "SPIEL.EXE", kb: 188 }]);
  const [wahl, setWahl] = useState(0);
  const [fortschritt, setFortschritt] = useState<{ kb: number; ziel: Datei } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const schieberStart = useRef<{ x: number; v: number } | null>(null);
  const zugStart = useRef<{ x: number; y: number } | null>(null);
  const lesen = useRef<ReturnType<typeof setTimeout> | null>(null);

  const belegt = dateien.reduce((s, d) => s + d.kb, 0);
  const schreibt = fortschritt !== null;

  useEffect(() => {
    if (!fortschritt) return;
    const id = setInterval(() => {
      setFortschritt(f => {
        if (!f) return f;
        const kb = Math.min(f.ziel.kb, f.kb + TEMPO / 10);
        return { ...f, kb };
      });
    }, 100);
    return () => clearInterval(id);
  }, [schreibt]); // eslint-disable-line react-hooks/exhaustive-deps

  const fertigName = fortschritt && fortschritt.kb >= fortschritt.ziel.kb ? fortschritt.ziel : null;
  useEffect(() => {
    if (!fertigName) return;
    setDateien(d => [...d.filter(x => x.name !== fertigName.name), fertigName]);
    setFortschritt(null); setLed("aus"); setGespeichert(true);
    ton(880, 0.12, 0, "sine", 0.08);
    erprobt("diskettenlaufwerk");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fertigName]);
  useEffect(() => () => { if (lesen.current) clearTimeout(lesen.current); }, []);

  // ── Metallschieber: ziehen, beim Loslassen schnappt die Feder zurück ──
  const schieberDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    schieberStart.current = { x: e.clientX, v: schieber };
    setLoslassen(false);
  };
  const schieberMove = (e: React.PointerEvent) => {
    const s = schieberStart.current;
    if (!s) return;
    const neu = Math.max(0, Math.min(SCHIEBER_MAX, s.v + (e.clientX - s.x) * (200 / ((e.currentTarget as SVGGElement).ownerSVGElement?.getBoundingClientRect().width || 200))));
    if (schieber < 8 && neu >= 8) klack();
    setSchieber(neu);
  };
  const schieberUp = () => {
    if (!schieberStart.current) return;
    schieberStart.current = null;
    setLoslassen(true); setSchieber(0);
    klack();
  };

  // ── Diskette ziehen oder per Knopf einlegen ──
  const einlegen = () => {
    if (drin) return;
    setDrin(true); setZug({ x: 0, y: 0, aktiv: false });
    setFehler(null); setGespeichert(false);
    setTimeout(klack, 450);
    setLed("gruen");
    laufwerkTon(2.2);
    lesen.current = setTimeout(() => setLed(l => (l === "gruen" && !schreibt ? "aus" : l)), 2400);
  };
  const auswerfen = () => {
    if (!drin || schreibt) return;
    setDrin(false); setLed("aus"); setFehler(null);
    ton(300, 0.08, 0, "square", 0.08); klack();
  };
  const zugDown = (e: React.PointerEvent) => {
    if (drin) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    zugStart.current = { x: e.clientX, y: e.clientY };
    setZug({ x: 0, y: 0, aktiv: true });
  };
  const zugMove = (e: React.PointerEvent) => {
    const s = zugStart.current;
    if (s) setZug({ x: e.clientX - s.x, y: e.clientY - s.y, aktiv: true });
  };
  const zugUp = () => {
    if (!zugStart.current) return;
    zugStart.current = null;
    if (zug.y > 70) einlegen(); else setZug({ x: 0, y: 0, aktiv: false });
  };

  const speichern = () => {
    if (!drin || schreibt) return;
    const ziel = DATEIEN[wahl];
    setGespeichert(false);
    if (schutz) { setFehler("Diskette ist schreibgeschützt"); ton(200, 0.25, 0, "square", 0.1); return; }
    if (belegt + ziel.kb > GESAMT) { setFehler("Nicht genug Platz auf der Diskette"); return; }
    setFehler(null); setLed("rot");
    laufwerkTon(Math.max(2, ziel.kb / TEMPO));
    setFortschritt({ kb: 0, ziel });
  };

  const disk = (
    <svg viewBox="0 0 200 200" className="w-40 h-40 block select-none" role="img" aria-label="3,5-Zoll-Diskette">
      <path d="M 4 4 H 176 L 196 24 V 196 H 4 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
      {/* Metallschieber (ziehbar) */}
      <g style={{ transform: `translateX(${schieber}px)`, transition: loslassen ? "transform .18s cubic-bezier(.3,1.8,.5,1)" : "none", cursor: "ew-resize", touchAction: "none" }}
        data-testid="schieber" onPointerDown={schieberDown} onPointerMove={schieberMove} onPointerUp={schieberUp} onPointerCancel={schieberUp}>
        <rect x="52" y="4" width="76" height="62" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
        <rect x="96" y="12" width="20" height="46" rx="2" fill="#475569" />
        <rect x="58" y="8" width="8" height="54" fill="#e2e8f0" opacity=".7" />
      </g>
      {/* Etikett */}
      <rect x="22" y="104" width="148" height="86" rx="3" fill="#fefce8" stroke="#a8a29e" />
      <line x1="30" y1="142" x2="162" y2="142" stroke="#bae6fd" /><line x1="30" y1="162" x2="162" y2="162" stroke="#bae6fd" />
      <rect x="22" y="104" width="148" height="14" fill="#ef4444" />
      <text x="30" y="136" fontSize="19" fill="#1d4ed8" style={{ fontFamily: SCHRIFT }}>{titel}</text>
      {/* Schreibschutz-Schieber: Loch offen = geschützt */}
      <rect x="156" y="172" width="30" height="22" fill="#0f172a" stroke="#475569" />
      <g onClick={(e) => { e.stopPropagation(); setSchutz(s => !s); ton(400, 0.04, 0, "square", 0.06); }} style={{ cursor: "pointer" }} data-testid="schutz" role="button" aria-label="Schreibschutz umschalten">
        <rect x="156" y="172" width="30" height="22" fill={schutz ? "#020617" : "#0f172a"} opacity="0.01" />
        {schutz ? <rect x="161" y="176" width="20" height="14" fill="#f8fafc" /> : <rect x="161" y="182" width="20" height="10" rx="1" fill="#f97316" />}
      </g>
    </svg>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted">Die Diskette (Schieber ziehen — die Feder holt ihn zurück)</span>
          <div className="h-44 grid place-items-center">
            {!drin ? (
              <div style={{ transform: `translate(${zug.x}px, ${zug.y}px)`, transition: zug.aktiv ? "none" : "transform .25s", touchAction: "none", cursor: "grab" }}
                onPointerDown={zugDown} onPointerMove={zugMove} onPointerUp={zugUp} onPointerCancel={zugUp} data-testid="diskette">{disk}</div>
            ) : <span className="text-sm text-muted border-2 border-dashed border-line rounded p-8">steckt im Laufwerk</span>}
          </div>
          <span className="text-xs text-muted">Schreibschutz: {schutz ? "Loch offen — nur lesen" : "Loch zu — beschreibbar"} (Klick auf die Ecke unten rechts)</span>
          <input className="border border-line rounded px-2 py-1 bg-surface w-40 text-sm" value={titel} maxLength={14} onChange={e => setTitel(e.target.value)} aria-label="Etikett beschriften" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted">PC-Frontplatte mit 3,5-Zoll-Laufwerk (Diskette nach unten ins Laufwerk ziehen)</span>
          <div className="rounded-lg bg-stone-300 border-2 border-stone-500 p-3 flex flex-col gap-2">
            <div className="relative h-20 rounded bg-stone-200 border border-stone-500 overflow-hidden">
              <div className="absolute left-1/2 -translate-x-1/2 top-9 h-2 w-40 rounded bg-black" aria-hidden />
              <div className="absolute left-1/2 -translate-x-1/2 w-40 h-40 origin-top" style={{ top: 36, transform: `translateX(-50%) translateY(${drin ? "-130px" : "20px"})`, transition: "transform .5s ease-in", opacity: drin ? 1 : 0 }} aria-hidden>
                <div className="w-40 h-40 rounded-b bg-slate-800" />
              </div>
              <div className="absolute right-2 top-2 flex items-center gap-1 text-[10px]">
                <span className="h-3 w-3 rounded-full border border-stone-600" data-testid="led" data-led={led}
                  style={{ background: led === "gruen" ? "#22c55e" : led === "rot" ? "#ef4444" : "#57534e", boxShadow: led === "aus" ? "none" : `0 0 8px ${led === "gruen" ? "#22c55e" : "#ef4444"}` }} />
              </div>
              <button className="absolute left-2 bottom-1 w-8 h-3 rounded-sm bg-stone-500 text-[8px] text-white" onClick={auswerfen} aria-label="Auswurftaste" disabled={!drin || schreibt} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={einlegen} disabled={drin}>💾 Einlegen</button>
              <button className="btn-secondary" onClick={auswerfen} disabled={!drin || schreibt}>⏏️ Auswerfen</button>
            </div>
          </div>
          <div className="rounded bg-black text-green-400 p-3 font-mono text-xs min-h-28" aria-live="polite">
            {drin ? (
              <>
                <div>{"A:\\>DIR"}</div>
                <div>Datenträger in Laufwerk A: {titel.toUpperCase() || "OHNE NAME"}</div>
                {dateien.map(d => <div key={d.name}>{d.name.padEnd(14, "\u00a0")}{kommaKb(d.kb).padStart(6, "\u00a0")} KB</div>)}
                <div>{dateien.length} Datei(en), {kommaKb(belegt)} KB belegt</div>
                <div>{kommaKb(GESAMT - belegt)} KB frei von {(GESAMT / 1000).toLocaleString("de-DE", { minimumFractionDigits: 2 })} MB</div>
              </>
            ) : <div>{"Kein Datenträger in Laufwerk A:"}</div>}
          </div>
          {drin && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {DATEIEN.map((d, i) => <button key={d.name} className={`chip ${wahl === i ? "chip-on" : ""}`} onClick={() => setWahl(i)} disabled={schreibt}>{d.name} ({d.kb} KB)</button>)}
                <button className="btn-primary" onClick={speichern} disabled={schreibt}>💾 Speichern</button>
              </div>
              {fortschritt && (
                <div>
                  <div className="h-3 rounded bg-surface border border-line overflow-hidden" role="progressbar" aria-valuenow={Math.round(fortschritt.kb)} aria-valuemin={0} aria-valuemax={fortschritt.ziel.kb}>
                    <div className="h-full bg-ok" style={{ width: `${(fortschritt.kb / fortschritt.ziel.kb) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted">{fortschritt.ziel.name}: {Math.round(fortschritt.kb)} von {fortschritt.ziel.kb} KB — {TEMPO} KB/s (hier fünfmal schneller als echt!)</span>
                </div>
              )}
              {gespeichert && <p className="text-sm font-bold text-ok">Gespeichert! Die Datei steht jetzt im Verzeichnis.</p>}
            </div>
          )}
          {fehler && (
            <div role="alert" className="card p-3 border-2 border-bad text-sm flex items-center justify-between gap-2">
              <span>⛔ {fehler}</span>
              <button className="btn-secondary" onClick={() => setFehler(null)}>OK</button>
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted">Ton: {TON?.titel.replace(/[.]\w+$/, "")} — {TON?.urheber}, {TON?.lizenz} (Wikimedia Commons)</p>
      <DisketteDemo />
    </div>
  );
}
