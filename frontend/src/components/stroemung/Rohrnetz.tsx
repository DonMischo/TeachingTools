"use client";
/**
 * Station »Rohrnetz« (Kl. 9/10): Pumpenkreislauf mit bis zu drei parallelen
 * Zweigen, Zweig 1 auf Wunsch mit Engstelle in Reihe. Gerechnet vom Löser
 * (Wasser turbulent, Hydrauliköl laminar). Pumpen- und Anlagenkennlinie mit
 * Betriebspunkt; der Regler 💧↔⚡ legt den Stromkreis darüber.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Stroemung } from "@/lib/stroemung/loeser";
import { querschnitt, type Knoten, type Medium, type Teil } from "@/lib/stroemung/modell";
import { Analogie, Karte, Pille, Regler, StationRahmen, Wahl, Werte, bar, muted, text, zahl } from "./rahmen";
import { Handrad, KitDefs, Manometer, Muffe, Pumpe, Rohr } from "./kit";

interface Einstellung {
  medium: Extract<Medium, "wasser" | "oel">;
  foerderdruck: number;                   // Pa
  d: [number, number, number];            // mm je Zweig
  offen: [boolean, boolean, boolean];
  zweige: number;                         // 1…3
  engstelle: number | null;               // mm in Zweig 1, null = keine
}

const Q_MAX = 2e-3;                       // m³/s, Pumpe bei Δp = 0
const D_HAUPT = 32;                       // mm

function netz(e: Einstellung, idealePumpe?: number): { knoten: Knoten[]; teile: Teil[] } {
  const turb = e.medium === "wasser";
  const rohr = (id: string, a: string, b: string, dmm: number, laenge: number): Teil =>
    ({ id, art: "rohr", a, b, durchmesser: dmm / 1000, laenge, turbulent: turb });
  const knoten: Knoten[] = ["pu", "po", "k1", "k2", "e"].map(id => ({ id, z: 0 }));
  const teile: Teil[] = [
    idealePumpe === undefined
      ? { id: "pumpe", art: "pumpe", a: "pu", b: "po", foerderdruck: e.foerderdruck, maxFluss: Q_MAX }
      : { id: "pumpe", art: "pumpe", a: "pu", b: "po", foerderdruck: idealePumpe, maxFluss: 1e3 },
    { id: "system", art: "druckquelle", a: "pu", druck: 1e5 },
    rohr("zu", "po", "k1", D_HAUPT, 4),
    rohr("rueck", "k2", "pu", D_HAUPT, 6),
  ];
  for (let i = 0; i < e.zweige; i++) {
    if (!e.offen[i]) continue;
    if (i === 0 && e.engstelle !== null) {
      teile.push(rohr("z0a", "k1", "e", e.d[0], 1.5), rohr("z0b", "e", "k2", e.engstelle, 1.5));
    } else teile.push(rohr(`z${i}`, "k1", "k2", e.d[i], 3));
  }
  return { knoten, teile };
}

function rechne(e: Einstellung) {
  const s = new Stroemung({ medium: e.medium, ...netz(e) });
  s.schritt(0.01);
  const zweig = (i: number) => (i === 0 && e.engstelle !== null ? s.fluss("z0a") : s.fluss(`z${i}`));
  return {
    p: { pu: s.druck("pu"), po: s.druck("po"), k1: s.druck("k1"), k2: s.druck("k2"), e: s.druck("e") },
    q: s.fluss("pumpe"),
    zweig: [0, 1, 2].map(i => (i < e.zweige && e.offen[i] ? zweig(i) : 0)),
    v: (id: string, dmm: number) => s.fluss(id) / querschnitt(dmm / 1000),
  };
}

/** Anlagenkennlinie: welcher Durchfluss bei welchem Pumpendruck (ideale Pumpe). */
function anlagenkennlinie(e: Einstellung) {
  return Array.from({ length: 13 }, (_, k) => {
    const p = (k / 12) * 2e5;
    const s = new Stroemung({ medium: e.medium, ...netz(e, Math.max(1, p)) });
    s.schritt(0.01);
    return { p, q: s.fluss("pumpe") };
  });
}

