"use client";
/**
 * sin, cos, tan im rechtwinkligen Dreieck: Winkel und Hypotenuse einstellen,
 * Bezugswinkel wählen — Gegenkathete, Ankathete und Hypotenuse färben sich
 * passend, die drei Verhältnisse stehen mit Zahlen daneben. Wird c größer,
 * wachsen alle Seiten, die Verhältnisse bleiben (ähnliche Dreiecke).
 */
import { useState } from "react";
import { Regler } from "@/components/groessen/bausteine";
import { cosG, sinG, tanG } from "@/lib/trigonometrie";
import { z } from "@/lib/prozent";

const W = 640, H = 380;
const FARBE = { gk: "#ef4444", ak: "#3b82f6", hy: "#a855f7" };

export default function Rechtwinklig() {
  const [alpha, setAlpha] = useState(35);
  const [c, setC] = useState(8);
  const [bezug, setBezug] = useState<"alpha" | "beta">("alpha");
  const beta = 90 - alpha;
  const a = c * sinG(alpha), b = c * cosG(alpha);
  // A links unten, C rechts unten (rechter Winkel), B oben über C
  const s = Math.min((W - 140) / b, (H - 90) / a);
  const A = { x: 60, y: H - 50 }, C = { x: 60 + b * s, y: H - 50 }, B = { x: 60 + b * s, y: H - 50 - a * s };
  const w = bezug === "alpha" ? alpha : beta, wz = bezug === "alpha" ? "α" : "β";
  // aus Sicht von α: a gegenüber, b anliegend; aus Sicht von β umgekehrt
  const gk = bezug === "alpha" ? "a" : "b", ak = bezug === "alpha" ? "b" : "a";
  const gkW = bezug === "alpha" ? a : b, akW = bezug === "alpha" ? b : a;
  const farbe = (seite: "a" | "b") => (seite === gk ? FARBE.gk : FARBE.ak);
  const bogen = (P: { x: number; y: number }, von: number, bis: number, r = 34) => {
    const p1 = { x: P.x + r * Math.cos(von * Math.PI / 180), y: P.y - r * Math.sin(von * Math.PI / 180) };
    const p2 = { x: P.x + r * Math.cos(bis * Math.PI / 180), y: P.y - r * Math.sin(bis * Math.PI / 180) };
    return `M ${P.x} ${P.y} L ${p1.x} ${p1.y} A ${r} ${r} 0 0 0 ${p2.x} ${p2.y} Z`;
  };

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 items-end">
        <Regler label="Winkel α (°)" wert={alpha} setze={setAlpha} min={5} max={85} breit />
        <Regler label="Hypotenuse c" wert={c} setze={setC} min={2} max={12} step={0.5} breit />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Von welchem Winkel aus?</span>
          <div className="flex gap-1.5">
            <button className={`chip ${bezug === "alpha" ? "chip-on" : ""}`} onClick={() => setBezug("alpha")}>α</button>
            <button className={`chip ${bezug === "beta" ? "chip-on" : ""}`} onClick={() => setBezug("beta")}>β</button>
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] items-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[calc(100vh-8rem)]" role="img" aria-label="Rechtwinkliges Dreieck">
          <path d={bogen(A, 0, alpha)} fill="#f59e0b" fillOpacity={bezug === "alpha" ? 0.45 : 0.15} />
          <path d={bogen(B, 270 - beta, 270, 30)} fill="#f59e0b" fillOpacity={bezug === "beta" ? 0.45 : 0.15} />
          <rect x={C.x - 22} y={C.y - 22} width={22} height={22} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} />
          <circle cx={C.x - 11} cy={C.y - 11} r={2.5} fill="var(--text-muted)" />
          <line x1={A.x} y1={A.y} x2={C.x} y2={C.y} stroke={farbe("b")} strokeWidth={6} strokeLinecap="round" />
          <line x1={C.x} y1={C.y} x2={B.x} y2={B.y} stroke={farbe("a")} strokeWidth={6} strokeLinecap="round" />
          <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={FARBE.hy} strokeWidth={6} strokeLinecap="round" />
          <text x={A.x - 14} y={A.y + 6} textAnchor="end" fontSize={18} fontWeight={800} fill="var(--text)">A</text>
          <text x={B.x + 12} y={B.y} fontSize={18} fontWeight={800} fill="var(--text)">B</text>
          <text x={C.x + 12} y={C.y + 6} fontSize={18} fontWeight={800} fill="var(--text)">C</text>
          <text x={A.x + 42} y={A.y - 10} fontSize={16} fontWeight={800} fill="#f59e0b">α</text>
          <text x={B.x - 18} y={B.y + 50} fontSize={16} fontWeight={800} fill="#f59e0b" textAnchor="end">β</text>
          <text x={(A.x + C.x) / 2} y={A.y + 28} textAnchor="middle" fontSize={15} fontWeight={700} fill={farbe("b")}>
            b = {z(b, 2)} · {ak === "b" ? "Ankathete" : "Gegenkathete"}
          </text>
          <text x={C.x + 12} y={(C.y + B.y) / 2} fontSize={15} fontWeight={700} fill={farbe("a")}>
            <tspan x={C.x + 12}>a = {z(a, 2)}</tspan>
            <tspan x={C.x + 12} dy={18}>{gk === "a" ? "Gegen-" : "An-"}</tspan>
            <tspan x={C.x + 12} dy={18}>kathete</tspan>
          </text>
          <text x={(A.x + B.x) / 2 - 14} y={(A.y + B.y) / 2 - 12} textAnchor="end" fontSize={15} fontWeight={700} fill={FARBE.hy}>
            c = {z(c, 2)} · Hypotenuse
          </text>
        </svg>
        <div className="flex flex-col gap-2">
          {([
            ["sin", "Gegenkathete", "Hypotenuse", gk, "c", gkW, c, sinG(w), FARBE.gk],
            ["cos", "Ankathete", "Hypotenuse", ak, "c", akW, c, cosG(w), FARBE.ak],
            ["tan", "Gegenkathete", "Ankathete", gk, ak, gkW, akW, tanG(w), FARBE.gk],
          ] as const).map(([fn, oben, unten, so, su, wo, wu, v, f]) => (
            <div key={fn} className="rounded-xl border border-line p-3" style={{ borderLeft: `5px solid ${f}` }}>
              <div className="font-black text-lg">
                {fn} {wz} = <span className="inline-flex flex-col items-center align-middle text-sm leading-tight mx-1"><span>{oben}</span><span className="border-t border-current w-full text-center">{unten}</span></span>
                = {so}/{su} = {z(wo, 2)} / {z(wu, 2)} = {z(v, 4)}
              </div>
            </div>
          ))}
          <p className="text-sm text-muted">
            <strong>Hypotenuse</strong> = längste Seite, gegenüber dem rechten Winkel. <strong>Gegenkathete</strong> liegt dem Winkel gegenüber,
            die <strong>Ankathete</strong> liegt an ihm an. Merksatz: <em>GHAHGA</em> — sin = G/H, cos = A/H, tan = G/A.
            Wechsel auf {bezug === "alpha" ? "β" : "α"}: Gegen- und Ankathete tauschen die Rollen, darum ist sin {wz} = cos {bezug === "alpha" ? "β" : "α"}.
            Zieh an c: alle Seiten wachsen, die Verhältnisse bleiben gleich — sie hängen nur am Winkel.
          </p>
        </div>
      </div>
    </div>
  );
}
