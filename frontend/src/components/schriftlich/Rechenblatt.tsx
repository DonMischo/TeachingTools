"use client";
/**
 * Das Rechenblatt: Karopapier, jede Ziffer in ihrem Kästchen, in den Farben
 * der Stellenwerttafel. Darunter die Walzen (wie im Zählwerk der
 * Stellenwerttafeln), daneben die Rechenkette mit Bögen.
 *
 * Ablauf eines Schritts, langsam zum Mitverfolgen:
 *   1. die Walze dreht Ziffer für Ziffer — der Sprung 9 → 0 in Zeitlupe,
 *   2. erst dann erscheint die geschriebene Ziffer, der Übertrag fliegt los
 *      (Zerlegung: Zehner fliegen, Einer bleiben),
 *   3. der Übertrag erscheint erst, wenn er gelandet ist.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { farbe } from "@/lib/stellenwert";
import { Walze } from "@/components/stellenwert/DrehZaehlwerk";
import type { Ablauf, Kette, Ort, Schritt, Zerlegung } from "@/lib/schriftlich";

export const ZELLE = 2.6; // rem — ein Kästchen je Ziffer
const TICK = 330; // ms je Walzenschritt
const ZEITLUPE = 1400; // ms für den Sprung 9 → 0 (bzw. 0 → 9)
const FLUG = 1100; // ms für den fliegenden Übertrag

/** Verzögerungen der einzelnen Walzenschritte: über die Zehnergrenze in Zeitlupe */
export function tickPlan(von: number, bis: number): number[] {
  const plan: number[] = [];
  let x = von;
  while (x !== bis) {
    const n = x + (bis > x ? 1 : -1);
    const ueber = Math.floor(n / 10) !== Math.floor(x / 10);
    plan.push(ueber ? ZEITLUPE : TICK);
    x = n;
  }
  return plan;
}
export const schrittDauer = (s: Schritt) =>
  (s.walze ? tickPlan(s.walze.von, s.walze.bis).reduce((a, b) => a + b, 0) : 0) + (s.flug ? FLUG + 200 : 0);

function Flug({ von, nach, t, start }: { von: Ort; nach: Ort; t: string; start: boolean }) {
  const [da, setDa] = useState(false);
  useEffect(() => { if (!start) return; const u = setTimeout(() => setDa(true), 40); return () => clearTimeout(u); }, [start]);
  if (!start) return null;
  const p = da ? nach : von;
  return (
    <span className="absolute flex items-center justify-center rounded-full bg-bad text-white font-black text-sm shadow-lg pointer-events-none z-10"
      style={{ left: `${p.c * ZELLE + 0.45}rem`, top: `${p.r * ZELLE + 0.45}rem`, width: `${ZELLE - 0.9}rem`, height: `${ZELLE - 0.9}rem`,
        transition: `left ${FLUG}ms ease-in-out, top ${FLUG}ms ease-in-out` }} aria-hidden>{t}</span>
  );
}