const STANDARD: Einstellung = { medium: "wasser", foerderdruck: 0.8e5, d: [20, 20, 12], offen: [true, true, true], zweige: 2, engstelle: null };
const lmin = (q: number) => `${zahl(q * 60000, q * 60000 >= 10 ? 0 : 1)} L/min`;

export default function Rohrnetz() {
  const [e, setE] = useState<Einstellung>(STANDARD);
  const [mix, setMix] = useState(0);
  const set = (t: Partial<Einstellung>) => setE(a => ({ ...a, ...t }));
  const r = useMemo(() => rechne(e), [e]);
  const kennlinie = useMemo(() => anlagenkennlinie(e), [e]);

  const versuche = [
    { name: "Doppelt so dick (Öl)", idee: "Bei zähem Öl strömt es laminar: Der doppelt so dicke Zweig lässt 16-mal so viel durch (r⁴). Probiere dasselbe mit Wasser — dort ist es »nur« etwa 5- bis 6-mal so viel.", los: () => setE({ ...STANDARD, medium: "oel", d: [10, 20, 12], zweige: 2, foerderdruck: 1.5e5 }) },
    { name: "Engstelle in Reihe", idee: "Eine Engstelle in Zweig 1 bremst nur diesen Zweig: Dort fällt viel Druck ab, und mehr Wasser nimmt den anderen Weg.", los: () => setE({ ...STANDARD, engstelle: 8 }) },
    { name: "Zweig schließen", idee: "Schließt man einen Zweig, fließt insgesamt weniger — die Pumpe liefert dann aber etwas mehr Druck (Betriebspunkt wandert auf der Kennlinie).", los: () => setE({ ...STANDARD, zweige: 3, offen: [true, false, true] }) },
    { name: "Drei Zweige", idee: "Jeder offene Zweig ist ein weiterer Weg: Der Gesamtwiderstand sinkt, der Gesamtdurchfluss steigt — Knotenregel: Q = Q₁ + Q₂ + Q₃.", los: () => setE({ ...STANDARD, zweige: 3 }) },
  ];

  // ── Geometrie ──
  const X1 = 330, X2 = 760, Y_OBEN = 110, Y_UNTEN = 480, PX = 110;
  const yZ = (i: number) => Y_OBEN + i * 150;
  const breite = (dmm: number) => 4 + dmm * 0.55;
  const yLetzt = yZ(e.zweige - 1);
  const pMin = Math.min(...Object.values(r.p)), pMax = Math.max(...Object.values(r.p));
  const pot = (p: number) => `hsl(${Math.round(120 * (pMax > pMin ? (p - pMin) / (pMax - pMin) : 1))} 75% 45%)`;
  const wasser = (p: number) => `hsl(${e.medium === "oel" ? 40 : 205} 80% ${Math.round(72 - 30 * (pMax > pMin ? (p - pMin) / (pMax - pMin) : 1))}%)`;

  interface Stueck { key: string; pts: [number, number][]; dmm: number; q: number; p: number }
  const stuecke: Stueck[] = [
    { key: "zu", pts: [[PX, 280], [PX, Y_OBEN], [X1, Y_OBEN]], dmm: D_HAUPT, q: r.q, p: (r.p.po + r.p.k1) / 2 },
    { key: "rueck", pts: [[X2, yLetzt], [X2, Y_UNTEN], [PX, Y_UNTEN], [PX, 330]], dmm: D_HAUPT, q: r.q, p: (r.p.k2 + r.p.pu) / 2 },
  ];
  for (let i = 0; i < e.zweige; i++) {
    const y = yZ(i), q = r.zweig[i];
    if (i > 0) {
      const unten = r.zweig.slice(i).reduce((a, b) => a + b, 0);
      stuecke.push({ key: `b1-${i}`, pts: [[X1, yZ(i - 1)], [X1, y]], dmm: D_HAUPT, q: unten, p: r.p.k1 });
      const oben = r.zweig.slice(0, i).reduce((a, b) => a + b, 0);
      stuecke.push({ key: `b2-${i}`, pts: [[X2, yZ(i - 1)], [X2, y]], dmm: D_HAUPT, q: oben, p: r.p.k2 });
    }
    if (i === 0 && e.engstelle !== null) {
      stuecke.push({ key: "z0a", pts: [[X1, y], [545, y]], dmm: e.d[0], q, p: (r.p.k1 + r.p.e) / 2 });
      stuecke.push({ key: "z0b", pts: [[545, y], [X2, y]], dmm: e.engstelle, q, p: (r.p.e + r.p.k2) / 2 });
    } else stuecke.push({ key: `z${i}`, pts: [[X1, y], [X2, y]], dmm: e.d[i], q, p: (r.p.k1 + r.p.k2) / 2 });
  }
  const pfad = (p: [number, number][]) => p.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

  // Strichmuster: Wasser mit v = Q/A, Strompunkte mit Q
  const striche = useRef(new Map<string, SVGPathElement>());
  const lage = useRef(stuecke);
  lage.current = stuecke;
  useEffect(() => {
    const phase = new Map<string, number>();
    let vorher = performance.now(), id = 0;
    const los = (jetzt: number) => {
      const dt = Math.min(0.05, (jetzt - vorher) / 1000);
      vorher = jetzt;
      for (const s of lage.current) {
        for (const art of ["w", "e"]) {
          const v = art === "w" ? Math.min(400, 60 * Math.abs(s.q) / querschnitt(s.dmm / 1000)) : Math.min(300, 120000 * Math.abs(s.q));
          const k = `${art}${s.key}`;
          const p = ((phase.get(k) ?? 0) + v * dt) % 1000;
          phase.set(k, p);
          striche.current.get(k)?.setAttribute("stroke-dashoffset", String(-p));
          if (art === "w") striche.current.get(k)?.setAttribute("stroke-opacity", Math.abs(s.q) > 1e-7 ? "0.6" : "0");
        }
      }
      id = requestAnimationFrame(los);
    };
    id = requestAnimationFrame(los);
    return () => cancelAnimationFrame(id);
  }, []);
  const merke = (k: string) => (el: SVGPathElement | null) => { if (el) striche.current.set(k, el); else striche.current.delete(k); };
  const wd = 1 - 0.85 * mix;

  const zweigDp = r.p.k1 - r.p.k2;

  return (
    <StationRahmen
      versuche={versuche}
      bild={
        <svg viewBox="0 0 1000 540" className="w-full h-auto select-none" role="img" aria-label="Rohrnetz mit Pumpe">
          <KitDefs />
          <defs>
            <linearGradient id="rnWand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eef1f4" /><stop offset="1" stopColor="#cfd6dd" /></linearGradient>
            <pattern id="rnRaster" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0 H0 V40" fill="none" stroke="#c3ccd4" strokeWidth={1} /></pattern>
          </defs>
          <rect width={1000} height={540} fill="url(#rnWand)" />
          <rect width={1000} height={540} fill="url(#rnRaster)" opacity={0.6} />
          {stuecke.map(s => (
            <g key={s.key}>
              <g style={{ opacity: wd }}>
                <Rohr d={pfad(s.pts)} w={breite(s.dmm)} fluessig={wasser(s.p)} merke={merke(`w${s.key}`)} />
              </g>
              <g style={{ opacity: mix }}>
                <path d={pfad(s.pts)} fill="none" stroke={pot(s.p)} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
                <path ref={merke(`e${s.key}`)} d={pfad(s.pts)} fill="none" stroke="#ffd23f" strokeOpacity={s.q > 1e-7 ? 1 : 0.4} strokeWidth={7} strokeDasharray="0 22" strokeLinecap="round" />
              </g>
            </g>
          ))}
          {/* Muffen an Knoten und Abzweigen */}
          <g style={{ opacity: wd }}>
            {Array.from({ length: e.zweige }, (_, i) => [X1, X2].map(x => <Muffe key={`${i}${x}`} x={x} y={yZ(i)} w={breite(D_HAUPT)} />))}
            {e.engstelle !== null && <Muffe x={545} y={yZ(0)} w={breite(e.d[0])} />}
            <Pumpe x={PX} y={305} r={30} laeuft={r.q > 1e-7} />
            <text x={PX + 40} y={300} fontSize={14} fontWeight={700} fill="#2f3740">Pumpe</text>
            <text x={PX + 40} y={318} fontSize={12} fill="#56616d">+{bar(r.p.po - r.p.pu)}</text>
          </g>
          <g style={{ opacity: mix }}>
            <rect x={PX - 30} y={285} width={60} height={42} style={{ fill: "var(--surface)" }} />
            <line x1={PX - 26} y1={296} x2={PX + 26} y2={296} style={{ stroke: "var(--text)" }} strokeWidth={3} />
            <line x1={PX - 13} y1={314} x2={PX + 13} y2={314} style={{ stroke: "var(--text)" }} strokeWidth={9} />
            <Pille x={PX + 95} y={350} t={`U ≙ ${bar(r.p.po - r.p.pu)}`} />
          </g>
          {/* Manometer an beiden Knoten */}
          {[{ x: X1, p: r.p.k1, n: "K₁" }, { x: X2, p: r.p.k2, n: "K₂" }].map(m => (
            <g key={m.n}>
              <line x1={m.x} y1={Y_OBEN} x2={m.x} y2={Y_OBEN - 34} stroke="#3f4a55" strokeWidth={5} />
              <Manometer x={m.x} y={Y_OBEN - 62} r={26} wert={m.p / 1e5} max={3} />
              <Pille x={m.x + (m.x === X1 ? -84 : 84)} y={Y_OBEN - 60} t={`${m.n}: ${bar(m.p)}`} />
            </g>
          ))}
          {/* Zweige: Handrad zum Öffnen/Schließen, Beschriftung, Widerstand */}
          {Array.from({ length: e.zweige }, (_, i) => {
            const y = yZ(i), q = r.zweig[i];
            const zu = !e.offen[i];
            const rx = i === 0 && e.engstelle !== null ? 650 : 545;
            return (
              <g key={i}>
                <Handrad x={X1 + 62} y={y - 30} r={14} offen={zu ? 0 : 1}
                  onClick={() => set({ offen: e.offen.map((o, k) => (k === i ? !o : o)) as Einstellung["offen"] })}
                  titel={zu ? `Zweig ${i + 1} öffnen` : `Zweig ${i + 1} schließen`} />
                <Pille x={560} y={y - 28} t={`Zweig ${i + 1}: ⌀ ${e.d[i]} mm${i === 0 && e.engstelle !== null ? ` → ${e.engstelle} mm` : ""} · ${zu ? "zu" : lmin(q)}`} farbe={zu ? "#d64541" : "#e0a000"} />
                <g style={{ opacity: mix }}>
                  {!zu && <rect x={rx - 40} y={y - 12} width={80} height={24} style={{ fill: "var(--surface)", stroke: "var(--text)" }} strokeWidth={3} />}
                  {!zu && <text x={rx} y={y + 5} textAnchor="middle" fontSize={13} fontWeight={700} style={text}>R{i + 1}</text>}
                  {!zu && q > 1e-7 && <Pille x={560} y={y + 36} t={`R = Δp/Q = ${zahl(zweigDp / 1e5 / (q * 60000) * 100, 2)} bar je 100 L/min`} />}
                </g>
              </g>
            );
          })}
          <Pille x={(PX + X2) / 2} y={Y_UNTEN + 38} t={`Q = ${lmin(r.q)}${e.zweige > 1 ? ` = ${r.zweig.slice(0, e.zweige).map(lmin).join(" + ")}` : ""}`} gross />
          <text x={PX - 40} y={Y_UNTEN + 44} fontSize={12} style={muted}>Systemdruck 1 bar</text>
        </svg>
      }
      seite={<>
        <Karte>
          <Wahl werte={[{ id: "wasser", label: "💧 Wasser" }, { id: "oel", label: "🛢️ Hydrauliköl" }]} wert={e.medium} setze={m => set({ medium: m })} />
          <Regler label={`Pumpe: ${bar(e.foerderdruck, 1)} Förderdruck`} min={0.1e5} max={2e5} step={0.05e5} wert={e.foerderdruck} setze={v => set({ foerderdruck: v })} />
          <Regler label={`Zweige: ${e.zweige}`} min={1} max={3} step={1} wert={e.zweige} setze={v => set({ zweige: v })} />
          {Array.from({ length: e.zweige }, (_, i) => (
            <Regler key={i} label={`Zweig ${i + 1}: ⌀ ${e.d[i]} mm`} min={6} max={40} step={1} wert={e.d[i]} setze={v => set({ d: e.d.map((x, k) => (k === i ? v : x)) as Einstellung["d"] })} />
          ))}
          <label className="flex items-center gap-2"><input type="checkbox" checked={e.engstelle !== null} onChange={ev => set({ engstelle: ev.target.checked ? 8 : null })} /> Engstelle in Zweig 1</label>
          {e.engstelle !== null && <Regler label={`Engstelle: ⌀ ${e.engstelle} mm`} min={4} max={30} step={1} wert={e.engstelle} setze={v => set({ engstelle: v })} />}
          <label className="flex items-center gap-2 font-bold">💧 <input type="range" min={0} max={1} step={0.01} value={mix} onChange={ev => setMix(Number(ev.target.value))} className="flex-1" aria-label="Stromkreis einblenden" /> ⚡</label>
        </Karte>
        <Karte titel="Kennlinien">
          <Kennlinie e={e} punkte={kennlinie} q={r.q} dp={r.p.po - r.p.pu} />
        </Karte>
        <Karte titel="Messwerte">
          <Werte zeilen={[
            ["Pumpe: Δp / Q", `${bar(r.p.po - r.p.pu)} / ${lmin(r.q)}`],
            ["Druckverlust Zuleitung", bar(r.p.po - r.p.k1)],
            ["Druckverlust Zweige", bar(zweigDp)],
            ...(e.engstelle !== null ? [["davon Engstelle", bar(r.p.e - r.p.k2)] as [string, string]] : []),
            ["Druckverlust Rückleitung", bar(r.p.k2 - r.p.pu)],
            ["Leistung Δp·Q", `${zahl((r.p.po - r.p.pu) * r.q, 1)} W`],
          ]} />
        </Karte>
      </>}
      unten={<Analogie>
        Die Pumpe verhält sich wie eine Batterie mit Innenwiderstand: Je mehr sie liefern muss, desto weniger Druck bleibt
        (U = U₀ − Rᵢ·I). Die Zweige sind Widerstände parallel, die Knotenregel gilt genau so. Anders als ein Draht ist ein
        Wasserrohr aber kein fester Widerstand: Bei schneller, turbulenter Strömung wächst der Druckverlust mit Q² — nur
        laminar (zähes Öl) gilt ein »Ohmsches Gesetz« Δp = R·Q.
      </Analogie>}
    />
  );
}

