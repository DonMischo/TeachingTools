"use client";
/**
 * Spiel »Bauhof« zu Rechtecken mit zwei Aufträgen (Logik in lib/vierecke-bauhof.ts):
 *   🦁 Gehege bauen   — Rechteck aufziehen: Zaun (Umfang) reicht, Platz (Fläche) genügt.
 *   🖌️ Wand streichen — die Wand ohne Fenster und Tür mit wenigen Rechteck-Strichen.
 * Gezogen wird mit Maus oder Finger von Ecke zu Ecke; Level werden schwerer,
 * das erreichte Level und die Sterne bleiben auf dem Gerät.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  aufziehen, bewerteGehege, flaeche, gehegeLevel, passt, umfang, wandLevel, wandSterne,
  type GehegeLevel, type Gitter, type Rechteck, type WandLevel,
} from "@/lib/vierecke-bauhof";

const Z = 40; // Pixel je Kästchen im viewBox
const SCHLUESSEL = "hp_vierecke_bauhof";
type Modus = "gehege" | "wand";
type Stand = Record<Modus, { level: number; sterne: number }>;
const LEER_STAND: Stand = { gehege: { level: 1, sterne: 0 }, wand: { level: 1, sterne: 0 } };
const liesStand = (): Stand => { try { return { ...LEER_STAND, ...JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "{}") }; } catch { return LEER_STAND; } };
const schreibStand = (s: Stand) => { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(s)); } catch { /* privat */ } };

const Sterne = ({ n }: { n: number }) => <span className="text-xl tracking-widest">{"★".repeat(n)}<span className="text-muted">{"★".repeat(3 - n)}</span></span>;

/**
 * Kästchenfeld, auf dem man ein Rechteck von Ecke zu Ecke aufzieht.
 * `vorschau` bekommt das gerade gezogene Rechteck, `fertig` das losgelassene.
 */
function Ziehfeld({ w, h, hintergrund, vorschau, fertig, gesperrt, label }: {
  w: number; h: number; hintergrund: ReactNode; label: string; gesperrt?: boolean;
  vorschau: (r: Rechteck | null) => ReactNode; fertig: (r: Rechteck) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [start, setStart] = useState<[number, number] | null>(null);
  const [jetzt, setJetzt] = useState<Rechteck | null>(null);
  const zelle = (e: React.PointerEvent): [number, number] => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [Math.max(0, Math.min(w - 1, Math.floor(p.x / Z))), Math.max(0, Math.min(h - 1, Math.floor(p.y / Z)))];
  };
  return (
    <svg ref={svg} viewBox={`0 0 ${w * Z} ${h * Z}`} className="w-full h-auto max-h-[calc(100vh-16rem)] rounded-xl select-none"
      style={{ touchAction: "none", cursor: gesperrt ? "default" : "crosshair" }} role="application" aria-label={label}
      onPointerDown={e => {
        if (gesperrt) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const c = zelle(e); setStart(c); setJetzt(aufziehen(c[0], c[1], c[0], c[1]));
      }}
      onPointerMove={e => { if (start) { const c = zelle(e); setJetzt(aufziehen(start[0], start[1], c[0], c[1])); } }}
      onPointerUp={() => { if (start && jetzt) fertig(jetzt); setStart(null); setJetzt(null); }}
      onPointerCancel={() => { setStart(null); setJetzt(null); }}>
      {hintergrund}
      <g stroke="rgba(0,0,0,0.12)" strokeWidth={1}>
        {Array.from({ length: w + 1 }, (_, i) => <line key={`v${i}`} x1={i * Z} y1={0} x2={i * Z} y2={h * Z} />)}
        {Array.from({ length: h + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * Z} x2={w * Z} y2={i * Z} />)}
      </g>
      {vorschau(jetzt)}
    </svg>
  );
}

function Masse({ r, x = r.x * Z + (r.b * Z) / 2, y = r.y * Z + (r.h * Z) / 2, text }: { r: Rechteck; x?: number; y?: number; text: string }) {
  return <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(20, 8 + r.b * 4)} fontWeight={900}
    fill="#1f2937" stroke="#fff" strokeWidth={4} paintOrder="stroke">{text}</text>;
}

