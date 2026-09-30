"use client";
/**
 * Der Rechenweg einer Runde, Schritt für Schritt.
 *
 * Oben die Schritte (Haushalt → Investitionen → Wirkungsgefüge → Eigendynamik
 * → Trägheit → Bevölkerung → Ereignisse → Wahl → Lebensqualität). Zu jedem
 * Schritt: was sich wodurch verändert hat, mit Quelle, und im Wirkungsnetz
 * leuchten die Pfeile, die gewirkt haben. Darunter lässt sich eine einzelne
 * Größe als Wasserfall durch die ganze Runde verfolgen.
 */
import { useMemo, useState, type ReactNode } from "react";
import { BEREICH } from "@/lib/leviathan/bereiche";
import { STARTJAHR } from "@/lib/leviathan/motor";
import { KNOTEN_INFO, type Knoten } from "@/lib/leviathan/netz";
import { GROESSEN, HOCH_SCHLECHT, type Beitrag, type Groesse, type Rechnung, type Zustand } from "@/lib/leviathan/typen";
import { QuelleLink } from "./ui";
import Wirkungsnetz from "./Wirkungsnetz";

const ICON: Record<string, string> = {
  budget: "🪙", investition: "🎛️", wirkung: "🕸️", eigen: "🌀", traegheit: "🧱",
  bevoelkerung: "👥", ereignisse: "⚡", wahl: "🗳️", lq: "❤️",
};

const zahl = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x) < 0.1 && x !== 0 ? Math.abs(x).toFixed(2) : Math.abs(x).toFixed(1)}`.replace(".", ",");
const gut = (g: Groesse, wert: number) => (HOCH_SCHLECHT.has(g) ? wert < 0 : wert > 0);

export default function Rechenweg({ z }: { z: Zustand }) {
  const r = z.rechnung;
  const [i, setI] = useState(0);
  const [verfolgt, setVerfolgt] = useState<Groesse>("vertrauen");
  if (!r) return <p className="text-sm text-[var(--text-muted)]">Nach der ersten Runde steht hier, wie jede Zahl zustande kam.</p>;

  const schritte = [...r.schritte, { id: "lq", titel: "Lebensqualität", erklaerung: "", beitraege: [] as Beitrag[] }];
  const s = schritte[Math.min(i, schritte.length - 1)];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        So wurde die Runde <b>{STARTJAHR + 2 * (r.runde - 1)} → {STARTJAHR + 2 * r.runde}</b> gerechnet. Der Computer geht jede Runde dieselben Schritte durch –
        gehe sie mit und sieh, woher jede Zahl kommt.
      </p>

      <ol className="flex flex-wrap gap-1.5" aria-label="Rechenschritte">
        {schritte.map((x, j) => (
          <li key={x.id}>
            <button onClick={() => setI(j)} aria-current={j === i ? "step" : undefined}
              className={`px-2.5 py-1 rounded-lg text-sm font-bold border ${j === i ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)] text-[var(--text-muted)]"}`}>
              {j + 1}. {ICON[x.id]} {x.titel}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black text-lg">{i + 1}. {ICON[s.id]} {s.titel}</h3>
            <div className="flex gap-1">
              <button onClick={() => setI((j) => Math.max(0, j - 1))} disabled={i === 0} aria-label="Voriger Schritt"
                className="w-9 h-9 rounded-lg border border-[var(--border)] font-black disabled:opacity-30">◀</button>
              <button onClick={() => setI((j) => Math.min(schritte.length - 1, j + 1))} disabled={i === schritte.length - 1} aria-label="Nächster Schritt"
                className="w-9 h-9 rounded-lg border border-[var(--border)] font-black disabled:opacity-30">▶</button>
            </div>
          </div>
          {s.id === "lq" ? <Lebensqualitaet r={r} lq={z.lq} /> : (
            <>
              <p className="text-sm">{s.erklaerung}</p>
              {"details" in s && s.details && (
                <ul className="text-sm rounded-xl border border-[var(--border)] p-3 space-y-1 tabular-nums">
                  {s.details.map((d, j) => <li key={j}>{d}</li>)}
                </ul>
              )}
              <SchrittBeitraege beitraege={s.beitraege} laufend={laufendNach(r, i)} vorher={laufendNach(r, i - 1)} onVerfolgen={setVerfolgt} />
            </>
          )}
        </div>
        <div className="min-w-0">
          <Wirkungsnetz z={z} markiert={pfeile(s.beitraege)} />
        </div>
      </div>

      <Wasserfall r={r} g={verfolgt} onWahl={setVerfolgt} />
    </div>
  );
}

