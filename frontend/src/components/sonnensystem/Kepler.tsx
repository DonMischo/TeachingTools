"use client";
/**
 * Die drei Keplerschen Gesetze zum Anfassen.
 *
 * Bewusst flach statt in 3D: beim Flächensatz muss man die Sektoren
 * nebeneinanderlegen können, und eine gekippte Bahn im Raum verdeckt genau
 * das. Alle drei Abschnitte rechnen mit denselben Formeln wie der Rest der
 * Simulation (bahnen.ts) und mit den echten Bahnelementen aus daten.ts.
 *
 *   1. Gesetz  Die Bahn ist eine Ellipse, die Sonne steht in einem Brennpunkt.
 *   2. Gesetz  In gleichen Zeiten überstreicht der Strahl gleiche Flächen.
 *   3. Gesetz  T² / a³ ist für alle Planeten dieselbe Zahl.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { HAUPTKOERPER, KOERPER_NACH_ID, type Koerper } from "@/lib/sonnensystem/daten";
import { loeseKepler, umlaufTage } from "@/lib/sonnensystem/bahnen";
import { zahl } from "@/lib/sonnensystem/format";

/** Bahnen zum Ausprobieren — von fast rund bis zum Kometen. */
const BEISPIELE: { name: string; e: number }[] = [
  { name: "Venus", e: 0.007 },
  { name: "Erde", e: 0.017 },
  { name: "Mars", e: 0.093 },
  { name: "Merkur", e: 0.206 },
  { name: "Pluto", e: 0.249 },
  { name: "Halleyscher Komet", e: 0.967 },
];

/** Punkt auf der Ellipse zur exzentrischen Anomalie E, Brennpunkt im Ursprung. */
function bahnPunkt(a: number, e: number, E: number): [number, number] {
  return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
}

/**
 * Der Zeichenkasten: immer gleich groß, aber so verschoben, dass die ganze
 * Ellipse hineinpasst. Je größer e, desto weiter reicht sie nach links — die
 * Sonne wandert dabei sichtbar aus der Mitte heraus.
 */
const kasten = (a: number, c: number) => `${-a - c - 25} ${-a - 25} ${2 * a + 50} ${2 * a + 50}`;

/** Fläche eines Vielecks nach der Trapezformel (Gaußsche Flächenformel). */
function flaeche(punkte: [number, number][]): number {
  let summe = 0;
  for (let i = 0; i < punkte.length; i++) {
    const [x1, y1] = punkte[i];
    const [x2, y2] = punkte[(i + 1) % punkte.length];
    summe += x1 * y2 - x2 * y1;
  }
  return Math.abs(summe) / 2;
}

/** Exzentrische Anomalie zum Zeitanteil t (0 … 1) eines Umlaufs. */
function anomalie(t: number, e: number): number {
  const M = t * 2 * Math.PI;
  return loeseKepler(M, e);
}

export function Kepler({ onSteckbrief }: { onSteckbrief?: (id: string) => void }) {
  const [e, setE] = useState(0.5);
  const [laeuft, setLaeuft] = useState(true);
  const [t, setT] = useState(0);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  // Ein Umlauf dauert acht Sekunden, unabhängig von der Exzentrizität.
  const letzte = useRef(0);
  useEffect(() => {
    if (!laeuft) return;
    let bild = 0;
    letzte.current = performance.now();
    const schritt = (jetzt: number) => {
      bild = requestAnimationFrame(schritt);
      const dt = Math.min((jetzt - letzte.current) / 1000, 0.1);
      letzte.current = jetzt;
      setT(alt => (alt + dt / 8) % 1);
    };
    bild = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild);
  }, [laeuft]);

  return (
    <div className="h-full overflow-y-auto p-4 text-slate-100 flex flex-col gap-6">
      <p className="text-sm text-slate-300 max-w-3xl">
        Johannes Kepler saß zwischen 1600 und 1619 über den Messwerten von Tycho Brahe und fand drei Regeln, nach denen
        sich alle Planeten richten — 68 Jahre bevor Newton sagen konnte, warum. Hier lassen sie sich einstellen und ablaufen.
      </p>

      <ErstesGesetz e={e} onE={setE} t={t} />
      <ZweitesGesetz e={e} t={t} laeuft={laeuft} onLaeuft={setLaeuft} onZuruecksetzen={() => setT(0)} />
      <DrittesGesetz gewaehlt={gewaehlt} onWaehle={setGewaehlt} onSteckbrief={onSteckbrief} />
    </div>
  );
}

