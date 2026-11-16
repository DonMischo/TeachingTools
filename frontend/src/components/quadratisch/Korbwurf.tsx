"use client";
/**
 * Spiel Korbwurf: Der Ball verlässt die Hand bei (0 | 2) und fliegt auf einer
 * Parabel. Man setzt den Scheitelpunkt S der Wurfbahn – die Sim rechnet a so,
 * dass die Bahn durch die Hand geht, und zeigt den Term y = a(x + d)² + e.
 * Der Wurf läuft durch die Physik (lib/wurfphysik.ts): Treffer, wenn die Ballmitte
 * zwischen den Ringkanten von oben durch 3,05 m fällt – auch nach Abprallern.
 * Verteidiger springen in echter Zeit; der Abwurfzeitpunkt zählt. Figuren sind die
 * 3D-Avatare (eigener Avatar wirft), ohne WebGL Strichfiguren.
 *
 * Stufen: mit Vorschau · ohne Vorschau · Term eintippen (d und e selbst, S(−d|e)).
 * Animation per setInterval: requestAnimationFrame steht in verdeckten Fenstern still.
 */
import { useEffect, useRef, useState } from "react";
import { ABWURF, BALL_R, KORB_HOEHE, LEVELS, RING_R, glatt, leseZahl, scheitel, spfStuecke, spfWert, sprungHoehe, wirf, wurfbahn, zahl, type Punkt, type SPF, type Wurf } from "@/lib/quadratisch";
import { ladeAvatar, type Avatar } from "@/components/gebaeude/avatar";
import Figuren3D, { type FigurLage } from "./Figuren3D";
import { Chips } from "@/components/prozent/ui";
import { F, FARBE, Term } from "./teile";

type Stufe = "vorschau" | "blind" | "term";
const STUFEN = [
  { id: "vorschau" as const, label: "👀 Mit Vorschau" },
  { id: "blind" as const, label: "🙈 Ohne Vorschau" },
  { id: "term" as const, label: "⌨️ Term eintippen" },
];
const W = 660, H = 420, MX = 36, MY = 30;
const X0 = -0.6, X1 = 8.6, Y0 = 0, Y1 = 7.4;
const sx = (x: number) => MX + ((x - X0) / (X1 - X0)) * (W - 2 * MX);
const sy = (y: number) => H - MY - ((y - Y0) / (Y1 - Y0)) * (H - 2 * MY);
const bestKey = (s: Stufe) => `hp_quadratisch_korbwurf_best_${s}`;
const GEGNER: Avatar[] = [
  { klasse: "krieger", form: "m", haut: 2 }, { klasse: "rocker", form: "w", haut: 1 }, { klasse: "metalhead", form: "m", haut: 3 },
];
const leseBest = (s: Stufe) => { try { return Number(localStorage.getItem(bestKey(s)) ?? 0) || 0; } catch { return 0; } };