/** Stand aller Größen nach Schritt i (−1 = Start). */
function laufendNach(r: Rechnung, i: number): Record<Groesse, number> {
  const w = { ...r.start };
  for (const s of r.schritte.slice(0, Math.max(0, i + 1))) for (const b of s.beitraege) w[b.nach] += b.wert;
  return w;
}

/** Welche Pfeile im Netz zu diesen Beiträgen gehören. */
function pfeile(bs: Beitrag[]): [Knoten, Knoten][] {
  const knoten = new Set(Object.keys(KNOTEN_INFO));
  return bs.filter((b) => b.von && knoten.has(b.von) && Math.abs(b.wert) >= 0.05).map((b) => [b.von as Knoten, b.nach]);
}

function SchrittBeitraege({ beitraege, laufend, vorher, onVerfolgen }: {
  beitraege: Beitrag[]; laufend: Record<Groesse, number>; vorher: Record<Groesse, number>; onVerfolgen: (g: Groesse) => void;
}) {
  const [offen, setOffen] = useState<Groesse | null>(null);
  const gruppen = useMemo(() => {
    const m = new Map<Groesse, Beitrag[]>();
    for (const b of beitraege) m.set(b.nach, [...(m.get(b.nach) ?? []), b]);
    return [...m.entries()]
      .map(([g, bs]) => ({ g, bs: bs.sort((a, b) => Math.abs(b.wert) - Math.abs(a.wert)), summe: bs.reduce((a, b) => a + b.wert, 0) }))
      .filter((x) => x.bs.some((b) => Math.abs(b.wert) >= 0.01))
      .sort((a, b) => GROESSEN.indexOf(a.g) - GROESSEN.indexOf(b.g));
  }, [beitraege]);
  if (!gruppen.length) return <p className="text-sm text-[var(--text-muted)]">In diesem Schritt hat sich an den Bereichen nichts verändert.</p>;
  const max = Math.max(1, ...gruppen.map((x) => Math.abs(x.summe)));

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[minmax(0,11rem)_1fr_4.5rem_5.5rem] gap-2 text-[11px] text-[var(--text-muted)] px-1">
        <span>Bereich</span><span className="text-center">Veränderung in diesem Schritt</span><span className="text-right">Summe</span><span className="text-right">Stand</span>
      </div>
      {gruppen.map(({ g, bs, summe }) => (
        <div key={g} className="rounded-lg border border-[var(--border)]">
          <button onClick={() => setOffen((o) => (o === g ? null : g))} aria-expanded={offen === g}
            className="w-full grid grid-cols-[minmax(0,11rem)_1fr_4.5rem_5.5rem] gap-2 items-center px-1 py-1 text-sm text-left">
            <span className="truncate">{BEREICH[g].icon} {BEREICH[g].name}</span>
            <MittelBalken wert={summe} max={max} gut={gut(g, summe)} />
            <span className="text-right font-bold tabular-nums" style={{ color: gut(g, summe) ? "var(--green)" : "var(--red)" }}>{zahl(summe)}</span>
            <span className="text-right tabular-nums text-[var(--text-muted)]">{Math.round(vorher[g])} → <b className="text-[var(--text)]">{Math.round(laufend[g])}</b></span>
          </button>
          {offen === g && (
            <ul className="px-3 pb-2 space-y-1 text-sm">
              {bs.map((b, j) => (
                <li key={j} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-bold tabular-nums w-12 text-right" style={{ color: gut(g, b.wert) ? "var(--green)" : "var(--red)" }}>{zahl(b.wert)}</span>
                  <span>{b.grund}</span>
                  {b.quelle && b.quelle !== "annahme" && <QuelleLink id={b.quelle} />}
                </li>
              ))}
              <li><button onClick={() => onVerfolgen(g)} className="text-xs underline text-[var(--text-muted)]">{BEREICH[g].name} durch die ganze Runde verfolgen ↓</button></li>
            </ul>
          )}
        </div>
      ))}
      <p className="text-xs text-[var(--text-muted)]">Tippe auf einen Bereich, um die einzelnen Beiträge und ihre Quellen zu sehen.</p>
    </div>
  );
}

