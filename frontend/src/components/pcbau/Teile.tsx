"use client";
/** Bausteine der PC-Werkstatt: Vorschaubild, Infokarte, Entscheidungs-Dialog, Bildschirm und Piepen. */
import { useEffect, useState } from "react";
import type { Frage, Kabel, Teil } from "@/lib/pcbau/typen";
import { KATEGORIEN } from "./Ansichten";
import { Zeichnung } from "./zeichnungen";

export function Vorschau({ t, className = "w-16 h-12" }: { t: Teil; className?: string }) {
  const { w, h } = t.rect;
  const rand = Math.max(w, h) * .08;
  return (
    <svg viewBox={`${-rand} ${-rand} ${w + 2 * rand} ${h + 2 * rand}`} className={className} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <Zeichnung name={t.zeichnung} w={w} h={h} />
    </svg>
  );
}

export function KabelSymbol({ k }: { k: Kabel }) {
  const farbe = { strom: "#111827", sata: "#dc2626", flach: "#a8a29e", "dünn": "#6b7280", hdmi: "#111318", usb: "#9ca3af", usbc: "#e2e8f0", lan: "#3b82f6" }[k.stil];
  return (
    <svg viewBox="0 0 64 40" className="w-16 h-10" aria-hidden>
      <path d="M8 30 C 22 4, 42 36, 56 10" stroke={farbe} strokeWidth={k.stil === "flach" ? 9 : 5} fill="none" strokeLinecap="round" />
      {k.stil === "flach" && <path d="M8 30 C 22 4, 42 36, 56 10" stroke="#dc2626" strokeWidth={1.5} fill="none" transform="translate(-3 -3)" />}
      <rect x={1} y={25} width={12} height={10} rx={2} fill="#374151" />
      <rect x={51} y={5} width={12} height={10} rx={2} fill="#374151" />
    </svg>
  );
}

export function KategorieChip({ t }: { t: Teil }) {
  const k = KATEGORIEN[t.kategorie];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `${k.farbe}22`, color: k.farbe }}>
      {k.icon} {k.name}
    </span>
  );
}

export function FrageDialog({ titel, frage, onAntwort, onAbbruch }: { titel: string; frage: Frage; onAntwort: (i: number) => void; onAbbruch: () => void }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-black/55 rounded-2xl p-4" role="dialog" aria-label={frage.frage}>
      <div className="card p-5 max-w-lg w-full shadow-2xl">
        <div className="text-xs font-bold text-muted uppercase tracking-wide">{titel}</div>
        <h3 className="text-lg font-black mt-1 mb-3">🤔 {frage.frage}</h3>
        <div className="grid gap-2">
          {frage.optionen.map((o, i) => (
            <button key={i} className="btn btn-secondary text-left justify-start whitespace-normal" onClick={() => onAntwort(i)}>{o.text}</button>
          ))}
        </div>
        <button className="text-sm text-muted mt-3 hover:text-fg" onClick={onAbbruch}>Abbrechen</button>
      </div>
    </div>
  );
}

/** Bildschirmtext Zeile für Zeile, wie beim Hochfahren. */
export function Bildschirm({ zeilen, farbe = "#a3e635" }: { zeilen: string[]; farbe?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = setInterval(() => setN(x => (x >= zeilen.length ? x : x + 1)), 260);
    return () => clearInterval(t);
  }, [zeilen]);
  return (
    <div className="rounded-xl p-4 font-mono text-sm leading-relaxed min-h-36 border-8 border-[#1f2328]" style={{ background: "#05070a", color: farbe, textShadow: `0 0 6px ${farbe}66` }}>
      {zeilen.slice(0, n).map((z, i) => <div key={i} className="whitespace-pre">{z || " "}</div>)}
      {n < zeilen.length && <span className="animate-pulse">▌</span>}
    </div>
  );
}

/** Piepcode abspielen: L = lang, K = kurz. */
export function piepen(code: string) {
  const AC = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!AC) return;
  try {
    const ctx = new AC();
    let t = ctx.currentTime + .05;
    for (const c of code.split(" ")) {
      const dauer = c === "L" ? .6 : .16;
      const o = ctx.createOscillator();
      const v = ctx.createGain();
      o.type = "square";
      o.frequency.value = 880;
      v.gain.value = .05;
      o.connect(v).connect(ctx.destination);
      o.start(t);
      o.stop(t + dauer);
      t += dauer + .18;
    }
    setTimeout(() => ctx.close(), (t - ctx.currentTime + .5) * 1000);
  } catch { /* ohne Ton geht es auch */ }
}

export const PiepAnzeige = ({ code }: { code: string }) => (
  <span className="inline-flex items-center gap-1 align-middle" aria-label={`Piepcode ${code}`}>
    {code.split(" ").map((c, i) => <span key={i} className="inline-block h-2 rounded-full bg-current" style={{ width: c === "L" ? 22 : 7 }} />)}
  </span>
);
