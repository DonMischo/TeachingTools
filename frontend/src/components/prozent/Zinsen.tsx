"use client";
/**
 * Zinsrechnung: Zinsen für Jahre, Monate oder Tage (kaufmännisch, 360 Tage)
 * und Zinseszins als wachsende Säulen — Startkapital, Zinsen aufs Startkapital
 * und Zinsen auf die Zinsen getrennt gefärbt.
 */
import { useState } from "react";
import { Regler } from "@/components/groessen/bausteine";
import { euro, verdopplung, z, zinsen, zinseszins } from "@/lib/prozent";
import { Chips, Erklaerung, Zahlfeld } from "./ui";

const MODI = [
  { id: "zeit", label: "⏱️ Zinsen für eine Zeit" },
  { id: "zins", label: "📈 Zinseszins" },
] as const;

const EINHEITEN = [
  { id: "jahre", label: "Jahre" },
  { id: "monate", label: "Monate" },
  { id: "tage", label: "Tage" },
] as const;
type Einheit = (typeof EINHEITEN)[number]["id"];

const MUTED = { fill: "var(--text-muted)" } as const;
const TEXT = { fill: "var(--text)" } as const;

function Zeit() {
  const [K, setK] = useState(2400);
  const [p, setP] = useState(3);
  const [einheit, setEinheit] = useState<Einheit>("monate");
  const [n, setN] = useState(5);
  const maxN = einheit === "jahre" ? 10 : einheit === "monate" ? 24 : 360;
  const nn = Math.min(n, maxN);
  const tage = einheit === "jahre" ? nn * 360 : einheit === "monate" ? nn * 30 : nn;
  const Zj = zinsen(K, p), Z = zinsen(K, p, tage);
  const teile = einheit === "jahre" ? 1 : einheit === "monate" ? 12 : 360;
  const proStueck = Zj / teile;
  const kaestchen = einheit === "tage" ? 12 : einheit === "monate" ? Math.max(12, nn) : Math.max(1, nn);
  const voll = einheit === "tage" ? nn / 30 : nn;
  const s = Math.min(60, 720 / kaestchen);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 items-end">
        <Zahlfeld label="Kapital K" wert={K} setze={setK} min={0} einheit="€" />
        <Zahlfeld label="Zinssatz p (pro Jahr)" wert={p} setze={setP} min={0} max={100} einheit="%" breite="w-20" />
        <Regler label={`Dauer in ${EINHEITEN.find(e => e.id === einheit)!.label}`} wert={nn} setze={setN} min={1} max={maxN} breit />
        <Chips wahl={einheit} setze={e => { setEinheit(e); setN(x => Math.min(x, e === "jahre" ? 10 : e === "monate" ? 24 : 360)); }} optionen={EINHEITEN} />
      </div>

      <svg viewBox={`0 0 ${kaestchen * s + 10} ${s + 40}`} className="w-full h-auto max-h-40" role="img" aria-label="Zeitstrahl der Zinsen">
        {Array.from({ length: kaestchen }, (_, i) => {
          const f = Math.max(0, Math.min(1, voll - i));
          return (
            <g key={i} transform={`translate(${5 + i * s} 5)`}>
              <rect width={s - 4} height={s - 4} rx={6} fill="none" style={{ stroke: "var(--border)" }} strokeWidth={2} />
              {f > 0 && <rect width={(s - 4) * f} height={s - 4} rx={6} fill="#eab308" fillOpacity={0.75} />}
              <text x={(s - 4) / 2} y={s + 14} textAnchor="middle" fontSize={Math.min(13, s / 3)} style={MUTED}>
                {einheit === "jahre" ? `${i + 1}. J` : einheit === "monate" ? `${i + 1}` : `${i * 30 + 30} T`}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="rounded-xl border border-line p-4 bg-page flex flex-col gap-1 text-lg">
        <p>Jahreszinsen: {euro(K)} · {z(p)} : 100 = <strong>{euro(Zj)}</strong></p>
        {einheit !== "jahre" && <p>pro {einheit === "monate" ? "Monat" : "Tag"}: {euro(Zj)} : {teile} = {z(proStueck, 4)} €</p>}
        <p>für {nn} {EINHEITEN.find(e => e.id === einheit)!.label}: {z(proStueck, 4)} € · {nn} = <strong className="text-2xl">{euro(Z)}</strong></p>
        <p className="text-muted text-sm">Formel: Z = K · p : 100 {einheit === "monate" ? "· m : 12" : einheit === "tage" ? "· t : 360" : "· Jahre"} — Kontostand danach {euro(K + Z)}</p>
      </div>
      <Erklaerung>
        Zinsen sind Prozentrechnung: das Kapital ist der Grundwert, der Zinssatz der Prozentsatz und die Zinsen der Prozentwert —
        aber für <strong>ein Jahr</strong>. Für kürzere Zeit nimmt man den passenden Teil. Banken in Deutschland rechnen dabei
        oft mit 30 Tagen pro Monat und 360 Tagen pro Jahr. Hier werden die Zinsen nicht mitverzinst — das zeigt der Zinseszins.
      </Erklaerung>
    </div>
  );
}

function Zinseszins() {
  const [K0, setK0] = useState(1000);
  const [p, setP] = useState(5);
  const [n, setN] = useState(15);
  const reihe = zinseszins(K0, p, n);
  // vier Gitterlinien mit runden Schritten
  const roh = (reihe[n] * 1.02) / 4, e = 10 ** Math.floor(Math.log10(roh));
  const stufe = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(f => f * e).find(x => x >= roh)!;
  const max = 4 * stufe;
  const B = 760, H = 300, x0 = 60, breite = B - x0 - 10, bw = breite / (n + 1);
  const sy = (v: number) => H - 30 - (v / max) * (H - 50);
  const doppelt = verdopplung(p);
  const q = 1 + p / 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4 items-end">
        <Zahlfeld label="Startkapital K₀" wert={K0} setze={setK0} min={1} einheit="€" />
        <Regler label="Zinssatz p in %" wert={p} setze={setP} min={0} max={15} step={0.5} />
        <Regler label="Jahre n" wert={n} setze={setN} min={1} max={40} breit />
      </div>

      <svg viewBox={`0 0 ${B} ${H}`} className="w-full h-auto max-h-[42vh]" role="img" aria-label="Säulen: Kapital mit Zinseszins">
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={t}>
            <line x1={x0} x2={B - 10} y1={sy(t * max)} y2={sy(t * max)} strokeWidth={1} style={{ stroke: "var(--border)" }} />
            <text x={x0 - 6} y={sy(t * max)} textAnchor="end" dominantBaseline="central" fontSize={11} style={MUTED}>{z(t * max, 2)}</text>
          </g>
        ))}
        {2 * K0 < max && (
          <g>
            <line x1={x0} x2={B - 10} y1={sy(2 * K0)} y2={sy(2 * K0)} stroke="#e11d48" strokeDasharray="6 4" strokeWidth={1.5} />
            <text x={B - 12} y={sy(2 * K0) - 6} textAnchor="end" fontSize={12} fill="#e11d48">doppelt so viel</text>
          </g>
        )}
        {reihe.map((k, i) => {
          const einfach = K0 + zinsen(K0, p) * i; // ohne Zinseszins
          const x = x0 + i * bw + bw * 0.12, w = bw * 0.76;
          return (
            <g key={i}>
              <rect x={x} y={sy(K0)} width={w} height={sy(0) - sy(K0)} fill="#64748b" />
              <rect x={x} y={sy(einfach)} width={w} height={sy(K0) - sy(einfach)} fill="#eab308" />
              <rect x={x} y={sy(k)} width={w} height={Math.max(0, sy(einfach) - sy(k))} fill="#22c55e" />
              {(n <= 20 || i % 5 === 0) && <text x={x + w / 2} y={H - 14} textAnchor="middle" fontSize={11} style={MUTED}>{i}</text>}
            </g>
          );
        })}
        <text x={x0} y={H - 1} fontSize={11} style={TEXT}>Jahre →</text>
      </svg>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="chip"><span className="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style={{ background: "#64748b" }} /> Startkapital</span>
        <span className="chip"><span className="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style={{ background: "#eab308" }} /> Zinsen aufs Startkapital</span>
        <span className="chip"><span className="inline-block w-3 h-3 rounded-sm mr-1 align-middle" style={{ background: "#22c55e" }} /> Zinsen auf Zinsen</span>
      </div>

      <div className="rounded-xl border border-line p-4 bg-page flex flex-col gap-1">
        <p className="text-lg">K<sub>{n}</sub> = K₀ · q<sup>n</sup> = {euro(K0)} · {z(q, 4)}<sup>{n}</sup> = <strong className="text-2xl">{euro(reihe[n])}</strong></p>
        <p className="text-sm text-muted">
          Ohne Zinseszins wären es {euro(K0 + zinsen(K0, p) * n)} — der Zinseszins bringt {euro(reihe[n] - K0 - zinsen(K0, p) * n)} extra.
          {Number.isFinite(doppelt) && ` Verdoppelt nach ${doppelt} Jahren (72er-Regel: ≈ ${z(72 / p, 1)}).`}
        </p>
      </div>

      <details className="rounded-xl border border-line p-3">
        <summary className="cursor-pointer font-bold">Tabelle Jahr für Jahr</summary>
        <table className="text-sm w-full mt-2">
          <thead><tr className="text-muted text-left"><th>Jahr</th><th>Kapital am Anfang</th><th>+ Zinsen ({z(p)} %)</th><th>Kapital am Ende</th></tr></thead>
          <tbody>
            {reihe.slice(1).map((k, i) => (
              <tr key={i} className="border-t border-line/50">
                <td>{i + 1}</td><td>{euro(reihe[i])}</td><td>{euro(k - reihe[i])}</td><td className="font-bold">{euro(k)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <Erklaerung>
        Beim Zinseszins bleiben die Zinsen auf dem Konto und werden im nächsten Jahr mitverzinst. Jedes Jahr wird das Kapital
        mit dem <strong>Zinsfaktor q = 1 + p/100</strong> malgenommen — deshalb wächst der grüne Teil immer schneller.
      </Erklaerung>
    </div>
  );
}

export default function Zinsen() {
  const [modus, setModus] = useState<(typeof MODI)[number]["id"]>("zeit");
  return (
    <div className="card flex flex-col gap-4">
      <Chips wahl={modus} setze={setModus} optionen={MODI} />
      {modus === "zeit" ? <Zeit /> : <Zinseszins />}
    </div>
  );
}
