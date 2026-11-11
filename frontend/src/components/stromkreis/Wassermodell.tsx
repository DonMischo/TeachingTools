"use client";
/**
 * Wassermodell — die alte Analogie aus dem Physikbuch: Fass auf dem Turm,
 * weite Rohre, Ventile als Engstellen, Rückrohr zur Pumpe. Ein Regler blendet
 * die elektrische Bedeutung darüber (Batterie, Leiter, Widerstände, Ströme,
 * Potenziale). Gerechnet wird in `lib/stromkreis/wasser.ts`.
 */
import { useEffect, useRef, useState } from "react";
import { rechne, type Aufbau, type WasserEinstellung } from "@/lib/stromkreis/wasser";

const Y = 300;          // Hauptrohr
const RUECK = 490;      // Rückrohr
const BODEN = 520;
const PUMPE = { x: 130, y: RUECK };
const FASS2 = { x: 830, y: 380, w: 100, h: 90 };
const U_MAX = 12;

type Pkt = [number, number];
type Fokus = "strom" | "spannung" | "widerstand" | "spannungsfall" | "dimension" | "kreis" | "knoten";

const zahl = (x: number) => (Math.abs(x) < 0.005 ? "0" : x.toLocaleString("de-DE", { maximumFractionDigits: Math.abs(x) < 10 ? 2 : 1 }));
const pfad = (p: Pkt[]) => p.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
/** Wasser: hell = wenig Druck, dunkel = viel Druck. */
const wasserFarbe = (phi: number) => `hsl(205 85% ${Math.round(78 - 43 * Math.min(1, Math.max(0, phi / U_MAX)))}%)`;
/** Wie im Schaltplan: grün = hohes Potenzial, rot = niedriges. */
const potFarbe = (phi: number, u: number) => `hsl(${Math.round(120 * Math.min(1, Math.max(0, u > 0 ? phi / u : 0)))} 75% 45%)`;
const ventilOffen = (r: number) => Math.min(1, Math.max(0.08, 1 - Math.log10(r) / 2.2));
const ohm = (x: number) => `${zahl(x)} Ω`;

interface Rohrstueck { key: string; pts: Pkt[]; phi: number; strom: number }

const VERSUCHE: { name: string; e: Partial<WasserEinstellung>; idee: string }[] = [
  { name: "Grundkreis", e: { aufbau: "einzeln", hoehe: 9, ventil1: 10, rohr: 3, geschlossen: true }, idee: "Dreh am Ventil: Je enger die Stelle, desto weniger fließt — und desto mehr Druck geht genau dort verloren." },
  { name: "Kreis offen", e: { geschlossen: false }, idee: "Das Rückrohr ist abgesperrt: Nichts fließt, aber vor der Sperre steht der volle Druck. Genauso liegt an einem offenen Schalter die ganze Spannung." },
  { name: "Zu dünne Rohre", e: { aufbau: "einzeln", ventil1: 2, rohr: 1, geschlossen: true }, idee: "Bei dünnen Rohren geht schon in der Leitung viel Druck verloren. Darum nimmt man für große Ströme dicke Kabel (Dimensionierung)." },
  { name: "Zwei in Reihe", e: { aufbau: "reihe", ventil1: 10, ventil2: 30, geschlossen: true }, idee: "Überall fließt dasselbe Wasser. Die Druckverluste teilen sich auf: am engeren Ventil fällt mehr ab (Spannungsteiler)." },
  { name: "Knoten (parallel)", e: { aufbau: "parallel", ventil1: 10, ventil2: 40, geschlossen: true }, idee: "Was in den Knoten hineinfließt, fließt auch wieder heraus: I = I₁ + I₂. Durchs weitere Ventil geht mehr." },
];

const ANALOGIE: { fokus: Fokus; strom: string; wasser: string; einheit: string }[] = [
  { fokus: "strom", strom: "Elektrischer Strom I", wasser: "Wasserdurchfluss", einheit: "Ampere (A) ≙ L/s" },
  { fokus: "spannung", strom: "Elektrische Spannung U", wasser: "Wasserdruck (Höhe des Fasses)", einheit: "Volt (V) ≙ m" },
  { fokus: "widerstand", strom: "Elektrischer Widerstand R", wasser: "Engstelle / Reibung im Rohr", einheit: "Ohm (Ω)" },
  { fokus: "spannungsfall", strom: "Spannungsfall U_R", wasser: "Druckverlust am Ventil", einheit: "Volt (V) ≙ m" },
  { fokus: "dimension", strom: "Dimensionierung", wasser: "Rohrgröße passend zum Durchfluss", einheit: "dickes Kabel = kleiner R" },
  { fokus: "kreis", strom: "Geschlossener Kreis", wasser: "Wasser muss zum Fass zurück", einheit: "offen ⇒ I = 0" },
  { fokus: "knoten", strom: "Knotenregel (Kirchhoff)", wasser: "Was zufließt, fließt ab", einheit: "Σ I = 0" },
];

