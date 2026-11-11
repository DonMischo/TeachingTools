"use client";
/**
 * Compact Disc: Der Laser liest Pits und Lands. Eine Kante (Land ↔ Pit) ist eine 1,
 * keine Kante eine 0 (NRZI, stark vereinfacht). Ein Kratzer verschluckt Bits —
 * echte CDs reparieren das mit Fehlerkorrektur.
 */
import { useEffect, useRef, useState } from "react";
import { useErprobt } from "@/lib/medien/erprobt";

/** Text (nur A–Z, höchstens 8 Zeichen) → ASCII-Bits, 8 je Buchstabe */
export function zuBits(text: string): number[] {
  const t = text.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8);
  return Array.from(t).flatMap(ch => {
    const c = ch.charCodeAt(0);
    return Array.from({ length: 8 }, (_, i) => (c >> (7 - i)) & 1);
  });
}
/** Bits → Spur (0 = Land, 1 = Pit): jede 1 kippt den Pegel, jede 0 lässt ihn */
export function alsSpur(bits: number[]): number[] {
  let p = 0;
  return bits.map(b => { if (b) p = 1 - p; return p; });
}
/** Spur → Bits: eine Kante ist eine 1 */
export function ausSpur(spur: number[]): number[] {
  return spur.map((v, i) => (v !== (i ? spur[i - 1] : 0) ? 1 : 0));
}
/** Bits → Text (je 8 Bits ein Zeichen) */
export function alsText(bits: number[]): string {
  let s = "";
  for (let i = 0; i + 8 <= bits.length; i += 8) s += String.fromCharCode(parseInt(bits.slice(i, i + 8).join(""), 2));
  return s;
}

const CW = 18, LX = 100, TY = 82, LASER = LX + CW / 2, SENSOR = LASER + 80;