function MittelBalken({ wert, max, gut }: { wert: number; max: number; gut: boolean }) {
  const breite = Math.min(50, (Math.abs(wert) / max) * 50);
  return (
    <div className="relative h-3 rounded-full bg-[var(--surface-hover)]">
      <div className="absolute top-0 bottom-0 w-px bg-[var(--text-muted)]" style={{ left: "50%" }} />
      <div className="absolute top-0 bottom-0 rounded-full"
        style={{ left: wert >= 0 ? "50%" : `${50 - breite}%`, width: `${breite}%`, background: gut ? "var(--green)" : "var(--red)" }} />
    </div>
  );
}

function Lebensqualitaet({ r, lq }: { r: Rechnung; lq: number }) {
  const teile = r.lq.map((t) => ({ ...t, beitrag: t.gewicht * t.wert }));
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>Die Lebensqualität ist ein gewichteter Durchschnitt. Klima geht umgekehrt ein: wenig Klimalast ist gut.</p>
      <table className="w-full tabular-nums">
        <thead className="text-[11px] text-[var(--text-muted)]">
          <tr><th className="text-left font-normal">Bereich</th><th className="text-right font-normal">Wert</th><th className="text-right font-normal">× Gewicht</th><th className="text-right font-normal">= Punkte</th></tr>
        </thead>
        <tbody>
          {teile.map((t) => (
            <tr key={t.name} className="border-t border-[var(--border)]">
              <td>{t.name === BEREICH.klima.name ? "Klima (100 − Klimalast)" : t.name}</td>
              <td className="text-right">{Math.round(t.wert)}</td>
              <td className="text-right">× {t.gewicht.toFixed(2).replace(".", ",")}</td>
              <td className="text-right font-bold">{t.beitrag.toFixed(1).replace(".", ",")}</td>
            </tr>
          ))}
          {Math.abs(r.lqSchock) >= 0.05 && (
            <tr className="border-t border-[var(--border)]"><td colSpan={3}>Nachklang von Ereignissen (halbiert sich jede Runde)</td><td className="text-right font-bold">{zahl(r.lqSchock)}</td></tr>
          )}
          <tr className="border-t-2 border-[var(--text)]"><td colSpan={3} className="font-black">Lebensqualität</td><td className="text-right font-black">{Math.round(lq)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** Eine Größe durch die ganze Runde: Start, jede Wirkung als Sprung, Ende. */
function Wasserfall({ r, g, onWahl }: { r: Rechnung; g: Groesse; onWahl: (g: Groesse) => void }) {
  const zeilen: { label: string; schritt?: string; von: number; bis: number; wert?: number; quelle?: string }[] = [];
  let lauf = r.start[g];
  for (const s of r.schritte) {
    const bs = s.beitraege.filter((b) => b.nach === g && Math.abs(b.wert) >= 0.01).sort((a, b) => Math.abs(b.wert) - Math.abs(a.wert));
    if (!bs.length) continue;
    const gross = bs.slice(0, 5);
    const klein = bs.slice(5).reduce((a, b) => a + b.wert, 0);
    for (const b of gross) { zeilen.push({ label: b.grund, schritt: `${ICON[s.id]} ${s.titel}`, von: lauf, bis: lauf + b.wert, wert: b.wert, quelle: b.quelle }); lauf += b.wert; }
    if (Math.abs(klein) >= 0.01) { zeilen.push({ label: bs.length - 5 === 1 ? "1 kleinere Wirkung" : `${bs.length - 5} kleinere Wirkungen`, schritt: `${ICON[s.id]} ${s.titel}`, von: lauf, bis: lauf + klein, wert: klein }); lauf += klein; }
  }
  const ende = r.ende[g];
  const lo = Math.max(0, Math.floor(Math.min(r.start[g], ende, ...zeilen.map((z) => Math.min(z.von, z.bis))) / 10) * 10 - 5);
  const hi = Math.min(100, Math.ceil(Math.max(r.start[g], ende, ...zeilen.map((z) => Math.max(z.von, z.bis))) / 10) * 10 + 5);
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;

  return (
    <div className="rounded-2xl border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="font-black">Eine Größe verfolgen:</h3>
        <select value={g} onChange={(e) => onWahl(e.target.value as Groesse)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm">
          {GROESSEN.map((x) => <option key={x} value={x}>{BEREICH[x].icon} {BEREICH[x].name}</option>)}
        </select>
        <span className="text-sm tabular-nums">{Math.round(r.start[g])} → <b>{Math.round(ende)}</b> ({zahl(ende - r.start[g])})</span>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <Zeile label="Start der Runde" balken={<Punkt x={x(r.start[g])} />} rechts={String(Math.round(r.start[g]))} />
        {zeilen.map((z, j) => {
          const g0 = gut(g, z.wert ?? 0);
          const links = Math.min(z.von, z.bis), rechts = Math.max(z.von, z.bis);
          return (
            <Zeile key={j} label={<>{z.label} <span className="text-[11px] text-[var(--text-muted)]">· {z.schritt}</span>{z.quelle && z.quelle !== "annahme" && <> · <QuelleLink id={z.quelle} /></>}</>}
              balken={<div className="absolute top-1 bottom-1 rounded-sm" style={{ left: x(links), width: `max(2px, calc(${x(rechts)} - ${x(links)}))`, background: g0 ? "var(--green)" : "var(--red)" }} />}
              rechts={<span style={{ color: g0 ? "var(--green)" : "var(--red)" }}>{zahl(z.wert ?? 0)}</span>} />
          );
        })}
        <Zeile label={<b>Ende der Runde</b>} balken={<Punkt x={x(ende)} />} rechts={<b>{Math.round(ende)}</b>} />
      </div>
      <div className="flex justify-between text-[11px] text-[var(--text-muted)] mt-1 pl-[45%] pr-14"><span>{lo}</span><span>{hi}</span></div>
      <p className="text-xs text-[var(--text-muted)] mt-2">
        Jede Zeile ist ein Sprung: grün hilft, rot schadet. {HOCH_SCHLECHT.has(g) && "Bei dieser Größe ist hoch schlecht – ein Sprung nach oben ist also rot."}
      </p>
    </div>
  );
}

function Zeile({ label, balken, rechts }: { label: ReactNode; balken: ReactNode; rechts: ReactNode }) {
  return (
    <div className="grid grid-cols-[45%_1fr_3.5rem] gap-2 items-center">
      <span className="min-w-0 truncate" title={typeof label === "string" ? label : undefined}>{label}</span>
      <div className="relative h-5 rounded bg-[var(--surface-hover)]">{balken}</div>
      <span className="text-right tabular-nums font-bold">{rechts}</span>
    </div>
  );
}

function Punkt({ x }: { x: string }) {
  return <div className="absolute top-0.5 bottom-0.5 w-1.5 rounded-full bg-[var(--text)]" style={{ left: `calc(${x} - 3px)` }} />;
}