export default function Korbwurf() {
  const [stufe, setStufe] = useState<Stufe>("vorschau");
  const [lv, setLv] = useState(0);
  const [S, setS] = useState<Punkt>({ x: 2.5, y: 4.2 });
  const [dTxt, setDTxt] = useState("−2,5");
  const [eTxt, setETxt] = useState("4,2");
  const [flug, setFlug] = useState<number | null>(null);   // Bild der Spur, das gerade gezeigt wird
  const [lauf, setLauf] = useState<Wurf | null>(null);     // der Wurf, der gerade fliegt
  const [wurf, setWurf] = useState<Wurf | null>(null);     // Ergebnis, sobald er gelandet ist
  const [uhr, setUhr] = useState(0);                        // Spielzeit in s (für springende Verteidiger)
  const [drei, setDrei] = useState(false);                  // 3D-Avatare da?
  const [ich, setIch] = useState<Avatar | null>(null);
  const [versuch, setVersuch] = useState(0);
  const [punkte, setPunkte] = useState(0);
  const [fertig, setFertig] = useState(false);
  const [best, setBest] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const zieht = useRef(false);
  const level = LEVELS[lv];

  useEffect(() => { setBest(leseBest(stufe)); }, [stufe]);
  useEffect(() => { setIch(ladeAvatar()); }, []);
  // Springer bewegen sich auch, wenn gerade niemand wirft (während des Flugs zählt die Spur)
  const springt = level.hindernisse.some(h => h.sprung);
  useEffect(() => {
    if (!springt || lauf) return;
    const id = setInterval(() => setUhr(u => u + 1 / 60), 1000 / 60);
    return () => clearInterval(id);
  }, [springt, lauf]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  // Im Term-Modus kommt S aus d und e (Tafelwerk: S(−d | e)).
  const dIn = leseZahl(dTxt), eIn = leseZahl(eTxt);
  const Sakt: Punkt | null = stufe === "term" ? (dIn !== null && eIn !== null ? { x: glatt(-dIn), y: eIn } : null) : S;
  const bahn: SPF | null = Sakt ? wurfbahn(Sakt) : null;

  const neuesSpiel = (st = stufe) => {
    if (timer.current) clearInterval(timer.current);
    setLv(0); setPunkte(0); setVersuch(0); setWurf(null); setLauf(null); setFlug(null); setFertig(false); setStufe(st);
  };

  const werfen = () => {
    if (!bahn || timer.current) return;   // läuft schon ein Wurf?
    const w = wirf(bahn, level, uhr);
    setWurf(null); setLauf(w);
    let i = 0;
    setFlug(0);
    timer.current = setInterval(() => {
      i++;
      if (i >= w.spur.length - 1) {
        clearInterval(timer.current!); timer.current = null;
        setFlug(w.spur.length - 1); setWurf(w); setLauf(null); setUhr(w.t0 + (w.spur.length - 1) / 60);
        if (w.treffer) setPunkte(p => p + Math.max(1, 3 - versuch));
        else setVersuch(v => v + 1);
        return;
      }
      setFlug(i);
    }, 1000 / 60);
  };

  const weiter = () => {
    setWurf(null); setLauf(null); setFlug(null); setVersuch(0);
    if (lv + 1 >= LEVELS.length) {
      setFertig(true);
      if (punkte > best) { setBest(punkte); try { localStorage.setItem(bestKey(stufe), String(punkte)); } catch { /* privat */ } }
    } else setLv(l => l + 1);
  };

  const setzeAusZeiger = (e: React.PointerEvent<SVGSVGElement>) => {
    if (stufe === "term" || flug !== null) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (!(r.width > 0)) return;
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    const x = glatt(Math.round((X0 + ((px - MX) / (W - 2 * MX)) * (X1 - X0)) * 10) / 10);
    const y = glatt(Math.round((Y0 + ((H - MY - py) / (H - 2 * MY)) * (Y1 - Y0)) * 10) / 10);
    setS({ x: Math.min(8, Math.max(0.2, x)), y: Math.min(7.2, Math.max(2.1, y)) });
    setWurf(null);
  };

  // Spielzeit, die gerade zu sehen ist: im Flug die der Spur
  const zeigeWurf = lauf ?? wurf;
  const t = zeigeWurf && flug !== null ? zeigeWurf.t0 + flug / 60 : uhr;
  const ball: Punkt = zeigeWurf && flug !== null ? zeigeWurf.spur[flug] : ABWURF;
  const figuren: FigurLage[] = [
    ...(ich ? [{ id: "werfer", avatar: ich, x: -0.3, y: 0, hoehe: 1.9, blick: 1 as const, bewegung: lauf && flug !== null && flug < 30 ? "angriff" as const : wurf?.treffer ? "jubel" as const : "idle" as const }] : []),
    ...level.hindernisse.map((h, i) => {
      const o = sprungHoehe(h, t);
      return { id: `h${lv}_${i}`, avatar: GEGNER[i % GEGNER.length], x: (h.x0 + h.x1) / 2, y: h.y0 + o, hoehe: (h.y1 - h.y0) * 0.85, blick: -1 as const, bewegung: o > 0.02 ? "jubel" as const : "idle" as const };
    }),
  ];

  // gestrichelte Vorschau, durchgezogene Flugspur
  const pfad = (s: SPF, bis: number) => {
    let d = "";
    for (let x = 0; x <= bis + 1e-9; x += 0.05) {
      const y = spfWert(s, x);
      if (y < -0.2) break;
      d += `${d ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
    }
    return d;
  };

  if (fertig) {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-5xl">🏆</div>
        <h3 className="text-2xl font-black">{punkte} Punkte</h3>
        <p className="text-muted">Alle {LEVELS.length} Würfe geschafft · Bestwert ({STUFEN.find(s => s.id === stufe)!.label}): {Math.max(best, punkte)}</p>
        <button className="btn btn-primary" onClick={() => neuesSpiel()}>🔄 Nochmal</button>
      </div>
    );
  }

  const Sb = bahn ? scheitel(bahn) : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Chips wahl={stufe} setze={st => neuesSpiel(st)} optionen={STUFEN} />
        <span className="flex-1" />
        <span className="text-sm font-black">Wurf {lv + 1}/{LEVELS.length} · {punkte} Punkte · Bestwert {best}</span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="card p-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" style={{ touchAction: "none", maxHeight: "calc(100vh - 240px)", cursor: stufe === "term" ? "default" : "crosshair" }}
            role="img" aria-label="Basketballfeld"
            onPointerDown={e => { zieht.current = true; setzeAusZeiger(e); }}
            onPointerMove={e => { if (zieht.current) setzeAusZeiger(e); }}
            onPointerUp={() => { zieht.current = false; }} onPointerLeave={() => { zieht.current = false; }}>
            <rect width={W} height={H} fill="var(--surface)" />
            {/* Raster in Metern */}
            <g stroke="var(--border)" opacity={0.5}>
              {Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={sx(i)} y1={sy(Y0)} x2={sx(i)} y2={sy(Y1)} />)}
              {Array.from({ length: 8 }, (_, i) => <line key={`h${i}`} x1={sx(X0)} y1={sy(i)} x2={sx(X1)} y2={sy(i)} />)}
            </g>
            <g fill="var(--text-muted)" fontSize={11}>
              {Array.from({ length: 9 }, (_, i) => <text key={i} x={sx(i)} y={sy(0) + 16} textAnchor="middle">{i} m</text>)}
              {Array.from({ length: 7 }, (_, i) => <text key={i} x={sx(X0) + 2} y={sy(i + 1) + 4}>{i + 1}</text>)}
            </g>
            <line x1={sx(X0)} y1={sy(0)} x2={sx(X1)} y2={sy(0)} stroke="var(--text)" strokeWidth={3} />
            {level.decke !== undefined && <g><rect x={sx(X0)} y={0} width={W} height={sy(level.decke)} fill="var(--text-muted)" opacity={0.25} />
              <text x={W / 2} y={sy(level.decke) - 6} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--text)">Hallendecke {zahl(level.decke)} m</text></g>}
            {/* Werfer */}
            {!drei && <g stroke="var(--text)" strokeWidth={3} strokeLinecap="round" fill="none">
              <circle cx={sx(-0.25)} cy={sy(1.75)} r={9} fill="var(--surface)" />
              <line x1={sx(-0.25)} y1={sy(1.6)} x2={sx(-0.25)} y2={sy(0.8)} />
              <line x1={sx(-0.25)} y1={sy(0.8)} x2={sx(-0.4)} y2={sy(0)} /><line x1={sx(-0.25)} y1={sy(0.8)} x2={sx(-0.1)} y2={sy(0)} />
              <line x1={sx(-0.25)} y1={sy(1.4)} x2={sx(ABWURF.x)} y2={sy(ABWURF.y)} />
            </g>}
            {/* Hindernisse */}
            {level.hindernisse.map((h, i) => {
              const o = sprungHoehe(h, t);
              return (
                <g key={i}>
                  <rect x={sx(h.x0)} y={sy(h.y1 + o)} width={sx(h.x1) - sx(h.x0)} height={sy(h.y0) - sy(h.y1)} rx={6} fill="#db2777"
                    opacity={drei ? 0.15 : 0.75} stroke={drei ? "#db2777" : "none"} strokeDasharray="4 4" />
                  <text x={(sx(h.x0) + sx(h.x1)) / 2} y={sy(h.y1 + o) - 6} textAnchor="middle" fontSize={11} fontWeight={800} fill="#db2777">{h.sprung ? "⤒" : "🙋"} {h.name}</text>
                </g>
              );
            })}
            <Figuren3D welt={{ W, H, MX, MY, X0, X1, Y0, Y1 }} figuren={figuren} beiBereit={setDrei} />
            {/* Korb */}
            <g>
              <line x1={sx(level.korbX + 0.35)} y1={sy(0)} x2={sx(level.korbX + 0.35)} y2={sy(4.1)} stroke="var(--text-muted)" strokeWidth={4} />
              <line x1={sx(level.korbX + 0.3)} y1={sy(2.9)} x2={sx(level.korbX + 0.3)} y2={sy(4.0)} stroke="var(--text)" strokeWidth={5} />
              <line x1={sx(level.korbX - RING_R)} y1={sy(KORB_HOEHE)} x2={sx(level.korbX + 0.3)} y2={sy(KORB_HOEHE)} stroke="#ea580c" strokeWidth={5} strokeLinecap="round" />
              <path d={`M${sx(level.korbX - 0.2)},${sy(KORB_HOEHE)} L${sx(level.korbX - 0.1)},${sy(KORB_HOEHE - 0.4)} L${sx(level.korbX + 0.1)},${sy(KORB_HOEHE - 0.4)} L${sx(level.korbX + 0.2)},${sy(KORB_HOEHE)}`} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} />
              <text x={sx(level.korbX)} y={sy(KORB_HOEHE) + 34} textAnchor="middle" fontSize={11} fill="var(--text-muted)">({zahl(level.korbX)} | 3,05)</text>
            </g>
            {/* Vorschau / Flugbahn */}
            {bahn && stufe === "vorschau" && flug === null && <path d={pfad(bahn, level.korbX + 1)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 6" opacity={0.8} />}
            {zeigeWurf && flug !== null && <path d={zeigeWurf.spur.slice(0, flug + 1).map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("")} fill="none" stroke="var(--accent)" strokeWidth={2.5} />}
            <circle cx={sx(ball.x)} cy={sy(ball.y)} r={sx(BALL_R) - sx(0)} fill="#ea580c" stroke="#7c2d12" strokeWidth={1.5} />
            {/* Scheitelpunkt */}
            {Sakt && stufe !== "term" && (
              <g>
                <line x1={sx(Sakt.x)} y1={sy(0)} x2={sx(Sakt.x)} y2={sy(Sakt.y)} stroke={FARBE.d} strokeDasharray="3 4" />
                <line x1={sx(X0)} y1={sy(Sakt.y)} x2={sx(Sakt.x)} y2={sy(Sakt.y)} stroke={FARBE.e} strokeDasharray="3 4" />
                <circle cx={sx(Sakt.x)} cy={sy(Sakt.y)} r={8} fill={FARBE.s} stroke="var(--surface)" strokeWidth={2} />
                <text x={sx(Sakt.x) + 11} y={sy(Sakt.y) - 9} fontSize={13} fontWeight={800} fill="var(--text)" stroke="var(--surface)" strokeWidth={3.5} paintOrder="stroke">S({zahl(Sakt.x)} | {zahl(Sakt.y)})</text>
              </g>
            )}
          </svg>
        </div>
        <div className="flex flex-col gap-3">
          <div className="card p-3 flex flex-col gap-2">
            <b>🏀 Wurf {lv + 1}: {level.text}</b>
            {stufe === "term" ? (
              <>
                <p className="text-sm">Gib d und e der Wurfbahn y = a(x + <F r="d">d</F>)² + <F r="e">e</F> ein – a wird so berechnet, dass der Ball aus der Hand bei (0 | 2) startet.</p>
                <div className="flex gap-3">
                  <label className="flex flex-col text-sm"><F r="d">d</F><input className="input w-24" value={dTxt} onChange={e => { setDTxt(e.target.value); setWurf(null); }} aria-label="d" /></label>
                  <label className="flex flex-col text-sm"><F r="e">e</F><input className="input w-24" value={eTxt} onChange={e => { setETxt(e.target.value); setWurf(null); }} aria-label="e" /></label>
                </div>
                <p className="text-xs text-muted">Achtung Vorzeichen: Der höchste Punkt liegt bei x = −d.</p>
              </>
            ) : (
              <p className="text-sm">Zieh oder klick den <b>Scheitelpunkt S</b> (höchster Punkt der Bahn) ins Feld. {stufe === "blind" && "Ohne Vorschau: schätz die Bahn mit dem Term ab!"}</p>
            )}
            {bahn ? (
              <div className="rounded-lg bg-page p-2 text-center"><Term st={spfStuecke({ ...bahn, a: glatt(Math.round(bahn.a * 1000) / 1000) })} /></div>
            ) : <p className="text-sm text-bad">S muss höher als die Hand (2 m) und rechts vom Werfer liegen.</p>}
            {Sb && stufe === "term" && <p className="text-sm">⟹ Scheitelpunkt S({zahl(Sb.x)} | {zahl(Sb.y)})</p>}
            <div className="flex gap-2 flex-wrap">
              {!wurf?.treffer && <button className="btn btn-primary" onClick={werfen} disabled={!bahn || (flug !== null && !wurf)}>🏀 Werfen</button>}
              {wurf?.treffer && <button className="btn btn-primary" onClick={weiter}>{lv + 1 >= LEVELS.length ? "🏆 Auswertung" : "➡ Nächster Wurf"}</button>}
              {wurf && !wurf.treffer && <button className="btn" onClick={() => { setWurf(null); setLauf(null); setFlug(null); }}>↺ Neu zielen</button>}
            </div>
            {wurf && <p className={`font-black ${wurf.treffer ? "text-ok" : "text-bad"}`}>{wurf.treffer ? `✔ ${wurf.grund} +${Math.max(1, 3 - versuch)} Punkte` : `✘ ${wurf.grund}`}</p>}
            {wurf && !wurf.treffer && bahn && <p className="text-xs text-muted">Bei x = {zahl(level.korbX)} ist die Bahn auf y = {zahl(spfWert(bahn, level.korbX), 2)} – der Ring hängt auf 3,05.</p>}
          </div>
          <div className="card p-3 text-sm flex flex-col gap-1">
            <b>💡 Mathe dahinter</b>
            <p>Die Bahn ist eine nach unten geöffnete Parabel (a &lt; 0) mit Scheitelpunkt S. Ein höherer Scheitel macht sie steiler, ein Scheitel weiter rechts macht sie weiter.</p>
            <p>Treffer heißt: Die Ballmitte fällt zwischen den Ringkanten (x = {zahl(level.korbX)} ± 0,23) durch y = 3,05 – der Ball muss also schon fallen (S links vom Korb). Flache Würfe prallen an Ring oder Brett ab; steil fallende Bälle sehen den Ring breiter.</p>
            {springt && <p>⤒ Die Verteidiger springen immer wieder – auch ihr Sprung ist eine Parabel, nur in der Zeit: h(t) = −4,9·t² + v·t.</p>}
            <p className="text-xs text-muted">Punkte: 3 beim ersten Versuch, 2 beim zweiten, danach 1.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