export function CdDemo() {
  const erprobt = useErprobt();
  const [text, setText] = useState("HALLO");
  const [pos, setPos] = useState(-2);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(3);
  const [kratzer, setKratzer] = useState<{ von: number; bis: number } | null>(null);
  const meldung = useRef(false);

  const bits = zuBits(text);
  const spur = alsSpur(bits);
  const n = bits.length;
  const fertig = n > 0 && pos >= n - 1;

  useEffect(() => {
    if (!laeuft) return;
    let raf = 0, last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      setPos(p => p + tempo * dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [laeuft, tempo]);

  useEffect(() => {
    if (!fertig) return;
    setLaeuft(false);
    if (!kratzer && !meldung.current) { meldung.current = true; erprobt("cd"); }
  }, [fertig, kratzer, erprobt]);

  const neu = (t = text) => { setText(t); setPos(-2); setLaeuft(false); setKratzer(null); meldung.current = false; };
  const kaputt = (i: number) => !!kratzer && i >= kratzer.von && i < kratzer.bis;
  const gelesen = Math.max(0, Math.min(n, Math.floor(pos) + 1));
  const gelesenBits = bits.slice(0, gelesen).map((b, i) => (kaputt(i) ? 1 - b : b));
  const buchstaben = Array.from({ length: n / 8 }, (_, k) => {
    const von = k * 8;
    if (gelesen < von + 8) return { z: "·", bad: false };
    const bad = Array.from({ length: 8 }, (_, i) => kaputt(von + i)).some(Boolean);
    return { z: bad ? "?" : alsText(gelesenBits.slice(von, von + 8)), bad };
  });

  const aktuell = Math.round(pos);
  const imWort = aktuell >= 0 && aktuell < n;
  const pit = imWort && spur[aktuell] === 1;
  const scratchHier = imWort && kaputt(aktuell);
  const reflex = !pit && !scratchHier;
  const von = Math.floor(pos) - 6;
  const zellen = Array.from({ length: 24 }, (_, k) => von + k).filter(i => i >= 0 && i < n);
  const xz = (i: number) => LX + (i - pos) * CW;

  return (
    <div className="card space-y-3 p-3">
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img" aria-label="Drehende CD mit Laserpunkt">
          <g transform={`rotate(${pos * 40} 60 60)`}>
            <circle cx="60" cy="60" r="54" fill="#cbd5e1" />
            <path d="M60 60 L60 6 A54 54 0 0 1 106 34 Z" fill="#a78bfa" opacity="0.55" />
            <path d="M60 60 L60 114 A54 54 0 0 1 14 86 Z" fill="#38bdf8" opacity="0.55" />
            <circle cx="60" cy="60" r="40" fill="none" stroke="#fff" strokeOpacity="0.5" strokeDasharray="2 3" />
            <circle cx="60" cy="60" r="26" fill="none" stroke="#64748b" strokeOpacity="0.4" />
          </g>
          <circle cx="60" cy="60" r="9" fill="#f1f5f9" stroke="#94a3b8" />
          <circle cx="92" cy="60" r="11" fill="none" stroke="#ef4444" strokeDasharray="3 2" />
          <circle cx="92" cy="60" r="3" fill="#ef4444" />
        </svg>

        <svg viewBox="0 0 360 150" className="w-full min-w-0" role="img" aria-label="Vergrößerte Spur unter dem Laser">
          <rect x="0" y="0" width="360" height="150" rx="8" fill="#0f172a" />
          <rect x="0" y={TY + 10} width="360" height="16" fill="#64748b" />
          <rect x="0" y={TY} width="360" height="10" fill="#e2e8f0" />
          {zellen.map(i => (
            <g key={i}>
              {spur[i] === 1 && <rect x={xz(i)} y={TY} width={CW} height="10" fill="#0f172a" />}
              <text x={xz(i) + CW / 2} y={TY + 44} textAnchor="middle" fontSize="12" fontFamily="monospace"
                fill={i <= Math.floor(pos) ? (kaputt(i) ? "#f87171" : "#fde047") : "#94a3b8"}>{bits[i]}</text>
              {bits[i] === 1 && <line x1={xz(i)} x2={xz(i)} y1={TY - 6} y2={TY + 26} stroke="#fde047" strokeWidth="1.5" strokeDasharray="2 2" />}
            </g>
          ))}
          {kratzer && (
            <g>
              <rect x={xz(kratzer.von)} y={TY - 6} width={(kratzer.bis - kratzer.von) * CW} height="36" fill="#fff" opacity="0.22" />
              {Array.from({ length: (kratzer.bis - kratzer.von) * 2 }, (_, k) => (
                <line key={k} x1={xz(kratzer.von) + k * 9} y1={TY + 28} x2={xz(kratzer.von) + k * 9 + 14} y2={TY - 8} stroke="#fff" strokeWidth="1.5" />
              ))}
            </g>
          )}
          <rect x={LASER - 12} y="4" width="24" height="14" rx="3" fill="#475569" />
          <text x={LASER} y="14" textAnchor="middle" fontSize="8" fill="#fff">Laser</text>
          <line x1={LASER} y1="18" x2={LASER} y2={TY} stroke="#ef4444" strokeWidth="4" opacity="0.35" />
          <line x1={LASER} y1="18" x2={LASER} y2={TY} stroke="#ef4444" strokeWidth="1.5" />
          <rect x={SENSOR - 14} y="4" width="28" height="14" rx="3" fill={reflex ? "#fde047" : "#334155"} />
          <text x={SENSOR} y="14" textAnchor="middle" fontSize="8" fill={reflex ? "#000" : "#fff"}>Sensor</text>
          {reflex ? (
            <line x1={LASER} y1={TY} x2={SENSOR} y2="18" stroke="#ef4444" strokeWidth="1.5" />
          ) : (
            [-50, -25, 10, 35, 60].map(a => (
              <line key={a} x1={LASER} y1={TY} x2={LASER + Math.sin(a / 57) * 40} y2={TY - Math.cos(a / 57) * 40}
                stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            ))
          )}
          <text x="350" y="40" textAnchor="end" fontSize="10" fill="#cbd5e1">{reflex ? "hell: Land" : "dunkel: Pit"}</text>
          <text x="350" y="54" textAnchor="end" fontSize="10" fill="#94a3b8">Kante = 1, keine Kante = 0</text>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          Wort (A–Z, bis 8):
          <input value={text} maxLength={8} className="w-32 rounded border border-line bg-surface px-2 py-1 font-mono uppercase"
            onChange={e => neu(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8))} />
        </label>
        <label className="flex items-center gap-2">
          Tempo
          <input type="range" min={1} max={12} step={0.5} value={tempo} onChange={e => setTempo(Number(e.target.value))} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={n === 0}
          onClick={() => { if (fertig) neu(); setLaeuft(l => !l); }}>
          {laeuft ? "⏸ Pause" : fertig ? "↺ Nochmal" : "▶ Laser starten"}
        </button>
        <button type="button" className="btn-secondary" disabled={!laeuft || !!kratzer}
          onClick={() => { const v = Math.ceil(pos) + 4; setKratzer({ von: v, bis: Math.min(n, v + 10) }); }}>
          🪨 Kratzer
        </button>
        <button type="button" className="btn-secondary" onClick={() => neu()}>Zurücksetzen</button>
      </div>

      <div className="space-y-1">
        <p className="break-all font-mono text-sm">
          {gelesenBits.length === 0 ? <span className="text-muted">Bits: noch nichts gelesen</span> : gelesenBits.map((b, i) => (
            <span key={i} className={kaputt(i) ? "text-bad" : ""}>{b}{i % 8 === 7 ? " " : ""}</span>
          ))}
        </p>
        <p className="flex gap-1 font-mono text-2xl font-bold">
          {buchstaben.map((b, i) => <span key={i} className={`w-7 rounded border border-line bg-surface-hover text-center ${b.bad ? "text-bad" : ""}`}>{b.z}</span>)}
        </p>
      </div>

      {fertig && !kratzer && <p className="text-sm text-ok">Geschafft: Der Laser hat das ganze Wort gelesen – nur aus Kanten und Nicht-Kanten.</p>}
      {fertig && kratzer && (
        <p className="text-sm text-bad">
          Der Kratzer hat Bits verschluckt – rote Ziffern, falsche Buchstaben. Echte CDs speichern zusätzliche Prüfdaten
          (Fehlerkorrektur) und rechnen verlorene Bits zurück. Deshalb überlebt dein Lieblingsalbum den Pausenhof. Drück »Nochmal« für einen sauberen Durchlauf.
        </p>
      )}
      {!fertig && (
        <p className="text-sm text-muted">
          Das Licht wird an glatten Stellen (Land) zurückgeworfen und an Löchern (Pits) gestreut. Wechselt die Helligkeit,
          liegt eine Kante unterm Laser – das ist eine 1. Jeder Buchstabe besteht aus 8 solchen Bits.
        </p>
      )}
    </div>
  );
}
