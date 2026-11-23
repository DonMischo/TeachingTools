"use client";
/**
 * Schrägbild, Zweitafel- und Dreitafelbild — mit Anleitung und Editor.
 *   📏 Anleitung        Schrägbild des Quaders Schritt für Schritt; Zweitafel-/Dreitafelbild jedes Körpers
 *                       mit Rissachse, Ordnungslinien und 45°-Hilfslinie
 *   🧱 Würfelbau-Editor Würfel stapeln, Schrägbild und alle Risse entstehen mit
 *   ✏️ Ansichten zeichnen  zu einem Schrägbild die drei Ansichten ins Raster tippen
 *   🏗️ Nach Plan bauen  aus dem Dreitafelbild den Würfelbau bauen
 */
import { useState, type ReactNode } from "react";
import { KOERPER, KOERPER_REIHE, startMasse, type KoerperKey, type V3 } from "@/lib/koerper";
import {
  ansichtVon, gleicheAnsicht, leererBau, rissPoly, rissRund, schraegbildBau, wuerfelZahl, zufallsBau,
  type Bau, type P2, type Raster, type Riss, type Strich,
} from "@/lib/koerper-risse";
import { Chips } from "@/components/prozent/ui";

const de = (x: number, s = 1) => x.toLocaleString("de-DE", { maximumFractionDigits: s });
const RISSNAME: Record<Riss, string> = { aufriss: "Aufriss (vorn)", grundriss: "Grundriss (oben)", seitenriss: "Seitenriss (links)" };

// ── Anleitung ────────────────────────────────────────────────────────

const Q = 0.5 * Math.SQRT1_2; // Kavalier: Tiefe 45°, halbe Länge

