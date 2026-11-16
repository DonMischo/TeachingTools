"use client";
/**
 * Spiel Feuerwehr: Der Löschstrahl ist eine Parabel. Man stellt den Düsendruck
 * (→ Austrittsgeschwindigkeit, Bernoulli) und den Winkel ein und wählt den
 * Standort – aber nur so nah, wie es die Hitze erlaubt (E = P / 4πr² ≤ 5 kW/m²).
 * Gelöschte Brände strahlen nicht mehr: dann darf man näher heran.
 *
 * Das Wasser sind einzelne Tropfen in der Physik aus lib/wurfphysik.ts: Sie prallen
 * an Fassade, Dach, Boden, Baum und Auto ab; durch ein Fenster fliegend löschen sie.
 * Mehr Druck heißt mehr Wasser pro Sekunde (Q = A·v) – der Tank ist begrenzt.
 * Animation per setInterval: requestAnimationFrame steht in verdeckten Fenstern still.
 */
import { useEffect, useRef, useState } from "react";
import { FLEVELS, DUESE_Y, E_MAX, WASSER_START, austritt, brandMitte, durchfluss, hitze, naechsterStandort, strahl, type FLevel } from "@/lib/feuerwehr";
import { glatt, scheitel, spfStuecke, spfWert, zahl } from "@/lib/quadratisch";
import { rechteck, schritt, stoss, type Koerper, type Strecke } from "@/lib/wurfphysik";
import { ladeAvatar, type Avatar } from "@/components/gebaeude/avatar";
import { F, Regler, Term } from "./teile";
import Figuren3D from "./Figuren3D";

const W = 660, H = 420, MX = 30, MY = 26;
const X0 = -1, X1 = 33, Y0 = 0, Y1 = 16;
const sx = (x: number) => MX + ((x - X0) / (X1 - X0)) * (W - 2 * MX);
const sy = (y: number) => H - MY - ((y - Y0) / (Y1 - Y0)) * (H - 2 * MY);
const DT = 1 / 60, PRO_TAKT = 4, X_MIN = 3.5;
const LITER_JE_GLUT = 0.01;          // Liter je kW Brandleistung bis zum Löschen (1500 kW → 15 L)
const NACHGLUT = 0.03;               // je s ohne Wasser wächst die Glut wieder
const BEST = "hp_quadratisch_feuerwehr_best";

type Tropfen = Koerper & { alter: number; liter: number; fertig?: boolean };

/** Fassade mit Fensterlöchern, Dach, Boden, Hindernisse als Strecken */
function feld(lv: FLevel): Strecke[] {
  const f: Strecke[] = [{ x0: -2, y0: 0, x1: 40, y1: 0, art: "boden" }];
  const loecher = [...lv.braende].sort((a, b) => a.y0 - b.y0);
  let y = 0;
  for (const b of loecher) { f.push({ x0: lv.hausX, y0: y, x1: lv.hausX, y1: b.y0, art: "wand" }); y = b.y1; }
  f.push({ x0: lv.hausX, y0: y, x1: lv.hausX, y1: lv.dach, art: "wand" });
  f.push({ x0: lv.hausX - 0.4, y0: lv.dach, x1: lv.hausX + 3.5, y1: lv.dach + 2.5, art: "dach" });
  for (const h of lv.hindernisse) f.push(...rechteck(h.x0, h.y0, h.x1, h.y1, h.name));
  return f;
}