/** Pumpenkennlinie (fallend) und Anlagenkennlinie (steigend); Schnittpunkt = Betriebspunkt. */
function Kennlinie({ e, punkte, q, dp }: { e: Einstellung; punkte: { p: number; q: number }[]; q: number; dp: number }) {
  const W = 260, H = 170, qMax = Q_MAX, pMax = 2e5;
  const x = (qq: number) => 30 + (qq / qMax) * (W - 40);
  const y = (pp: number) => H - 25 - (pp / pMax) * (H - 40);
  const anlage = punkte.filter(pt => pt.q <= qMax * 1.05).map(pt => `${x(pt.q)},${y(pt.p)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Pumpen- und Anlagenkennlinie">
      <line x1={30} y1={H - 25} x2={W - 5} y2={H - 25} style={{ stroke: "var(--text-muted)" }} />
      <line x1={30} y1={10} x2={30} y2={H - 25} style={{ stroke: "var(--text-muted)" }} />
      <text x={W - 5} y={H - 8} textAnchor="end" fontSize={11} style={muted}>Q (bis {zahl(qMax * 60000, 0)} L/min)</text>
      <text x={34} y={18} fontSize={11} style={muted}>Δp (bis 2 bar)</text>
      <line x1={x(0)} y1={y(e.foerderdruck)} x2={x(qMax)} y2={y(0)} stroke="#e0a000" strokeWidth={2.5} />
      <polyline points={anlage} fill="none" stroke="#0ea5e9" strokeWidth={2.5} />
      <circle cx={x(q)} cy={y(dp)} r={5} style={{ fill: "var(--text)" }} />
      <text x={W - 8} y={y(0) - 6} textAnchor="end" fontSize={11} fill="#e0a000">Pumpe</text>
      <text x={x(punkte[punkte.length - 1].q) - 4} y={y(pMax) + 22} textAnchor="end" fontSize={11} fill="#0ea5e9">Anlage</text>
    </svg>
  );
}