/* ─────────────────────────────────────────────────────────── Gehege ── */

function Gehege({ start, weiter }: { start: number; weiter: (sterne: number, nr: number) => void }) {
  const [l, setL] = useState<GehegeLevel>(() => gehegeLevel(start));
  const [plan, setPlan] = useState<Rechteck | null>(null);
  const [fehlversuche, setFehl] = useState(0);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fertig, setFertig] = useState<number | null>(null);

  const neu = (nr: number) => { setL(gehegeLevel(nr)); setPlan(null); setFehl(0); setMeldung(null); setFertig(null); };
  const bauen = () => {
    if (!plan) return;
    const b = bewerteGehege(l, plan);
    if (!b.ok) { setFehl(f => f + 1); setMeldung(b.grund!); return; }
    const s = fehlversuche ? Math.max(1, b.sterne - 1) : b.sterne;
    setFertig(s); setMeldung(null); weiter(s, l.nr);
  };

  const gelaende = (
    <g>
      <rect width={l.w * Z} height={l.h * Z} fill="#86c06c" />
      {l.gitter.flatMap((zeile, y) => zeile.split("").map((c, x) => c === "." ? null : c === "T"
        ? <rect key={`${x},${y}`} x={x * Z} y={y * Z} width={Z} height={Z} fill="#60a5fa" />
        : <text key={`${x},${y}`} x={x * Z + Z / 2} y={y * Z + Z / 2 + 2} textAnchor="middle" dominantBaseline="central" fontSize={26}>🪨</text>))}
    </g>
  );
  const zeige = (r: Rechteck | null) => {
    const q = r ?? plan;
    if (!q) return null;
    const ok = passt(l.gitter, q) && umfang(q) <= l.zaun;
    return (
      <g pointerEvents="none">
        <rect x={q.x * Z} y={q.y * Z} width={q.b * Z} height={q.h * Z} fill={ok ? "#fde68a" : "#fca5a5"} fillOpacity={0.45}
          stroke={ok ? "#92400e" : "#dc2626"} strokeWidth={7} strokeDasharray={fertig ? undefined : "14 6"} />
        {fertig
          ? <text x={q.x * Z + (q.b * Z) / 2} y={q.y * Z + (q.h * Z) / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(44, 14 + q.b * 6)}>{l.tier.emoji.repeat(Math.min(3, Math.max(1, Math.floor(flaeche(q) / 6))))}</text>
          : <Masse r={q} text={`${q.b} × ${q.h}`} />}
      </g>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem] items-start">
      <Ziehfeld w={l.w} h={l.h} hintergrund={gelaende} vorschau={zeige} fertig={r => { setPlan(r); setMeldung(null); }}
        gesperrt={fertig !== null} label="Gelände: Gehege aufziehen" />
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-line p-3">
          <div className="text-xs text-muted">Level {l.nr}</div>
          <div className="text-lg font-black">{l.tier.emoji} Gehege für {l.tier.name}</div>
          <ul className="text-sm mt-1 flex flex-col gap-0.5">
            <li>🚧 Zaun: <strong>{l.zaun} Stücke</strong> (höchstens so viel Umfang)</li>
            <li>🌿 Platz: <strong>mindestens {l.bedarf} Kästchen</strong> Fläche</li>
            <li>🪨 Felsen und 💧 Wasser bleiben draußen</li>
          </ul>
        </div>
        {plan ? (
          <div className="rounded-xl border border-line p-3 font-mono text-sm flex flex-col gap-1">
            <span className={umfang(plan) <= l.zaun ? "text-ok" : "text-bad"}>u = 2 · ({plan.b} + {plan.h}) = {umfang(plan)} {umfang(plan) <= l.zaun ? "≤" : ">"} {l.zaun}</span>
            <span className={flaeche(plan) >= l.bedarf ? "text-ok" : "text-bad"}>A = {plan.b} · {plan.h} = {flaeche(plan)} {flaeche(plan) >= l.bedarf ? "≥" : "<"} {l.bedarf}</span>
          </div>
        ) : <p className="text-sm text-muted">Zieh mit Maus oder Finger ein Rechteck auf — von einer Ecke zur gegenüberliegenden.</p>}
        {meldung && <p className="text-sm text-bad font-bold">{meldung}</p>}
        {fertig === null ? (
          <button className="btn btn-primary" onClick={bauen} disabled={!plan}>🏗️ Gehege bauen</button>
        ) : (
          <div className="rounded-xl border border-ok p-3 flex flex-col gap-2">
            <div className="font-black">Die {l.tier.name} ziehen ein! <Sterne n={fertig} /></div>
            {plan && flaeche(plan) < l.beste && (
              <p className="text-sm">Mit {l.zaun} Zaunstücken ginge hier sogar ein Gehege mit {l.beste} Kästchen. Tipp: Je quadratischer, desto mehr Platz bei gleichem Zaun.</p>
            )}
            {fehlversuche > 0 && <p className="text-xs text-muted">Ein Stern Abzug für den Fehlversuch.</p>}
            <button className="btn btn-primary" onClick={() => neu(l.nr + 1)}>➡ Level {l.nr + 1}</button>
          </div>
        )}
        {fertig === null && <button className="btn" onClick={() => neu(l.nr)}>🎲 Anderes Gelände</button>}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── Wand ── */

const FARBEN = ["#f472b6", "#a78bfa", "#34d399", "#fbbf24", "#60a5fa", "#fb923c", "#f87171", "#22d3ee"];

function Wand({ start, weiter }: { start: number; weiter: (sterne: number, nr: number) => void }) {
  const [l, setL] = useState<WandLevel>(() => wandLevel(start));
  const [striche, setStriche] = useState<Rechteck[]>([]);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fertig, setFertig] = useState<number | null>(null);

  const neu = (nr: number) => { setL(wandLevel(nr)); setStriche([]); setMeldung(null); setFertig(null); };
  // Gestrichenes zählt wie ein Fenster: darüber darf kein neuer Strich.
  const belegt: Gitter = l.gitter.map((zeile, y) => zeile.split("").map((c, x) =>
    c !== "." || striche.some(s => x >= s.x && x < s.x + s.b && y >= s.y && y < s.y + s.h) ? "#" : ".").join(""));
  const gestrichen = striche.reduce((s, r) => s + flaeche(r), 0);

  const streichen = (r: Rechteck) => {
    if (!passt(belegt, r)) {
      setMeldung(passt(l.gitter, r) ? "Da ist schon Farbe — jedes Stück Wand nur einmal streichen." : "Fenster und Tür werden nicht gestrichen!");
      return;
    }
    const neu = [...striche, r];
    setStriche(neu); setMeldung(null);
    if (gestrichen + flaeche(r) === l.flaeche) { const s = wandSterne(l, neu.length); setFertig(s); weiter(s, l.nr); }
  };

  const wand = (
    <g>
      <rect width={l.w * Z} height={l.h * Z} fill="#f5f0e1" />
      {l.gitter.flatMap((zeile, y) => zeile.split("").map((c, x) => c === "F"
        ? <g key={`${x},${y}`}><rect x={x * Z} y={y * Z} width={Z} height={Z} fill="#bae6fd" stroke="#64748b" strokeWidth={3} />
          <line x1={x * Z + Z / 2} y1={y * Z} x2={x * Z + Z / 2} y2={y * Z + Z} stroke="#64748b" strokeWidth={2} /></g>
        : c === "T" ? <rect key={`${x},${y}`} x={x * Z} y={y * Z} width={Z} height={Z} fill="#a16207" /> : null))}
      {striche.map((s, i) => (
        <g key={i}>
          <rect x={s.x * Z + 2} y={s.y * Z + 2} width={s.b * Z - 4} height={s.h * Z - 4} rx={6} fill={FARBEN[i % FARBEN.length]} fillOpacity={0.85} />
          <Masse r={s} text={`${s.b}·${s.h}`} />
        </g>
      ))}
    </g>
  );
  const zeige = (r: Rechteck | null) => {
    if (!r) return null;
    const ok = passt(belegt, r);
    return (
      <g pointerEvents="none">
        <rect x={r.x * Z} y={r.y * Z} width={r.b * Z} height={r.h * Z} fill={ok ? FARBEN[striche.length % FARBEN.length] : "#fca5a5"} fillOpacity={0.5}
          stroke={ok ? "#1f2937" : "#dc2626"} strokeWidth={3} strokeDasharray="10 5" />
        <Masse r={r} text={`${r.b} · ${r.h} = ${flaeche(r)}`} />
      </g>
    );
  };
  const fenster = l.w * l.h - l.flaeche;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem] items-start">
      <Ziehfeld w={l.w} h={l.h} hintergrund={wand} vorschau={zeige} fertig={streichen} gesperrt={fertig !== null} label="Wand: Rollerstrich aufziehen" />
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-line p-3">
          <div className="text-xs text-muted">Level {l.nr}</div>
          <div className="text-lg font-black">🖌️ Wand streichen</div>
          <ul className="text-sm mt-1 flex flex-col gap-0.5">
            <li>Jeder Rollerstrich ist ein <strong>Rechteck</strong>.</li>
            <li>Fenster 🪟 und Tür 🚪 bleiben frei, nichts doppelt streichen.</li>
            <li>Profi schafft es in <strong>{l.profi} Strichen</strong>.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-line p-3 text-sm flex flex-col gap-1">
          <span>Striche: <strong>{striche.length}</strong> · gestrichen: <strong>{gestrichen}</strong> von {l.flaeche} Kästchen</span>
          {striche.length > 0 && <span className="font-mono">A = {striche.map(flaeche).join(" + ")} = {gestrichen}</span>}
        </div>
        {meldung && <p className="text-sm text-bad font-bold">{meldung}</p>}
        {fertig === null ? (
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => setStriche(s => s.slice(0, -1))} disabled={!striche.length}>↶ Strich zurück</button>
            <button className="btn" onClick={() => setStriche([])} disabled={!striche.length}>✖ Alles abwaschen</button>
          </div>
        ) : (
          <div className="rounded-xl border border-ok p-3 flex flex-col gap-2">
            <div className="font-black">Fertig gestrichen! <Sterne n={fertig} /></div>
            <p className="text-sm font-mono">A = {striche.map(flaeche).join(" + ")} = {l.flaeche}</p>
            <p className="text-sm font-mono">Probe: {l.w} · {l.h} − {fenster} (Fenster + Tür) = {l.flaeche}</p>
            {striche.length < l.profi && <p className="text-sm font-bold">Besser als der Profi! 🏅</p>}
            <button className="btn btn-primary" onClick={() => neu(l.nr + 1)}>➡ Level {l.nr + 1}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Bauhof() {
  const [modus, setModus] = useState<Modus>("gehege");
  const [stand, setStand] = useState<Stand>(LEER_STAND);
  const [geladen, setGeladen] = useState(false);
  useEffect(() => { setStand(liesStand()); setGeladen(true); }, []);

  // Gespeichert wird das nächste Level; die Sterne addieren sich. Die Blätter
  // lesen das Level nur beim Start und zählen danach selbst weiter.
  const weiter = (m: Modus) => (sterne: number, nr: number) => setStand(s => {
    const n = { ...s, [m]: { level: Math.max(s[m].level, nr + 1), sterne: s[m].sterne + sterne } };
    schreibStand(n);
    return n;
  });

  if (!geladen) return null;
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={`chip ${modus === "gehege" ? "chip-on" : ""}`} aria-pressed={modus === "gehege"} onClick={() => setModus("gehege")}>🦁 Gehege bauen</button>
        <button className={`chip ${modus === "wand" ? "chip-on" : ""}`} aria-pressed={modus === "wand"} onClick={() => setModus("wand")}>🖌️ Wand streichen</button>
        <span className="flex-1" />
        <span className="text-sm font-black">★ {stand[modus].sterne} · erreicht: Level {stand[modus].level}</span>
      </div>
      {modus === "gehege"
        ? <Gehege start={stand.gehege.level} weiter={weiter("gehege")} />
        : <Wand start={stand.wand.level} weiter={weiter("wand")} />}
    </div>
  );
}
