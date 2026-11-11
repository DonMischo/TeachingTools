"use client";
/**
 * Klammern quadrieren mit vier Bögen (wie die Bögen in »Umrechnen«):
 * ① vorne·vorne, ② vorne·hinten, ③ hinten·vorne, ④ hinten·hinten.
 * Schritt für Schritt aufdecken, erst am Ende bekommt der Fall seinen Namen
 * (1., 2., 3. binomische Formel). Daneben das Flächenbild.
 */
import { useState } from "react";
import { boegen, nfStuecke, zahl } from "@/lib/quadratisch";
import { Chips } from "@/components/prozent/ui";
import { F, FARBE, Kasten, Regler, Term } from "./teile";

type Fall = "plus" | "minus" | "dritte";
const FAELLE = [
  { id: "plus" as const, label: "(x + d)²" },
  { id: "minus" as const, label: "(x − d)²" },
  { id: "dritte" as const, label: "(x + d)(x − d)" },
];
const BOGEN_FARBE = [FARBE.x, FARBE.d, FARBE.d, FARBE.a];
const NAME = ["", "1. binomische Formel", "2. binomische Formel", "3. binomische Formel"];
const FORMEL = ["", "(x + d)² = x² + 2·d·x + d²", "(x − d)² = x² − 2·d·x + d²", "(x + d)(x − d) = x² − d²"];

