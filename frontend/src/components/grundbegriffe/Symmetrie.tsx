"use client";
/**
 * Reiter »Symmetrie« auf Kästchenpapier:
 *   Achse spiegeln — eine halbe Figur an einer Achse (senkrecht, waagerecht,
 *                    schräg) ergänzen: Kästchen antippen
 *   Punkt spiegeln — dasselbe am Zentrum Z (Punktspiegelung = halbe Drehung)
 *   Achsen finden  — alle Symmetrieachsen einer Figur wählen, dazu »punktsymmetrisch?«
 *   Drehen         — eine Kopie drehen, bis sie passt; kleinsten Drehwinkel angeben
 */
import { useMemo, useState, type ReactNode } from "react";
import { leseZahl, z } from "@/lib/prozent";
import {
  ACHSEN_TYPEN, drehfigur, halbeFigur, kandidaten, punktsymmetrisch, schluessel, symmetrieAchsen, symmetrischeFigur,
  type AchsenTyp, type Drehfigur, type GitterAchse, type Gruppe, type Pt, type Zelle,
} from "@/lib/grundbegriffe";
import { LEER, zaehle } from "@/components/prozent/ui";

type Modus = "achse" | "punkt" | "finden" | "drehen";
const N = 10, Z = 38, RAND = 10, GROESSE = N * Z + 2 * RAND;
const px = (g: number) => RAND + g * Z;

/** Gerade durch die Gitterachse, auf das Blatt zugeschnitten. */
function achsenStrecke(a: GitterAchse): [Pt, Pt] {
  switch (a.art) {
    case "senkrecht": return [{ x: a.k, y: 0 }, { x: a.k, y: N }];
    case "waagerecht": return [{ x: 0, y: a.k }, { x: N, y: a.k }];
    case "diagonal": { const x0 = Math.max(0, a.k), x1 = Math.min(N, N + a.k); return [{ x: x0, y: x0 - a.k }, { x: x1, y: x1 - a.k }]; }
    case "gegendiagonal": { const x0 = Math.max(0, a.k - N), x1 = Math.min(N, a.k); return [{ x: x0, y: a.k - x0 }, { x: x1, y: a.k - x1 }]; }
  }
}

function Achse({ a, farbe, gestrichelt }: { a: GitterAchse; farbe: string; gestrichelt?: boolean }) {
  const [p, q] = achsenStrecke(a);
  return <line x1={px(p.x)} y1={px(p.y)} x2={px(q.x)} y2={px(q.y)} style={{ stroke: farbe }} strokeWidth={4} strokeDasharray={gestrichelt ? "9 6" : undefined} strokeLinecap="round" pointerEvents="none" />;
}

type Farbe = { fill: string; opacity?: number; mark?: string };

function Blatt({ farben, onTippe, children, label }: { farben: Map<string, Farbe>; onTippe?: (z: Zelle) => void; children?: ReactNode; label: string }) {
  const zellen: ReactNode[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const f = farben.get(schluessel([c, r]));
    zellen.push(
      <g key={`${c},${r}`} onClick={onTippe ? () => onTippe([c, r]) : undefined} style={onTippe ? { cursor: "pointer" } : undefined}
        role={onTippe ? "button" : undefined} aria-label={onTippe ? `Kästchen ${c + 1}, ${r + 1}` : undefined}>
        <rect x={px(c)} y={px(r)} width={Z} height={Z} style={{ fill: f?.fill ?? "transparent", stroke: "var(--border)" }} fillOpacity={f?.opacity ?? 1} strokeWidth={1} />
        {f?.mark && <text x={px(c) + Z / 2} y={px(r) + Z / 2} textAnchor="middle" dominantBaseline="central" fontSize={20} fontWeight={900} style={{ fill: "#fff" }}>{f.mark}</text>}
      </g>,
    );
  }
  return (
    <svg viewBox={`0 0 ${GROESSE} ${GROESSE}`} className="w-full h-auto max-h-[70vh] max-w-[34rem] rounded-xl border border-line select-none" role="img" aria-label={label}>
      <rect width={GROESSE} height={GROESSE} style={{ fill: "var(--surface)" }} />
      {zellen}
      {children}
    </svg>
  );
}

const BLAU = "#3b82f6", ORANGE = "#f59e0b", GRUEN = "#16a34a", ROT = "#dc2626";

/* ── Ergänzen (Achse oder Punkt) ─────────────────────────────────────────── */

