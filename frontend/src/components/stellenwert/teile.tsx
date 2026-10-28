"use client";
/**
 * Bauteile der Stellenwerttafeln: die farbige Tafel selbst (mit Ziffern oder
 * Plättchen, auf Wunsch mit Knöpfen) und »dieselbe Zahl in drei Systemen«.
 * Farben: im Zehnersystem je Dreiergruppe eine, im Sechzehnersystem je Stelle
 * eine — und die vier Bits einer Hex-Ziffer tragen deren Farbe.
 */
import type { ReactNode } from "react";
import { HEX_FARBEN, INDEX, paeckchen, schreibe, spalten, ziffer, ziffernVon, type Basis } from "@/lib/stellenwert";

export type Knoepfe = {
  plus: (exp: number) => void;
  minus: (exp: number) => void;
  buendeln: (exp: number) => void;
  entbuendeln: (exp: number) => void;
};

function Plaettchen({ anzahl, farbe, basis }: { anzahl: number; farbe: string; basis: Basis }) {
  const zeigen = Math.min(anzahl, 20);
  return (
    <div className="grid grid-cols-5 gap-[3px] place-items-center min-h-[3.25rem] content-start" aria-hidden>
      {Array.from({ length: zeigen }, (_, i) => (
        <span key={i} className="block size-3 rounded-full shadow-sm"
          style={{ background: farbe, outline: i >= basis - 1 && anzahl >= basis ? "2px solid var(--red)" : undefined }} />
      ))}
      {anzahl > zeigen && <span className="col-span-5 text-[10px] font-bold">+{anzahl - zeigen}</span>}
    </div>
  );
}

