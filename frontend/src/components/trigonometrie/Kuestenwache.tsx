"use client";
/**
 * Spiel »Küstenwache«: Ein Schiff in Seenot steckt im Nebel. Die Leuchttürme
 * A und B peilen es an und melden ihre Winkel zur Küste. Wer Kurs und Strecke
 * richtig ausrechnet, schickt das Rettungsboot genau hin.
 *   Stufe 1  Lotse     Schiff genau vor A — rechtwinklig, tan
 *   Stufe 2  Peilung   beliebige Lage, Boot startet in A — Sinussatz
 *   Stufe 3  Hafen     Boot startet im Hafen H — Sinussatz, dann Kosinussatz
 * Fünf Einsätze je Spiel; Punkte nach Fehlweite, ein Tipp kostet 25.
 */
import { useEffect, useRef, useState } from "react";
import { cosG, sinG, tanG } from "@/lib/trigonometrie";
import { leseZahl, z } from "@/lib/prozent";

const W = 820, H = 470, SC = 46, OX = 130, KY = 420; // 1 km = SC px, A bei OX, Küste bei KY
const px = (x: number) => OX + x * SC;
const py = (y: number) => KY - y * SC;
const EINSAETZE = 5;
const RETTUNG = 0.3; // km — so nah muss das Boot heran
const SPEICHER = "hp_trig_kuestenwache_best";

type Stufe = 1 | 2 | 3;
type Einsatz = { s: number; a: number; b: number; ship: { x: number; y: number }; hafen: number; kurs: number; weg: number };

const ganz = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

/** Lage aus den gerundeten Winkeln — dann passen die gemeldeten Zahlen genau. */
function neuerEinsatz(stufe: Stufe): Einsatz {
  const s = ganz(4, 9);
  for (;;) {
    let a: number, b: number;
    if (stufe === 1) { a = 90; b = ganz(25, 60); }
    else {
      const x = -1 + Math.random() * (s + 2), y = 1.5 + Math.random() * 6;
      a = Math.round(Math.atan2(y, x) * 180 / Math.PI); b = Math.round(Math.atan2(y, s - x) * 180 / Math.PI);
    }
    if (a < 20 || b < 20 || a + b > 165) continue;
    const as = (s * sinG(b)) / sinG(180 - a - b), ship = { x: as * cosG(a), y: as * sinG(a) };
    if (ship.y < 1.2 || ship.y > 8.3 || ship.x < -2.4 || ship.x > 14.5) continue;
    let hafen = 0;
    if (stufe === 3) { do hafen = ganz(-4, 2 * s + 4) / 2; while (Math.abs(hafen) < 1.5 || Math.abs(hafen - s) < 1); }
    const dx = ship.x - hafen, dy = ship.y;
    return { s, a, b, ship, hafen, kurs: Math.atan2(dy, dx) * 180 / Math.PI, weg: Math.hypot(dx, dy) };
  }
}

function tippText(st: Stufe, e: Einsatz) {
  if (st === 1) return `Bei A ist ein rechter Winkel. tan β = AS / AB, also AS = ${e.s} km · tan ${e.b}°. Kurs: genau 90° (senkrecht zur Küste).`;
  const g = 180 - e.a - e.b;
  if (st === 2) return `Winkel am Schiff: 180° − ${e.a}° − ${e.b}° = ${g}°. Sinussatz: AS = ${e.s} km · sin ${e.b}° / sin ${g}°. Der Kurs ist der Winkel bei A: ${e.a}°.`;
  const rechts = e.hafen > 0;
  return `Erst AS mit dem Sinussatz (wie Stufe 2). H liegt ${z(Math.abs(e.hafen), 1)} km ${rechts ? "rechts" : "links"} von A, der Winkel bei A im Dreieck H–A–S ist also ${rechts ? `${e.a}°` : `180° − ${e.a}° = ${180 - e.a}°`}. Kosinussatz → HS. Den Winkel bei H (zur Küste, ${rechts ? "nach links gemessen, Kurs = 180° minus diesen Winkel" : "nach rechts gemessen = Kurs"}) mit Sinus- oder Kosinussatz.`;
}