function QuaderSchritte() {
  const [m, setM] = useState({ a: 6, b: 4, c: 3 });
  const [schritt, setSchritt] = useState(1);
  const S = 28, pad = 30;
  // Vorderfläche a × c in wahrer Größe, Tiefe b nach hinten rechts oben
  const P = (x: number, y: number, t: number) => ({ x: pad + (x + Q * t) * S, y: pad + (m.c + Q * m.b - y - Q * t) * S });
  const W = pad * 2 + (m.a + Q * m.b) * S, H = pad * 2 + (m.c + Q * m.b) * S;
  const L = (a: { x: number; y: number }, b: { x: number; y: number }, stil: { farbe: string; strich?: string; dick?: number }) =>
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stil.farbe} strokeWidth={stil.dick ?? 2.5} strokeDasharray={stil.strich} />;
  const v = [P(0, 0, 0), P(m.a, 0, 0), P(m.a, m.c, 0), P(0, m.c, 0)];
  const h = [P(0, 0, m.b), P(m.a, 0, m.b), P(m.a, m.c, m.b), P(0, m.c, m.b)];
  const TEXTE = [
    `Vorderfläche in wahrer Größe zeichnen: ${m.a} cm × ${m.c} cm (Länge × Höhe).`,
    `Tiefenkanten im Winkel von 45° nach hinten zeichnen — nur halb so lang: ${m.b} cm : 2 = ${de(m.b / 2, 2)} cm. Auf Karopapier (5 mm): für jeden Zentimeter Tiefe eine Kästchendiagonale.`,
    "Hintere Kanten verbinden: Die Rückfläche ist genauso groß wie die Vorderfläche.",
    "Verdeckte Kanten (hinten links unten) gestrichelt zeichnen — man sieht sie nicht.",
  ];
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">📦 Schrägbild eines Quaders — Schritt für Schritt</h3>
      <div className="flex flex-wrap gap-4">
        {(["a", "c", "b"] as const).map(k => (
          <label key={k} className="flex flex-col text-xs text-muted">{k === "a" ? "Länge a" : k === "b" ? "Breite (Tiefe) b" : "Höhe c"}: <b className="text-fg text-sm">{m[k]} cm</b>
            <input type="range" min={1} max={8} value={m[k]} onChange={e => setM({ ...m, [k]: Number(e.target.value) })} aria-label={k} />
          </label>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg bg-surface rounded-xl" role="img" aria-label="Schrägbild Quader">
          {Array.from({ length: Math.ceil(W / (S / 2)) }, (_, i) => <line key={`gx${i}`} x1={i * S / 2} y1={0} x2={i * S / 2} y2={H} stroke="var(--color-line)" strokeWidth={0.5} />)}
          {Array.from({ length: Math.ceil(H / (S / 2)) }, (_, i) => <line key={`gy${i}`} x1={0} y1={i * S / 2} x2={W} y2={i * S / 2} stroke="var(--color-line)" strokeWidth={0.5} />)}
          {schritt >= 1 && <>{[0, 1, 2, 3].map(i => <g key={i}>{L(v[i], v[(i + 1) % 4], { farbe: "#2563eb" })}</g>)}</>}
          {schritt >= 2 && [1, 2, 3].map(i => <g key={i}>{L(v[i], h[i], { farbe: "#ea580c" })}</g>)}
          {schritt >= 3 && <>{L(h[1], h[2], { farbe: "#16a34a" })}{L(h[2], h[3], { farbe: "#16a34a" })}</>}
          {schritt >= 4 && <>{L(v[0], h[0], { farbe: "#6b7280", strich: "6 5", dick: 2 })}{L(h[0], h[1], { farbe: "#6b7280", strich: "6 5", dick: 2 })}{L(h[0], h[3], { farbe: "#6b7280", strich: "6 5", dick: 2 })}</>}
          {schritt >= 2 && <path d={`M ${v[1].x + 22} ${v[1].y} A 22 22 0 0 0 ${v[1].x + 22 * Math.SQRT1_2} ${v[1].y - 22 * Math.SQRT1_2}`} fill="none" stroke="#ea580c" />}
          {schritt >= 2 && <text x={v[1].x + 26} y={v[1].y - 6} fontSize={12} fill="#ea580c">45°</text>}
        </svg>
        <div className="flex flex-col gap-2">
          <ol className="list-decimal pl-5 text-sm flex flex-col gap-1">{TEXTE.slice(0, schritt).map(t => <li key={t}>{t}</li>)}</ol>
          <div className="flex gap-2">
            {schritt < 4 && <button className="btn-primary" onClick={() => setSchritt(schritt + 1)}>Nächster Schritt →</button>}
            {schritt > 1 && <button className="btn-secondary" onClick={() => setSchritt(1)}>Von vorn</button>}
          </div>
          <p className="text-xs text-muted">Das ist die <b>Kavalierperspektive</b>: Breite und Höhe in wahrer Größe, Tiefe unter 45° und auf die Hälfte verkürzt.</p>
        </div>
      </div>
    </section>
  );
}

/** Zeichnet Striche (y nach oben) in ein Feld mit Ursprung o und Maßstab s */
function Striche({ s, o, k, farbe = "var(--color-fg)" }: { s: Strich[]; o: P2; k: number; farbe?: string }) {
  return <>{s.map((x, i) => (
    <line key={i} x1={o.x + x.a.x * k} y1={o.y - x.a.y * k} x2={o.x + x.b.x * k} y2={o.y - x.b.y * k}
      stroke={farbe} strokeWidth={x.verdeckt ? 1.6 : 2.4} strokeDasharray={x.verdeckt ? "5 4" : undefined} />
  ))}</>;
}

function KoerperRisse() {
  const [key, setKey] = useState<KoerperKey>("prisma3");
  const [drei, setDrei] = useState(true);
  const koerper = KOERPER[key];
  const m = startMasse(koerper);
  const poly = koerper.poly?.(m), rund = koerper.rund?.(m);
  const riss = (r: Riss) => (poly ? { striche: rissPoly(poly, r), kreise: [], boegen: [] } : rissRund(rund!, r));
  // Ausdehnung
  const pts: V3[] = poly ? poly.ecken : [[-rund!.r1, 0, -rund!.r1], [rund!.r1, rund!.art === "kugel" ? 2 * rund!.r1 : rund!.h, rund!.r1]];
  const [x0, x1] = [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0]))];
  const [y0, y1] = [Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))];
  const [z0, z1] = [Math.min(...pts.map(p => p[2])), Math.max(...pts.map(p => p[2]))];
  const k = 22, rand = 24, luecke = 40;
  // Aufriss oben links, Grundriss darunter, Seitenriss rechts daneben
  const auf = { x: rand - x0 * k, y: rand + y1 * k };
  const achseY = auf.y - y0 * k + luecke / 2;
  const grund = { x: auf.x, y: achseY + luecke / 2 - z0 * k };
  const achseX = auf.x + x1 * k + luecke / 2;
  const seite = { x: achseX + luecke / 2 - z0 * k, y: auf.y };
  const W = (drei ? seite.x + z1 * k : achseX) + rand, H = grund.y + z1 * k + rand;
  const zeichne = (r: Riss, o: P2) => {
    const x = riss(r);
    return (
      <g>
        <Striche s={x.striche} o={o} k={k} />
        {x.kreise.map((c, i) => <circle key={i} cx={o.x + c.m.x * k} cy={o.y - c.m.y * k} r={c.r * k} fill="none" stroke="var(--color-fg)" strokeWidth={2.4} strokeDasharray={c.verdeckt ? "5 4" : undefined} />)}
        {x.boegen?.map((b, i) => <path key={i} d={`M ${o.x + (b.m.x - b.r) * k} ${o.y - b.m.y * k} A ${b.r * k} ${b.r * k} 0 0 1 ${o.x + (b.m.x + b.r) * k} ${o.y - b.m.y * k}`} fill="none" stroke="var(--color-fg)" strokeWidth={2.4} />)}
      </g>
    );
  };
  // Ordnungslinien: senkrecht Aufriss ↔ Grundriss bei jedem x, waagerecht Aufriss ↔ Seitenriss bei jedem y
  const xs = [...new Set(pts.map(p => +p[0].toFixed(3)))], ys = [...new Set(pts.map(p => +p[1].toFixed(3)))], zs = [...new Set(pts.map(p => +p[2].toFixed(3)))];
  const hilf = "var(--color-muted)";
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">📐 Zweitafel- und Dreitafelbild</h3>
      <Chips wahl={key} setze={setKey} optionen={KOERPER_REIHE.map(k2 => ({ id: k2, label: `${KOERPER[k2].icon} ${KOERPER[k2].name}` }))} />
      <div className="flex gap-2">
        <button className={`chip ${!drei ? "chip-on" : ""}`} onClick={() => setDrei(false)}>Zweitafelbild</button>
        <button className={`chip ${drei ? "chip-on" : ""}`} onClick={() => setDrei(true)}>Dreitafelbild</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl bg-surface rounded-xl" role="img" aria-label={drei ? "Dreitafelbild" : "Zweitafelbild"}>
          {/* Rissachsen */}
          <line x1={4} y1={achseY} x2={W - 4} y2={achseY} stroke="var(--color-fg)" strokeWidth={1} />
          {drei && <line x1={achseX} y1={4} x2={achseX} y2={H - 4} stroke="var(--color-fg)" strokeWidth={1} />}
          {xs.map(x => <line key={`ox${x}`} x1={auf.x + x * k} y1={auf.y - y0 * k} x2={grund.x + x * k} y2={grund.y + z0 * k} stroke={hilf} strokeWidth={0.7} strokeDasharray="2 3" />)}
          {drei && ys.map(y => <line key={`oy${y}`} x1={auf.x + x1 * k} y1={auf.y - y * k} x2={seite.x + z0 * k} y2={seite.y - y * k} stroke={hilf} strokeWidth={0.7} strokeDasharray="2 3" />)}
          {drei && zs.map(z => {
            // Grundriss (Tiefe z) → über den Viertelkreis um den Achsenschnitt zum Seitenriss
            const gy = grund.y + z * k, sxp = seite.x + z * k, r = Math.abs(gy - achseY);
            return <g key={`oz${z}`}>
              <line x1={grund.x + x1 * k} y1={gy} x2={achseX} y2={gy} stroke={hilf} strokeWidth={0.7} strokeDasharray="2 3" />
              <path d={`M ${achseX} ${gy} A ${r} ${r} 0 0 0 ${achseX + r} ${achseY}`} fill="none" stroke={hilf} strokeWidth={0.7} strokeDasharray="2 3" />
              <line x1={sxp} y1={achseY} x2={sxp} y2={seite.y - y0 * k} stroke={hilf} strokeWidth={0.7} strokeDasharray="2 3" />
            </g>;
          })}
          {zeichne("aufriss", auf)}
          {zeichne("grundriss", { x: grund.x, y: grund.y + 0 })}
          {drei && zeichne("seitenriss", seite)}
          <text x={8} y={16} fontSize={12} fontWeight={700} fill="var(--color-muted)">Aufriss</text>
          <text x={8} y={achseY + 16} fontSize={12} fontWeight={700} fill="var(--color-muted)">Grundriss</text>
          {drei && <text x={achseX + 6} y={16} fontSize={12} fontWeight={700} fill="var(--color-muted)">Seitenriss</text>}
        </svg>
        <div className="text-sm flex flex-col gap-2">
          <p><b>Aufriss</b> = Ansicht von vorn, <b>Grundriss</b> = Ansicht von oben (unter dem Aufriss, die Vorderseite unten), {drei && <><b>Seitenriss</b> = Ansicht von links (rechts neben dem Aufriss), </>}alles in wahrer Größe.</p>
          <p><b>Ordnungslinien</b> (fein gestrichelt) verbinden zusammengehörige Punkte: Was im Aufriss übereinander steht, steht im Grundriss genau darunter — gleiche Breite. Aufriss und Seitenriss haben die gleiche Höhe.</p>
          {drei && <p>Die <b>Tiefe</b> kommt aus dem Grundriss: mit dem Zirkel um den Schnittpunkt der Rissachsen (Viertelkreise) hinüber in den Seitenriss.</p>}
          <p>Verdeckte Kanten werden <b>gestrichelt</b> gezeichnet.</p>
        </div>
      </div>
    </section>
  );
}