export default function Feuerwehr() {
  const [lv, setLv] = useState(0);
  const level = FLEVELS[lv];
  const [druck, setDruck] = useState(1);
  const [winkel, setWinkel] = useState(35);
  const [xF, setXF] = useState(X_MIN);
  const [spritzt, setSpritzt] = useState(false);
  const [vorschau, setVorschau] = useState(true);
  const [glut, setGlut] = useState<number[]>(() => level.braende.map(() => 1));
  const [wasser, setWasser] = useState(WASSER_START);
  const [punkte, setPunkte] = useState(0);
  const [status, setStatus] = useState<"laeuft" | "geloescht" | "leer" | "fertig">("laeuft");
  const [best, setBest] = useState(0);
  const [drei, setDrei] = useState(false);
  const [ich, setIch] = useState<Avatar | null>(null);
  const [, setTakt] = useState(0);
  const tropfen = useRef<Tropfen[]>([]);
  const zuletztNass = useRef<number[]>([]);
  const zeit = useRef(0);
  // der Takt liest den aktuellen Stand über eine Ref, damit das Intervall nicht bei jedem Regler neu startet
  const stand = useRef({ druck, winkel, xF, spritzt, glut, wasser, lv, status });
  stand.current = { druck, winkel, xF, spritzt, glut, wasser, lv, status };

  useEffect(() => { setIch(ladeAvatar()); try { setBest(Number(localStorage.getItem(BEST) ?? 0) || 0); } catch { /* privat */ } }, []);

  const erlaubt = naechsterStandort(level, glut);
  const s = strahl(xF, druck, winkel);
  const S = scheitel(s);
  const v = austritt(druck), q = durchfluss(druck);
  const e = hitze(level, glut, xF);

  const starteLevel = (n: number) => {
    tropfen.current = []; zeit.current = 0;
    setLv(n); setGlut(FLEVELS[n].braende.map(() => 1)); setWasser(WASSER_START); setSpritzt(false); setStatus("laeuft");
    setXF(X_MIN);
  };

  useEffect(() => {
    const strecken = feld(level);
    const id = setInterval(() => {
      const st = stand.current, L = FLEVELS[st.lv];
      zeit.current += DT;
      const t = tropfen.current;
      let w = st.wasser;
      // neue Tropfen an der Düse, leicht gestreut
      if (st.spritzt && w > 0 && st.status === "laeuft") {
        const v0 = austritt(st.druck), menge = Math.min(w, durchfluss(st.druck) * DT);
        w -= menge;
        for (let i = 0; i < PRO_TAKT; i++) {
          const al = ((st.winkel + (Math.random() - 0.5) * 1.2) * Math.PI) / 180, vv = v0 * (1 + (Math.random() - 0.5) * 0.03);
          const k = (i / PRO_TAKT) * DT;   // über den Takt verteilt, sonst fliegen Klumpen
          t.push({ x: st.xF + vv * Math.cos(al) * k, y: DUESE_Y + vv * Math.sin(al) * k, vx: vv * Math.cos(al), vy: vv * Math.sin(al) - 9.81 * k, r: 0.06, alter: 0, liter: menge / PRO_TAKT });
        }
      }
      // Tropfen bewegen; durch ein brennendes Fenster: löschen
      const g = [...st.glut], nass = zuletztNass.current;
      for (const d of t) {
        for (let n = 0; n < 2; n++) {
          const xAlt = d.x;
          schritt(d, DT / 2);
          if (xAlt < L.hausX && d.x >= L.hausX) {
            const i = L.braende.findIndex(b => d.y > b.y0 && d.y < b.y1);
            if (i >= 0) { d.fertig = true; if (g[i] > 0) { g[i] = Math.max(0, g[i] - d.liter / (L.braende[i].leistung * LITER_JE_GLUT)); nass[i] = zeit.current; } break; }
          }
          for (const sg of strecken) stoss(d, sg, sg.art === "boden" ? 0.05 : 0.15, 0.6);
        }
        d.alter += DT;
        if (d.alter > 4 || d.x > L.hausX + 4 || d.x < X0 - 1) d.fertig = true;
      }
      tropfen.current = t.filter(d => !d.fertig);
      // ohne Wasser glüht es wieder auf
      for (let i = 0; i < g.length; i++) if (g[i] > 0 && zeit.current - (nass[i] ?? 0) > 1) g[i] = Math.min(1, g[i] + NACHGLUT * DT);
      if (st.status === "laeuft") {
        if (g.every(x => x <= 0)) {
          setStatus("geloescht"); setSpritzt(false);
          setPunkte(p => p + 50 + Math.round(w / 2));
        } else if (w <= 0 && tropfen.current.length === 0) { setStatus("leer"); setSpritzt(false); }
      }
      setGlut(g); setWasser(w);
      // zu heiß? Dann weicht die Feuerwehrfrau / der Feuerwehrmann zurück
      const darf = naechsterStandort(L, g);
      if (st.xF > darf) setXF(Math.max(X_MIN, darf));
      setTakt(n => n + 1);
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [level]);

  const weiter = () => {
    if (lv + 1 >= FLEVELS.length) {
      setStatus("fertig");
      if (punkte > best) { setBest(punkte); try { localStorage.setItem(BEST, String(punkte)); } catch { /* privat */ } }
    } else starteLevel(lv + 1);
  };

  if (status === "fertig") {
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-5xl">🚒</div>
        <h3 className="text-2xl font-black">{punkte} Punkte</h3>
        <p className="text-muted">Alle {FLEVELS.length} Einsätze geschafft · Bestwert {Math.max(best, punkte)}</p>
        <button className="btn btn-primary" onClick={() => { setPunkte(0); starteLevel(0); }}>🔄 Nochmal</button>
      </div>
    );
  }

  // gestrichelte Vorschau der Strahl-Parabel bis zur Fassade
  let vorschauPfad = "";
  for (let x = xF; x <= level.hausX; x += 0.2) {
    const y = spfWert(s, x);
    if (y < 0) break;
    vorschauPfad += `${vorschauPfad ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
  }
  const tz = zeit.current;
  const haus = { x0: level.hausX, x1: level.hausX + 3.5 };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-black">🚒 Einsatz {lv + 1}/{FLEVELS.length}: {level.text}</span>
        <span className="flex-1" />
        <span className="text-sm font-black">{punkte} Punkte · Bestwert {best}</span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="card p-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" style={{ maxHeight: "calc(100vh - 240px)" }} role="img" aria-label="Einsatzort">
            <rect width={W} height={H} fill="var(--surface)" />
            <g stroke="var(--border)" opacity={0.45}>
              {Array.from({ length: 17 }, (_, i) => <line key={`v${i}`} x1={sx(i * 2)} y1={sy(Y0)} x2={sx(i * 2)} y2={sy(Y1)} />)}
              {Array.from({ length: 8 }, (_, i) => <line key={`h${i}`} x1={sx(X0)} y1={sy(i * 2)} x2={sx(X1)} y2={sy(i * 2)} />)}
            </g>
            <g fill="var(--text-muted)" fontSize={10}>
              {Array.from({ length: 9 }, (_, i) => <text key={i} x={sx(i * 4)} y={sy(0) + 14} textAnchor="middle">{i * 4} m</text>)}
              {Array.from({ length: 7 }, (_, i) => <text key={i} x={sx(X0) + 2} y={sy((i + 1) * 2) + 4}>{(i + 1) * 2}</text>)}
            </g>
            {/* Hitzezone */}
            <defs>
              <linearGradient id="fw-hitze" x1="0" x2="1">
                <stop offset="0" stopColor="#f97316" stopOpacity={0.05} /><stop offset="1" stopColor="#dc2626" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            {erlaubt < level.hausX - 0.5 && glut.some(g => g > 0) && (
              <g>
                <rect x={sx(erlaubt + 0.3)} y={sy(Y1)} width={sx(level.hausX) - sx(erlaubt + 0.3)} height={sy(0) - sy(Y1)} fill="url(#fw-hitze)" />
                <line x1={sx(erlaubt + 0.3)} y1={sy(0)} x2={sx(erlaubt + 0.3)} y2={sy(Y1)} stroke="#dc2626" strokeDasharray="5 5" />
                <text x={sx(erlaubt + 0.3) + 4} y={sy(Y1) + 14} fontSize={11} fontWeight={800} fill="#dc2626">🔥 zu heiß: mehr als {E_MAX} kW/m²</text>
              </g>
            )}
            <line x1={sx(X0)} y1={sy(0)} x2={sx(X1)} y2={sy(0)} stroke="var(--text)" strokeWidth={3} />
            {/* Haus */}
            <rect x={sx(haus.x0)} y={sy(level.dach)} width={sx(haus.x1) - sx(haus.x0)} height={sy(0) - sy(level.dach)} fill="#a8a29e" stroke="#57534e" />
            <path d={`M${sx(level.hausX - 0.4)},${sy(level.dach)} L${sx(level.hausX + 3.5)},${sy(level.dach + 2.5)} L${sx(X1)},${sy(level.dach + 2.5)} L${sx(X1)},${sy(level.dach)} Z`} fill="#7f1d1d" />
            <rect x={sx(haus.x1)} y={sy(level.dach)} width={sx(X1) - sx(haus.x1)} height={sy(0) - sy(level.dach)} fill="#a8a29e" opacity={0.7} />
            {level.braende.map((b, i) => {
              const m = brandMitte(level, b), gl = glut[i];
              const hoch = (b.y1 - b.y0) * (0.6 + gl * 0.9), wackel = Math.sin(tz * 9 + i) * 0.15;
              return (
                <g key={i}>
                  <rect x={sx(level.hausX) - 2} y={sy(b.y1)} width={sx(level.hausX + 1.4) - sx(level.hausX)} height={sy(b.y0) - sy(b.y1)} fill={gl > 0 ? "#451a03" : "#1e293b"} />
                  {gl > 0 && (
                    <g opacity={0.35 + gl * 0.65}>
                      <path d={`M${sx(m.x - 0.1)},${sy(b.y0)} Q${sx(m.x - 1.2 + wackel)},${sy(b.y0 + hoch * 0.6)} ${sx(m.x - 0.3 - wackel)},${sy(b.y0 + hoch)} Q${sx(m.x + 0.6)},${sy(b.y0 + hoch * 0.4)} ${sx(m.x + 0.9)},${sy(b.y0)} Z`} fill="#f97316" />
                      <path d={`M${sx(m.x)},${sy(b.y0)} Q${sx(m.x - 0.6 - wackel)},${sy(b.y0 + hoch * 0.4)} ${sx(m.x - 0.1 + wackel)},${sy(b.y0 + hoch * 0.7)} Q${sx(m.x + 0.4)},${sy(b.y0 + hoch * 0.3)} ${sx(m.x + 0.6)},${sy(b.y0)} Z`} fill="#fde047" />
                      {[0, 1, 2].map(k => {
                        const u = (tz * 0.6 + k / 3) % 1;
                        return <circle key={k} cx={sx(m.x - 0.8 - u * 2)} cy={sy(b.y1 + u * 3)} r={4 + u * 10} fill="#64748b" opacity={(1 - u) * 0.5 * gl} />;
                      })}
                    </g>
                  )}
                  <text x={sx(level.hausX + 1.8)} y={sy(m.y) + 4} fontSize={10} fontWeight={800} fill="#1c1917">{gl > 0 ? `${Math.round(gl * 100)} %` : "✔ aus"}</text>
                </g>
              );
            })}
            {/* Hindernisse */}
            {level.hindernisse.map((h, i) => h.name === "Baum" ? (
              <g key={i}>
                <rect x={sx((h.x0 + h.x1) / 2 - 0.3)} y={sy(h.y1 * 0.45)} width={sx(0.6) - sx(0)} height={sy(0) - sy(h.y1 * 0.45)} fill="#78350f" />
                <ellipse cx={sx((h.x0 + h.x1) / 2)} cy={sy(h.y1 * 0.7)} rx={(sx(h.x1) - sx(h.x0)) / 2 + 4} ry={(sy(h.y1 * 0.4) - sy(h.y1)) / 2 + 4} fill="#15803d" />
                <rect x={sx(h.x0)} y={sy(h.y1)} width={sx(h.x1) - sx(h.x0)} height={sy(h.y0) - sy(h.y1)} fill="none" stroke="#15803d" strokeDasharray="3 4" />
              </g>
            ) : (
              <g key={i}>
                <rect x={sx(h.x0)} y={sy(h.y1 * 0.7)} width={sx(h.x1) - sx(h.x0)} height={sy(h.y0 + 0.4) - sy(h.y1 * 0.7)} rx={5} fill="#2563eb" />
                <rect x={sx(h.x0 + 0.6)} y={sy(h.y1)} width={sx(h.x1 - 0.6) - sx(h.x0 + 0.6)} height={sy(h.y1 * 0.7) - sy(h.y1)} rx={5} fill="#60a5fa" />
                <circle cx={sx(h.x0 + 0.6)} cy={sy(0.4)} r={6} fill="#111827" /><circle cx={sx(h.x1 - 0.6)} cy={sy(0.4)} r={6} fill="#111827" />
              </g>
            ))}
            {/* Löschfahrzeug + Schlauch */}
            <g>
              <rect x={sx(-0.8)} y={sy(2.6)} width={sx(2.6) - sx(-0.8)} height={sy(0.4) - sy(2.6)} rx={4} fill="#dc2626" />
              <rect x={sx(1.6)} y={sy(2.6)} width={sx(2.6) - sx(1.6)} height={sy(1.6) - sy(2.6)} fill="#bfdbfe" />
              <line x1={sx(-0.6)} y1={sy(2.9)} x2={sx(1.4)} y2={sy(2.9)} stroke="#9ca3af" strokeWidth={3} />
              <circle cx={sx(0)} cy={sy(0.4)} r={7} fill="#111827" /><circle cx={sx(2)} cy={sy(0.4)} r={7} fill="#111827" />
              <path d={`M${sx(2.4)},${sy(0.6)} Q${sx((1.9 + xF) / 2)},${sy(0.05)} ${sx(xF - 0.5)},${sy(0.15)} L${sx(xF - 0.3)},${sy(DUESE_Y - 0.2)} L${sx(xF)},${sy(DUESE_Y)}`} fill="none" stroke="#b45309" strokeWidth={3} />
            </g>
            {!drei && (
              <g stroke="var(--text)" strokeWidth={2.5} strokeLinecap="round" fill="none" transform={`translate(${sx(xF - 0.6) - sx(xF)},0)`}>
                <circle cx={sx(xF)} cy={sy(1.6)} r={6} fill="#facc15" />
                <line x1={sx(xF)} y1={sy(1.45)} x2={sx(xF)} y2={sy(0.8)} />
                <line x1={sx(xF)} y1={sy(0.8)} x2={sx(xF - 0.25)} y2={sy(0)} /><line x1={sx(xF)} y1={sy(0.8)} x2={sx(xF + 0.25)} y2={sy(0)} />
              </g>
            )}
            {vorschau && glut.some(g => g > 0) && <path d={vorschauPfad} fill="none" stroke="#38bdf8" strokeWidth={2} strokeDasharray="5 6" />}
            {/* Wasser */}
            <path d={tropfen.current.map(d => `M${sx(d.x).toFixed(1)},${sy(d.y).toFixed(1)}h0`).join("")} stroke="#38bdf8" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
            <circle cx={sx(S.x)} cy={sy(S.y)} r={5} fill="#22c55e" stroke="var(--surface)" strokeWidth={1.5} />
            <text x={sx(S.x) + 8} y={sy(S.y) - 7} fontSize={11} fontWeight={800} fill="var(--text)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke">S({zahl(S.x, 1)} | {zahl(S.y, 1)})</text>
            {ich && <Figuren3D welt={{ W, H, MX, MY, X0, X1, Y0, Y1 }} beiBereit={setDrei}
              figuren={[{ id: "fw", avatar: ich, x: xF - 0.6, y: 0, hoehe: 1.8, blick: 1, bewegung: status === "geloescht" ? "jubel" : "idle" }]} />}
          </svg>
        </div>
        <div className="flex flex-col gap-3">
          <div className="card p-3 flex flex-col gap-3">
            <Regler name="Düsendruck p in bar" r="a" wert={druck} setze={setDruck} min={0.2} max={level.pMax} schritt={0.1} hinweis={`max. ${zahl(level.pMax)} bar`} />
            <Regler name="Winkel α in °" r="d" wert={winkel} setze={setWinkel} min={5} max={80} schritt={1} />
            <Regler name="Standort x in m" r="x" wert={xF} setze={x => setXF(Math.min(erlaubt, Math.max(X_MIN, x)))} min={X_MIN} max={Math.max(X_MIN, Math.floor(level.hausX - 1))} schritt={0.1}
              hinweis={`näher als ${zahl(erlaubt, 1)} m ist zu heiß`} />
            <div className="rounded-lg bg-page p-2 text-center"><Term st={spfStuecke({ ...s, a: glatt(Math.round(s.a * 10000) / 10000) })} /></div>
            <div className="flex gap-2 flex-wrap items-center">
              {status === "laeuft" && (
                <button className={`btn ${spritzt ? "" : "btn-primary"}`} onClick={() => setSpritzt(x => !x)} disabled={wasser <= 0}>
                  {spritzt ? "✋ Wasser halt!" : "💦 Wasser marsch!"}
                </button>
              )}
              {status === "geloescht" && <button className="btn btn-primary" onClick={weiter}>{lv + 1 >= FLEVELS.length ? "🏆 Auswertung" : "➡ Nächster Einsatz"}</button>}
              {status === "leer" && <button className="btn btn-primary" onClick={() => starteLevel(lv)}>↺ Tank auffüllen, neu</button>}
              <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={vorschau} onChange={e => setVorschau(e.target.checked)} /> Vorschau</label>
            </div>
            {status === "geloescht" && <p className="font-black text-ok">✔ Gelöscht! +{50 + Math.round(wasser / 2)} Punkte</p>}
            {status === "leer" && <p className="font-black text-bad">✘ Tank leer – weniger Druck spart Wasser, gut zielen spart mehr.</p>}
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span>💧 Tank</span><b>{Math.round(wasser)} L</b>
              <span>🚿 Austritt v = √(2p/ρ)</span><b>{zahl(v, 1)} m/s</b>
              <span>🌊 Wasserstrom Q = A·v</span><b>{zahl(q, 2)} L/s</b>
              <span>🔥 Hitze am Standort</span><b className={e > E_MAX * 0.9 ? "text-bad" : ""}>{zahl(e, 1)} kW/m²</b>
            </div>
          </div>
          <div className="card p-3 text-sm flex flex-col gap-1">
            <b>💡 Physik dahinter</b>
            <p>Der Strahl ist eine Wurfparabel: <F r="a">a</F> = −g / (2v²·cos²α). Mehr Druck → größeres v → flachere, weitere Parabel. Der Scheitel liegt bei y = 1,3 + v²·sin²α / (2g).</p>
            <p>Hitze nimmt mit dem Quadrat des Abstands ab: E = P / (4πr²). Ist ein Brand aus, sinkt E – dann darfst du näher heran.</p>
            <p className="text-xs text-muted">Punkte je Einsatz: 50 + halber Tankrest. Ohne Wasser glüht ein Brand langsam wieder auf.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
