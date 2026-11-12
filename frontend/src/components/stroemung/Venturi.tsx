"use client";
/**
 * Station »Venturi« (Kl. 9/10): In der Engstelle fließt es schneller
 * (A·v = const), dafür sinkt der Druck (Bernoulli). Wasser: drei Steigrohre
 * zeigen den Druck; fällt er unter den Luftdruck, saugt die Engstelle Luft an
 * (Wasserstrahlpumpe), unter dem Dampfdruck kavitiert es. Luft: Zerstäuber —
 * der Unterdruck hebt Flüssigkeit aus dem Fläschchen.
 */
import { useEffect, useRef, useState } from "react";
import { VERLUST, steighoehe, venturi } from "@/lib/stroemung/venturi";
import { ABSCHNITT, STEIGROHR_X, VenturiSzene, radiusBei, saeulenOben, type Schild, type VenturiZustand } from "./venturiSzene";
import { MEDIEN, P_LUFT } from "@/lib/stroemung/modell";
import { Analogie, Karte, Pille, Regler, StationRahmen, Wahl, Werte, bar, muted, text, useTakt, zahl } from "./rahmen";

const ACHSE = 300;
const ABSCHNITTE = { a: 60, b: 300, c: 420, d: 560, e: 800, f: 940 };   // weit | Konus | Engstelle | Diffusor | weit
const D1 = 40;  // mm

