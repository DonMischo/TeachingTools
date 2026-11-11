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

  // Fließendes Wasser: Strichmuster wandern mit v ∝ I / A, ohne React neu zu rendern.
  const striche = useRef(new Map<string, SVGPathElement>());
  const lage = useRef({ stuecke, rohr: e.rohr });
  lage.current = { stuecke, rohr: e.rohr };
  useEffect(() => {
    const phase = new Map<string, number>();
    let vorher = performance.now(), id = 0;
    const schritt = (jetzt: number) => {
      const dt = Math.min(0.1, (jetzt - vorher) / 1000);
      vorher = jetzt;
      const { stuecke: st, rohr } = lage.current;
      for (const s of st) {
        const v = Math.min(400, (160 * s.strom) / (rohr * rohr));
        const p = ((phase.get(s.key) ?? 0) + v * dt) % 1000;
        phase.set(s.key, p);
        striche.current.get(s.key)?.setAttribute("stroke-dashoffset", String(-p));
      }
      id = requestAnimationFrame(schritt);
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
  }, []);

  const wasserDeckung = 1 - 0.7 * mix;
  const text = { fill: "var(--text)" } as const;
  const muted = { fill: "var(--text-muted)" } as const;
  const elek = { fill: "#e0a000", fontWeight: 700 } as const;

  const manometer = (x: number, phi: number, name: string) => {
    const w = (-135 + 270 * Math.min(1, Math.max(0, phi / U_MAX))) * Math.PI / 180;
    const cy = Y - W / 2 - 34;
    return (
      <g key={name}>
        <line x1={x} y1={Y - W / 2} x2={x} y2={cy + 14} stroke="#7b8794" strokeWidth={4} />
        <circle cx={x} cy={cy} r={15} fill="#f8f8f4" stroke="#56616d" strokeWidth={2.5} />
        <line x1={x} y1={cy} x2={x + 11 * Math.sin(w)} y2={cy - 11 * Math.cos(w)} stroke="#c0392b" strokeWidth={2} strokeLinecap="round" />
        <text x={x} y={cy - 20} textAnchor="middle" fontSize={11} style={{ ...muted, opacity: wasserDeckung }}>{zahl(phi)} m</text>
        <text x={x} y={cy - 20} textAnchor="middle" fontSize={12} style={{ ...elek, opacity: mix }}>φ = {zahl(phi)} V</text>
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
            <line x1={0} y1={BODEN} x2={1000} y2={BODEN} stroke="#8d7b62" strokeWidth={3} />

            {/* ── Wasserbild ── */}
            <g style={{ opacity: wasserDeckung }}>
              {/* Turm */}
              <rect x={60} y={tb} width={140} height={8} fill="#8b5a2b" />
              <line x1={72} y1={tb + 8} x2={58} y2={BODEN} stroke="#8b5a2b" strokeWidth={8} />
              <line x1={188} y1={tb + 8} x2={202} y2={BODEN} stroke="#8b5a2b" strokeWidth={8} />
              {tb < BODEN - 60 && <path d={`M70 ${tb + 30} L195 ${BODEN - 10} M190 ${tb + 30} L65 ${BODEN - 10}`} stroke="#a0703c" strokeWidth={4} />}
              {/* Fass oben */}
              <Fass x={70} y={tb - 90} w={120} h={90} pegel={0.85} />
              <text x={130} y={tb - 100} textAnchor="middle" fontSize={13} style={text}>Fass (Quelle)</text>
              {/* Höhenpfeil */}
              <line x1={30} y1={tb} x2={30} y2={Y} stroke="#56616d" strokeWidth={1.5} markerStart="url(#pfeilA)" markerEnd="url(#pfeilB)" />
              <text x={38} y={(tb + Y) / 2} fontSize={12} style={text}>h = {zahl(e.hoehe)} m</text>
              {/* Sammelfass */}
              <Fass x={FASS2.x} y={FASS2.y} w={FASS2.w} h={FASS2.h} pegel={0.5} />
              <text x={FASS2.x + FASS2.w / 2} y={FASS2.y + FASS2.h + 46} textAnchor="middle" fontSize={12} style={text}>zurück ins Fass</text>
              <text x={320} y={Y - W / 2 - 60} textAnchor="middle" fontSize={12} style={muted}>Weites Rohr</text>
              <text x={740} y={Y - W / 2 - 10} textAnchor="middle" fontSize={12} style={muted}>Weites Rohr</text>
              <text x={330} y={RUECK + 26} textAnchor="middle" fontSize={12} style={muted}>Rückrohr</text>
              <text x={PUMPE.x} y={RUECK + 42} textAnchor="middle" fontSize={12} style={text}>Pumpe</text>
            </g>

            {/* Rohre (bleiben sichtbar, die Elektrik legt sich darüber) */}
            {stuecke.map(s => (
              <g key={s.key}>
                <path d={pfad(s.pts)} fill="none" stroke="#7b8794" strokeWidth={W} strokeLinejoin="round" />
                <path d={pfad(s.pts)} fill="none" stroke={wasserFarbe(s.phi)} strokeWidth={W - 5} strokeLinejoin="round" />
                <path
                  ref={el => { if (el) striche.current.set(s.key, el); else striche.current.delete(s.key); }}
                  d={pfad(s.pts)} fill="none" stroke="#ffffff" strokeOpacity={s.strom > 1e-6 ? 0.7 : 0}
                  strokeWidth={Math.max(2, W / 5)} strokeDasharray="6 14" strokeLinecap="round"
                />
                <path d={pfad(s.pts)} fill="none" stroke={potFarbe(s.phi, U)} strokeWidth={5} strokeLinejoin="round" style={{ opacity: mix }} />
              </g>
            ))}
            {e.aufbau === "parallel" && [415, 585].map(x => (
              <circle key={x} cx={x} cy={Y} r={7} fill="#e0a000" style={{ opacity: mix }} />
            ))}

            {/* Pumpe */}
            <g>
              <circle cx={PUMPE.x} cy={PUMPE.y} r={22} fill="#56616d" stroke="#2f3740" strokeWidth={3} style={{ opacity: wasserDeckung }} />
              <Laufrad x={PUMPE.x} y={PUMPE.y} drehen={z.strom > 1e-6} sichtbar={wasserDeckung} />
            </g>

            {/* Ventile */}
            {ventile.map((v, n) => {
              const o = ventilOffen(v.r);
              const glut = Math.min(0.85, v.p / 15);
              return (
                <g key={n}>
                  <circle cx={v.cx} cy={v.cy} r={34} fill="#ff7a1a" opacity={glut * 0.5} />
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
                  <text x={v.cx} y={v.cy + W / 2 + 22} textAnchor="middle" fontSize={12} style={{ ...muted, opacity: wasserDeckung }}>Ventil{v.nr} · −{zahl(v.u)} m</text>
                  {/* Elektrik: Widerstand nach DIN */}
                  <g style={{ opacity: mix }}>
                    <rect x={v.cx - 26} y={v.cy - 10} width={52} height={20} fill="var(--surface)" stroke="#e0a000" strokeWidth={3} />
                    <text x={v.cx} y={v.cy + 5} textAnchor="middle" fontSize={12} style={elek}>R{v.nr}</text>
                    <text x={v.cx} y={v.cy + W / 2 + 22} textAnchor="middle" fontSize={12} style={elek}>{ohm(v.r)} · U{v.nr ? v.nr : "_R"} = {zahl(v.u)} V</text>
                    <text x={v.cx} y={v.cy + W / 2 + 37} textAnchor="middle" fontSize={11} style={elek}>I{v.nr} = {zahl(v.i)} A · P = {zahl(v.p)} W</text>
                  </g>
                </g>
              );
            })}

            {/* Absperrhahn im Rückrohr = Schalter */}
            <g onClick={() => set({ geschlossen: !e.geschlossen })} style={{ cursor: "pointer" }}>
              <rect x={478} y={RUECK - W / 2 - 4} width={44} height={W + 8} rx={6} fill="#8a949e" stroke="#4a545e" strokeWidth={2} />
              <rect x={484} y={RUECK - (W - 5) / 2} width={32} height={W - 5} fill={offen ? "#8a949e" : wasserFarbe(z.phi.fass / 2)} />
              <line x1={500} y1={RUECK - W / 2 - 4} x2={500} y2={RUECK - W / 2 - 16} stroke="#4a545e" strokeWidth={4} />
              <line x1={offen ? 500 : 482} y1={RUECK - W / 2 - 18} x2={offen ? 500 : 518} y2={offen ? RUECK - W / 2 - 40 : RUECK - W / 2 - 18} stroke="#b03a2e" strokeWidth={6} strokeLinecap="round" />
              <text x={500} y={RUECK + W / 2 + 18} textAnchor="middle" fontSize={11} style={{ ...muted, opacity: wasserDeckung }}>{offen ? "Hahn zu" : "Hahn offen"} (klicken)</text>
              <text x={500} y={RUECK + W / 2 + 18} textAnchor="middle" fontSize={11} style={{ ...elek, opacity: mix }}>{offen ? `Schalter offen: U = ${zahl(U)} V` : "Schalter geschlossen"}</text>
            </g>

            {/* Manometer = Potenziale */}
            {manometer(255, U, "A")}
            {manometer(385, z.phi.vor, "B")}
            {manometer(615, z.phi.nach, "C")}
            {manometer(800, z.phi.fass, "D")}

            {/* ── Elektrische Bedeutung ── */}
            <g style={{ opacity: mix }} pointerEvents="none">
              {/* Batterie am Steigrohr: langer Strich = Plus */}
              <rect x={PUMPE.x - 26} y={PUMPE.y - 98} width={52} height={36} fill="var(--surface)" />
              <line x1={PUMPE.x - 22} y1={PUMPE.y - 88} x2={PUMPE.x + 22} y2={PUMPE.y - 88} stroke="#e0a000" strokeWidth={3} />
              <line x1={PUMPE.x - 11} y1={PUMPE.y - 72} x2={PUMPE.x + 11} y2={PUMPE.y - 72} stroke="#e0a000" strokeWidth={7} />
              <text x={PUMPE.x + 30} y={PUMPE.y - 84} fontSize={14} style={elek}>+</text>
              <text x={PUMPE.x + 30} y={PUMPE.y - 64} fontSize={14} style={elek}>−</text>
              <text x={PUMPE.x} y={RUECK + 58} textAnchor="middle" fontSize={12} style={elek}>Quelle U = {zahl(U)} V</text>
              <text x={38} y={(tb + Y) / 2 + 16} fontSize={12} style={elek}>U = {zahl(U)} V</text>
              {/* Ströme */}
              <text x={320} y={Y + W / 2 + 18} textAnchor="middle" fontSize={13} style={elek}>I = {zahl(z.strom)} A →</text>
              <text x={330} y={RUECK - W / 2 - 8} textAnchor="middle" fontSize={13} style={elek}>← I = {zahl(z.strom)} A</text>
              {/* Leiter */}
              <text x={320} y={Y + W / 2 + 34} textAnchor="middle" fontSize={11} style={elek}>Leiter {ohm(z.rZu)} · −{zahl(z.uZu)} V</text>
              <text x={740} y={Y + W / 2 + 18} textAnchor="middle" fontSize={11} style={elek}>Leiter {ohm(z.rAb)} · −{zahl(z.uAb)} V</text>
              <text x={330} y={RUECK + W / 2 + 34} textAnchor="middle" fontSize={11} style={elek}>Rückleiter {ohm(z.rRueck)} · −{zahl(z.uRueck)} V</text>
              <text x={FASS2.x + FASS2.w / 2} y={FASS2.y + FASS2.h + 62} textAnchor="middle" fontSize={12} style={elek}>zum Minuspol (−)</text>
              {e.aufbau === "parallel" && (
                <text x={500} y={355 + W / 2 + 56} textAnchor="middle" fontSize={12} style={elek}>
                  Knoten: {zahl(z.strom)} A = {zahl(z.i1)} A + {zahl(z.i2)} A
                </text>
              )}
            </g>

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