/** Die Tafel: eine Spalte je Stellenwert, links der größte. */
export function TafelAnsicht({ basis, maxExp, minExp = 0, werte, art = "ziffern", luecken = false, blitz = [], knoepfe, auto = true }: {
  basis: Basis; maxExp: number; minExp?: number; werte: Record<number, number>;
  art?: "ziffern" | "plaettchen";
  /** leere Spalten frei lassen statt 0 zu zeigen (Ablese-Aufgaben) */
  luecken?: boolean;
  blitz?: number[];
  knoepfe?: Knoepfe;
  /** beim automatischen Bündeln braucht es keine Bündel-Knöpfe */
  auto?: boolean;
}) {
  const sp = spalten(basis, maxExp, minExp);
  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex rounded-xl overflow-hidden border-2 border-line" role="group" aria-label="Stellenwerttafel">
        {sp.map(s => {
          const n = werte[s.exp] ?? 0;
          const voll = n >= basis;
          const leuchtet = blitz.includes(s.exp);
          return (
            <div key={s.exp} role="group" aria-label={s.name} className={`flex flex-col ${knoepfe && !auto ? "w-[4.75rem]" : "w-14 sm:w-16"} ${s.exp === -1 ? "border-l-4" : "border-l"} first:border-l-0`}
              style={{ borderLeftColor: s.exp === -1 ? "var(--text)" : s.farbe + "55" }}>
              <div className="text-center px-1 py-1 text-white" style={{ background: s.farbe }} title={s.name}>
                <div className="font-black text-sm leading-tight">{s.kurz}</div>
                <div className="text-[10px] opacity-90 leading-tight">{basis === 10 && s.exp < 6 ? s.wert : s.potenz}</div>
              </div>
              <div className={`flex-1 flex flex-col items-center justify-center p-1.5 transition-colors duration-300 ${voll ? "ring-2 ring-inset ring-bad" : ""}`}
                style={{ background: leuchtet ? s.farbe + "66" : s.farbe + "1a", minHeight: art === "plaettchen" ? "4.5rem" : "3.25rem" }}
                aria-label={`${s.name}: ${n}`}>
                {art === "plaettchen"
                  ? <Plaettchen anzahl={n} farbe={s.farbe} basis={basis} />
                  : <span className={`font-mono font-black text-2xl ${voll ? "text-bad" : ""}`}>
                      {luecken && !n ? "" : n < basis ? ziffer(n) : n}
                    </span>}
                {art === "plaettchen" && <span className={`text-xs font-bold ${voll ? "text-bad" : "text-muted"}`}>{n}</span>}
              </div>
              {knoepfe && (
                <div className="flex flex-col gap-0.5 p-1 bg-surface border-t border-line">
                  <div className="flex gap-0.5">
                    <button className="flex-1 rounded bg-page hover:bg-surface-hover font-black" aria-label={`${s.name} plus eins`} onClick={() => knoepfe.plus(s.exp)}>+</button>
                    <button className="flex-1 rounded bg-page hover:bg-surface-hover font-black" aria-label={`${s.name} minus eins`} onClick={() => knoepfe.minus(s.exp)}>−</button>
                  </div>
                  {!auto && (
                    <>
                      <button className="rounded text-[10px] font-bold py-0.5 disabled:opacity-30 text-white" style={{ background: voll && s.exp < maxExp ? "var(--red)" : "#6b7280" }}
                        disabled={!voll || s.exp >= maxExp} title={`${basis} Plättchen zu einem in der Spalte links bündeln`}
                        aria-label={`${s.name} bündeln`} onClick={() => knoepfe.buendeln(s.exp)}>⬅ bündeln</button>
                      <button className="rounded text-[10px] font-bold py-0.5 bg-page hover:bg-surface-hover disabled:opacity-30"
                        disabled={!n || s.exp <= minExp} title={`1 Plättchen in ${basis} der Spalte rechts tauschen`}
                        aria-label={`${s.name} entbündeln`} onClick={() => knoepfe.entbuendeln(s.exp)}>entbündeln ➡</button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Binärzahl mit gefärbten Vierer-Päckchen; die passende Hex-Ziffer trägt dieselbe Farbe. */
export function BitsFarbig({ n, hexStellen }: { n: number; hexStellen: number }) {
  const p = paeckchen(n, hexStellen);
  return (
    <span className="font-mono font-black inline-flex flex-wrap gap-x-2">
      {p.map((x, i) => (
        <span key={i} style={{ color: HEX_FARBEN[(p.length - 1 - i) % HEX_FARBEN.length] }}>{x.bits.join("")}</span>
      ))}
    </span>
  );
}

export function HexFarbig({ n, stellen = 1 }: { n: number; stellen?: number }) {
  const z = ziffernVon(n, 16, stellen);
  return (
    <span className="font-mono font-black">
      {z.map((d, i) => <span key={i} style={{ color: HEX_FARBEN[(z.length - 1 - i) % HEX_FARBEN.length] }}>{ziffer(d)}</span>)}
    </span>
  );
}

function Zeile({ icon, name, children, basis }: { icon: string; name: string; children: ReactNode; basis: Basis }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="w-36 shrink-0 text-sm text-muted">{icon} {name}</span>
      <span className="text-xl">{children}</span><span className="text-sm text-muted">{INDEX[basis]}</span>
    </div>
  );
}

/** Dieselbe ganze Zahl im Zehner-, Zweier- und Sechzehnersystem. */
export function DreiSysteme({ n }: { n: number }) {
  const hexStellen = Math.max(1, ziffernVon(n, 16).length);
  return (
    <div className="flex flex-col gap-1.5">
      <Zeile icon="🔟" name="Zehnersystem" basis={10}><span className="font-mono font-black">{schreibe(n, 10)}</span></Zeile>
      <Zeile icon="💡" name="Zweiersystem" basis={2}><BitsFarbig n={n} hexStellen={hexStellen} /></Zeile>
      <Zeile icon="🔣" name="Sechzehnersystem" basis={16}><HexFarbig n={n} stellen={hexStellen} /></Zeile>
    </div>
  );
}

/**
 * Zählwerk wie am Kilometerzähler: je Stelle eine Walze. Springt eine Stelle
 * über, dreht die nächste links ein wenig später — so sieht man den Übertrag
 * von rechts nach links wandern.
 */
export function ZaehlwerkAnzeige({ n, basis, stellen, gross = false, beschriftet = false }: {
  n: number; basis: Basis; stellen: number; gross?: boolean;
  /** über jeder Walze ihr Stellenwert (E, Z, H, T …) */
  beschriftet?: boolean;
}) {
  const z = ziffernVon(n, basis, stellen).slice(-stellen);
  const h = gross ? 3.5 : 2.5;
  return (
    <div className="inline-flex gap-1 p-2 rounded-xl bg-neutral-900 shadow-inner" role="img" aria-label={`Zählwerk zeigt ${z.map(ziffer).join("")}`}>
      {z.map((d, i) => {
        const exp = z.length - 1 - i;
        const s = spalten(basis, exp, exp)[0];
        return (
          <div key={exp} className="flex flex-col items-center gap-1">
            {beschriftet && <span className="text-xs font-black leading-none" style={{ color: s.farbe }}>{s.kurz}</span>}
            <div className="relative overflow-hidden rounded-md" style={{ height: `${h}rem`, width: `${h * 0.72}rem`, background: s.farbe }}>
              <div className="flex flex-col transition-transform duration-500 ease-out"
                style={{ transform: `translateY(-${d * h}rem)`, transitionDelay: `${exp * 140}ms` }}>
                {Array.from({ length: basis }, (_, k) => (
                  <span key={k} className="flex items-center justify-center font-mono font-black text-white"
                    style={{ height: `${h}rem`, fontSize: `${h * 0.6}rem` }}>{ziffer(k)}</span>
                ))}
              </div>
              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(#0006, transparent 30%, transparent 70%, #0006)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
