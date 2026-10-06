"use client";
/**
 * N(r) gegen r doppelt-logarithmisch: Die Steigung ist die fraktale Dimension.
 * Zum Vergleich laufen Geraden für D = 1 (Linie), 2 (Fläche) und 3 (Körper)
 * durch den ersten Messpunkt.
 */
import type { Dimension } from "@/lib/dla/kern";

const B = 260, H = 190, R = { l: 34, r: 10, o: 10, u: 26 };

export default function Dimensionsbild({ d, raum }: { d: Dimension | null; raum: boolean }) {
  if (!d) {
    return (
      <p className="text-xs text-muted">
        Die Dimension wird gemessen, sobald ein paar hundert Teilchen um einen Punkt gewachsen sind (nur bei der Saat »Punkt«).
      </p>
    );
  }
  const p = d.punkte.filter(q => q.n > 0);
  const lx = p.map(q => Math.log10(q.r)), ly = p.map(q => Math.log10(q.n));
  const x0 = Math.min(...lx), x1 = Math.max(...lx);
  const vergleich = raum ? [1, 2, 3] : [1, 2];
  const yEnde = vergleich.map(k => ly[0] + k * (x1 - x0));
  const y0 = Math.min(...ly), y1 = Math.max(...ly, ...yEnde);
  const sx = (v: number) => R.l + ((v - x0) / (x1 - x0 || 1)) * (B - R.l - R.r);
  const sy = (v: number) => H - R.u - ((v - y0) / (y1 - y0 || 1)) * (H - R.o - R.u);
  const mx = lx.reduce((s, v) => s + v, 0) / lx.length, my = ly.reduce((s, v) => s + v, 0) / ly.length;
  const fit = (v: number) => my + d.d * (v - mx);
  const faktor = Math.pow(2, d.d);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black tabular-nums">D ≈ {d.d.toFixed(2).replace(".", ",")}</span>
        <span className="text-xs text-muted">{raum ? "Linie 1 · Fläche 2 · Körper 3" : "Linie 1 · Fläche 2"}</span>
      </div>
      <svg viewBox={`0 0 ${B} ${H}`} className="w-full max-w-[320px]" role="img" aria-label="Masse-Radius-Diagramm">
        <line x1={R.l} y1={H - R.u} x2={B - R.r} y2={H - R.u} className="stroke-line" />
        <line x1={R.l} y1={R.o} x2={R.l} y2={H - R.u} className="stroke-line" />
        {vergleich.map((k, i) => (
          <g key={k}>
            <line x1={sx(x0)} y1={sy(ly[0])} x2={sx(x1)} y2={sy(yEnde[i])} className="stroke-muted" strokeDasharray="3 3" strokeWidth={1} />
            <text x={sx(x1) - 2} y={Math.max(R.o + 8, sy(yEnde[i]) - 3)} textAnchor="end" className="fill-muted" fontSize={9}>D={k}</text>
          </g>
        ))}
        <line x1={sx(x0)} y1={sy(fit(x0))} x2={sx(x1)} y2={sy(fit(x1))} stroke="#f59e0b" strokeWidth={2} />
        {p.map((q, i) => <circle key={i} cx={sx(lx[i])} cy={sy(ly[i])} r={3} fill="#0ea5e9" />)}
        <text x={(B + R.l) / 2} y={H - 6} textAnchor="middle" className="fill-muted" fontSize={10}>Radius r (log)</text>
        <text x={10} y={(H - R.u) / 2} textAnchor="middle" className="fill-muted" fontSize={10} transform={`rotate(-90 10 ${(H - R.u) / 2})`}>Teilchen N (log)</text>
      </svg>
      <p className="text-xs text-muted">
        Doppelter Radius → {faktor.toFixed(1).replace(".", ",")}-mal so viele Teilchen (2<sup>D</sup>).
        {" "}Eine volle {raum ? "Kugel hätte 8-mal" : "Scheibe hätte 4-mal"} so viele, eine Linie nur 2-mal.
      </p>
    </div>
  );
}
