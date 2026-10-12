"use client";
/**
 * Umrechnen — die Einheitenleiter wie auf dem Merkblatt: oben die Bögen zum
 * Multiplizieren (zur kleineren Einheit), unten die zum Teilen. Ein Klick
 * auf eine Einheit zeigt statt der Nachbarschritte alle Wege von ihr aus.
 *
 * Darunter der Umrechner (Zahl eintippen → alle Einheiten, mit »Komma
 * wandert«) und die Größenleiter: Dinge aus dem Alltag auf einer
 * logarithmischen Achse, damit man ein Gefühl für die Einheiten bekommt.
 */
import { useState } from "react";
import {
  KATEGORIEN, bestEinheit, faktor, kategorie, kommaStellen, schritt, umrechnen, ungefaehr, zahl,
  type Kategorie,
} from "@/lib/groessen";

const MAL = "#f97316";
const DURCH = "#3b82f6";

/* ─────────────────────────────────────────────────────── Leiter ── */

function Leiter({ k, gewaehlt, waehle }: { k: Kategorie; gewaehlt: number | null; waehle: (i: number | null) => void }) {
  const n = k.einheiten.length;
  const dx = 150, W = Math.max(520, dx * n), bw = 84, bh = 48;
  // Die Beschriftung sitzt im Scheitel eines Bogens — halb so hoch wie sein Kontrollpunkt.
  const hoch = (weit: number) => (gewaehlt === null ? 46 : 30 + weit * 44);
  const H = bh + 2 * (hoch(n - 1) / 2 + 26), cy = H / 2;
  const x = (i: number) => W / 2 + (i - (n - 1) / 2) * dx;

  // Ein Bogen von Kasten i zu Kasten j; oben (mal) oder unten (geteilt).
  const bogen = (i: number, j: number, oben: boolean, hoehe: number, label: string, farbe: string, key: string, blass = false) => {
    const y = oben ? cy - bh / 2 : cy + bh / 2;
    const x1 = x(i) + (j > i ? 12 : -12), x2 = x(j) + (j > i ? -12 : 12);
    const cyB = oben ? y - hoehe : y + hoehe;
    const mx = (x1 + x2) / 2;
    return (
      <g key={key} opacity={blass ? 0.55 : 1}>
        <path d={`M ${x1} ${y} Q ${mx} ${cyB} ${x2} ${y}`} fill="none" stroke={farbe} strokeWidth={2.5}
          markerEnd={`url(#pfeil-${farbe === MAL ? "mal" : "durch"})`} />
        <rect x={mx - label.length * 5.2 - 6} y={(y + cyB) / 2 - 12} width={label.length * 10.4 + 12} height={24} rx={6}
          fill="var(--surface)" />
        <text x={mx} y={(y + cyB) / 2} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={800} fill={farbe}>
          {label}
        </text>
      </g>
    );
  };

  const boegen = [];
  if (gewaehlt === null) {
    for (let i = 0; i < n - 1; i++) {
      boegen.push(bogen(i, i + 1, true, 46, `· ${zahl(k.schritte[i])}`, MAL, `m${i}`));
      boegen.push(bogen(i + 1, i, false, 46, `: ${zahl(k.schritte[i])}`, DURCH, `d${i}`));
    }
  } else {
    for (let j = 0; j < n; j++) {
      if (j === gewaehlt) continue;
      const s = schritt(k, gewaehlt, j);
      const weit = Math.abs(j - gewaehlt);
      boegen.push(bogen(gewaehlt, j, s.op === "·", hoch(weit), `${s.op} ${zahl(s.zahl)}`, s.op === "·" ? MAL : DURCH, `g${j}`));
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: "48vh" }} role="group"
      aria-label={`Einheitenleiter ${k.name}`}>
      <defs>
        {([["mal", MAL], ["durch", DURCH]] as const).map(([id, c]) => (
          <marker key={id} id={`pfeil-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
          </marker>
        ))}
      </defs>
      {boegen}
      {k.einheiten.map((e, i) => {
        const an = gewaehlt === i;
        return (
          <g key={e.id} onClick={() => waehle(an ? null : i)} style={{ cursor: "pointer" }} role="button"
            aria-label={`${e.name} (${e.zeichen})`} aria-pressed={an}>
            <rect x={x(i) - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={10}
              fill={k.farbe} fillOpacity={an ? 0.9 : 0.18} stroke={k.farbe} strokeWidth={an ? 4 : 2} />
            <text x={x(i)} y={cy + (e.auch ? -5 : 1)} textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={900}
              fill={an ? "#fff" : "var(--text)"}>{e.zeichen}</text>
            {e.auch && (
              <text x={x(i)} y={cy + 15} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}
                fill={an ? "#fff" : "var(--text-muted)"}>= {e.auch}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ──────────────────────────────────────────────── Größenleiter ── */

function Groessenleiter({ k, gewaehlt, zeige }: { k: Kategorie; gewaehlt: number | null; zeige: (wertBasis: number) => void }) {
  const W = 1000, H = 250, pad = 40, ay = 128;
  const werte = [...k.beispiele.map(b => b.wert), ...k.einheiten.map((_, i) => faktor(k, i, k.basis))];
  const lo = Math.floor(Math.log10(Math.min(...werte))), hi = Math.ceil(Math.log10(Math.max(...werte)));
  const X = (v: number) => pad + ((Math.log10(v) - lo) / (hi - lo || 1)) * (W - 2 * pad);
  const lesbar = (w: number) => {
    const b = bestEinheit(k, w);
    return `${zahl(Number(b.wert.toPrecision(3)))} ${k.einheiten[b.i].zeichen}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="group" aria-label={`Größenleiter ${k.name}`}>
      <line x1={pad} y1={ay} x2={W - pad} y2={ay} stroke="var(--border)" strokeWidth={3} />
      {/* Die Einheiten selbst: wo liegt »1 km«, »1 m« …? */}
      {k.einheiten.map((e, i) => {
        const xx = X(faktor(k, i, k.basis));
        const an = gewaehlt === i;
        return (
          <g key={e.id}>
            <line x1={xx} y1={ay - 9} x2={xx} y2={ay + 9} stroke={an ? k.farbe : "var(--text-muted)"} strokeWidth={an ? 5 : 2.5} />
            <text x={xx} y={ay + 1} dy={-14} textAnchor="middle" fontSize={an ? 16 : 13} fontWeight={800}
              fill={an ? k.farbe : "var(--text-muted)"}>1 {e.zeichen}</text>
          </g>
        );
      })}
      {k.beispiele.map((b, i) => {
        const xx = X(b.wert);
        const unten = i % 2 === 0;
        const stufe = Math.floor(i / 2) % 2;
        const ty = unten ? ay + 38 + stufe * 50 : ay - 48 - stufe * 50;
        return (
          <g key={i} onClick={() => zeige(b.wert)} style={{ cursor: "pointer" }}>
            <line x1={xx} y1={ay} x2={xx} y2={ty + (unten ? -18 : 14)} stroke={k.farbe} strokeOpacity={0.45} strokeWidth={1.5} />
            <circle cx={xx} cy={ay} r={4.5} fill={k.farbe} />
            <text x={xx} y={ty} textAnchor="middle" fontSize={22}>{b.emoji}</text>
            <text x={xx} y={ty + 18} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--text)">
              {b.text}: {lesbar(b.wert)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ────────────────────────────────────────────────── Werkzeug ── */

export default function Umrechnen() {
  const [katId, setKatId] = useState("laenge");
  const k = kategorie(katId);
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [eingabe, setEingabe] = useState("1");
  const [von, setVon] = useState(1);

  function waehleKat(id: string) {
    setKatId(id);
    setGewaehlt(null);
    setVon(Math.min(1, kategorie(id).einheiten.length - 1));
  }
  function waehle(i: number | null) {
    setGewaehlt(i);
    if (i !== null) setVon(i);
  }

  const v = Number(eingabe.replace(",", ".").replace(/\s/g, ""));
  const gueltig = eingabe.trim() !== "" && Number.isFinite(v);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {KATEGORIEN.map(x => (
          <button key={x.id} onClick={() => waehleKat(x.id)} className={`chip ${katId === x.id ? "chip-on" : ""}`}>
            {x.icon} {x.name}
          </button>
        ))}
      </div>

      <div className="card p-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wide text-muted">Einheitenleiter {k.name}</div>
          <div className="text-xs text-muted">
            <span style={{ color: MAL }} className="font-bold">oben · mal</span> zur kleineren Einheit ·{" "}
            <span style={{ color: DURCH }} className="font-bold">unten : geteilt</span> zur größeren.{" "}
            {gewaehlt === null ? "Tipp auf eine Einheit — dann siehst du alle Wege von ihr aus." : "Nochmal tippen zeigt wieder die Nachbarschritte."}
          </div>
        </div>
        <Leiter k={k} gewaehlt={gewaehlt} waehle={waehle} />
        {k.hinweis && <p className="text-sm rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">⚠️ {k.hinweis}</p>}
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted mr-2">Umrechner</span>
          <input className="input w-36 text-lg font-bold text-right" inputMode="decimal" value={eingabe}
            onChange={e => setEingabe(e.target.value)} aria-label="Zahl" />
          <select className="input text-lg font-bold" value={von} onChange={e => { setVon(Number(e.target.value)); setGewaehlt(Number(e.target.value)); }}
            aria-label="Einheit">
            {k.einheiten.map((e, i) => <option key={e.id} value={i}>{e.zeichen} — {e.name}</option>)}
          </select>
          <span className="text-sm text-muted">≈ {k.einheiten[von].eins}{v !== 1 && gueltig ? ` (für 1 ${k.einheiten[von].zeichen})` : ""}</span>
        </div>

        {gueltig && (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "auto auto 1fr" }}>
            {k.einheiten.map((e, j) => {
              if (j === von) return null;
              const s = schritt(k, von, j);
              const r = umrechnen(k, v, von, j);
              const komma = kommaStellen(s.zahl);
              return (
                <div key={e.id} className="contents">
                  <span className="text-right font-mono text-lg font-bold whitespace-nowrap">
                    {zahl(v)} {k.einheiten[von].zeichen} {r.exakt ? "=" : "≈"}
                  </span>
                  <span className="font-mono text-lg font-black whitespace-nowrap" style={{ color: k.farbe }}>
                    {r.exakt ? zahl(r.wert) : ungefaehr(r.wert)} {e.zeichen}
                  </span>
                  <span className="text-sm text-muted self-center">
                    <span style={{ color: s.op === "·" ? MAL : DURCH }} className="font-bold">{s.op} {zahl(s.zahl)}</span>
                    {komma !== null && ` — Komma ${komma} ${komma === 1 ? "Stelle" : "Stellen"} nach ${s.op === "·" ? "rechts" : "links"}`}
                    {r.bruch && !r.exakt && ` — genau ${zahl(r.bruch[0])}/${zahl(r.bruch[1])} ${e.zeichen}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {!gueltig && <p className="text-sm text-bad">Bitte eine Zahl eingeben, z. B. 2,5.</p>}
      </div>

      <div className="card p-4 flex flex-col gap-2">
        <div className="text-xs font-bold uppercase tracking-wide text-muted">Wie viel ist das? — {k.name} im Alltag</div>
        <Groessenleiter k={k} gewaehlt={gewaehlt} zeige={w => {
          const b = bestEinheit(k, w);
          setVon(b.i);
          setGewaehlt(b.i);
          setEingabe(zahl(Number(b.wert.toPrecision(6))).replace(/\s/g, ""));
        }} />
        <div className="text-xs text-muted">
          Die Achse wächst in Zehnerschritten (logarithmisch) — sonst passten Ameise und Erde nicht auf ein Bild. Tipp auf ein Ding — es landet im Umrechner.
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
          {k.einheiten.map((e, i) => (
            <button key={e.id} onClick={() => waehle(i)}
              className={`text-left rounded-lg border px-3 py-2 text-sm ${gewaehlt === i ? "border-accent bg-accent/10" : "border-line"}`}>
              <strong>1 {e.zeichen}</strong> <span className="text-muted">({e.name})</span>: {e.eins}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
