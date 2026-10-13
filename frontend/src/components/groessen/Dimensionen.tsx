"use client";
/**
 * Länge → Fläche → Volumen: warum aus · 10 erst · 100 und dann · 1 000 wird.
 *
 * Eine Strecke von 1 dm zerfällt in 10 cm, ein Quadrat von 1 dm² in
 * 10 · 10 = 100 cm², ein Würfel von 1 dm³ in 10 · 10 · 10 = 1 000 cm³. Der
 * Regler füllt alle drei gleichzeitig: Stück für Stück, Reihe für Reihe,
 * Schicht für Schicht. Darunter die Umrechnungszahlen der ganzen Leiter mit
 * ihrer Hochzahl.
 */
import { useState } from "react";
import { zahl } from "@/lib/groessen";
import { AbspielKnopf, Regler, Wuerfel, useZaehler, wuerfelMass } from "./bausteine";

const PAARE = [
  { gross: "m", klein: "dm" },
  { gross: "dm", klein: "cm", liter: true },
  { gross: "cm", klein: "mm", ml: true },
];
const LEITER = [
  { gross: "km", klein: "m", f: 1000 },
  { gross: "m", klein: "dm", f: 10 },
  { gross: "dm", klein: "cm", f: 10 },
  { gross: "cm", klein: "mm", f: 10 },
];
const FARBE = { linie: "#3b82f6", flaeche: "#22c55e", volumen: "#06b6d4" };

export default function Dimensionen() {
  const [p, setP] = useState(1);
  const paar = PAARE[p];
  const [k, setK, laeuft, start] = useZaehler(10, 900);
  const n = 10;

  // Strecke
  const LW = 260, seg = LW / n;
  // Quadrat
  const qs = 22;
  // Würfel
  const ws = 15, wm = wuerfelMass(n, ws);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2">
          {PAARE.map((x, i) => (
            <button key={x.gross} onClick={() => setP(i)} className={`chip ${p === i ? "chip-on" : ""}`}>
              {x.gross} → {x.klein}
            </button>
          ))}
        </div>
        <Regler label="gefüllt" wert={k} setze={setK} min={0} max={10} breit />
        <AbspielKnopf laeuft={laeuft} start={start} fertig={k >= 10} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ── Länge ── */}
        <div className="card p-4 flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: FARBE.linie }}>Länge — Strecke</div>
          <svg viewBox={`-20 -40 ${LW + 40} 130`} className="w-full h-auto">
            {Array.from({ length: n }, (_, i) => (
              <rect key={i} x={i * seg} y={0} width={seg - 2} height={36} rx={3}
                fill={FARBE.linie} fillOpacity={i < k ? 0.8 : 0.1} stroke={FARBE.linie} strokeWidth={1.5} />
            ))}
            <text x={LW / 2} y={-14} textAnchor="middle" fontSize={20} fontWeight={800} fill="var(--text)">1 {paar.gross}</text>
            <text x={seg / 2} y={64} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--text-muted)">1 {paar.klein}</text>
          </svg>
          <p className="text-center text-xl font-black">1 {paar.gross} = <span style={{ color: FARBE.linie }}>10</span> {paar.klein}</p>
          <p className="text-center text-sm text-muted">gezählt: {k} Stück · 1 = {k} {paar.klein}</p>
        </div>

        {/* ── Fläche ── */}
        <div className="card p-4 flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: FARBE.flaeche }}>Fläche — Quadrat</div>
          <svg viewBox={`-30 -30 ${n * qs + 50} ${n * qs + 50}`} className="w-full h-auto max-h-[38vh]">
            {Array.from({ length: n * n }, (_, i) => {
              const r = n - 1 - Math.floor(i / n), c = i % n; // von unten nach oben
              return <rect key={i} x={c * qs} y={r * qs} width={qs - 1.5} height={qs - 1.5} rx={2}
                fill={FARBE.flaeche} fillOpacity={Math.floor(i / n) < k ? 0.8 : 0.08} stroke={FARBE.flaeche} strokeWidth={0.8} />;
            })}
            <text x={(n * qs) / 2} y={-10} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--text)">1 {paar.gross}</text>
            <text x={-10} y={(n * qs) / 2} textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--text)"
              transform={`rotate(-90 -10 ${(n * qs) / 2})`}>1 {paar.gross}</text>
          </svg>
          <p className="text-center text-xl font-black">1 {paar.gross}² = 10 · 10 = <span style={{ color: FARBE.flaeche }}>100</span> {paar.klein}²</p>
          <p className="text-center text-sm text-muted">gezählt: {k} {k === 1 ? "Reihe" : "Reihen"} · 10 = {k * 10} {paar.klein}²</p>
        </div>

        {/* ── Volumen ── */}
        <div className="card p-4 flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: FARBE.volumen }}>Volumen — Würfel</div>
          <svg viewBox={`-10 -10 ${wm.w + 20} ${wm.h + 20}`} className="w-full h-auto max-h-[38vh]">
            <Wuerfel n={n} hoch={k} s={ws} ox={wm.ox} oy={wm.oy} farbe={FARBE.volumen} rahmen />
          </svg>
          <p className="text-center text-xl font-black">
            1 {paar.gross}³ = 10 · 10 · 10 = <span style={{ color: FARBE.volumen }}>1{String.fromCharCode(0x202f)}000</span> {paar.klein}³
          </p>
          <p className="text-center text-sm text-muted">
            gezählt: {k} {k === 1 ? "Schicht" : "Schichten"} · 100 = {zahl(k * 100)} {paar.klein}³
            {paar.liter && " — und 1 dm³ ist genau 1 Liter"}
            {paar.ml && " — 1 cm³ ist genau 1 Milliliter"}
          </p>
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <div className="text-xs font-bold uppercase tracking-wide text-muted">Die Umrechnungszahl bekommt die Hochzahl der Einheit</div>
        <div className="overflow-x-auto">
          <table className="w-full text-center">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1 text-left">Schritt</th>
                <th style={{ color: FARBE.linie }}>Länge (hoch 1)</th>
                <th style={{ color: FARBE.flaeche }}>Fläche (hoch 2)</th>
                <th style={{ color: FARBE.volumen }}>Volumen (hoch 3)</th>
              </tr>
            </thead>
            <tbody className="font-mono text-base">
              {LEITER.map(s => (
                <tr key={s.gross} className="border-t border-line">
                  <td className="py-2 text-left font-sans font-bold">{s.gross} → {s.klein}</td>
                  <td>· {zahl(s.f)}</td>
                  <td>· {zahl(s.f)}² = {zahl(s.f ** 2)}</td>
                  <td>· {zahl(s.f)}³ = {zahl(s.f ** 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          Eine Fläche hat zwei Richtungen (lang und breit), darum zählt die Umrechnung zweimal: 10 · 10. Ein Körper hat drei (lang, breit, hoch): 10 · 10 · 10.
          Bei Flächen gibt es dazwischen noch <strong>Ar</strong> und <strong>Hektar</strong>: 1 a = 10 m · 10 m = 100 m², 1 ha = 100 m · 100 m = 100 a.
        </p>
      </div>
    </div>
  );
}