// ── Würfelbauten ─────────────────────────────────────────────────────

const SEITE = 34;
/** Schrägbild eines Würfelbaus */
export function BauSchraeg({ b, gross = 1 }: { b: Bau; gross?: number }) {
  const flaechen = schraegbildBau(b);
  const breite = b.length, tiefe = b[0]?.length ?? 0, hoehe = Math.max(1, ...b.flat());
  const q = 0.5 * Math.SQRT1_2, s = SEITE * gross, pad = 10;
  const W = (breite + q * tiefe) * s + 2 * pad, H = (hoehe + q * tiefe) * s + 2 * pad;
  const P = (p: P2) => `${pad + p.x * s},${H - pad - p.y * s}`;
  const FARBE = { vorn: "#60a5fa", oben: "#bfdbfe", rechts: "#2563eb" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm" role="img" aria-label="Schrägbild des Würfelbaus">
      {/* Bodenplatte */}
      <polygon points={[{ x: 0, y: 0 }, { x: breite, y: 0 }, { x: breite + q * tiefe, y: q * tiefe }, { x: q * tiefe, y: q * tiefe }].map(P).join(" ")} fill="var(--color-line)" opacity={0.5} />
      {flaechen.map((f, i) => <polygon key={i} points={f.pkte.map(P).join(" ")} fill={FARBE[f.art]} stroke="#1e3a8a" strokeWidth={1.5} strokeLinejoin="round" />)}
    </svg>
  );
}