/** Rechenkette mit Bögen wie beim Größen-Umrechnen: plus/mal oben, minus/geteilt unten */
const BOGEN_FARBE = { plus: "#16a34a", mal: "#2563eb", minus: "#dc2626", durch: "#ea580c" } as const;
export function KettenBild({ k }: { k: Kette }) {
  // Abstand nach dem längsten Bogen-Etikett, damit nichts überlappt
  const dx = Math.max(104, 40 + Math.max(0, ...k.boegen.map(b => b.text.length)) * 9.4), bw = 64, bh = 40, W = Math.max(160, k.kaesten.length * dx), H = 130, cy = H / 2;
  const x = (i: number) => W / 2 + (i - (k.kaesten.length - 1) / 2) * dx;
  const bogen = (i: number, b: Kette["boegen"][number]) => {
    const oben = b.art === "plus" || b.art === "mal";
    const y = oben ? cy - bh / 2 : cy + bh / 2, cyB = oben ? y - 44 : y + 44;
    const x1 = x(i) + 10, x2 = x(i + 1) - 10, mx = (x1 + x2) / 2, f = BOGEN_FARBE[b.art];
    return (
      <g key={i}>
        <path d={`M ${x1} ${y} Q ${mx} ${cyB} ${x2} ${y}`} fill="none" stroke={f} strokeWidth={2.5} markerEnd={`url(#sp-${b.art})`} />
        <rect x={mx - b.text.length * 4.6 - 6} y={(y + cyB) / 2 - 11} width={b.text.length * 9.2 + 12} height={22} rx={6} fill="var(--color-surface)" />
        <text x={mx} y={(y + cyB) / 2} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={800} fill={f}>{b.text}</text>
      </g>
    );
  };
  return (
    <div className="flex flex-col items-center">
      {k.titel && <span className="text-xs font-bold text-muted">{k.titel}</span>}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: `${W * 0.9}px` }} className="max-w-full" role="img" aria-label={`Rechenkette ${k.kaesten.join(" → ")}`}>
        <defs>
          {(Object.keys(BOGEN_FARBE) as (keyof typeof BOGEN_FARBE)[]).map(a => (
            <marker key={a} id={`sp-${a}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={BOGEN_FARBE[a]} />
            </marker>
          ))}
        </defs>
        {k.boegen.map((b, i) => bogen(i, b))}
        {k.kaesten.map((t, i) => (
          <g key={i}>
            <rect x={x(i) - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={9} fill="var(--color-page)" stroke="var(--color-fg)" strokeWidth={2} />
            <text x={x(i)} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={900} fill="var(--color-fg)">{t}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** 13 = 1 Zehner (fliegt als Übertrag) + 3 Einer (werden geschrieben) */
function ZerlegungBild({ z, offen }: { z: Zerlegung; offen: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-page p-2" aria-label={`${z.zahl} = ${z.zehner} Zehner + ${z.einer} Einer`}>
      <span className="text-2xl font-black font-mono">{z.zahl}</span>
      <span className="text-muted">=</span>
      <span className={`flex flex-col items-center rounded-lg px-2 py-1 transition-all duration-700 ${offen ? "bg-bad/15 -translate-y-1" : ""}`}>
        <span className="text-xl font-black text-bad">{z.zehner}</span><span className="text-[10px] font-bold">Zehner → Übertrag</span>
      </span>
      <span className="text-muted">+</span>
      <span className={`flex flex-col items-center rounded-lg px-2 py-1 transition-all duration-700 ${offen ? "bg-ok/15" : ""}`}>
        <span className="text-xl font-black text-ok">{z.einer}</span><span className="text-[10px] font-bold">Einer → schreiben</span>
      </span>
    </div>
  );
}

/** Walzenreihe; die aktive Walze tickt von `von` nach `bis`, an der Zehnergrenze in Zeitlupe */
function Walzen({ s, breite, einer, fertig }: { s: Schritt; breite: number; einer?: number; fertig: () => void }) {
  const [dreh, setDreh] = useState<number | null>(s.walze ? s.walze.von : null);
  const [langsam, setLangsam] = useState(false);
  useEffect(() => {
    if (!s.walze) { setDreh(null); fertig(); return; }
    const { von, bis } = s.walze;
    const plan = tickPlan(von, bis);
    setDreh(von);
    let x = von, i = 0, u: ReturnType<typeof setTimeout>;
    const weiter = () => {
      if (i >= plan.length) { setLangsam(false); fertig(); return; }
      const d = plan[i++];
      setLangsam(d === ZEITLUPE);
      x += bis > x ? 1 : -1;
      setDreh(x);
      u = setTimeout(weiter, d);
    };
    u = setTimeout(weiter, 250);
    return () => clearTimeout(u);
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const spalten = Object.keys(s.stand).map(Number);
  if (s.walze && !spalten.includes(s.walze.c)) spalten.push(s.walze.c);
  if (!spalten.length) return null;
  const gedreht = s.walze && dreh !== null ? Math.abs(dreh - s.walze.von) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="relative" style={{ height: `${ZELLE * 1.3 + 0.4}rem`, width: `${breite * ZELLE}rem` }}>
        {Array.from({ length: breite }, (_, c) => c).filter(c => spalten.includes(c)).map(c => {
          const aktiv = s.walze?.c === c && dreh !== null;
          const wert = aktiv ? dreh! : s.stand[c] ?? 0;
          const f = einer !== undefined ? farbe(10, einer - c) : "#475569";
          return (
            <div key={c} className={`absolute top-0 rounded-md transition-shadow ${aktiv ? (langsam ? "ring-4 ring-bad" : "ring-4 ring-accent") : ""}`} style={{ left: `${c * ZELLE + 0.25}rem` }}>
              <Walze dreh={wert} basis={10} farbe={f} h={ZELLE * 1.25} dauer={aktiv && langsam ? ZEITLUPE - 150 : 260} />
              {aktiv && s.walze?.zaehle && gedreht > 0 && (
                <span className="absolute -top-3 -right-3 rounded-full bg-accent text-accent-fg text-xs font-black px-1.5">+{gedreht}</span>
              )}
            </div>
          );
        })}
      </div>
      {langsam && <span className="text-sm font-black text-bad">Zeitlupe: Die Walze springt von {s.walze && s.walze.bis > s.walze.von ? "9 auf 0 — ein Zehner ist voll: Übertrag!" : "0 auf 9 — ein Zehner wird aufgebraucht."}</span>}
    </div>
  );
}

export function Rechenblatt({ ablauf, i }: { ablauf: Ablauf; i: number }) {
  const s = ablauf.schritte[Math.min(i, ablauf.schritte.length - 1)];
  const { breite, hoehe, einer } = ablauf;
  // Phase 0: Walze dreht, 1: Ziffer steht, Übertrag fliegt, 2: Übertrag gelandet
  // Kein Zurücksetzen per Effekt (liefe nach dem Walzen-Effekt): der Abspieler gibt jedem Schritt einen eigenen key.
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (phase !== 1) return;
    if (!s.flug) { setPhase(2); return; }
    const u = setTimeout(() => setPhase(2), FLUG + 100);
    return () => clearTimeout(u);
  }, [phase, s]);
  const sichtbar = (ab?: "walze" | "flug") => !ab || (ab === "walze" ? phase >= 1 : phase >= 2);
  const fertig = useMemo(() => () => setPhase(p => (p === 0 ? 1 : p)), []);
  return (
    <div className="flex flex-wrap gap-6 items-start">
      <div className="flex flex-col gap-3 overflow-x-auto pb-1">
        <div className="relative rounded-lg border border-line" style={{
          width: `${breite * ZELLE}rem`, height: `${hoehe * ZELLE}rem`,
          backgroundImage: "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
          backgroundSize: `${ZELLE}rem ${ZELLE}rem`,
        }} role="img" aria-label="Rechenblatt">
          {s.spalten.map(c => <div key={`h${c}`} className="absolute top-0 bottom-0 bg-accent/15" style={{ left: `${c * ZELLE}rem`, width: `${ZELLE}rem` }} />)}
          {s.striche.map((x, k) => <div key={`s${k}`} className="absolute bg-fg" style={{ left: `${x.c0 * ZELLE}rem`, width: `${(x.c1 - x.c0 + 1) * ZELLE}rem`, top: `${(x.r + 1) * ZELLE - 0.1}rem`, height: "3px" }} />)}
          {s.zellen.filter(z => sichtbar(z.ab)).map((z, k) => {
            const pos = { left: `${z.c * ZELLE}rem`, top: `${z.r * ZELLE}rem`, width: `${ZELLE}rem`, height: `${ZELLE}rem` };
            if (z.art === "uebertrag") return (
              <span key={k} className="absolute flex items-center justify-center" style={pos}>
                <span className={`flex items-center justify-center rounded-full border-2 border-bad text-bad font-black text-sm size-7 ${z.durch ? "opacity-40" : ""} ${z.neu ? "animate-pulse" : ""}`}>+{z.t}</span>
              </span>
            );
            const klein = z.art === "hilfe";
            const f = (z.art === "zahl" || z.art === "ergebnis" || z.art === "teil") && einer !== undefined && z.c <= einer ? farbe(10, einer - z.c) : undefined;
            return (
              <span key={k} className={`absolute flex justify-center font-mono font-black ${klein ? "text-sm items-start text-bad" : "text-[1.7rem] items-center"} ${z.neu ? "animate-pulse" : ""}`}
                style={{ ...pos, color: klein ? undefined : f, textDecorationLine: z.durch ? "line-through" : undefined, opacity: z.durch ? 0.45 : 1 }}>{z.t}</span>
            );
          })}
          {s.flug && <Flug key={i} von={s.flug.von} nach={s.flug.nach} t={s.flug.t} start={phase === 1} />}
        </div>
        <Walzen s={s} breite={breite} einer={einer} fertig={fertig} />
      </div>
      {(s.ketten?.length || s.zerlegung) ? (
        <div className="flex flex-col gap-3 items-start">
          {s.ketten?.map((k, n) => <KettenBild key={`${i}-${n}`} k={k} />)}
          {s.zerlegung && <ZerlegungBild z={s.zerlegung} offen={phase >= 1} />}
        </div>
      ) : null}
    </div>
  );
}

/** Abspieler: Schritt für Schritt, zurück, alle, automatisch (mit Lesezeit) */
export function Abspieler({ ablauf, extra }: { ablauf: Ablauf; extra?: ReactNode }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  useEffect(() => { setI(0); setAuto(false); }, [ablauf]);
  const n = ablauf.schritte.length;
  useEffect(() => {
    if (!auto) return;
    if (i >= n - 1) { setAuto(false); return; }
    const u = setTimeout(() => setI(x => x + 1), schrittDauer(ablauf.schritte[i]) + 2600);
    return () => clearTimeout(u);
  }, [auto, i, n, ablauf]);
  const s = ablauf.schritte[i];
  return (
    <div className="flex flex-col gap-3">
      <Rechenblatt key={`${i}-${ablauf.op}-${ablauf.ergebnis}-${n}`} ablauf={ablauf} i={i} />
      <p className="text-base min-h-12 max-w-3xl">{s.text}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={i === 0} onClick={() => setI(i - 1)}>◀ Zurück</button>
        <button className="btn-primary" disabled={i >= n - 1} onClick={() => setI(i + 1)}>Nächster Schritt ▶</button>
        <button className="btn-secondary" onClick={() => setAuto(a => !a)}>{auto ? "⏸ Anhalten" : "⏯ Abspielen"}</button>
        <button className="btn-secondary" onClick={() => setI(n - 1)}>Alle Schritte</button>
        <span className="text-sm text-muted self-center">Schritt {i + 1} / {n}</span>
        {extra}
      </div>
    </div>
  );
}
