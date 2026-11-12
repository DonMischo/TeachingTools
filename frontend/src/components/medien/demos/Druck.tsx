"use client";
/** Mitmach-Demos: Setzkasten (Buchdruck), Chappe-Telegraf, Belichtung (Fotografie) */
import { useEffect, useRef, useState } from "react";
import { useErprobt } from "@/lib/medien/erprobt";

// ── Setzkasten ──
export function SetzkastenDemo() {
  const [wort, setWort] = useState("WISSEN");
  const [abzuege, setAbzuege] = useState(0);
  const erprobt = useErprobt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (abzuege >= 3) erprobt("setzkasten"); }, [abzuege]);
  const [druckt, setDruckt] = useState(false);
  const lettern = [...wort.toUpperCase().replace(/[^A-ZÄÖÜ0-9 !?.]/g, "")].slice(0, 12);
  const drucke = () => { setDruckt(true); window.setTimeout(() => { setDruckt(false); setAbzuege(a => a + 1); }, 700); };
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="label">Setz ein Wort:</span>
        <input className="input w-56 uppercase" value={wort} maxLength={12} onChange={e => { setWort(e.target.value); setAbzuege(0); }} />
      </label>
      <div className="grid sm:grid-cols-2 gap-4 items-center">
        <div>
          <div className="text-xs text-muted mb-1">Die Lettern im Winkelhaken (so sieht der Drucker sie):</div>
          <div className="flex flex-row-reverse justify-end gap-0.5 p-2 rounded-lg" style={{ background: "#6b7280" }}>
            {lettern.map((c, i) => (
              <span key={i} className="w-9 h-12 flex items-center justify-center text-2xl font-black rounded-sm"
                style={{ background: "linear-gradient(#d1d5db, #9ca3af)", color: "#1f2937", transform: "scaleX(-1)", fontFamily: "serif" }}>{c === " " ? "" : c}</span>
            ))}
          </div>
          <div className="text-xs text-muted mt-1">Spiegelverkehrt und von rechts nach links — beim Drucken dreht es sich um.</div>
        </div>
        <div className="relative h-28 rounded-lg border border-line bg-surface-hover overflow-hidden">
          <div className={`absolute inset-x-6 top-0 h-6 rounded-b transition-transform duration-300 ${druckt ? "translate-y-16" : ""}`} style={{ background: "#78350f" }} aria-hidden />
          <div className="absolute inset-x-4 bottom-3 h-14 rounded shadow flex items-center justify-center text-3xl font-black" style={{ background: "#fefce8", color: "#111827", fontFamily: "serif" }}>
            {abzuege > 0 ? lettern.join("") : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button className="btn-primary" onClick={drucke} disabled={druckt || !lettern.length}>🖨️ Presse runter!</button>
        <button className="btn-secondary" onClick={() => { for (let i = 0; i < 10; i++) window.setTimeout(() => setAbzuege(a => a + 1), i * 80); }} disabled={!lettern.length}>×10 drucken</button>
        <span><b>{abzuege}</b> gleiche Abzüge</span>
        {abzuege > 0 && <span className="text-muted">— ein Mönch hätte für so viele Seiten etwa {Math.max(1, Math.round(abzuege / 2))} {abzuege < 4 ? "Tag" : "Tage"} gebraucht.</span>}
      </div>
    </div>
  );
}

// ── Chappe-Telegraf ──
/** Ein paar Einträge aus einem erfundenen Codebuch */
const CODEBUCH: Record<number, string> = {
  1: "Sieg!", 2: "Feind in Sicht", 3: "Nebel — Pause", 4: "Nachricht wiederholen", 5: "Verstanden",
  7: "Kaiser kommt", 12: "Brücke gesperrt", 17: "Pferde füttern", 23: "Es regnet", 42: "Mittagspause", 66: "Bitte Fernrohr putzen", 98: "Ende der Nachricht",
};
const winkel = (pos: number) => pos * 45; // 0 … 7 · 45°, 7 Stellungen benutzt (die achte verdeckt den Balken)