export default function Venturi() {
  const [medium, setMedium] = useState<"wasser" | "luft">("wasser");
  const [q, setQ] = useState(1.0);       // L/s
  const [d2, setD2] = useState(20);      // mm
  const [p3, setP3] = useState(0.3e5);   // Pa Gegendruck (nur Wasser)
  const [ansicht, setAnsicht] = useState<"3d" | "2d">("3d");
  const drei = ansicht === "3d";

  const luft = medium === "luft";
  const rho = MEDIEN[medium].dichte;
  const r = venturi(q / 1000, D1 / 1000, d2 / 1000, rho, luft ? 0 : p3);
  const saugt = !luft && r.p2 < 0;
  const kavitation = !luft && r.p2 + P_LUFT < 2340;
  const hoch = luft ? steighoehe(r.p2, 1000) : 0;
  const spruehen = luft && hoch >= 0.1;

  // Rohrprofil: Radius in px über x
  const R1 = D1 * 1.2, R2 = d2 * 1.2, A = ABSCHNITTE;
  const radius = (x: number) => {
    if (x <= A.b || x >= A.e) return R1;
    if (x < A.c) return R1 + ((R2 - R1) * (x - A.b)) / (A.c - A.b);
    if (x <= A.d) return R2;
    return R2 + ((R1 - R2) * (x - A.d)) / (A.e - A.d);
  };
  const xs = Array.from({ length: 89 }, (_, i) => A.a + (i * (A.f - A.a)) / 88);
  const oben = xs.map(x => `${x} ${ACHSE - radius(x)}`), unten = xs.map(x => `${x} ${ACHSE + radius(x)}`).reverse();

  // Teilchen auf drei Stromlinien, Tempo ∝ örtliche Geschwindigkeit q/A(x)
  const teilchen = useRef(Array.from({ length: 42 }, (_, i) => ({ x: A.a + ((i * 53) % (A.f - A.a)), bahn: [-0.6, 0, 0.6][i % 3] })));
  const tropfen = useRef<{ x: number; y: number; vx: number; vy: number }[]>([]);
  const PX_JE_MS = luft ? 3 : 40;
  useTakt(dt => {
    if (drei) return;
    for (const t of teilchen.current) {
      const v = (q / 1000) / (Math.PI * (radius(t.x) / 1.2 / 1000) ** 2 / 4);
      t.x += Math.min(600, v * PX_JE_MS) * dt;
      if (t.x > A.f) t.x = A.a;
    }
    if (spruehen) tropfen.current.push({ x: 490, y: ACHSE + R2, vx: 0, vy: -60 });
    tropfen.current = tropfen.current
      .map(d => { const vx = Math.min(500, d.vx + 900 * dt); return { x: d.x + vx * dt, y: d.y + d.vy * dt, vx, vy: d.vy * 0.97 }; })
      .filter(d => d.x < 1000).slice(-60);
  }, !drei);

  const SK = 50;   // px je m Wassersäule im Steigrohr
  const steigrohr = (x: number, p: number, name: string) => {
    const fuss = ACHSE - radius(x);
    const h = Math.max(0, p / (rho * 9.81)) * SK;
    return (
      <g key={name}>
        <rect x={x - 9} y={Math.max(14, fuss - h)} width={18} height={fuss - Math.max(14, fuss - h)} fill="hsl(205 80% 55%)" />
        <path d={`M${x - 11} ${fuss} V14 M${x + 11} ${fuss} V14`} stroke="#56616d" strokeWidth={3} />
        <Pille x={x} y={Math.max(30, fuss - h - 16)} t={`${name}: ${bar(p)}`} farbe={p < 0 ? "#d64541" : "#e0a000"} />
      </g>
    );
  };

  // 3D: Druck p(x) entlang des Rohrs, Verlust im Diffusor
  const vBei = (x: number) => (q / 1000) / (Math.PI * (radiusBei(x, D1, d2) / radiusBei(ABSCHNITT.a, D1, D1) * D1 / 1000) ** 2 / 4);
  const druck = (x: number) => {
    const v = vBei(x);
    const verlust = x <= ABSCHNITT.d ? 0 : Math.min(1, (x - ABSCHNITT.d) / (ABSCHNITT.e - ABSCHNITT.d));
    return r.p1 - 0.5 * rho * (v * v - r.v1 * r.v1) - verlust * VERLUST * r.dp;
  };
  const [x1, x2] = STEIGROHR_X, R1s = radiusBei(x1, D1, d2), R2s = radiusBei(x2, D1, d2);
  const mbar = (p: number) => `${zahl(p / 100, 1)} mbar`;
  const rot = (p: number) => (p < 0 ? "#d64541" : "#e0a000");
  const schilder: Schild[] = luft ? [
    { id: "p1", text: `p₁ = ${mbar(r.p1)}`, pos: [x1, R1s + 0.5, 0] },
    { id: "p2", text: `p₂ = ${mbar(r.p2)}`, pos: [x2, R2s + 0.55, 0], farbe: rot(r.p2) },
    { id: "v1", text: `v₁ = ${zahl(r.v1, 1)} m/s`, pos: [x1, -R1s - 0.5, 0], gross: true },
    { id: "v2", text: `v₂ = ${zahl(r.v2, 1)} m/s`, pos: [1.6, -R2s - 0.55, 0], gross: true },
    { id: "zs", text: spruehen ? "zerstäubt!" : `steigt ${zahl(hoch * 100, 1)} cm von 10 cm`, pos: [x2 + 1.9, -1.75, 0.4], farbe: spruehen ? "#c0399a" : undefined },
  ] : [
    ...[r.p1, r.p2, r.p3].map((p, i): Schild => ({ id: `p${i + 1}`, text: `p${"₁₂₃"[i]}: ${bar(p)}`, pos: [STEIGROHR_X[i], saeulenOben(STEIGROHR_X[i], p, rho, D1, d2) + 0.35, 0], farbe: rot(p) })),
    { id: "v1", text: `v₁ = ${zahl(r.v1, 1)} m/s`, pos: [x1, -R1s - 0.5, 0], gross: true },
    { id: "v2", text: `v₂ = ${zahl(r.v2, 1)} m/s`, pos: [x2, -R2s - 0.55, 0], gross: true },
    ...(saugt ? [{ id: "saugt", text: "saugt Luft an", pos: [x2 + 1.2, 3.6, 0], farbe: "#d64541" } as Schild] : []),
    ...(kavitation ? [{ id: "kav", text: "Kavitation: Dampfblasen", pos: [1.4, -R2s - 1.15, 0], farbe: "#d64541" } as Schild] : []),
  ];
  const pWerte = [r.p1, r.p2, r.p3, druck(ABSCHNITT.d)];
  const zustand3d: VenturiZustand = {
    luft, q, d1: D1, d2, druck, pMin: Math.min(...pWerte), pMax: Math.max(...pWerte), saeulen: [r.p1, r.p2, r.p3], dichte: rho,
    saugt, kavitation, steigt: luft ? Math.min(1, hoch / 0.1) : 0, spruehen, schilder,
  };

  const versuche = [
    { name: "Engstelle", idee: "Halber Durchmesser heißt ein Viertel der Fläche: Das Wasser muss viermal so schnell durch — und in der Engstelle steht das Steigrohr am niedrigsten.", los: () => { setMedium("wasser"); setQ(1); setD2(20); setP3(0.3e5); } },
    { name: "Wasserstrahlpumpe", idee: "Wird es schnell genug, fällt der Druck in der Engstelle unter den Luftdruck: Das Steigrohr läuft leer und saugt Luft an. So arbeitet die Wasserstrahlpumpe im Chemieraum.", los: () => { setMedium("wasser"); setQ(1.6); setD2(18); setP3(0.1e5); } },
    { name: "Kavitation", idee: "Noch schneller: Der Druck sinkt bis zum Dampfdruck, das Wasser siedet kalt — Dampfblasen fallen hinter der Engstelle krachend zusammen und fressen Schiffsschrauben an.", los: () => { setMedium("wasser"); setQ(3); setD2(14); setP3(0); } },
    { name: "Zerstäuber", idee: "Bläst man Luft durch die Engstelle, hebt der Unterdruck die Flüssigkeit im Röhrchen — ab 10 cm wird sie mitgerissen und zerstäubt (Parfüm, Airbrush, früher der Vergaser).", los: () => { setMedium("luft"); setQ(6); setD2(10); } },
  ];

  return (
    <StationRahmen
      versuche={versuche}
      bild={drei ? <Venturi3D zustand={zustand3d} ohneGl={() => setAnsicht("2d")} /> :
        <svg viewBox="0 0 1000 470" className="w-full h-auto select-none" role="img" aria-label="Venturi-Rohr">
          <path d={`M${oben.join(" L")} L${unten.join(" L")} Z`} fill={luft ? "hsl(200 30% 85%)" : "hsl(205 80% 60%)"} opacity={luft ? 0.35 : 0.9} />
          <path d={`M${oben.join(" L")}`} fill="none" stroke="#56616d" strokeWidth={5} />
          <path d={`M${unten.join(" L")}`} fill="none" stroke="#56616d" strokeWidth={5} />
          {teilchen.current.map((t, i) => <circle key={i} cx={t.x} cy={ACHSE + t.bahn * radius(t.x)} r={4} fill={luft ? "#56616d" : "#ffffff"} opacity={0.85} />)}
          {kavitation && Array.from({ length: 14 }, (_, i) => <circle key={i} cx={A.c + 10 + ((i * 37) % (A.d - A.c + 60))} cy={ACHSE + (((i * 13) % 9) - 4) * R2 / 5} r={2 + (i % 3)} fill="none" stroke="#fff" strokeWidth={1.5} />)}

          {!luft && <>
            {steigrohr(180, r.p1, "p₁")}
            {steigrohr(490, r.p2, "p₂")}
            {steigrohr(870, r.p3, "p₃")}
            {saugt && <>
              {Array.from({ length: 5 }, (_, i) => <circle key={i} cx={490 + (i % 2 ? 4 : -4)} cy={ACHSE - R2 - 50 - i * 26} r={5} fill="#fff" stroke="#9aa5b1" />)}
              <text x={510} y={ACHSE - R2 - 90} fontSize={14} fontWeight={700} fill="#d64541">saugt Luft an</text>
            </>}
            {kavitation && <text x={490} y={ACHSE + R2 + 34} textAnchor="middle" fontSize={14} fontWeight={700} fill="#d64541">Kavitation: Dampfblasen</text>}
          </>}

          {luft && <>
            {/* Fläschchen mit Steigröhrchen an der Engstelle */}
            <rect x={440} y={410} width={100} height={50} rx={8} fill="hsl(300 50% 70%)" opacity={0.7} stroke="#56616d" strokeWidth={3} />
            <path d={`M482 ${ACHSE + R2} V450 M498 ${ACHSE + R2} V450`} stroke="#56616d" strokeWidth={3} />
            <rect x={484} y={Math.max(ACHSE + R2, 450 - Math.min(hoch, 0.12) * 1000)} width={12} height={450 - Math.max(ACHSE + R2, 450 - Math.min(hoch, 0.12) * 1000)} fill="hsl(300 50% 60%)" />
            {tropfen.current.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={3} fill="hsl(300 60% 55%)" />)}
            <Pille x={180} y={ACHSE - R1 - 24} t={`p₁ = ${zahl(r.p1 / 100, 1)} mbar`} />
            <Pille x={490} y={ACHSE - R2 - 24} t={`p₂ = ${zahl(r.p2 / 100, 1)} mbar`} farbe={r.p2 < 0 ? "#d64541" : "#e0a000"} />
            <Pille x={640} y={430} t={spruehen ? "zerstäubt!" : `steigt ${zahl(hoch * 100, 1)} cm von 10 cm`} />
          </>}

          <Pille x={180} y={ACHSE + R1 + 34} t={`v₁ = ${zahl(r.v1, 1)} m/s`} gross />
          <Pille x={luft ? 360 : 490} y={ACHSE + R2 + (luft ? 70 : 64)} t={`v₂ = ${zahl(r.v2, 1)} m/s`} gross />
          <text x={940} y={ACHSE + R1 + 34} textAnchor="end" fontSize={13} style={muted}>⌀ {D1} mm → {d2} mm</text>
          <text x={60} y={ACHSE - R1 - 50} fontSize={13} style={text}>Strömung →</text>
        </svg>
      }
      seite={<>
        <Karte>
          <Wahl werte={[{ id: "3d", label: "🧊 3D" }, { id: "2d", label: "✏️ 2D" }]} wert={ansicht} setze={setAnsicht} />
          <Wahl werte={[{ id: "wasser", label: "💧 Wasser" }, { id: "luft", label: "💨 Luft" }]} wert={medium} setze={m => { setMedium(m); setQ(m === "luft" ? 4 : 1); }} />
          <Regler label={`Durchfluss: ${zahl(q, 1)} L/s`} min={0} max={luft ? 10 : 3} step={0.1} wert={q} setze={setQ} />
          <Regler label={`Engstelle: ⌀ ${d2} mm`} min={8} max={40} step={1} wert={d2} setze={setD2} />
          {!luft && <Regler label={`Druck am Auslass: ${bar(p3)}`} min={0} max={0.5e5} step={0.01e5} wert={p3} setze={setP3} />}
        </Karte>
        <Karte titel="A₁·v₁ = A₂·v₂ · p + ½ρv² = const">
          <Werte zeilen={[
            ["Flächen A₁ : A₂", `${zahl((D1 / d2) ** 2, 1)} : 1`],
            ["v₁ / v₂", `${zahl(r.v1, 1)} / ${zahl(r.v2, 1)} m/s`],
            ["Druckabfall ½ρ(v₂² − v₁²)", luft ? `${zahl(r.dp / 100, 1)} mbar` : bar(r.dp)],
            ["p₁ / p₂ / p₃", luft ? `${zahl(r.p1 / 100, 1)} / ${zahl(r.p2 / 100, 1)} / 0 mbar` : `${bar(r.p1)} / ${bar(r.p2)} / ${bar(r.p3)}`],
            ["bleibender Verlust", luft ? `${zahl((r.p1 - r.p3) / 100, 1)} mbar` : bar(r.p1 - r.p3)],
          ]} />
          <p className="text-muted">Drücke als Überdruck gegen die Luft. Im Diffusor kommt der Druck zurück — bis auf rund 15 % Verlust durch Verwirbelung.</p>
        </Karte>
      </>}
      unten={<Analogie>
        Die Kontinuität kennt der Stromkreis auch: In Reihe fließt überall derselbe Strom, und im dünnen Draht laufen die
        Elektronen tatsächlich schneller. Bernoulli dagegen hat kein Gegenstück — die Bewegungsenergie der Elektronen ist
        winzig, eine »Engstelle« im Draht senkt die Spannung nicht durch Geschwindigkeit, sondern nur durch ihren Widerstand.
      </Analogie>}
    />
  );
}