export default function Binome() {
  const [fall, setFall] = useState<Fall>("plus");
  const [d, setD] = useState(3);
  const [schritt, setSchritt] = useState(0);
  const p = fall === "minus" ? -d : d, q = fall === "plus" ? d : -d;
  const b = boegen(p, q);
  const wechsel = (f: Fall) => { setFall(f); setSchritt(0); };
  const vz = (v: number) => (v < 0 ? `− ${zahl(-v)}` : `+ ${zahl(v)}`);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Chips wahl={fall} setze={wechsel} optionen={FAELLE} />
        <div className="w-56"><Regler name="d" r="d" wert={d} setze={v => { setD(Math.max(1, Math.round(v))); setSchritt(0); }} min={1} max={9} schritt={1} /></div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="flex flex-col gap-3">
          <div className="card p-4 flex flex-col gap-3">
            <div className="text-center text-xl" style={{ fontFamily: "Cambria Math, Cambria, serif" }}>
              (x {vz(p)}){fall === "dritte" ? `(x ${vz(q)})` : "²"} = (x {vz(p)}) · (x {vz(q)})
            </div>
            <BogenBild p={p} q={q} sichtbar={Math.min(schritt, 4)} produkte={b.bg.map(x => x.produkt)} />
            <div className="text-xl text-center min-h-8" style={{ fontFamily: "Cambria Math, Cambria, serif" }}>
              {schritt > 0 && <>= {b.bg.slice(0, Math.min(schritt, 4)).map((g, i) => (
                <span key={i} style={{ color: BOGEN_FARBE[i], fontWeight: 700 }}>{i === 0 ? "x²" : ` ${g.ergebnis.t}${i < 3 ? "x" : ""}`}</span>
              ))}</>}
            </div>
            {schritt >= 5 && (
              <div className="text-center flex flex-col gap-1">
                <div className="text-2xl"><Term st={nfStuecke(b.ergebnis, "= ")} gross /></div>
                <div className="text-sm">
                  {fall === "dritte" ? <>② und ③ heben sich auf – die Mitte fällt weg.</> : <>② und ③ sind gleich – zusammen <b>{zahl(2 * p)}x</b> (das <b>doppelte</b> Produkt).</>}
                </div>
                <div className="rounded-lg bg-page border border-line p-2 mt-1">
                  <b>Das ist die {NAME[b.formel]}:</b> <span className="font-serif" style={{ fontFamily: "Cambria Math, Cambria, serif" }}>{FORMEL[b.formel]}</span>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-center">
              <button className="btn btn-primary" onClick={() => setSchritt(s => Math.min(5, s + 1))} disabled={schritt >= 5}>
                {schritt < 4 ? `▶ Bogen ${["①", "②", "③", "④"][schritt]}` : "▶ Zusammenfassen"}
              </button>
              <button className="btn" onClick={() => setSchritt(5)}>Alles zeigen</button>
              <button className="btn" onClick={() => setSchritt(0)}>↺ Von vorn</button>
            </div>
          </div>
          <Kasten art="so" titel="Jedes mal jedes – vier Bögen">
            <p><F r="x">① vorne · vorne</F> – <F r="d">② vorne · hinten</F> – <F r="d">③ hinten · vorne</F> – <F r="a">④ hinten · hinten</F>, dann gleichartige Glieder zusammenfassen.</p>
            <p>Das Vorzeichen gehört zum Glied: in (x − 3) ist das hintere Glied <b>−3</b>. Minus mal minus gibt plus.</p>
          </Kasten>
          <Kasten art="achtung" titel="Fehlerfalle">
            <p>(x + 3)² ≠ x² + 9 – da fehlen die Bögen ② und ③. Quadrieren heißt nicht: jedes Glied einzeln hoch 2.</p>
          </Kasten>
        </div>
        <div className="flex flex-col gap-3">
          <div className="card p-3 flex flex-col gap-2">
            <b>🟪 Warum stimmt das? – am Flächenbild</b>
            <Flaeche fall={fall} d={d} />
          </div>
          <div className="card p-3 text-sm">
            <b>Die drei binomischen Formeln</b>
            <table className="w-full mt-1" style={{ fontFamily: "Cambria Math, Cambria, serif" }}>
              <tbody>
                {[1, 2, 3].map(n => (
                  <tr key={n} className={`border-t border-line ${schritt >= 5 && b.formel === n ? "bg-accent/15" : ""}`}>
                    <td className="py-1 pr-2 font-sans font-bold text-xs">{n}.</td><td className="py-1">{FORMEL[n]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted mt-1">Merksatz für 1 und 2: erstes Quadrat – doppeltes Produkt – zweites Quadrat; hinten steht immer plus.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** (t0 t1)·(t2 t3) mit Bögen: oben ① ②, unten ③ ④. */
function BogenBild({ p, q, sichtbar, produkte }: { p: number; q: number; sichtbar: number; produkte: string[] }) {
  const W = 300, H = 210, ym = 105;
  const xs = [48, 112, 192, 256];
  const t = ["x", (p < 0 ? "−" : "+") + zahl(Math.abs(p)), "x", (q < 0 ? "−" : "+") + zahl(Math.abs(q))];
  const bogen = (i: number, j: number, oben: boolean, h: number, n: number) => {
    const y = oben ? ym - 17 : ym + 17;
    const x1 = xs[i], x2 = xs[j], cy = oben ? y - h : y + h, mx = (x1 + x2) / 2;
    const c = BOGEN_FARBE[n];
    // Pfeilspitze am Ende, entlang der Tangente der Kurve (vom Kontrollpunkt zum Ziel)
    const ux = x2 - mx, uy = y - cy, l = Math.hypot(ux, uy), ax = ux / l, ay = uy / l;
    const sp = `${x2},${y} ${x2 - ax * 9 - ay * 5},${y - ay * 9 + ax * 5} ${x2 - ax * 9 + ay * 5},${y - ay * 9 - ax * 5}`;
    const ly = (y + cy) / 2, label = `${["①", "②", "③", "④"][n]} ${produkte[n]}`, lw = 14 + 7.4 * label.length;
    return (
      <g key={n} opacity={sichtbar > n ? 1 : 0.12}>
        <path d={`M ${x1} ${y} Q ${mx} ${cy} ${x2} ${y}`} fill="none" stroke={c} strokeWidth={2.6} />
        <polygon points={sp} fill={c} />
        {sichtbar > n && <>
          <rect x={mx - lw / 2} y={ly - 11} width={lw} height={22} rx={7} fill="var(--surface)" stroke={c} />
          <text x={mx} y={ly + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={800} fill={c}>{label}</text>
        </>}
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-w-md mx-auto" role="img" aria-label="Bögen beim Ausmultiplizieren">
      {[[22, "("], [140, ")"], [152, "·"], [166, "("], [284, ")"]].map(([x, c]) => (
        <text key={x as number} x={x as number} y={ym} textAnchor="middle" dominantBaseline="central" fontSize={32} fill="var(--text-muted)" fontFamily="Cambria Math, Cambria, serif">{c as string}</text>
      ))}
      {t.map((s, i) => (
        <text key={i} x={xs[i]} y={ym} textAnchor="middle" dominantBaseline="central" fontSize={25} fontWeight={700}
          fill={s === "x" ? FARBE.x : FARBE.d} fontFamily="Cambria Math, Cambria, serif">{s}</text>
      ))}
      {bogen(0, 2, true, 34, 0)}
      {bogen(0, 3, true, 140, 1)}
      {bogen(1, 2, false, 34, 2)}
      {bogen(1, 3, false, 140, 3)}
    </svg>
  );
}

/** Flächenbild zur jeweiligen Formel; x als feste Länge, d mit dem Regler. */
function Flaeche({ fall, d }: { fall: Fall; d: number }) {
  const X = 150, D = Math.min(16 * d, 110), m = 30;
  const txt = (x: number, y: number, t: string, c: string, gr = 15) => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={gr} fontWeight={700} fill={c} fontFamily="Cambria Math, Cambria, serif">{t}</text>
  );
  const feld = (x: number, y: number, w: number, h: number, c: string, t: string, deckend = 0.18) => (
    <g><rect x={x} y={y} width={w} height={h} fill={c} fillOpacity={deckend} stroke={c} strokeWidth={2} />{txt(x + w / 2, y + h / 2, t, c, Math.min(w, h) > 50 ? 16 : 12)}</g>
  );
  if (fall === "plus") {
    const S = m + X + D + 10;
    return (
      <>
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full h-auto max-w-sm mx-auto" role="img" aria-label="Quadrat (x + d)²">
          {feld(m, m, X, X, FARBE.x, "x²")}{feld(m + X, m, D, X, FARBE.d, `${d}x`)}{feld(m, m + X, X, D, FARBE.d, `${d}x`)}{feld(m + X, m + X, D, D, FARBE.a, `${d * d}`)}
          {txt(m + X / 2, m - 12, "x", FARBE.x)}{txt(m + X + D / 2, m - 12, String(d), FARBE.d)}
          {txt(m - 12, m + X / 2, "x", FARBE.x)}{txt(m - 12, m + X + D / 2, String(d), FARBE.d)}
        </svg>
        <p className="text-sm">Ein Quadrat mit der Seite x + {d} zerfällt in <F r="x">x²</F>, zwei Rechtecke <F r="d">{d}x</F> und <F r="a">{d * d}</F>: (x + {d})² = x² + {2 * d}x + {d * d}.</p>
      </>
    );
  }
  if (fall === "minus") {
    const S = m + X + 10, k = X - D;
    return (
      <>
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full h-auto max-w-sm mx-auto" role="img" aria-label="Quadrat (x − d)²">
          <rect x={m} y={m} width={X} height={X} fill="none" stroke="var(--text-muted)" strokeDasharray="5 4" />
          {feld(m, m, k, k, FARBE.x, `(x − ${d})²`, 0.22)}
          {feld(m + k, m, D, X, FARBE.d, `−${d}x`, 0.12)}{feld(m, m + k, X, D, FARBE.d, `−${d}x`, 0.12)}
          {feld(m + k, m + k, D, D, FARBE.a, `+${d * d}`, 0.35)}
          {txt(m + X / 2, m - 12, "x", FARBE.x)}{txt(m - 12, m + X / 2, "x", FARBE.x)}
        </svg>
        <p className="text-sm">Von <F r="x">x²</F> zwei Streifen <F r="d">{d}x</F> abschneiden – dabei ist die Ecke <F r="a">{d * d}</F> doppelt weg, also einmal zurück: (x − {d})² = x² − {2 * d}x + {d * d}.</p>
      </>
    );
  }
  // dritte: L-Form x² − d², Streifen umlegen → Rechteck (x + d)(x − d)
  const k = X - D, B = m + X + 50, S = B + k + 20, H = m + X + D + 10;
  return (
    <>
      <svg viewBox={`0 0 ${S} ${H}`} className="w-full h-auto mx-auto" role="img" aria-label="x² − d² als Rechteck">
        {feld(m, m, k, X, FARBE.x, "", 0.18)}
        {feld(m + k, m + D, D, k, FARBE.d, "", 0.3)}
        <rect x={m + k} y={m} width={D} height={D} fill="none" stroke={FARBE.a} strokeDasharray="4 3" />
        {txt(m + k + D / 2, m + D / 2, `−${d * d}`, FARBE.a, 12)}
        {txt(m + k / 2, m + X / 2, "x² − d²", FARBE.x, 14)}
        <path d={`M ${m + X + 8} ${m + X / 2} L ${B - 10} ${m + X / 2}`} stroke="var(--text-muted)" strokeWidth={2} />
        <polygon points={`${B - 6},${m + X / 2} ${B - 16},${m + X / 2 - 6} ${B - 16},${m + X / 2 + 6}`} fill="var(--text-muted)" />
        {feld(B, m, k, X, FARBE.x, "", 0.18)}
        {feld(B, m + X, k, D, FARBE.d, "", 0.3)}
        {txt(B + k / 2, m - 12, `x − ${d}`, FARBE.d)}{txt(B + k + 14, m + (X + D) / 2, `x + ${d}`, FARBE.d)}
      </svg>
      <p className="text-sm">Von <F r="x">x²</F> fehlt die Ecke <F r="a">{d * d}</F>. Den <F r="d">Streifen</F> umlegen: Es entsteht ein Rechteck (x + {d}) · (x − {d}). Also: (x + {d})(x − {d}) = x² − {d * d}.</p>
    </>
  );
}
