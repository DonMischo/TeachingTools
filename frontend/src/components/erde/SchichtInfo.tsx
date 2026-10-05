"use client";
import type { ReactNode } from "react";
import {
  ERDRADIUS, SCHICHTEN, profilWert, profilWertOben, schalenMasse, schalenVolumen, type Schicht,
} from "@/lib/erde/schichten";

const zahl = (x: number, stellen = 0) => x.toLocaleString("de-DE", { maximumFractionDigits: stellen, minimumFractionDigits: stellen });

/** »10²⁰« aus einem Exponenten. */
export function zehnHoch(e: number): string {
  const hoch: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  return "10" + String(Math.round(e)).split("").map(c => hoch[c] ?? c).join("");
}

const MASSE_GESAMT = schalenMasse(0, ERDRADIUS, 2000);
const VOLUMEN_GESAMT = schalenVolumen(0, ERDRADIUS);

export const ZUSTAND_STIL: Record<string, string> = {
  fest: "bg-slate-500/20 text-slate-600 dark:text-slate-300",
  plastisch: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  "flüssig": "bg-sky-500/20 text-sky-700 dark:text-sky-300",
};

function Zeile({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 border-b border-(--border) last:border-0">
      <span className="text-(--text-muted)">{k}</span>
      <span className="font-semibold text-right">{children}</span>
    </div>
  );
}

function spanne(oben: number, unten: number, stellen = 0, einheit = "") {
  const a = zahl(oben, stellen), b = zahl(unten, stellen);
  return a === b ? `${a}${einheit}` : `${a} – ${b}${einheit}`;
}

export default function SchichtInfo({ schicht }: { schicht: Schicht }) {
  const s = schicht;
  const oben = (g: Parameters<typeof profilWert>[0]) => profilWert(g, s.von + 0.01);
  const unten = (g: Parameters<typeof profilWert>[0]) => profilWertOben(g, s.bis);
  const masse = (schalenMasse(s.von, s.bis) / MASSE_GESAMT) * 100;
  const volumen = (schalenVolumen(s.von, s.bis) / VOLUMEN_GESAMT) * 100;
  const index = SCHICHTEN.indexOf(s);
  const vs0 = oben("vs"), vs1 = unten("vs");
  const visk = (oben("viskositaet") + unten("viskositaet")) / 2;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded-full border border-black/20 shrink-0" style={{ background: s.farbe }} />
        <h3 className="font-black text-lg leading-tight">{s.name}</h3>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${ZUSTAND_STIL[s.zustand]}`}>{s.zustand}</span>
      </div>
      <p>{s.beschaffenheit}</p>
      <div className="text-xs">
        <Zeile k="Tiefe">{zahl(s.von)} – {zahl(s.bis)} km {index === 0 && "(Ø Kontinent)"}</Zeile>
        <Zeile k="Dicke">{zahl(s.bis - s.von)} km</Zeile>
        <Zeile k="Temperatur">{spanne(oben("temperatur"), unten("temperatur"), 0, " °C")}</Zeile>
        <Zeile k="Druck">{spanne(oben("druck"), unten("druck"), 1, " GPa")}</Zeile>
        <Zeile k="Dichte">{spanne(oben("dichte"), unten("dichte"), 2, " g/cm³")}</Zeile>
        <Zeile k="P-Wellen">{spanne(oben("vp"), unten("vp"), 1, " km/s")}</Zeile>
        <Zeile k="S-Wellen">{vs0 === 0 && vs1 === 0 ? "keine (flüssig)" : spanne(vs0, vs1, 1, " km/s")}</Zeile>
        <Zeile k="Viskosität">≈ {zehnHoch(visk)} Pa·s</Zeile>
        <Zeile k="Anteil am Volumen">{zahl(volumen, 1)} %</Zeile>
        <Zeile k="Anteil an der Masse">{zahl(masse, 1)} %</Zeile>
      </div>
      <p><b>Gesteine:</b> {s.gesteine}</p>
      <div>
        <b>Minerale:</b>
        <div className="flex flex-wrap gap-1 mt-1">
          {s.minerale.map(m => (
            <span key={m} className="text-xs px-2 py-0.5 rounded-full border border-(--border) bg-(--bg)">{m}</span>
          ))}
        </div>
      </div>
      <p><b>Zähigkeit:</b> {s.vergleich}</p>
      {s.grenzeUnten && <p><b>Grenze unten:</b> {s.grenzeUnten}</p>}
      <p className="rounded-lg bg-(--surface-hover) px-3 py-2">💡 {s.merke}</p>
    </div>
  );
}