function loesungText(st: Stufe, e: Einsatz) {
  const g = 180 - e.a - e.b, as = (e.s * sinG(e.b)) / sinG(g);
  if (st === 1) return `AS = ${e.s} · tan ${e.b}° = ${z(e.s * tanG(e.b), 2)} km, Kurs 90°`;
  if (st === 2) return `γ = ${g}°, AS = ${e.s} · sin ${e.b}° / sin ${g}° = ${z(as, 2)} km, Kurs ${e.a}°`;
  const wA = e.hafen > 0 ? e.a : 180 - e.a, ah = Math.abs(e.hafen);
  return `AS = ${z(as, 2)} km; HS² = ${z(ah, 1)}² + ${z(as, 2)}² − 2·${z(ah, 1)}·${z(as, 2)}·cos ${wA}° ⇒ HS = ${z(e.weg, 2)} km, Kurs ${z(e.kurs, 1)}°`;
}

export default function Kuestenwache() {
  const [stufe, setStufe] = useState<Stufe>(1);
  const [lauf, setLauf] = useState<"start" | "zielen" | "faehrt" | "ergebnis" | "ende">("start");
  const [e, setE] = useState<Einsatz | null>(null);
  const [nr, setNr] = useState(0);
  const [kurs, setKurs] = useState(""), [weg, setWeg] = useState("");
  const [tipp, setTipp] = useState(false);
  const [boot, setBoot] = useState<{ x: number; y: number } | null>(null);
  const [ziel, setZiel] = useState<{ x: number; y: number } | null>(null);
  const [runden, setRunden] = useState<{ fehl: number; punkte: number; gerettet: boolean }[]>([]);
  const [best, setBest] = useState<Record<string, number>>({});
  const anim = useRef(0);

  useEffect(() => {
    try { setBest(JSON.parse(localStorage.getItem(SPEICHER) ?? "{}")); } catch { /* ohne Speicher */ }
    return () => cancelAnimationFrame(anim.current);
  }, []);

  const starte = (st: Stufe) => {
    setStufe(st); setRunden([]); setNr(1); naechster(st);
  };
  const naechster = (st = stufe) => {
    const n = neuerEinsatz(st);
    setE(n); setKurs(st === 1 ? "90" : ""); setWeg(""); setTipp(false); setBoot(null); setZiel(null); setLauf("zielen");
  };

  const k = leseZahl(kurs), d = leseZahl(weg);
  const losOk = k !== null && d !== null && d > 0 && d < 30 && k >= 0 && k <= 180;

  const los = () => {
    if (!e || !losOk) return;
    const z0 = { x: e.hafen, y: 0 }, end = { x: z0.x + d! * cosG(k!), y: z0.y + d! * sinG(k!) };
    setZiel(end); setLauf("faehrt");
    const t0 = performance.now(), dauer = 900 + Math.min(2200, d! * 250);
    const schritt = (t: number) => {
      const f = Math.min(1, (t - t0) / dauer), g = 1 - (1 - f) ** 2;
      setBoot({ x: z0.x + (end.x - z0.x) * g, y: z0.y + (end.y - z0.y) * g });
      if (f < 1) { anim.current = requestAnimationFrame(schritt); return; }
      const fehl = Math.hypot(end.x - e.ship.x, end.y - e.ship.y), gerettet = fehl <= RETTUNG;
      const punkte = Math.max(0, Math.round(100 - fehl * 120)) + (gerettet ? 20 : 0) - (tipp ? 25 : 0);
      setRunden(r => [...r, { fehl, punkte: Math.max(0, punkte), gerettet }]);
      setLauf("ergebnis");
    };
    anim.current = requestAnimationFrame(schritt);
  };

  const weiter = () => {
    if (nr >= EINSAETZE) {
      const summe = runden.reduce((s, r) => s + r.punkte, 0);
      if (summe > (best[stufe] ?? 0)) {
        const nb = { ...best, [stufe]: summe };
        setBest(nb);
        try { localStorage.setItem(SPEICHER, JSON.stringify(nb)); } catch { /* ohne Speicher */ }
      }
      setLauf("ende"); return;
    }
    setNr(n => n + 1); naechster();
  };

  const summe = runden.reduce((s, r) => s + r.punkte, 0);
  const zeigeSchiff = lauf === "ergebnis" || lauf === "ende";
  const strahl = (x0: number, w: number, l = 110) => ({ x1: px(x0), y1: KY, x2: px(x0) + l * cosG(w), y2: KY - l * sinG(w) });

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-black">🚨 Küstenwache</h3>
        {lauf !== "start" && lauf !== "ende" && <span className="text-sm text-muted">Stufe {stufe} · Einsatz {nr}/{EINSAETZE} · {summe} Punkte</span>}
        <span className="flex-1" />
        {lauf !== "start" && <button className="btn text-xs" onClick={() => { cancelAnimationFrame(anim.current); setLauf("start"); }}>↺ Stufe wählen</button>}
      </div>

      {lauf === "start" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm max-w-3xl">
            Seenotruf! Ein Schiff treibt im Nebel. Die Leuchttürme <strong>A</strong> und <strong>B</strong> peilen es an und melden den Winkel zwischen
            Küste und Peilstrahl. Rechne Kurs und Strecke aus und schick das Rettungsboot los — kommt es bis auf {z(RETTUNG * 1000, 0)} m heran, ist die Crew gerettet.
            Der Kurs wird an der Küste gemessen: 0° = nach rechts die Küste entlang, 90° = gerade aufs Meer, 180° = nach links.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {([[1, "🧭 Lotse", "Schiff genau vor A — rechtwinkliges Dreieck, tan"], [2, "📡 Peilung", "beliebige Lage, Start in A — Sinussatz"],
              [3, "⚓ Hafen", "Start im Hafen H — Sinussatz, dann Kosinussatz"]] as const).map(([st, t, b]) => (
              <button key={st} className="rounded-xl border border-line p-3 text-left hover:bg-surface-hover" onClick={() => starte(st)}>
                <div className="font-black">Stufe {st}: {t}</div>
                <div className="text-xs text-muted">{b}</div>
                {best[st] ? <div className="text-xs mt-1">🏆 Bestwert {best[st]}</div> : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {e && lauf !== "start" && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded-xl" role="img" aria-label="Seekarte">
            <defs>
              <radialGradient id="kw-nebel"><stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.55} /><stop offset="100%" stopColor="#cbd5e1" stopOpacity={0} /></radialGradient>
            </defs>
            <rect x={0} y={0} width={W} height={KY} fill="#0e7490" fillOpacity={0.35} />
            <rect x={0} y={KY} width={W} height={H - KY} fill="#a16207" fillOpacity={0.35} />
            {Array.from({ length: 9 }, (_, i) => <line key={i} x1={0} y1={py(i)} x2={W} y2={py(i)} stroke="#fff" strokeOpacity={0.07} />)}
            {Array.from({ length: 18 }, (_, i) => <line key={i} x1={px(i - 2)} y1={0} x2={px(i - 2)} y2={KY} stroke="#fff" strokeOpacity={0.07} />)}
            {!zeigeSchiff && [0, 1, 2, 3, 4, 5].map(i => <ellipse key={i} cx={(i * 157 + 80) % W} cy={70 + (i * 61) % 260} rx={170} ry={70} fill="url(#kw-nebel)" />)}
            <line x1={0} y1={KY} x2={W} y2={KY} stroke="var(--text)" strokeWidth={2} />
            {/* Maßstab */}
            <line x1={W - 20 - SC} y1={H - 18} x2={W - 20} y2={H - 18} stroke="var(--text)" strokeWidth={3} />
            <text x={W - 20 - SC / 2} y={H - 26} textAnchor="middle" fontSize={11} fill="var(--text)">1 km</text>
            {/* Peilstrahlen */}
            {[[0, e.a], [e.s, 180 - e.b]].map(([x0, w], i) => (
              <line key={i} {...strahl(x0, w, zeigeSchiff ? 2000 : 110)} stroke="#fde047" strokeWidth={zeigeSchiff ? 1.5 : 10} strokeOpacity={zeigeSchiff ? 0.6 : 0.35} strokeLinecap="round" />
            ))}
            {[[0, "A", e.a, 0, e.a], [e.s, "B", e.b, 180 - e.b, 180]].map(([x0, n, w, von, bis]) => {
              const r = 40, p1 = `${px(x0 as number) + r * cosG(von as number)} ${KY - r * sinG(von as number)}`, p2 = `${px(x0 as number) + r * cosG(bis as number)} ${KY - r * sinG(bis as number)}`;
              return (
                <g key={n as string}>
                  <path d={`M ${px(x0 as number)} ${KY} L ${p1} A ${r} ${r} 0 0 0 ${p2} Z`} fill="#f59e0b" fillOpacity={0.45} />
                  <text x={px(x0 as number)} y={KY + 4} textAnchor="middle" fontSize={26}>🗼</text>
                  <text x={px(x0 as number)} y={KY + 40} textAnchor="middle" fontSize={15} fontWeight={900} fill="var(--text)">{n as string}</text>
                  <text x={px(x0 as number) + (n === "A" ? 46 : -46)} y={KY - 14} textAnchor="middle" fontSize={15} fontWeight={900} fill="#fde047">{w as number}°</text>
                </g>
              );
            })}
            <line x1={px(0)} y1={KY + 22} x2={px(e.s)} y2={KY + 22} stroke="var(--text)" strokeDasharray="4 3" />
            <text x={px(e.s / 2)} y={KY + 38} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--text)">{e.s} km</text>
            {stufe === 3 && (
              <g>
                <text x={px(e.hafen)} y={KY + 4} textAnchor="middle" fontSize={24}>⚓</text>
                <text x={px(e.hafen)} y={KY + 40} textAnchor="middle" fontSize={15} fontWeight={900} fill="#22c55e">H</text>
                <text x={px(e.hafen)} y={KY + 56} textAnchor="middle" fontSize={11} fill="var(--text)">{z(Math.abs(e.hafen), 1)} km {e.hafen > 0 ? "rechts" : "links"} von A</text>
              </g>
            )}
            {/* Kurs-Vorschau */}
            {lauf === "zielen" && k !== null && (
              <line x1={px(e.hafen)} y1={KY} x2={px(e.hafen) + 70 * cosG(k)} y2={KY - 70 * sinG(k)} stroke="#22c55e" strokeWidth={3} strokeDasharray="5 4" />
            )}
            {zeigeSchiff && (
              <>
                <line x1={px(e.hafen)} y1={KY} x2={px(e.ship.x)} y2={py(e.ship.y)} stroke="#fff" strokeDasharray="6 5" strokeOpacity={0.7} />
                <circle cx={px(e.ship.x)} cy={py(e.ship.y)} r={RETTUNG * SC} fill="#22c55e" fillOpacity={0.2} stroke="#22c55e" />
                <text x={px(e.ship.x)} y={py(e.ship.y) + 8} textAnchor="middle" fontSize={26}>🚢</text>
              </>
            )}
            {ziel && <line x1={px(e.hafen)} y1={KY} x2={px(boot?.x ?? e.hafen)} y2={py(boot?.y ?? 0)} stroke="#fb923c" strokeWidth={2} />}
            {boot && <text x={px(boot.x)} y={py(boot.y) + 7} textAnchor="middle" fontSize={20}>🛥️</text>}
          </svg>

          {lauf === "zielen" && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Kurs (Winkel zur Küste)</span>
                <span className="flex items-center gap-1"><input className="input w-24" inputMode="decimal" value={kurs} aria-label="Kurs" disabled={stufe === 1}
                  onChange={ev => setKurs(ev.target.value)} />°</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Strecke</span>
                <span className="flex items-center gap-1"><input className="input w-24" inputMode="decimal" value={weg} aria-label="Strecke"
                  onChange={ev => setWeg(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") los(); }} /> km</span>
              </label>
              <button className="btn btn-primary" disabled={!losOk} onClick={los}>🛥️ Boot los!</button>
              <button className="btn" disabled={tipp} onClick={() => setTipp(true)}>💡 Tipp (−25)</button>
            </div>
          )}
          {tipp && lauf === "zielen" && <p className="text-sm rounded-xl border border-line p-3">{tippText(stufe, e)}</p>}

          {lauf === "ergebnis" && runden.length > 0 && (() => {
            const r = runden[runden.length - 1];
            return (
              <div className="flex flex-col gap-2">
                <p className={`text-lg font-black ${r.gerettet ? "text-ok" : "text-bad"}`}>
                  {r.gerettet ? `🛟 Gerettet! Nur ${z(r.fehl * 1000, 0)} m daneben.` : `Verfehlt — ${z(r.fehl, 2)} km vom Schiff entfernt.`} +{r.punkte} Punkte
                </p>
                <p className="text-sm text-muted font-mono">{loesungText(stufe, e)}</p>
                <button className="btn btn-primary self-start" onClick={weiter}>{nr >= EINSAETZE ? "Auswertung →" : "Nächster Einsatz →"}</button>
              </div>
            );
          })()}

          {lauf === "ende" && (
            <div className="flex flex-col gap-2">
              <p className="text-xl font-black">Schicht vorbei: {summe} Punkte · {runden.filter(r => r.gerettet).length} von {EINSAETZE} Crews gerettet</p>
              {summe >= (best[stufe] ?? 0) && summe > 0 && <p className="text-ok font-bold">🏆 Neuer Bestwert für Stufe {stufe}!</p>}
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={() => starte(stufe)}>Noch eine Schicht</button>
                {stufe < 3 && <button className="btn" onClick={() => starte((stufe + 1) as Stufe)}>Stufe {stufe + 1} →</button>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