export function ChappeDemo() {
  const [balken, setBalken] = useState<0 | 1>(0);
  const erprobt = useErprobt();
  const [gestellt, setGestellt] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (gestellt >= 5) erprobt("chappe"); }, [gestellt]);
  const [links, setLinks] = useState(1);
  const [rechts, setRechts] = useState(1);
  // 7 × 7 × 2 = 98 Stellungen
  const nr = balken * 49 + (links - 1) * 7 + rechts;
  const dreh = (v: number) => (v % 7) + 1;
  const bw = balken === 0 ? 0 : 90;
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <svg viewBox="-110 -110 220 230" className="w-56 shrink-0 rounded-xl" role="img" aria-label={`Telegraf in Stellung ${nr}`}>
        <rect x="-110" y="-110" width="220" height="230" fill="#bae6fd" />
        <rect x="-4" y="0" width="8" height="100" fill="#a8a29e" />
        <rect x="-40" y="96" width="80" height="24" fill="#d6d3d1" stroke="#78716c" />
        <g transform={`rotate(${bw})`}>
          <rect x="-70" y="-6" width="140" height="12" rx="2" fill="#1c1917" />
          <g transform={`translate(-70 0) rotate(${winkel(links) + 180})`}><rect x="0" y="-4" width="42" height="8" rx="2" fill="#44403c" /></g>
          <g transform={`translate(70 0) rotate(${winkel(rechts)})`}><rect x="0" y="-4" width="42" height="8" rx="2" fill="#44403c" /></g>
        </g>
        <circle r="5" fill="#fbbf24" />
      </svg>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => { setBalken(b => (b ? 0 : 1)); setGestellt(n => n + 1); }}>↻ Balken</button>
          <button className="btn-secondary" onClick={() => { setLinks(dreh); setGestellt(n => n + 1); }}>↻ linker Arm</button>
          <button className="btn-secondary" onClick={() => { setRechts(dreh); setGestellt(n => n + 1); }}>↻ rechter Arm</button>
        </div>
        <p className="text-lg font-black">Stellung Nr. {nr} von 98</p>
        <p>Codebuch: <b>{CODEBUCH[nr] ?? "— (im Buch nachschlagen)"}</b></p>
        <p className="text-xs text-muted max-w-xs">Chappe benutzte zwei Stellungen nacheinander: Seite und Zeile im Codebuch. So bedeuteten zwei Signale ein ganzes Wort oder einen Satz — Kompression schon 1794. Die Einträge hier sind erfunden; probier 42.</p>
      </div>
    </div>
  );
}

// ── Belichtung: stillhalten! ──
const DAUER = 5;
export function BelichtungDemo() {
  const [laeuft, setLaeuft] = useState(false);
  const [rest, setRest] = useState(DAUER);
  const [wackler, setWackler] = useState<number | null>(null);
  const erprobt = useErprobt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (wackler !== null && wackler < 30) erprobt("belichtung"); }, [wackler]);
  const weg = useRef(0), letzte = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!laeuft) return;
    const t = window.setInterval(() => setRest(r => {
      if (r <= 1) { setLaeuft(false); setWackler(weg.current); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [laeuft]);
  // Der Auslöser liegt im Bild: Wer klickt, hat die Maus schon dort, wo sie stillhalten muss
  const start = (e: React.MouseEvent) => { weg.current = 0; letzte.current = { x: e.clientX, y: e.clientY }; setWackler(null); setRest(DAUER); setLaeuft(true); };
  const bewege = (e: React.PointerEvent) => {
    if (!laeuft) return;
    const p = { x: e.clientX, y: e.clientY };
    if (letzte.current) weg.current += Math.hypot(p.x - letzte.current.x, p.y - letzte.current.y);
    letzte.current = p;
  };
  const unschaerfe = wackler === null ? 0 : Math.min(14, wackler / 25);
  const urteil = wackler === null ? "" : wackler < 30 ? "Gestochen scharf! Du wärst der Star im Fotostudio von 1840." : wackler < 200 ? "Ein bisschen verwackelt — die Oma auf dem Foto sieht aus wie ein Gespenst." : "Total verwischt. Du bist jetzt offiziell ein Geist auf einer Daguerreotypie.";
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <div onPointerMove={bewege} className="relative w-56 h-56 rounded-xl overflow-hidden border-4 shrink-0 flex items-center justify-center touch-none select-none"
        style={{ borderColor: "#78350f", background: "#e7d8b8", cursor: laeuft ? "none" : "default" }}>
        {laeuft ? (
          <div className="text-center"><div className="text-5xl font-black">{rest}</div><div className="text-sm">Maus im Bild — nicht bewegen!</div></div>
        ) : (
          <>
            <span className="text-8xl" style={{ filter: `blur(${unschaerfe}px) sepia(1)`, opacity: wackler === null ? 0.25 : 1 }}>🧑‍🎩</span>
            <button className="btn-primary absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg whitespace-nowrap" onClick={start}>📷 Deckel ab!</button>
          </>
        )}
      </div>
      <div className="flex flex-col gap-2 text-sm max-w-sm">
        <p>Um 1840 dauerte ein Porträt bis zu einer Minute. Hier nur {DAUER} Sekunden: Klick im Bild auf <b>»Deckel ab!«</b> und halte die Maus (oder den Finger) genau dort <b>absolut still</b>.</p>
        {urteil && <p className="font-bold">{urteil}</p>}
        <p className="text-xs text-muted">Fotografen hatten dafür Kopfhalter aus Eisen hinter dem Stuhl. Lächeln? Eine Minute lang? Keine Chance.</p>
      </div>
    </div>
  );
}