/** Raster einer Ansicht; mit `tippe` zum Selberzeichnen */
function RasterAnsicht({ r, spalten, zeilen, titel, tippe, farbe = "#2563eb" }: { r: Raster; spalten: number; zeilen: number; titel: string; tippe?: (x: number, y: number) => void; farbe?: string }) {
  const s = 30;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-bold text-muted">{titel}</span>
      <svg viewBox={`0 0 ${spalten * s + 2} ${zeilen * s + 2}`} style={{ width: spalten * s * 0.9 }} className="max-w-full" role="group" aria-label={titel}>
        {Array.from({ length: spalten }, (_, x) => Array.from({ length: zeilen }, (_, y) => {
          const an = r[x]?.[y] ?? false;
          return <rect key={`${x}-${y}`} x={1 + x * s} y={1 + (zeilen - 1 - y) * s} width={s} height={s}
            fill={an ? farbe : "transparent"} fillOpacity={an ? 0.75 : 1} stroke={an ? "#1e3a8a" : "var(--color-line)"} strokeWidth={an ? 2 : 1}
            onClick={tippe ? () => tippe(x, y) : undefined} style={tippe ? { cursor: "pointer" } : undefined}
            role={tippe ? "button" : undefined} aria-label={tippe ? `${titel} Feld ${x + 1}/${y + 1}` : undefined} aria-pressed={tippe ? an : undefined} />;
        }))}
      </svg>
    </div>
  );
}