export default function Wassermodell() {
  const [e, setE] = useState<WasserEinstellung>({ aufbau: "einzeln", hoehe: 9, ventil1: 10, ventil2: 30, rohr: 3, geschlossen: true });
  const [mix, setMix] = useState(0);
  const [fokus, setFokus] = useState<Fokus | null>(null);
  const [idee, setIdee] = useState<string | null>(VERSUCHE[0].idee);
  const z = rechne(e);
  const set = (teil: Partial<WasserEinstellung>) => setE(a => ({ ...a, ...teil }));

  // Geometrie, die von der Einstellung abhängt
  const tb = Y - 15 * e.hoehe;               // Unterkante des Fasses auf dem Turm
  const W = 8 + 5 * e.rohr;                  // Rohrdicke in px
  const U = e.hoehe;
  const offen = !e.geschlossen;

  const stuecke: Rohrstueck[] = [
    { key: "steig", pts: [[PUMPE.x, PUMPE.y - 22], [PUMPE.x, tb]], phi: U, strom: z.strom },
    { key: "zu", pts: [[190, tb - 20], [230, tb - 20], [230, Y], [400, Y]], phi: (U + z.phi.vor) / 2, strom: z.strom },
    { key: "ab", pts: [[600, Y], [880, Y], [880, FASS2.y]], phi: (z.phi.nach + z.phi.fass) / 2, strom: z.strom },
    { key: "rueck1", pts: [[880, FASS2.y + FASS2.h], [880, RUECK], [522, RUECK]], phi: offen ? U : z.phi.fass * 0.75, strom: z.strom },
    { key: "rueck2", pts: [[478, RUECK], [PUMPE.x + 22, RUECK]], phi: offen ? 0 : z.phi.fass * 0.25, strom: z.strom },
  ];
  // Ventile: Lage, Strom, Widerstand, Spannungsfall
  const ventile: { cx: number; cy: number; r: number; i: number; u: number; p: number; nr: string }[] = [];
  if (e.aufbau === "einzeln") {
    stuecke.push({ key: "b1", pts: [[400, Y], [460, Y]], phi: z.phi.vor, strom: z.strom }, { key: "b2", pts: [[540, Y], [600, Y]], phi: z.phi.nach, strom: z.strom });
    ventile.push({ cx: 500, cy: Y, r: e.ventil1, i: z.i1, u: z.u1, p: z.p1, nr: "" });
  } else if (e.aufbau === "reihe") {
    stuecke.push(
      { key: "b1", pts: [[400, Y], [415, Y]], phi: z.phi.vor, strom: z.strom },
      { key: "b2", pts: [[485, Y], [515, Y]], phi: z.phi.mitte, strom: z.strom },
      { key: "b3", pts: [[585, Y], [600, Y]], phi: z.phi.nach, strom: z.strom },
    );
    ventile.push({ cx: 450, cy: Y, r: e.ventil1, i: z.i1, u: z.u1, p: z.p1, nr: "₁" }, { cx: 550, cy: Y, r: e.ventil2, i: z.i2, u: z.u2, p: z.p2, nr: "₂" });
  } else {
    stuecke.push(
      { key: "k1", pts: [[400, Y], [415, Y]], phi: z.phi.vor, strom: z.strom },
      { key: "o1", pts: [[415, Y], [415, 245], [460, 245]], phi: z.phi.vor, strom: z.i1 },
      { key: "u1", pts: [[415, Y], [415, 355], [460, 355]], phi: z.phi.vor, strom: z.i2 },
      { key: "o2", pts: [[540, 245], [585, 245], [585, Y]], phi: z.phi.nach, strom: z.i1 },
      { key: "u2", pts: [[540, 355], [585, 355], [585, Y]], phi: z.phi.nach, strom: z.i2 },
      { key: "k2", pts: [[585, Y], [600, Y]], phi: z.phi.nach, strom: z.strom },
    );
    ventile.push({ cx: 500, cy: 245, r: e.ventil1, i: z.i1, u: z.u1, p: z.p1, nr: "₁" }, { cx: 500, cy: 355, r: e.ventil2, i: z.i2, u: z.u2, p: z.p2, nr: "₂" });
  }

  // Schaltplan-Ansicht: eigene Leitungen, die Batterie sitzt im Steigrohr (oben +, unten −).
  const yBat = (tb + RUECK) / 2;
  const mitteFass2 = FASS2.y + FASS2.h / 2;
  const leitungen: Rohrstueck[] = [
    { key: "e:zu", pts: [[PUMPE.x, yBat - 10], [PUMPE.x, tb - 20], [230, tb - 20], [230, Y], [400, Y]], phi: (U + z.phi.vor) / 2, strom: z.strom },
    ...stuecke.filter(s => !["steig", "zu", "ab", "rueck1", "rueck2"].includes(s.key)).map(s => ({ ...s, key: `e:${s.key}` })),
    { key: "e:ab", pts: [[600, Y], [880, Y], [880, mitteFass2]], phi: (z.phi.nach + z.phi.fass) / 2, strom: z.strom },
    { key: "e:r1", pts: [[880, mitteFass2], [880, RUECK], [522, RUECK]], phi: offen ? U : z.phi.fass * 0.75, strom: z.strom },
    { key: "e:r2", pts: [[478, RUECK], [PUMPE.x, RUECK], [PUMPE.x, yBat + 10]], phi: offen ? 0 : z.phi.fass * 0.25, strom: z.strom },
  ];

  // Fließendes Wasser und Strompunkte wandern, ohne React neu zu rendern:
  // Wasser mit v ∝ I / A (dünnes Rohr = schneller), Punkte im Draht mit v ∝ I.
  const striche = useRef(new Map<string, SVGPathElement>());
  const lage = useRef({ alle: [...stuecke, ...leitungen], rohr: e.rohr });
  lage.current = { alle: [...stuecke, ...leitungen], rohr: e.rohr };
  useEffect(() => {
    const phase = new Map<string, number>();
    let vorher = performance.now(), id = 0;
    const schritt = (jetzt: number) => {
      const dt = Math.min(0.1, (jetzt - vorher) / 1000);
      vorher = jetzt;
      const { alle, rohr } = lage.current;
      for (const s of alle) {
        const v = s.key.startsWith("e:") ? Math.min(300, 45 * s.strom) : Math.min(400, (160 * s.strom) / (rohr * rohr));
        const p = ((phase.get(s.key) ?? 0) + v * dt) % 1100;
        phase.set(s.key, p);
        striche.current.get(s.key)?.setAttribute("stroke-dashoffset", String(-p));
      }
      id = requestAnimationFrame(schritt);
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
  }, []);
  const merke = (key: string) => (el: SVGPathElement | null) => { if (el) striche.current.set(key, el); else striche.current.delete(key); };

  // Wasser verblasst zur Andeutung, die Elektrik kommt dazu.
  const wasserDeckung = 1 - 0.85 * mix;
  const text = { fill: "var(--text)" } as const;
  const muted = { fill: "var(--text-muted)" } as const;
  const DRAHT = "var(--text)";

  /** Beschriftung der Elektrik: Wert auf einer Pille, in beiden Farbschemata lesbar. */
  const pille = (x: number, y: number, t: string, key: string, gross = false) => {
    const fs = gross ? 16 : 14;
    const w = t.length * fs * 0.56 + 16;
    return (
      <g key={key}>
        <rect x={x - w / 2} y={y - fs + 1} width={w} height={fs + 8} rx={(fs + 8) / 2} style={{ fill: "var(--surface)" }} stroke="#e0a000" strokeWidth={1.5} />
        <text x={x} y={y + 3} textAnchor="middle" fontSize={fs} fontWeight={700} style={text}>
          {/* »U_R« → U mit tiefgestelltem R */}
          {t.split(/_(\w)/).map((teil, i) => (i % 2 ? <tspan key={i} fontSize={fs * 0.7} dy={3}>{teil}</tspan> : <tspan key={i} dy={i ? -3 : 0}>{teil}</tspan>))}
        </text>
      </g>
    );
  };

  const manometer = (x: number, phi: number, name: string) => {
    const w = (-135 + 270 * Math.min(1, Math.max(0, phi / U_MAX))) * Math.PI / 180;
    const cy = Y - W / 2 - 34;
    const vy = Y - 46;
    return (
      <g key={name}>
        <g style={{ opacity: wasserDeckung }}>
          <line x1={x} y1={Y - W / 2} x2={x} y2={cy + 14} stroke="#7b8794" strokeWidth={4} />
          <circle cx={x} cy={cy} r={15} fill="#f8f8f4" stroke="#56616d" strokeWidth={2.5} />
          <line x1={x} y1={cy} x2={x + 11 * Math.sin(w)} y2={cy - 11 * Math.cos(w)} stroke="#c0392b" strokeWidth={2} strokeLinecap="round" />
          <text x={x} y={cy - 20} textAnchor="middle" fontSize={11} style={muted}>{zahl(phi)} m</text>
        </g>
        {/* Spannungsmesser gegen den Minuspol */}
        <g style={{ opacity: mix }}>
          <line x1={x} y1={Y} x2={x} y2={vy + 14} style={{ stroke: DRAHT }} strokeWidth={1.5} strokeDasharray="3 3" />
          <circle cx={x} cy={vy} r={14} style={{ fill: "var(--surface)", stroke: "var(--text)" }} strokeWidth={2} />
          <text x={x} y={vy + 5} textAnchor="middle" fontSize={14} fontWeight={700} style={text}>V</text>
          {pille(x, vy - 26, `${zahl(phi)} V`, `p${name}`)}
        </g>
      </g>
    );
  };

  const markierung = (x: number, y: number, w: number, h: number, k: string) => (
    <rect key={k} x={x} y={y} width={w} height={h} rx={10} fill="none" stroke="var(--accent)" strokeWidth={3} strokeDasharray="8 6" className="animate-pulse" />
  );
  const FOKUS: Record<Fokus, [number, number, number, number][]> = {
    strom: [[225, Y - 30, 175, 60], [140, RUECK - 25, 740, 50]],
    spannung: [[20, tb - 100, 190, Y - tb + 110]],
    widerstand: ventile.map(v => [v.cx - 50, v.cy - 60, 100, 100] as [number, number, number, number]),
    spannungsfall: [[355, Y - W / 2 - 75, 60, 80], [585, Y - W / 2 - 75, 60, 80]],
    dimension: [[620, Y - 30, 250, 60]],
    kreis: [[460, RUECK - 40, 80, 70], [FASS2.x - 15, FASS2.y - 15, FASS2.w + 30, FASS2.h + 50]],
    knoten: e.aufbau === "parallel" ? [[395, Y - 25, 40, 50], [565, Y - 25, 40, 50]] : [],
  };

  const chip = (an: boolean) => `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;
  const AUFBAUTEN: { a: Aufbau; l: string }[] = [{ a: "einzeln", l: "Ein Ventil" }, { a: "reihe", l: "Zwei in Reihe" }, { a: "parallel", l: "Zwei parallel" }];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line p-1 bg-surface">
          {AUFBAUTEN.map(x => <button key={x.a} className={chip(e.aufbau === x.a)} onClick={() => set({ aufbau: x.a })}>{x.l}</button>)}
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          💧 Wasser
          <input type="range" min={0} max={1} step={0.01} value={mix} onChange={ev => setMix(Number(ev.target.value))} aria-label="Elektrische Bedeutung einblenden" className="w-40" />
          ⚡ Strom
        </label>
        <button className="btn btn-secondary" onClick={() => setMix(m => (m < 0.5 ? 1 : 0))}>{mix < 0.5 ? "⚡ Elektrik einblenden" : "💧 Nur Wasser"}</button>
        <select className="input w-auto" value="" aria-label="Versuch laden" onChange={ev => { const v = VERSUCHE.find(x => x.name === ev.target.value); if (v) { set(v.e); setIdee(v.idee); } }}>
          <option value="">🧪 Versuch …</option>
          {VERSUCHE.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
        </select>
      </div>
      {idee && <div className="text-sm text-muted">💡 {idee}</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card p-2 min-w-0">
          <svg viewBox="0 0 1000 560" className="w-full h-auto select-none" role="img" aria-label="Wassermodell des Stromkreises">
            {/* Boden */}
            <line x1={0} y1={BODEN} x2={1000} y2={BODEN} stroke="#8d7b62" strokeWidth={3} style={{ opacity: wasserDeckung }} />

            {/* ── Wasserbild ── */}
            <g style={{ opacity: wasserDeckung }}>
              {/* Turm */}
              <rect x={60} y={tb} width={140} height={8} fill="#8b5a2b" />
              <line x1={72} y1={tb + 8} x2={58} y2={BODEN} stroke="#8b5a2b" strokeWidth={8} />
              <line x1={188} y1={tb + 8} x2={202} y2={BODEN} stroke="#8b5a2b" strokeWidth={8} />
              {tb < BODEN - 60 && <path d={`M70 ${tb + 30} L195 ${BODEN - 10} M190 ${tb + 30} L65 ${BODEN - 10}`} stroke="#a0703c" strokeWidth={4} />}
              <Fass x={70} y={tb - 90} w={120} h={90} pegel={0.85} />
              <text x={130} y={tb - 100} textAnchor="middle" fontSize={13} style={text}>Fass (Quelle)</text>
              <Fass x={FASS2.x} y={FASS2.y} w={FASS2.w} h={FASS2.h} pegel={0.5} />
              <text x={FASS2.x + FASS2.w / 2} y={FASS2.y + FASS2.h + 46} textAnchor="middle" fontSize={12} style={text}>zurück ins Fass</text>
              <text x={320} y={Y - W / 2 - 60} textAnchor="middle" fontSize={12} style={muted}>Weites Rohr</text>
              <text x={740} y={Y - W / 2 - 10} textAnchor="middle" fontSize={12} style={muted}>Weites Rohr</text>
              <text x={330} y={RUECK + 26} textAnchor="middle" fontSize={12} style={muted}>Rückrohr</text>
              <text x={PUMPE.x} y={RUECK + 42} textAnchor="middle" fontSize={12} style={text}>Pumpe</text>
              {stuecke.map(s => (
                <g key={s.key}>
                  <path d={pfad(s.pts)} fill="none" stroke="#7b8794" strokeWidth={W} strokeLinejoin="round" />
                  <path d={pfad(s.pts)} fill="none" stroke={wasserFarbe(s.phi)} strokeWidth={W - 5} strokeLinejoin="round" />
                  <path ref={merke(s.key)} d={pfad(s.pts)} fill="none" stroke="#ffffff" strokeOpacity={s.strom > 1e-6 ? 0.7 : 0} strokeWidth={Math.max(2, W / 5)} strokeDasharray="6 14" strokeLinecap="round" />
                </g>
              ))}
              <circle cx={PUMPE.x} cy={PUMPE.y} r={22} fill="#56616d" stroke="#2f3740" strokeWidth={3} />
              <Laufrad x={PUMPE.x} y={PUMPE.y} drehen={z.strom > 1e-6} sichtbar={1} />
            </g>
            {/* Höhenpfeil = Spannung der Quelle */}
            <line x1={30} y1={tb} x2={30} y2={Y} stroke="#56616d" strokeWidth={1.5} markerStart="url(#pfeilA)" markerEnd="url(#pfeilB)" style={{ opacity: wasserDeckung }} />
            <text x={38} y={(tb + Y) / 2} fontSize={12} style={{ ...text, opacity: wasserDeckung }}>h = {zahl(e.hoehe)} m</text>

            {/* ── Schaltplan ── */}
            <g style={{ opacity: mix }} pointerEvents="none">
              {leitungen.map(s => (
                <g key={s.key}>
                  {/* Leitung im Potenzial gefärbt, darüber die Strompunkte (technische Richtung) */}
                  <path d={pfad(s.pts)} fill="none" stroke={potFarbe(s.phi, U)} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
                  <path ref={merke(s.key)} d={pfad(s.pts)} fill="none" stroke="#ffd23f" strokeWidth={7} strokeDasharray="0 22" strokeLinecap="round" />
                </g>
              ))}
              {e.aufbau === "parallel" && [415, 585].map(x => <circle key={x} cx={x} cy={Y} r={7} style={{ fill: "var(--text)" }} />)}

              {/* Batterie: langer Strich = Pluspol */}
              <line x1={PUMPE.x - 26} y1={yBat - 10} x2={PUMPE.x + 26} y2={yBat - 10} style={{ stroke: "var(--text)" }} strokeWidth={3} />
              <line x1={PUMPE.x - 13} y1={yBat + 10} x2={PUMPE.x + 13} y2={yBat + 10} style={{ stroke: "var(--text)" }} strokeWidth={9} />
              <text x={PUMPE.x + 34} y={yBat - 4} fontSize={20} fontWeight={700} fill="#2e9e3e">+</text>
              <text x={PUMPE.x + 34} y={yBat + 22} fontSize={20} fontWeight={700} fill="#d64541">−</text>
              {pille(PUMPE.x - 72, yBat + 6, `U = ${zahl(U)} V`, "quelle", true)}

              {/* Schalter im Rückleiter */}
              <circle cx={478} cy={RUECK} r={5} style={{ fill: "var(--text)" }} />
              <circle cx={522} cy={RUECK} r={5} style={{ fill: "var(--text)" }} />
              <line x1={522} y1={RUECK} x2={offen ? 484 : 478} y2={offen ? RUECK - 24 : RUECK} style={{ stroke: "var(--text)" }} strokeWidth={4} strokeLinecap="round" />

              {/* Strompfeile und Werte */}
              {pille(315, Y + 34, `I = ${zahl(z.strom)} A →`, "i-zu", true)}
              {pille(330, RUECK - 22, `← I = ${zahl(z.strom)} A`, "i-rueck", true)}
              {pille(740, Y + 34, `Leiter ${ohm(z.rAb)}: −${zahl(z.uAb)} V`, "l-ab")}
              {pille(315, Y + 62, `Leiter ${ohm(z.rZu)}: −${zahl(z.uZu)} V`, "l-zu")}
              {pille(700, RUECK - 22, `Rückleiter ${ohm(z.rRueck)}: −${zahl(z.uRueck)} V`, "l-rueck")}
              {pille(500, RUECK + 34, offen ? `Schalter offen: an ihm liegen ${zahl(U)} V` : "Schalter geschlossen", "schalter")}
              {pille(880, FASS2.y + FASS2.h + 62, "zum Minuspol (−)", "minus")}
              {e.aufbau === "parallel" && pille(500, 355 + W / 2 + 62, `Knoten: ${zahl(z.strom)} A = ${zahl(z.i1)} A + ${zahl(z.i2)} A`, "knoten", true)}
            </g>

            {/* Ventile = Widerstände */}
            {ventile.map((v, n) => {
              const o = ventilOffen(v.r);
              const glut = Math.min(0.85, v.p / 15);
              return (
                <g key={n}>
                  {/* Wärme: an der Engstelle wie im Widerstand */}
                  <circle cx={v.cx} cy={v.cy} r={34} fill="#ff7a1a" opacity={glut * 0.5} />
                  <g style={{ opacity: wasserDeckung }}>
                    <rect x={v.cx - 40} y={v.cy - W / 2 - 4} width={8} height={W + 8} fill="#56616d" />
                    <rect x={v.cx + 32} y={v.cy - W / 2 - 4} width={8} height={W + 8} fill="#56616d" />
                    <rect x={v.cx - 32} y={v.cy - W / 2 - 6} width={64} height={W + 12} rx={8} fill="#8a949e" stroke="#4a545e" strokeWidth={2} />
                    <path
                      d={`M${v.cx - 30} ${v.cy - (W - 5) / 2} L${v.cx - 8} ${v.cy - (W - 5) / 2} L${v.cx} ${v.cy - (W - 5) * o / 2} L${v.cx + 8} ${v.cy - (W - 5) / 2} L${v.cx + 30} ${v.cy - (W - 5) / 2}
                          L${v.cx + 30} ${v.cy + (W - 5) / 2} L${v.cx + 8} ${v.cy + (W - 5) / 2} L${v.cx} ${v.cy + (W - 5) * o / 2} L${v.cx - 8} ${v.cy + (W - 5) / 2} L${v.cx - 30} ${v.cy + (W - 5) / 2} Z`}
                      fill={wasserFarbe((z.phi.vor + z.phi.nach) / 2)}
                    />
                    <line x1={v.cx} y1={v.cy - W / 2 - 6} x2={v.cx} y2={v.cy - W / 2 - 22} stroke="#4a545e" strokeWidth={4} />
                    <g transform={`rotate(${o * 270} ${v.cx} ${v.cy - W / 2 - 26})`}>
                      <circle cx={v.cx} cy={v.cy - W / 2 - 26} r={13} fill="none" stroke="#b03a2e" strokeWidth={4} />
                      <path d={`M${v.cx - 13} ${v.cy - W / 2 - 26} H${v.cx + 13} M${v.cx} ${v.cy - W / 2 - 39} V${v.cy - W / 2 - 13}`} stroke="#b03a2e" strokeWidth={2.5} />
                    </g>
                    <text x={v.cx} y={v.cy + W / 2 + 22} textAnchor="middle" fontSize={12} style={muted}>Ventil{v.nr} · −{zahl(v.u)} m</text>
                  </g>
                  {/* Widerstand nach DIN: Rechteck */}
                  <g style={{ opacity: mix }}>
                    <rect x={v.cx - 48} y={v.cy - 13} width={96} height={26} style={{ fill: "var(--surface)", stroke: "var(--text)" }} strokeWidth={3} />
                    <text x={v.cx} y={v.cy + 5} textAnchor="middle" fontSize={13} fontWeight={700} style={text}>R{v.nr} = {ohm(v.r)}</text>
                    {e.aufbau === "parallel" && pille(v.cx, v.cy - 30, `I${v.nr} = ${zahl(v.i)} A`, `i${n}`)}
                    {/* In Reihe stehen die Ventile dicht: das erste oben, das zweite unten beschriften. */}
                    {e.aufbau === "reihe" && n === 0
                      ? pille(495, v.cy - 30, `U₁ = ${zahl(v.u)} V · P = ${zahl(v.p)} W`, `u${n}`)
                      : pille(v.cx, v.cy + 36, `U${v.nr || "_R"} = ${zahl(v.u)} V · P = ${zahl(v.p)} W`, `u${n}`)}
                  </g>
                </g>
              );
            })}

            {/* Absperrhahn im Rückrohr = Schalter (klickbar) */}
            <g onClick={() => set({ geschlossen: !e.geschlossen })} style={{ cursor: "pointer" }}>
              <rect x={470} y={RUECK - 30} width={60} height={50} fill="transparent" />
              <g style={{ opacity: wasserDeckung }}>
                <rect x={478} y={RUECK - W / 2 - 4} width={44} height={W + 8} rx={6} fill="#8a949e" stroke="#4a545e" strokeWidth={2} />
                <rect x={484} y={RUECK - (W - 5) / 2} width={32} height={W - 5} fill={offen ? "#8a949e" : wasserFarbe(z.phi.fass / 2)} />
                <line x1={500} y1={RUECK - W / 2 - 4} x2={500} y2={RUECK - W / 2 - 16} stroke="#4a545e" strokeWidth={4} />
                <line x1={offen ? 500 : 482} y1={RUECK - W / 2 - 18} x2={offen ? 500 : 518} y2={offen ? RUECK - W / 2 - 40 : RUECK - W / 2 - 18} stroke="#b03a2e" strokeWidth={6} strokeLinecap="round" />
                <text x={500} y={RUECK + W / 2 + 18} textAnchor="middle" fontSize={11} style={muted}>{offen ? "Hahn zu" : "Hahn offen"} (klicken)</text>
              </g>
            </g>

            {/* Manometer = Spannungsmesser */}
            {manometer(255, U, "A")}
            {manometer(385, z.phi.vor, "B")}
            {manometer(615, z.phi.nach, "C")}
            {manometer(800, z.phi.fass, "D")}

            {fokus && FOKUS[fokus].map((r, i) => markierung(...r, `${fokus}${i}`))}

            <defs>
              <marker id="pfeilA" viewBox="0 0 10 10" refX={5} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#56616d" /></marker>
              <marker id="pfeilB" viewBox="0 0 10 10" refX={5} refY={5} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#56616d" /></marker>
            </defs>
          </svg>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-4 flex flex-col gap-3 text-sm">
            <Regler label={`Höhe des Fasses: ${zahl(e.hoehe)} m ≙ ${zahl(e.hoehe)} V`} min={0} max={U_MAX} step={0.5} wert={e.hoehe} setze={v => set({ hoehe: v })} />
            <Regler label={`Ventil${e.aufbau === "einzeln" ? "" : " 1"}: ${ohm(e.ventil1)}`} min={0} max={2} step={0.01} wert={Math.log10(e.ventil1)} setze={v => set({ ventil1: Math.round(10 ** v * 10) / 10 })} />
            {e.aufbau !== "einzeln" && (
              <Regler label={`Ventil 2: ${ohm(e.ventil2)}`} min={0} max={2} step={0.01} wert={Math.log10(e.ventil2)} setze={v => set({ ventil2: Math.round(10 ** v * 10) / 10 })} />
            )}
            <Regler label={`Rohre: ${["", "dünn", "mittel", "weit", "sehr weit"][e.rohr]} (Leitung gesamt ${ohm(z.rZu + z.rAb + z.rRueck)})`} min={1} max={4} step={1} wert={e.rohr} setze={v => set({ rohr: v })} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={e.geschlossen} onChange={ev => set({ geschlossen: ev.target.checked })} />
              Rückrohr offen — Kreis geschlossen
            </label>
          </div>
          <div className="card p-4 text-sm">
            <table className="w-full">
              <thead><tr className="text-muted text-left"><th></th><th>💧 Wasser</th><th>⚡ Strom</th></tr></thead>
              <tbody className="[&_td]:py-1">
                <tr><td className="text-muted">Antrieb</td><td>{zahl(U)} m</td><td>U = {zahl(U)} V</td></tr>
                <tr><td className="text-muted">Fluss</td><td>{zahl(z.strom)} L/s</td><td>I = {zahl(z.strom)} A</td></tr>
                {e.aufbau !== "einzeln" && <tr><td className="text-muted">Zweige</td><td>{zahl(z.i1)} | {zahl(z.i2)} L/s</td><td>I₁ = {zahl(z.i1)} A, I₂ = {zahl(z.i2)} A</td></tr>}
                <tr><td className="text-muted">Engstelle</td><td>Verlust {zahl(z.strom * z.rVentile)} m</td><td>R = {ohm(z.rVentile)}</td></tr>
                <tr><td className="text-muted">Rohre</td><td>Verlust {zahl(z.uZu + z.uAb + z.uRueck)} m</td><td>R = {ohm(z.rZu + z.rAb + z.rRueck)}</td></tr>
                <tr><td className="text-muted">Gesamt</td><td></td><td>R = {ohm(z.rGesamt)}</td></tr>
                <tr><td className="text-muted">Leistung</td><td></td><td>P = U·I = {zahl(z.pQuelle)} W</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-muted mt-2">Maßstab: 1 m Höhe ≙ 1 V, 1 L/s ≙ 1 A. Die Pumpe hält den Wasserstand im Fass — wie die Batterie die Spannung.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
        {ANALOGIE.map(a => (
          <button
            key={a.fokus}
            className={`card p-3 text-left text-sm transition-colors ${fokus === a.fokus ? "border-accent" : ""}`}
            onMouseEnter={() => setFokus(a.fokus)} onMouseLeave={() => setFokus(null)}
            onFocus={() => setFokus(a.fokus)} onBlur={() => setFokus(null)}
            onClick={() => { if (a.fokus === "knoten") set({ aufbau: "parallel" }); if (a.fokus === "kreis") set({ geschlossen: !e.geschlossen }); }}
          >
            <div className="font-bold">{a.strom}</div>
            <div className="text-muted">= {a.wasser}</div>
            <div className="text-xs text-muted mt-1">{a.einheit}</div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">Die Wasseranalogie stammt aus Physikbüchern des späten 19. Jahrhunderts. Sie trägt bis zu Spannung, Strom, Widerstand und den Kirchhoffschen Regeln — nicht aber für Wechselstrom, Magnetfelder oder dafür, dass Ladungen im Draht nicht »auslaufen«.</p>
    </div>
  );
}

function Regler({ label, min, max, step, wert, setze }: { label: string; min: number; max: number; step: number; wert: number; setze: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={wert} onChange={ev => setze(Number(ev.target.value))} aria-label={label} />
    </label>
  );
}

function Fass({ x, y, w, h, pegel }: { x: number; y: number; w: number; h: number; pegel: number }) {
  const wy = y + h * (1 - pegel);
  return (
    <g>
      <path d={`M${x} ${y} Q${x - 8} ${y + h / 2} ${x} ${y + h} H${x + w} Q${x + w + 8} ${y + h / 2} ${x + w} ${y} Z`} fill="#a0703c" stroke="#5c3a1a" strokeWidth={2.5} />
      <rect x={x + 4} y={wy} width={w - 8} height={y + h - wy - 3} fill="hsl(205 80% 55%)" opacity={0.75} />
      {[0.18, 0.5, 0.82].map(f => <line key={f} x1={x - 4} y1={y + h * f} x2={x + w + 4} y2={y + h * f} stroke="#55606b" strokeWidth={4} />)}
      <ellipse cx={x + w / 2} cy={y} rx={w / 2} ry={7} fill="hsl(205 80% 60%)" stroke="#5c3a1a" strokeWidth={2} />
    </g>
  );
}

/** Laufrad der Pumpe; dreht sich, solange Wasser fließt. */
function Laufrad({ x, y, drehen, sichtbar }: { x: number; y: number; drehen: boolean; sichtbar: number }) {
  return (
    <g style={{ opacity: sichtbar }}>
      <g className={drehen ? "animate-spin" : undefined} style={{ transformOrigin: `${x}px ${y}px` }}>
        {[0, 60, 120].map(a => (
          <line key={a} x1={x - 15 * Math.cos(a * Math.PI / 180)} y1={y - 15 * Math.sin(a * Math.PI / 180)} x2={x + 15 * Math.cos(a * Math.PI / 180)} y2={y + 15 * Math.sin(a * Math.PI / 180)} stroke="#d8dee4" strokeWidth={3} />
        ))}
      </g>
    </g>
  );
}