function Abschnitt({ nummer, titel, satz, children }: {
  nummer: number; titel: string; satz: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">{nummer}. Gesetz</span>
        <h2 className="text-lg font-black">{titel}</h2>
      </div>
      <p className="text-sm text-sky-200/90 mt-1 italic">»{satz}«</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ── 1. Gesetz: die Ellipse und ihre Brennpunkte ──

function ErstesGesetz({ e, onE, t }: { e: number; onE: (v: number) => void; t: number }) {
  const a = 150;
  const b = a * Math.sqrt(1 - e * e);
  const c = a * e;
  const [px, py] = bahnPunkt(a, e, anomalie(t, e));
  const r = Math.hypot(px, py);
  // Der Strahl zum zweiten Brennpunkt: zusammen sind beide immer 2a lang.
  const r2 = Math.hypot(px + 2 * c, py);

  return (
    <Abschnitt
      nummer={1}
      titel="Die Bahn ist eine Ellipse"
      satz="Die Planeten laufen auf Ellipsen, in deren einem Brennpunkt die Sonne steht."
    >
      <div className="flex flex-col lg:flex-row gap-4">
        <svg viewBox={kasten(a, c)} className="w-full max-w-lg max-h-[21rem] bg-black/40 rounded-xl">
          {/* Die Ellipse; Mittelpunkt links vom Brennpunkt */}
          <ellipse cx={-c} cy={0} rx={a} ry={b} fill="rgba(56,189,248,0.06)" stroke="#7dd3fc" strokeWidth={1.5} />
          {/* Große Halbachse a und kleine Halbachse b */}
          <line x1={-c} y1={0} x2={-c + a} y2={0} stroke="#fbbf24" strokeWidth={1} strokeDasharray="4 3" />
          <text x={-c + a / 2} y={-6} textAnchor="middle" className="fill-amber-300 text-[11px] font-bold">a</text>
          <line x1={-c} y1={0} x2={-c} y2={-b} stroke="#86efac" strokeWidth={1} strokeDasharray="4 3" />
          <text x={-c - 8} y={-b / 2} textAnchor="end" className="fill-emerald-300 text-[11px] font-bold">b</text>
          {/* Die beiden Strahlen zum Planeten */}
          <line x1={0} y1={0} x2={px} y2={py} stroke="#fde68a" strokeWidth={1.6} />
          <line x1={-2 * c} y1={0} x2={px} y2={py} stroke="#fde68a" strokeWidth={1.2} strokeDasharray="3 3" opacity={0.7} />
          {/* Brennpunkte: in einem steht die Sonne, der andere ist leer */}
          <circle cx={-2 * c} cy={0} r={4} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
          <text x={-2 * c} y={18} textAnchor="middle" className="fill-slate-400 text-[10px]">leerer Brennpunkt</text>
          <circle cx={0} cy={0} r={9} fill="#fcd34d" />
          <circle cx={0} cy={0} r={16} fill="#fcd34d" opacity={0.25} />
          <text x={0} y={30} textAnchor="middle" className="fill-amber-200 text-[11px] font-bold">Sonne</text>
          {/* Der Planet */}
          <circle cx={px} cy={py} r={6} fill="#7dd3fc" />
        </svg>

        <div className="flex-1 min-w-0">
          <label className="block text-sm">
            Exzentrizität <span className="font-black tabular-nums text-amber-300">e = {zahl(e, 3)}</span>
            <input
              type="range" min={0} max={0.9} step={0.001} value={e}
              onChange={ev => onE(Number(ev.target.value))}
              className="w-full accent-sky-400 mt-1"
              aria-label="Exzentrizität"
            />
          </label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {BEISPIELE.map(b2 => (
              <button
                key={b2.name}
                onClick={() => onE(Math.min(b2.e, 0.9))}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  Math.abs(e - Math.min(b2.e, 0.9)) < 0.002 ? "border-sky-300 bg-sky-400/20" : "border-white/15 bg-white/5 hover:bg-white/10"
                }`}
              >{b2.name} <span className="text-slate-400 tabular-nums">{b2.e}</span></button>
            ))}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm mt-3">
            <dt className="text-slate-400">Abstand Sonne–Mittelpunkt</dt>
            <dd className="tabular-nums">e · a = {zahl(e, 3)} · a</dd>
            <dt className="text-slate-400">Kleine Halbachse</dt>
            <dd className="tabular-nums">b = {zahl(Math.sqrt(1 - e * e), 3)} · a</dd>
            <dt className="text-slate-400">Beide Strahlen zusammen</dt>
            <dd className="tabular-nums text-amber-200">{zahl((r + r2) / a, 2)} · a — immer gleich 2a</dd>
          </dl>
          <p className="text-xs text-slate-400 mt-3 leading-snug">
            Genau das ist die Ellipse: die Summe der Abstände zu beiden Brennpunkten bleibt überall gleich. Deshalb
            funktioniert die Gärtnerkonstruktion mit zwei Nägeln und einer Schnur.
          </p>
          <p className="text-xs text-slate-400 mt-2 leading-snug">
            Echte Planetenbahnen sehen fast kreisrund aus — die Erde hat e = 0,017. Nicht die Form fällt auf, sondern
            dass die Sonne nicht in der Mitte steht. Im Januar ist die Erde 5 Mio. km näher an ihr als im Juli.
          </p>
        </div>
      </div>
    </Abschnitt>
  );
}

// ── 2. Gesetz: gleiche Flächen in gleichen Zeiten ──

/** In so viele gleich lange Zeitabschnitte wird der Umlauf zerlegt. */
const SEKTOREN = 12;

function ZweitesGesetz({ e, t, laeuft, onLaeuft, onZuruecksetzen }: {
  e: number; t: number; laeuft: boolean; onLaeuft: (an: boolean) => void; onZuruecksetzen: () => void;
}) {
  const a = 150;
  const c = a * e;
  const [px, py] = bahnPunkt(a, e, anomalie(t, e));

  // Jeder Sektor ist ein Zeitabschnitt: gezeichnet als Fächer vom Brennpunkt aus.
  const sektoren = useMemo(() => Array.from({ length: SEKTOREN }, (_, i) => {
    const punkte: [number, number][] = [[0, 0]];
    for (let s = 0; s <= 16; s++) punkte.push(bahnPunkt(a, e, anomalie((i + s / 16) / SEKTOREN, e)));
    return { d: punkte.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "), flaeche: flaeche(punkte) / (a * a) };
  }), [e]);

  const aktiv = Math.floor(t * SEKTOREN) % SEKTOREN;
  // Sonnennächster und sonnenfernster Abschnitt — die beiden zum Vergleichen.
  const schnellster = 0;
  const langsamster = SEKTOREN / 2;
  const bogen = (i: number) => {
    const von = bahnPunkt(a, e, anomalie(i / SEKTOREN, e));
    const bis = bahnPunkt(a, e, anomalie((i + 1) / SEKTOREN, e));
    return Math.hypot(bis[0] - von[0], bis[1] - von[1]);
  };

  return (
    <Abschnitt
      nummer={2}
      titel="Gleiche Flächen in gleichen Zeiten"
      satz="Der Strahl von der Sonne zum Planeten überstreicht in gleichen Zeiten gleich große Flächen."
    >
      <div className="flex flex-col lg:flex-row gap-4">
        <svg viewBox={kasten(a, c)} className="w-full max-w-lg max-h-[21rem] bg-black/40 rounded-xl">
          {sektoren.map((p, i) => (
            <polygon
              key={i}
              points={p.d}
              fill={i === schnellster ? "rgba(248,113,113,0.5)" : i === langsamster ? "rgba(96,165,250,0.5)" : "rgba(148,163,184,0.12)"}
              stroke={i === aktiv ? "#fde68a" : "rgba(226,232,240,0.25)"}
              strokeWidth={i === aktiv ? 1.8 : 0.6}
            />
          ))}
          <ellipse cx={-c} cy={0} rx={a} ry={a * Math.sqrt(1 - e * e)} fill="none" stroke="#7dd3fc" strokeWidth={1.2} />
          <line x1={0} y1={0} x2={px} y2={py} stroke="#fde68a" strokeWidth={1.8} />
          <circle cx={0} cy={0} r={9} fill="#fcd34d" />
          <circle cx={px} cy={py} r={6} fill="#7dd3fc" />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="flex gap-2">
            <button
              onClick={() => onLaeuft(!laeuft)}
              className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm font-bold"
            >{laeuft ? "⏸ Anhalten" : "▶ Weiter"}</button>
            <button
              onClick={onZuruecksetzen}
              className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-sm"
            >Zum Anfang</button>
          </div>
          <p className="text-sm text-slate-300 mt-3 leading-snug">
            Alle zwölf Kuchenstücke stehen für dieselbe Zeit — ein Zwölftel des Umlaufs. Und sie sind alle gleich groß.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm mt-3">
            <dt className="text-rose-300">Nah an der Sonne</dt>
            <dd>
              kurz und breit — Weg <span className="tabular-nums font-bold">{zahl(bogen(schnellster) / a, 2)} · a</span>,
              Fläche <span className="tabular-nums font-bold text-amber-300">{zahl(sektoren[schnellster].flaeche, 2)} · a²</span>
            </dd>
            <dt className="text-blue-300">Weit weg</dt>
            <dd>
              lang und schmal — Weg nur <span className="tabular-nums font-bold">{zahl(bogen(langsamster) / a, 2)} · a</span>,
              Fläche <span className="tabular-nums font-bold text-amber-300">{zahl(sektoren[langsamster].flaeche, 2)} · a²</span>
            </dd>
          </dl>
          <p className="text-xs text-slate-400 mt-3 leading-snug">
            Nah an der Sonne ist der Strahl kurz, also muss der Planet weit laufen, damit die Fläche stimmt: er wird
            schneller. Weit draußen reicht ein kurzes Stück. Stell oben e groß ein — dann rast der Planet um die Sonne
            herum und schleicht auf der Gegenseite.
          </p>
          <p className="text-xs text-slate-400 mt-2 leading-snug">
            Dahinter steckt der Drehimpuls: Es gibt nichts, was ihn ändern könnte, denn die Anziehung zeigt immer genau
            zur Sonne. Dasselbe lässt eine Eiskunstläuferin schneller kreiseln, wenn sie die Arme anlegt.
          </p>
        </div>
      </div>
    </Abschnitt>
  );
}

// ── 3. Gesetz: T² zu a³ ──

function DrittesGesetz({ gewaehlt, onWaehle, onSteckbrief }: {
  gewaehlt: string | null; onWaehle: (id: string | null) => void; onSteckbrief?: (id: string) => void;
}) {
  const zeilen = useMemo(() => HAUPTKOERPER.filter(k => k.bahn).map(k => {
    const a = k.bahn!.a;
    const T = umlaufTage(k.bahn!) / 365.25;
    return { k, a, T, verhaeltnis: (T * T) / (a * a * a) };
  }), []);

  // Doppelt logarithmisch: dort liegen alle Planeten auf einer Geraden mit der Steigung 3/2.
  const B = 420, H = 260, RAND = 42;
  const xVon = -0.5, xBis = 1.75, yVon = -0.8, yBis = 2.6;
  const sx = (a: number) => RAND + ((Math.log10(a) - xVon) / (xBis - xVon)) * (B - RAND - 10);
  const sy = (T: number) => H - RAND - ((Math.log10(T) - yVon) / (yBis - yVon)) * (H - RAND - 10);

  return (
    <Abschnitt
      nummer={3}
      titel="T² geteilt durch a³ ist für alle gleich"
      satz="Die Quadrate der Umlaufzeiten verhalten sich wie die Kuben der großen Halbachsen."
    >
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="overflow-x-auto">
          <table className="text-sm tabular-nums border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-400">
                <th className="text-left font-bold pr-3 pb-1">Planet</th>
                <th className="text-right font-bold px-2 pb-1">a in AE</th>
                <th className="text-right font-bold px-2 pb-1">T in Jahren</th>
                <th className="text-right font-bold px-2 pb-1">a³</th>
                <th className="text-right font-bold px-2 pb-1">T²</th>
                <th className="text-right font-bold pl-2 pb-1">T² / a³</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map(z => (
                <tr
                  key={z.k.id}
                  onClick={() => onWaehle(gewaehlt === z.k.id ? null : z.k.id)}
                  className={`cursor-pointer border-t border-white/10 ${gewaehlt === z.k.id ? "bg-sky-400/15" : "hover:bg-white/5"}`}
                >
                  <td className="pr-3 py-0.5 font-bold" style={{ color: z.k.farbe }}>{z.k.name}</td>
                  <td className="text-right px-2">{zahl(z.a, 3)}</td>
                  <td className="text-right px-2">{zahl(z.T, z.T < 10 ? 2 : 1)}</td>
                  <td className="text-right px-2 text-slate-400">{zahl(z.a ** 3, 2)}</td>
                  <td className="text-right px-2 text-slate-400">{zahl(z.T ** 2, 2)}</td>
                  <td className="text-right pl-2 font-bold text-amber-300">{zahl(z.verhaeltnis, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 mt-2 max-w-md leading-snug">
            Die letzte Spalte ist überall 1,00 — in diesen Einheiten (AE und Jahre) sogar genau. Deshalb reicht die
            Umlaufzeit, um den Abstand auszurechnen: Kepler brauchte für die Entfernung eines Planeten nur eine Uhr.
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <svg viewBox={`0 0 ${B} ${H}`} className="w-full max-w-xl bg-black/40 rounded-xl">
            {/* Gerade der Steigung 3/2 */}
            <line x1={sx(10 ** xVon)} y1={sy(10 ** (1.5 * xVon))} x2={sx(10 ** xBis)} y2={sy(10 ** (1.5 * xBis))}
              stroke="#fbbf24" strokeWidth={1.4} strokeDasharray="5 4" />
            {/* Achsen */}
            <line x1={RAND} y1={H - RAND} x2={B - 10} y2={H - RAND} stroke="#64748b" strokeWidth={1} />
            <line x1={RAND} y1={10} x2={RAND} y2={H - RAND} stroke="#64748b" strokeWidth={1} />
            {[0.1, 1, 10].map(v => (
              <g key={`x${v}`}>
                <line x1={sx(v)} y1={H - RAND} x2={sx(v)} y2={H - RAND + 4} stroke="#64748b" />
                <text x={sx(v)} y={H - RAND + 15} textAnchor="middle" className="fill-slate-400 text-[10px]">{v}</text>
              </g>
            ))}
            {[0.1, 1, 10, 100].map(v => (
              <g key={`y${v}`}>
                <line x1={RAND - 4} y1={sy(v)} x2={RAND} y2={sy(v)} stroke="#64748b" />
                <text x={RAND - 7} y={sy(v) + 3} textAnchor="end" className="fill-slate-400 text-[10px]">{v}</text>
              </g>
            ))}
            <text x={(B + RAND) / 2} y={H - 6} textAnchor="middle" className="fill-slate-300 text-[11px]">große Halbachse a in AE</text>
            <text x={12} y={(H - RAND) / 2} textAnchor="middle" className="fill-slate-300 text-[11px]"
              transform={`rotate(-90 12 ${(H - RAND) / 2})`}>Umlaufzeit T in Jahren</text>
            {zeilen.map(z => (
              <g key={z.k.id} onClick={() => onWaehle(gewaehlt === z.k.id ? null : z.k.id)} className="cursor-pointer">
                <circle cx={sx(z.a)} cy={sy(z.T)} r={gewaehlt === z.k.id ? 7 : 4.5} fill={z.k.farbe}
                  stroke={gewaehlt === z.k.id ? "#fff" : "none"} strokeWidth={1.5} />
                <text x={sx(z.a)} y={sy(z.T) - 9} textAnchor="middle" className="fill-slate-300 text-[9px]">{z.k.name}</text>
              </g>
            ))}
          </svg>
          <p className="text-xs text-slate-400 mt-2 leading-snug">
            Beide Achsen sind zehnerpotenzweise geteilt. In dieser Auftragung liegen alle Planeten auf einer Geraden —
            und zwar auf einer mit der Steigung 3/2, genau das sagt T² = a³.
          </p>
          {gewaehlt && (
            <GewaehlterHinweis id={gewaehlt} onSteckbrief={onSteckbrief} />
          )}
        </div>
      </div>
    </Abschnitt>
  );
}

function GewaehlterHinweis({ id, onSteckbrief }: { id: string; onSteckbrief?: (id: string) => void }) {
  const k: Koerper = KOERPER_NACH_ID[id];
  const a = k.bahn!.a;
  const T = umlaufTage(k.bahn!) / 365.25;
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
      <span className="font-black" style={{ color: k.farbe }}>{k.name}</span>{" "}
      steht {zahl(a, 3)} AE von der Sonne entfernt und braucht {zahl(T, T < 10 ? 2 : 1)} Jahre für einen Umlauf.
      <div className="text-xs text-slate-400 mt-1 tabular-nums">
        √(a³) = √{zahl(a ** 3, 2)} = {zahl(Math.sqrt(a ** 3), 2)} Jahre — dieselbe Zahl, nur aus dem Abstand gerechnet.
      </div>
      {onSteckbrief && (
        <button onClick={() => onSteckbrief(id)} className="mt-1.5 text-xs text-sky-300 hover:text-sky-200">📖 Steckbrief</button>
      )}
    </div>
  );
}