function Ergaenzen({ punkt, onErgebnis }: { punkt: boolean; onErgebnis: (ok: boolean) => void }) {
  const [art, setArt] = useState<"senkrecht" | "waagerecht" | "diagonal">("senkrecht");
  const [nr, setNr] = useState(0);
  const auf = useMemo(() => halbeFigur(Math.random, N, punkt ? "punkt" : art), [punkt, art, nr]); // eslint-disable-line react-hooks/exhaustive-deps
  const [gesetzt, setGesetzt] = useState<Set<string>>(new Set());
  const [geprueft, setGeprueft] = useState(false);
  const [zeigen, setZeigen] = useState(false);
  const vorlage = new Set(auf.vorlage.map(schluessel)), loesung = new Set(auf.loesung.map(schluessel));

  const neu = () => { setNr(n => n + 1); setGesetzt(new Set()); setGeprueft(false); setZeigen(false); };
  const tippe = (c: Zelle) => {
    const k = schluessel(c);
    if (vorlage.has(k)) return;
    const s = new Set(gesetzt);
    if (s.has(k)) s.delete(k); else s.add(k);
    setGesetzt(s); setGeprueft(false);
  };
  const richtig = [...gesetzt].filter(k => loesung.has(k)).length;
  const falsch = [...gesetzt].filter(k => !loesung.has(k)).length;
  const fertig = richtig === loesung.size && falsch === 0;
  const pruefe = () => { if (!geprueft && !zeigen) onErgebnis(fertig); setGeprueft(true); };

  const farben = new Map<string, Farbe>();
  for (const k of vorlage) farben.set(k, { fill: BLAU });
  for (const k of gesetzt) farben.set(k, geprueft || zeigen ? (loesung.has(k) ? { fill: GRUEN } : { fill: ROT, mark: "✘" }) : { fill: ORANGE });
  if (zeigen) for (const k of loesung) if (!gesetzt.has(k)) farben.set(k, { fill: GRUEN, opacity: 0.35 });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,34rem)_1fr] items-start">
      <Blatt farben={farben} onTippe={tippe} label={punkt ? "Figur am Punkt Z ergänzen" : "Figur an der Achse ergänzen"}>
        {auf.achse && <Achse a={auf.achse} farbe={ROT} />}
        {auf.zentrum && <g pointerEvents="none"><circle cx={px(auf.zentrum.x)} cy={px(auf.zentrum.y)} r={7} style={{ fill: ROT }} /><text x={px(auf.zentrum.x) + 10} y={px(auf.zentrum.y) - 10} fontSize={18} fontWeight={900} style={{ fill: ROT }}>Z</text></g>}
      </Blatt>
      <div className="flex flex-col gap-3 text-sm">
        {!punkt && (
          <div className="flex flex-wrap gap-1.5">
            {(["senkrecht", "waagerecht", "diagonal"] as const).map(a => (
              <button key={a} className={`chip ${art === a ? "chip-on" : ""}`} aria-pressed={art === a} onClick={() => { setArt(a); neu(); }}>
                {{ senkrecht: "Achse │", waagerecht: "Achse ─", diagonal: "Achse ╲" }[a]}
              </button>
            ))}
          </div>
        )}
        <p>{punkt
          ? "Spiegle die blaue Figur am Punkt Z: Jedes Kästchen kommt auf die gegenüberliegende Seite, gleich weit von Z entfernt. Tippe die Kästchen der Bildfigur an."
          : "Spiegle die blaue Figur an der roten Achse: Jedes Kästchen kommt gleich weit auf die andere Seite. Tippe die Kästchen der Bildfigur an."}</p>
        {punkt && <p className="text-muted">Tipp: Eine Punktspiegelung ist dasselbe wie eine halbe Drehung (180°) um Z.</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={pruefe}>✔ Prüfen</button>
          <button className="btn" onClick={() => setZeigen(true)}>👁 Lösung</button>
          <button className="btn" onClick={neu}>🎲 Neue Figur</button>
        </div>
        {geprueft && (fertig
          ? <p className="text-ok font-bold">✔ Perfekt gespiegelt!</p>
          : <p className="text-bad font-bold">✘ {richtig} von {loesung.size} Kästchen richtig{falsch ? `, ${falsch} falsch (✘)` : ""}.</p>)}
      </div>
    </div>
  );
}

/* ── Achsen finden ───────────────────────────────────────────────────────── */

const GRUPPEN: Gruppe[] = ["keine", "senkrecht", "waagerecht", "diagonal", "zwei", "vier", "punkt", "dreh4"];