/** Die three.js-Szene samt Farblegende; ohne WebGL schaltet sie auf 2D zurück. */
function Venturi3D({ zustand, ohneGl }: { zustand: VenturiZustand; ohneGl: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const szene = useRef<VenturiSzene | null>(null);
  useEffect(() => {
    try { szene.current = new VenturiSzene(ref.current!); } catch { ohneGl(); return; }
    return () => { szene.current?.entsorgen(); szene.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { szene.current?.setze(zustand); });
  return (
    <div ref={ref} className="relative w-full aspect-[1000/560] rounded-xl overflow-hidden select-none" role="img" aria-label="Venturi-Rohr in 3D, mit der Maus drehbar"
      style={{ background: "radial-gradient(ellipse at 50% 35%, color-mix(in srgb, var(--surface) 70%, hsl(200 60% 75%)), var(--surface) 75%)" }}>
      <div className="absolute left-3 bottom-3 flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1" style={{ background: "var(--surface)", color: "var(--text)", boxShadow: "0 1px 4px rgb(0 0 0 / .15)" }}>
        Druck <span className="text-muted">niedrig</span>
        <span className="inline-block h-2.5 w-24 rounded-full" style={{ background: "linear-gradient(90deg, hsl(250 75% 62%), hsl(190 85% 60%), hsl(28 95% 58%))" }} />
        <span className="text-muted">hoch</span>
      </div>
      <div className="absolute right-3 top-3 text-xs text-muted">ziehen: drehen · Rad: zoomen</div>
    </div>
  );
}