function Dreitafel({ b, spalten, tiefe, hoehe }: { b: Bau; spalten: number; tiefe: number; hoehe: number }) {
  return (
    <div className="grid grid-cols-[auto_auto] gap-x-6 gap-y-2 w-fit">
      <RasterAnsicht r={ansichtVon(b, "aufriss")} spalten={spalten} zeilen={hoehe} titel="Aufriss (vorn)" />
      <RasterAnsicht r={ansichtVon(b, "seitenriss")} spalten={tiefe} zeilen={hoehe} titel="Seitenriss (links)" />
      <RasterAnsicht r={ansichtVon(b, "grundriss")} spalten={spalten} zeilen={tiefe} titel="Grundriss (oben)" />
    </div>
  );
}

/** Editor: im Grundriss-Raster Türme hoch- und runterbauen */
function BauEditor({ b, setB }: { b: Bau; setB: (b: Bau) => void }) {
  const [modus, setModus] = useState<1 | -1>(1);
  const tiefe = b[0].length;
  const aendere = (x: number, t: number, d: number) => setB(b.map((sp, i) => (i === x ? sp.map((h, j) => (j === t ? Math.max(0, Math.min(5, h + d)) : h)) : sp)));
  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex gap-1">
        <button className={`chip ${modus === 1 ? "chip-on" : ""}`} onClick={() => setModus(1)}>➕ Würfel drauf</button>
        <button className={`chip ${modus === -1 ? "chip-on" : ""}`} onClick={() => setModus(-1)}>➖ Würfel weg</button>
      </div>
      <span className="text-xs text-muted">Von oben gesehen — vorn ist unten. Zahl = Turmhöhe.</span>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${b.length}, 2.75rem)` }}>
        {Array.from({ length: tiefe }, (_, zeile) => tiefe - 1 - zeile).map(t => b.map((sp, x) => (
          <button key={`${x}-${t}`} type="button" onClick={() => aendere(x, t, modus)} onContextMenu={e => { e.preventDefault(); aendere(x, t, -modus); }}
            className="h-11 rounded-lg border-2 font-black text-lg" aria-label={`Turm ${x + 1}, Reihe ${t + 1}: ${sp[t]}`}
            style={{ background: sp[t] ? `rgba(37,99,235,${0.15 + sp[t] * 0.15})` : "transparent", borderColor: sp[t] ? "#2563eb" : "var(--color-line)" }}>
            {sp[t] || ""}
          </button>
        )))}
      </div>
    </div>
  );
}

function Editor() {
  const [b, setB] = useState<Bau>(() => [[2, 1, 0], [1, 1, 0], [1, 0, 0], [3, 2, 1]]);
  const hoehe = Math.max(1, ...b.flat());
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">🧱 Würfelbau-Editor</h3>
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <div className="flex flex-col gap-2">
          <BauEditor b={b} setB={setB} />
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setB(leererBau(b.length, b[0].length))}>Leeren</button>
            <button className="btn-secondary" onClick={() => setB(zufallsBau(Math.random, 3))}>🎲 Zufall</button>
          </div>
          <span className="text-sm">{wuerfelZahl(b)} Würfel</span>
        </div>
        <BauSchraeg b={b} />
        <Dreitafel b={b} spalten={b.length} tiefe={b[0].length} hoehe={hoehe} />
      </div>
    </section>
  );
}

function AnsichtenZeichnen() {
  const [stufe, setStufe] = useState<1 | 2 | 3>(1);
  const [b, setB] = useState<Bau>(() => zufallsBau(Math.random, 1));
  const leer = (s: number, z: number): Raster => Array.from({ length: s }, () => Array(z).fill(false));
  const hoehe = 5, tiefe = b[0].length;
  const [eigen, setEigen] = useState<Record<Riss, Raster>>(() => ({ aufriss: leer(b.length, hoehe), grundriss: leer(b.length, tiefe), seitenriss: leer(tiefe, hoehe) }));
  const [geprueft, setGeprueft] = useState(false);
  const neu = (s = stufe) => {
    const n = zufallsBau(Math.random, s);
    setB(n); setGeprueft(false);
    setEigen({ aufriss: leer(n.length, hoehe), grundriss: leer(n.length, n[0].length), seitenriss: leer(n[0].length, hoehe) });
  };
  const tippe = (r: Riss) => (x: number, y: number) => { setGeprueft(false); setEigen(e => ({ ...e, [r]: e[r].map((sp, i) => (i === x ? sp.map((v, j) => (j === y ? !v : v)) : sp)) })); };
  const ok = (r: Riss) => gleicheAnsicht(eigen[r], ansichtVon(b, r));
  const zeile = (r: Riss, spalten: number, zeilen: number): ReactNode => (
    <div className="flex flex-col items-center gap-1">
      <RasterAnsicht r={eigen[r]} spalten={spalten} zeilen={zeilen} titel={RISSNAME[r]} tippe={tippe(r)} farbe="#ea580c" />
      {geprueft && <span className={`text-sm font-bold ${ok(r) ? "text-ok" : "text-bad"}`}>{ok(r) ? "✔ stimmt" : "✘ noch nicht"}</span>}
    </div>
  );
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">✏️ Ansichten zeichnen</h3>
      <div className="flex gap-2 items-center text-sm">Stufe {([1, 2, 3] as const).map(s => <button key={s} className={`chip ${stufe === s ? "chip-on" : ""}`} onClick={() => { setStufe(s); neu(s); }}>{s}</button>)}</div>
      <p className="text-sm text-muted">Färbe in jedem Raster die Kästchen, die man aus dieser Richtung sieht. Unten im Raster ist der Boden; im Grundriss ist unten vorn.</p>
      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] items-start">
        <BauSchraeg b={b} />
        <div className="grid grid-cols-[auto_auto] gap-x-6 gap-y-3 w-fit">
          {zeile("aufriss", b.length, hoehe)}
          {zeile("seitenriss", tiefe, hoehe)}
          {zeile("grundriss", b.length, tiefe)}
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => setGeprueft(true)}>Prüfen</button>
        <button className="btn-secondary" onClick={() => neu()}>Neuer Bau</button>
      </div>
      {geprueft && (["aufriss", "grundriss", "seitenriss"] as Riss[]).every(ok) && <p className="font-bold text-ok">🎉 Alle drei Ansichten richtig!</p>}
    </section>
  );
}

function NachPlan() {
  const [ziel, setZiel] = useState<Bau>(() => zufallsBau(Math.random, 2));
  const [b, setB] = useState<Bau>(() => leererBau(4, 3));
  const [geprueft, setGeprueft] = useState(false);
  const hoehe = Math.max(1, ...ziel.flat());
  const passt = (["aufriss", "grundriss", "seitenriss"] as Riss[]).every(r => gleicheAnsicht(ansichtVon(b, r), ansichtVon(ziel, r)));
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">🏗️ Nach Plan bauen</h3>
      <p className="text-sm text-muted">Baue einen Würfelbau, der genau so aussieht wie im Dreitafelbild. Manchmal gibt es mehrere richtige Bauten — jeder zählt, dessen drei Ansichten stimmen.</p>
      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <div className="flex flex-col gap-1"><span className="text-xs font-bold text-muted">Der Plan</span><Dreitafel b={ziel} spalten={ziel.length} tiefe={ziel[0].length} hoehe={hoehe} /></div>
        <BauEditor b={b} setB={x => { setB(x); setGeprueft(false); }} />
        <BauSchraeg b={b} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => setGeprueft(true)}>Prüfen</button>
        <button className="btn-secondary" onClick={() => { setZiel(zufallsBau(Math.random, 2)); setB(leererBau(4, 3)); setGeprueft(false); }}>Neuer Plan</button>
      </div>
      {geprueft && <p className={`font-bold ${passt ? "text-ok" : "text-bad"}`}>{passt ? "✔ Passt — alle drei Ansichten stimmen!" : "✘ Noch nicht: Vergleiche Aufriss, Seitenriss und Grundriss einzeln."}</p>}
    </section>
  );
}

const TEILE = [
  { id: "anleitung", label: "📏 Anleitung" },
  { id: "editor", label: "🧱 Würfelbau-Editor" },
  { id: "zeichnen", label: "✏️ Ansichten zeichnen" },
  { id: "bauen", label: "🏗️ Nach Plan bauen" },
] as const;

export default function Risse() {
  const [teil, setTeil] = useState<(typeof TEILE)[number]["id"]>("anleitung");
  return (
    <div className="flex flex-col gap-4">
      <Chips wahl={teil} setze={setTeil} optionen={TEILE} />
      {teil === "anleitung" && <><QuaderSchritte /><KoerperRisse /></>}
      {teil === "editor" && <Editor />}
      {teil === "zeichnen" && <AnsichtenZeichnen />}
      {teil === "bauen" && <NachPlan />}
    </div>
  );
}