function Finden({ onErgebnis }: { onErgebnis: (ok: boolean) => void }) {
  const [nr, setNr] = useState(0);
  const figur = useMemo<Zelle[]>(() => {
    const g = GRUPPEN[Math.floor(Math.random() * GRUPPEN.length)];
    return symmetrischeFigur(Math.random, g, 6).map(([c, r]) => [c + 2, r + 2] as Zelle);
  }, [nr]); // eslint-disable-line react-hooks/exhaustive-deps
  const kand = kandidaten(figur), richtig = symmetrieAchsen(figur), punkt = punktsymmetrisch(figur);
  const [wahl, setWahl] = useState<Set<AchsenTyp>>(new Set());
  const [pWahl, setPWahl] = useState<boolean | null>(null);
  const [geprueft, setGeprueft] = useState(false);
  const ok = richtig.length === wahl.size && richtig.every(a => wahl.has(a)) && pWahl === punkt;

  const neu = () => { setNr(n => n + 1); setWahl(new Set()); setPWahl(null); setGeprueft(false); };
  const pruefe = () => { if (!geprueft) onErgebnis(ok); setGeprueft(true); };
  const farben = new Map<string, Farbe>(figur.map(c => [schluessel(c), { fill: BLAU }]));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,34rem)_1fr] items-start">
      <Blatt farben={farben} label="Figur mit möglichen Symmetrieachsen">
        {ACHSEN_TYPEN.map(a => {
          const k = kand[a.id];
          if (!k) return null;
          if (geprueft) {
            if (richtig.includes(a.id)) return <Achse key={a.id} a={k} farbe={GRUEN} />;
            if (wahl.has(a.id)) return <Achse key={a.id} a={k} farbe={ROT} gestrichelt />;
            return null;
          }
          return wahl.has(a.id) ? <Achse key={a.id} a={k} farbe={ORANGE} gestrichelt /> : null;
        })}
        {geprueft && punkt && <circle cx={px(kand.senkrecht!.k)} cy={px(kand.waagerecht!.k)} r={7} style={{ fill: GRUEN }} />}
      </Blatt>
      <div className="flex flex-col gap-3 text-sm">
        <p>Welche Geraden sind Symmetrieachsen der Figur? Wähle alle aus (es können auch keine sein). Beim Falten an einer Achse müssen beide Hälften genau aufeinanderliegen.</p>
        <div className="flex flex-wrap gap-1.5">
          {ACHSEN_TYPEN.map(a => {
            const da = !!kand[a.id], an = wahl.has(a.id);
            return (
              <button key={a.id} className={`chip ${an ? "chip-on" : ""}`} aria-pressed={an} disabled={!da || geprueft}
                title={da ? undefined : "Der Umriss ist nicht quadratisch — schräge Achsen gibt es hier nicht."}
                onClick={() => { const s = new Set(wahl); if (an) s.delete(a.id); else s.add(a.id); setWahl(s); }}>{a.label}</button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold">Punktsymmetrisch (halbe Drehung passt)?</span>
          {[true, false].map(v => <button key={String(v)} disabled={geprueft} className={`chip ${pWahl === v ? "chip-on" : ""}`} onClick={() => setPWahl(v)}>{v ? "ja" : "nein"}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={pruefe} disabled={pWahl === null}>✔ Prüfen</button>
          <button className="btn" onClick={neu}>🎲 Neue Figur</button>
        </div>
        {geprueft && (
          <p className={ok ? "text-ok font-bold" : "text-bad font-bold"}>
            {ok ? "✔ Richtig! " : "✘ Nicht ganz. "}
            {richtig.length ? `Achsen: ${richtig.map(a => ACHSEN_TYPEN.find(x => x.id === a)!.label).join(", ")}.` : "Die Figur hat keine Symmetrieachse."}{" "}
            {punkt ? "Sie ist punktsymmetrisch." : "Sie ist nicht punktsymmetrisch."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Drehen ─────────────────────────────────────────────────────────────── */

function zufallsDrehfigur(): Drehfigur {
  const art = (["windrad", "stern", "vieleck", "propeller"] as const)[Math.floor(Math.random() * 4)];
  const n = art === "propeller" ? 2 + Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 6);
  return drehfigur(art, n);
}

function Drehen({ onErgebnis }: { onErgebnis: (ok: boolean) => void }) {
  const [fig, setFig] = useState<Drehfigur>(() => drehfigur("windrad", 4));
  const [w, setW] = useState(0);
  const [ein, setEin] = useState("");
  const [urteil, setUrteil] = useState<boolean | null>(null);
  const passt = w > 0.5 && w < 359.5 && Math.abs(((w + 180 / fig.n) % (360 / fig.n)) - 180 / fig.n) < 0.75;
  const S = 400, k = 48;
  const pfad = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"} ${S / 2 + p.x * k} ${S / 2 - p.y * k}`).join(" ") + " Z";
  const pruefe = () => {
    const x = leseZahl(ein);
    const ok = x !== null && Math.abs(x - 360 / fig.n) < 0.5;
    if (urteil === null) onErgebnis(ok);
    setUrteil(ok);
  };
  const neu = () => { setFig(zufallsDrehfigur()); setW(0); setEin(""); setUrteil(null); };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,34rem)_1fr] items-start">
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full h-auto max-h-[70vh] max-w-[34rem] rounded-xl border border-line" role="img" aria-label={fig.name}>
        <rect width={S} height={S} style={{ fill: "var(--surface)" }} />
        {fig.flaechen.map((f, i) => <path key={`o${i}`} d={pfad(f)} style={{ fill: BLAU, stroke: BLAU }} fillOpacity={0.35} strokeWidth={2} />)}
        <g transform={`rotate(${-w} ${S / 2} ${S / 2})`}>
          {fig.flaechen.map((f, i) => <path key={`k${i}`} d={pfad(f)} style={{ fill: "none", stroke: passt ? GRUEN : ORANGE }} strokeWidth={3} strokeDasharray={passt ? undefined : "7 5"} />)}
          <line x1={S / 2} y1={S / 2} x2={S / 2 + 3.3 * k} y2={S / 2} style={{ stroke: ROT }} strokeWidth={2} />
        </g>
        <line x1={S / 2} y1={S / 2} x2={S / 2 + 3.3 * k} y2={S / 2} style={{ stroke: "var(--text-muted)" }} strokeWidth={1.5} strokeDasharray="4 4" />
        <circle cx={S / 2} cy={S / 2} r={5} style={{ fill: ROT }} />
        {passt && <text x={S / 2} y={S - 18} textAnchor="middle" fontSize={20} fontWeight={900} style={{ fill: GRUEN }}>✔ passt bei {z(w)}°</text>}
      </svg>
      <div className="flex flex-col gap-3 text-sm">
        <p><strong>{fig.name}</strong>. Drehe die gestrichelte Kopie um die Mitte, bis sie wieder genau auf der Figur liegt. Eine Figur ist <strong>drehsymmetrisch</strong>, wenn das schon vor einer ganzen Umdrehung passiert.</p>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Drehwinkel: {w}°</span>
          <input type="range" min={0} max={360} value={w} onChange={e => setW(Number(e.target.value))} aria-label="Drehwinkel" />
        </label>
        <label className="flex flex-wrap items-center gap-2 font-bold">kleinster Drehwinkel =
          <input className="input w-24" inputMode="decimal" value={ein} aria-label="kleinster Drehwinkel"
            onChange={e => { setEin(e.target.value); setUrteil(null); }} onKeyDown={e => { if (e.key === "Enter") pruefe(); }} /> °
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={pruefe}>✔ Prüfen</button>
          <button className="btn" onClick={neu}>🎲 Neue Figur</button>
        </div>
        {urteil !== null && (urteil
          ? <p className="text-ok font-bold">✔ Richtig: 360° : {fig.n} = {z(360 / fig.n)}°. {fig.achsen ? `Dazu hat sie ${fig.achsen} Symmetrieachsen.` : "Spiegelachsen hat sie keine — die Teile sind schief."}</p>
          : <p className="text-bad font-bold">✘ Zähle die gleichen Teile und teile 360° durch ihre Anzahl.</p>)}
      </div>
    </div>
  );
}

export default function Symmetrie() {
  const [modus, setModus] = useState<Modus>("achse");
  const [punkte, setPunkte] = useState(LEER);
  const zaehl = (ok: boolean) => setPunkte(p => zaehle(p, ok));
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["achse", "punkt", "finden", "drehen"] as Modus[]).map(m => (
          <button key={m} className={`chip ${modus === m ? "chip-on" : ""}`} aria-pressed={modus === m} onClick={() => setModus(m)}>
            {{ achse: "🦋 Achse spiegeln", punkt: "🔄 Punkt spiegeln", finden: "🔎 Achsen finden", drehen: "🌀 Drehen" }[m]}
          </button>
        ))}
        <span className="flex-1" />
        {punkte.gesamt > 0 && <span className="text-sm font-black">✔ {punkte.richtig} von {punkte.gesamt} · Serie {punkte.serie}</span>}
      </div>
      {modus === "achse" && <Ergaenzen key="a" punkt={false} onErgebnis={zaehl} />}
      {modus === "punkt" && <Ergaenzen key="p" punkt onErgebnis={zaehl} />}
      {modus === "finden" && <Finden onErgebnis={zaehl} />}
      {modus === "drehen" && <Drehen onErgebnis={zaehl} />}
    </div>
  );
}
