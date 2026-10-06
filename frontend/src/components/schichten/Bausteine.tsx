"use client";
/** Gemeinsame Ansichten: Hex-Bild mit Schichtfarben, Feldtabelle, Signal. */
import { hex2 } from "@/lib/schichten/bytes";
import { SCHICHTEN, schicht, type Bereich, type Feld, type SchichtNr } from "@/lib/schichten/kapselung";
import type { Medium } from "@/lib/schichten/route";
import { signal } from "@/lib/schichten/signal";

export type Modell = "osi" | "tcpip";

/** Tiefe der Erklärung: von Klasse 6 bis Informatik-Profi */
export type Niveau = "einsteiger" | "fortgeschritten" | "experte";
export const NIVEAUS: { id: Niveau; icon: string; label: string; text: string }[] = [
  { id: "einsteiger", icon: "🌱", label: "Einsteiger", text: "ab Klasse 6: einfache Sprache, Bilder statt Zahlenkolonnen" },
  { id: "fortgeschritten", icon: "🔧", label: "Fortgeschritten", text: "Klasse 9/10: Kopffelder, Hex-Bild, Adressen" },
  { id: "experte", icon: "🎓", label: "Experte", text: "Oberstufe/Profi: Prüfsummen von Hand, Krypto, RFC-Details" },
];

export function schichtName(nr: SchichtNr, modell: Modell): string {
  const s = schicht(nr);
  return modell === "osi" ? `Schicht ${nr} · ${s.name}` : `${s.tcpip} (OSI ${nr} ${s.name})`;
}

export function Schichtmarke({ nr, modell }: { nr: SchichtNr; modell: Modell }) {
  const s = schicht(nr);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: s.farbe }}>
      {modell === "osi" ? `${nr} ${s.name}` : s.tcpip}
    </span>
  );
}

/** Bytes als Hex, eingefärbt nach Bereich; `markiert` hebt einen Feldbereich hervor. */
export function HexBild({ bytes, bereiche, bis = 128, markiert, versatz = 0 }: {
  bytes: Uint8Array;
  bereiche?: Bereich[];
  bis?: number;
  markiert?: { von: number; laenge: number } | null;
  versatz?: number;
}) {
  const n = Math.min(bis, bytes.length);
  const farbe = new Array<string | undefined>(n);
  const titel = new Array<string | undefined>(n);
  for (const b of bereiche ?? []) {
    for (let i = b.von; i < Math.min(n, b.von + b.laenge); i++) { farbe[i] = schicht(b.schicht).farbe; titel[i] = b.name; }
  }
  const zeilen = [];
  for (let z = 0; z < n; z += 16) {
    zeilen.push(
      <div key={z} className="flex gap-3">
        <span className="text-muted select-none w-10 text-right">{(z + versatz).toString(16).padStart(4, "0")}</span>
        <span className="flex flex-wrap gap-x-[0.45em]">
          {Array.from({ length: Math.min(16, n - z) }, (_, k) => {
            const i = z + k;
            const an = markiert && i >= markiert.von && i < markiert.von + markiert.laenge;
            return (
              <span key={i} title={titel[i]} className={`rounded-sm ${an ? "ring-2 ring-white" : ""}`}
                style={{ color: farbe[i] ?? "inherit", background: an ? `${farbe[i] ?? "#888"}55` : undefined }}>
                {hex2(bytes[i])}
              </span>
            );
          })}
        </span>
      </div>,
    );
  }
  return (
    <div className="font-mono text-xs leading-relaxed rounded-lg bg-[#060a14] text-slate-300 p-3 overflow-x-auto">
      {zeilen}
      {bytes.length > n && <div className="text-muted mt-1">… noch {(bytes.length - n).toLocaleString("de-DE")} Byte</div>}
    </div>
  );
}

export function Legende({ bereiche, modell }: { bereiche: Bereich[]; modell: Modell }) {
  const nrs = SCHICHTEN.map(s => s.nr).filter(nr => bereiche.some(b => b.schicht === nr));
  return (
    <div className="flex flex-wrap gap-1.5">
      {nrs.map(nr => <Schichtmarke key={nr} nr={nr} modell={modell} />)}
    </div>
  );
}

export function FelderTabelle({ felder, farbe, onZeige }: { felder: Feld[]; farbe: string; onZeige: (f: Feld | null) => void }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {felder.map(f => (
          <tr key={f.name} className="border-t border-line hover:bg-surface-hover cursor-default align-top"
            onMouseEnter={() => onZeige(f)} onMouseLeave={() => onZeige(null)} onClick={() => onZeige(f)}>
            <td className="py-1.5 pr-3 font-semibold whitespace-nowrap" style={{ color: farbe }}>{f.name}</td>
            <td className="py-1.5 pr-3 font-mono whitespace-nowrap">{f.wert}</td>
            <td className="py-1.5 text-muted text-xs">{f.erkl}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Bits als Signalverlauf (SVG) */
export function SignalBild({ bits, medium }: { bits: number[]; medium: Medium }) {
  const n = 16;
  const werte = signal(bits, medium, n);
  const b = 8, h = 70, mitte = 40;
  const pfad = werte.map((v, i) => `${i ? "L" : "M"}${(i * b) / n},${mitte - v * 22}`).join(" ");
  const farbe = medium === "funk" ? "#a78bfa" : medium === "kupfer" ? "#fbbf24" : "#22d3ee";
  return (
    <div className="overflow-x-auto rounded-lg bg-[#060a14] p-2">
      <svg width={bits.length * b} height={h} role="img" aria-label="Signal auf der Leitung">
        {bits.map((bit, i) => (
          <g key={i}>
            <line x1={i * b} y1={8} x2={i * b} y2={h - 4} stroke="#1e293b" />
            <text x={i * b + b / 2} y={h - 2} fontSize={7} textAnchor="middle" fill="#64748b">{bit}</text>
          </g>
        ))}
        {medium !== "funk" && medium !== "kupfer" ? (
          bits.map((bit, i) => bit ? <rect key={i} x={i * b} y={mitte - 22} width={b} height={44} fill={farbe} opacity={0.35} /> : null)
        ) : null}
        <path d={pfad} fill="none" stroke={farbe} strokeWidth={1.5} />
      </svg>
    </div>
  );
}

export function Kasten({ titel, children, farbe }: { titel: string; children: React.ReactNode; farbe?: string }) {
  return (
    <div className="card p-4 flex flex-col gap-2" style={farbe ? { borderTop: `3px solid ${farbe}` } : undefined}>
      <h3 className="font-bold">{titel}</h3>
      {children}
    </div>
  );
}

export const kb = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 2 })} MB`
    : n >= 1e3 ? `${(n / 1e3).toLocaleString("de-DE", { maximumFractionDigits: 1 })} KB`
      : `${n} Byte`;
