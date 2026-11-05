"use client";
/**
 * Spiel »Renovieren«: Wände streichen, tapezieren oder fliesen. Der Raum
 * liegt als Netz eines Quaders da — Boden in der Mitte, Wände ringsum
 * aufgeklappt, die Decke an der Nordwand. Ein Klick wählt eine Fläche; ihr
 * Feld schaltet sie an oder aus (der Boden ist meist aus) und nimmt Fenster
 * und Türen auf.
 *
 *   »Auftrag«  fünf Aufträge: erst die Fläche (bzw. die Tapetenbahnen)
 *              ausrechnen, dann einkaufen; danach wird gestrichen — reicht
 *              es nicht, bleibt ein Stück Wand grau. Punkte für die
 *              Rechnung, fürs Reichen und für den Preis.
 *   »Planer«   Raum frei einstellen, alles zum Nachrechnen.
 */
import { useEffect, useMemo, useState } from "react";
import { euro, leseZahl, z } from "@/lib/prozent";
import {
  ARTEN, FLAECHEN, FLAECHEN_NAME, OEFFNUNG, START_EINSTELLUNG, auftrag, guenstigsterEinkauf, leererRaum, rechne, wandBreite,
  type ArtId, type Auftrag, type Einstellung, type Flaeche, type OeffnungArt, type Raum, type Wand,
} from "@/lib/koerper-renovieren";

const RUNDEN = 5, SCHLUESSEL = "hp_koerper_renovieren_best";
const liesBest = () => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

type Rechteck = { x: number; y: number; width: number; height: number };

/** Lage einer Fläche im Netz (Meter) und wie Wandkoordinaten (s entlang, z hoch) dorthin kommen. */
function lage(r: Raum, f: Flaeche): { rect: Rechteck; punkt: (s: number, h: number) => [number, number] } {
  const { L, B, H } = r;
  switch (f) {
    case "nord": return { rect: { x: H, y: 0, width: L, height: H }, punkt: (s, h) => [H + s, H - h] };
    case "sued": return { rect: { x: H, y: H + B, width: L, height: H }, punkt: (s, h) => [H + s, H + B + h] };
    case "west": return { rect: { x: 0, y: H, width: H, height: B }, punkt: (s, h) => [H - h, H + s] };
    case "ost": return { rect: { x: H + L, y: H, width: H, height: B }, punkt: (s, h) => [H + L + h, H + s] };
    case "boden": return { rect: { x: H, y: H, width: L, height: B }, punkt: (s, h) => [H + s, H + h] };
    case "decke": return { rect: { x: H, y: -B, width: L, height: B }, punkt: (s, h) => [H + s, -B + h] };
  }
}
function box(p: (s: number, h: number) => [number, number], s0: number, h0: number, s1: number, h1: number): Rechteck {
  const [x0, y0] = p(s0, h0), [x1, y1] = p(s1, h1);
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

/** Lage der Fenster und Türen auf einer Wand: gleichmäßig verteilt. */
export function oeffnungsLagen(r: Raum, w: Wand) {
  const os = r.oeffnungen[w], b = wandBreite(r, w);
  return os.map((o, i) => {
    const x = OEFFNUNG[o], mitte = (i + 1) * b / (os.length + 1);
    return { o, s0: mitte - x.b / 2, s1: mitte + x.b / 2, h0: x.unten, h1: Math.min(x.unten + x.h, r.H) };
  });
}

function RaumNetz({ r, art, einst, auswahl, onWaehle, anteil }: {
  r: Raum; art: ArtId; einst: Einstellung; auswahl: Flaeche | null; onWaehle?: (f: Flaeche) => void;
  /** wie weit jede Fläche schon bearbeitet ist (0–1); fehlt = nicht zeigen */
  anteil?: Partial<Record<Flaeche, number>>;
}) {
  const { L, B, H } = r;
  const rand = 0.6, schrift = Math.max(0.2, (L + 2 * H) / 34);
  const farbe = ARTEN[art].farbe;
  const oben = art === "fliesen" ? Math.min(einst.fliesenhoehe, H) : H;
  return (
    <svg viewBox={`${-rand} ${-B - rand} ${L + 2 * H + 2 * rand} ${B + 2 * H + B + 2 * rand}`} className="w-full h-auto max-h-[62vh]" role="img"
      aria-label={`Raum als Netz: ${z(L)} m lang, ${z(B)} m breit, ${z(H)} m hoch`}>
      <defs>
        <pattern id="fliesen-muster" width={0.3} height={0.3} patternUnits="userSpaceOnUse">
          <rect width={0.3} height={0.3} fill={farbe} fillOpacity={0.55} />
          <path d="M 0.3 0 L 0 0 0 0.3" fill="none" stroke="#fff" strokeWidth={0.02} />
        </pattern>
        <pattern id="tapete-muster" width={0.53} height={0.4} patternUnits="userSpaceOnUse">
          <rect width={0.53} height={0.4} fill={farbe} fillOpacity={0.45} />
          <circle cx={0.26} cy={0.2} r={0.07} fill="#fff" fillOpacity={0.7} />
          <line x1={0.53} y1={0} x2={0.53} y2={0.4} stroke="#fff" strokeWidth={0.015} />
        </pattern>
      </defs>
      {FLAECHEN.map(f => {
        const { rect, punkt } = lage(r, f);
        const erlaubt = ARTEN[art].erlaubt.includes(f), an = r.an[f] && erlaubt;
        const wand = f !== "decke" && f !== "boden";
        const laenge = f === "decke" || f === "boden" ? L : wandBreite(r, f as Wand);
        const p = anteil?.[f];
        const fuellung = art === "fliesen" ? "url(#fliesen-muster)" : art === "tapezieren" ? "url(#tapete-muster)" : farbe;
        return (
          <g key={f} onClick={() => onWaehle?.(f)} style={{ cursor: onWaehle ? "pointer" : undefined }} role={onWaehle ? "button" : undefined}
            aria-label={onWaehle ? `${FLAECHEN_NAME[f]} wählen` : undefined}>
            <rect {...rect} className={an ? "fill-surface stroke-fg" : "fill-surface-hover stroke-line"} strokeWidth={0.03}
              strokeDasharray={an ? undefined : "0.12 0.08"} />
            {an && p === undefined && <rect {...(wand ? box(punkt, 0, 0, laenge, oben) : rect)} fill={farbe} fillOpacity={0.18} />}
            {an && p !== undefined && p > 0 && (
              <rect {...(wand ? box(punkt, 0, 0, laenge * p, oben) : box(punkt, 0, 0, laenge * p, B))}
                fill={fuellung} fillOpacity={art === "streichen" ? 0.75 : 1} />
            )}
            {wand && oeffnungsLagen(r, f as Wand).map((x, i) => (
              <rect key={i} {...box(punkt, x.s0, x.h0, x.s1, x.h1)} fill={x.o === "fenster" ? "#bae6fd" : "#a16207"} fillOpacity={x.o === "fenster" ? 0.9 : 0.75}
                stroke="#334155" strokeWidth={0.02} />
            ))}
            {auswahl === f && <rect {...rect} fill="none" className="stroke-accent" strokeWidth={0.09} />}
            <text x={rect.x + rect.width / 2} y={rect.y + rect.height / 2} fontSize={schrift} textAnchor="middle" dominantBaseline="central"
              className={an ? "fill-fg" : "fill-muted"} fontWeight={700} stroke="var(--surface)" strokeWidth={schrift * 0.18} paintOrder="stroke">
              {FLAECHEN_NAME[f]}{an ? "" : " (aus)"}
            </text>
          </g>
        );
      })}
      {/* Maße außen am Netz */}
      <g fontSize={schrift * 0.9} className="fill-muted" textAnchor="middle">
        <text x={H + L / 2} y={2 * H + B + schrift * 1.1}>{z(L)} m</text>
        <text x={2 * H + L + schrift * 1.6} y={H + B / 2} dominantBaseline="central">{z(B)} m</text>
        <text x={H + L + H / 2} y={H + B + schrift * 1.1}>Höhe {z(H)} m</text>
      </g>
    </svg>
  );
}

/** Feld zur gewählten Fläche: an/aus, Fenster und Türen. */
function FlaechenFeld({ r, art, f, setRaum, sperre }: { r: Raum; art: ArtId; f: Flaeche; setRaum: (r: Raum) => void; sperre?: boolean }) {
  const erlaubt = ARTEN[art].erlaubt.includes(f);
  const wand = f !== "decke" && f !== "boden";
  return (
    <div className="rounded-xl border border-line p-3 flex flex-col gap-2 text-sm">
      <strong>{FLAECHEN_NAME[f]} {wand ? `(${z(wandBreite(r, f as Wand))} m × ${z(r.H)} m)` : `(${z(r.L)} m × ${z(r.B)} m)`}</strong>
      {erlaubt ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={r.an[f]} disabled={sperre} onChange={e => setRaum({ ...r, an: { ...r.an, [f]: e.target.checked } })} />
          {ARTEN[art].name.toLowerCase()} {f === "boden" ? "(der Boden bleibt sonst frei)" : ""}
        </label>
      ) : <span className="text-muted">Beim {ARTEN[art].name} gehört diese Fläche nicht dazu.</span>}
      {wand && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {r.oeffnungen[f as Wand].map((o, i) => (
            <button key={i} className="chip" disabled={sperre} aria-label={`${OEFFNUNG[o].name} entfernen`}
              onClick={() => setRaum({ ...r, oeffnungen: { ...r.oeffnungen, [f]: r.oeffnungen[f as Wand].filter((_, j) => j !== i) } })}>
              {OEFFNUNG[o].icon} {OEFFNUNG[o].name} {z(OEFFNUNG[o].b)} × {z(OEFFNUNG[o].h)} ✕
            </button>
          ))}
          {!sperre && (Object.keys(OEFFNUNG) as OeffnungArt[]).map(o => (
            <button key={o} className="chip" onClick={() => setRaum({ ...r, oeffnungen: { ...r.oeffnungen, [f]: [...r.oeffnungen[f as Wand], o] } })}
              disabled={r.oeffnungen[f as Wand].length >= Math.floor(wandBreite(r, f as Wand) / 1.4)}>+ {OEFFNUNG[o].icon} {OEFFNUNG[o].name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Einstellungen({ art, e, setE, H, sperre }: { art: ArtId; e: Einstellung; setE: (e: Einstellung) => void; H: number; sperre?: boolean }) {
  if (art === "tapezieren") return null;
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      {art === "streichen" && <>
        <label className="flex items-center gap-2">Anstriche
          <select className="input w-auto" value={e.anstriche} disabled={sperre} onChange={x => setE({ ...e, anstriche: Number(x.target.value) })}>
            {[1, 2, 3].map(n => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">1 l reicht für
          <select className="input w-auto" value={e.ergiebigkeit} disabled={sperre} onChange={x => setE({ ...e, ergiebigkeit: Number(x.target.value) })}>
            {[5, 6, 7, 8, 9, 10].map(n => <option key={n}>{n}</option>)}
          </select> m²
        </label>
      </>}
      {art === "fliesen" && (
        <label className="flex items-center gap-2">Fliesen bis
          <select className="input w-auto" value={e.fliesenhoehe} disabled={sperre} onChange={x => setE({ ...e, fliesenhoehe: Number(x.target.value) })}>
            {[1.2, 1.5, 2, H].map(n => <option key={n} value={n}>{n === H ? `zur Decke (${z(H)} m)` : `${z(n)} m`}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function Planer() {
  const [art, setArt] = useState<ArtId>("streichen");
  const [r, setR] = useState<Raum>(() => leererRaum());
  const [e, setE] = useState<Einstellung>(START_EINSTELLUNG);
  const [auswahl, setAuswahl] = useState<Flaeche | null>("nord");
  const rg = rechne(r, art, e);
  const kauf = guenstigsterEinkauf(ARTEN[art].gebinde, rg.bedarf);
  const regler = (k: "L" | "B" | "H", label: string, min: number, max: number) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label} = <strong className="text-fg">{z(r[k])} m</strong></span>
      <input type="range" min={min} max={max} step={0.05} value={r[k]} aria-label={label} className="accent-accent"
        onChange={x => setR({ ...r, [k]: Number(x.target.value) })} />
    </label>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
      <div className="flex flex-col gap-3">
        <RaumNetz r={r} art={art} einst={e} auswahl={auswahl} onWaehle={setAuswahl} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{regler("L", "Länge", 2, 9)}{regler("B", "Breite", 1.5, 7)}{regler("H", "Höhe", 2.2, 3.5)}</div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ARTEN) as ArtId[]).map(a => (
            <button key={a} className={`chip ${art === a ? "chip-on" : ""}`} aria-pressed={art === a} onClick={() => setArt(a)}>{ARTEN[a].icon} {ARTEN[a].name}</button>
          ))}
        </div>
        <Einstellungen art={art} e={e} setE={setE} H={r.H} />
        {auswahl && <FlaechenFeld r={r} art={art} f={auswahl} setRaum={setR} />}
        <div className="card p-3 flex flex-col gap-1 text-sm">
          {rg.teile.map(t => t.zeilen.map((x, i) => <code key={t.f + i} className="text-xs">{x}</code>))}
          {rg.zeilen.map((x, i) => <code key={i} className="font-bold">{x}</code>)}
          <p className="mt-1">🛒 Günstigster Einkauf: {kauf.anzahl.map((n, i) => n ? `${n} × ${ARTEN[art].gebinde[i].name}` : "").filter(Boolean).join(" + ") || "nichts"} = <strong>{euro(kauf.preis)}</strong></p>
          {art === "tapezieren" && <p className="text-xs text-muted">Fenster und Türen zieht man beim Tapezieren nicht ab: Die Bahnen laufen darüber und darunter weiter.</p>}
        </div>
      </div>
    </div>
  );
}

const ARTEN_REIHE: ArtId[] = ["streichen", "tapezieren", "fliesen"];
const SPRUECHE = {
  knapp: ["Farbe alle! Ein grauer Streifen bleibt — der Kunde runzelt die Stirn.", "Mist, der Eimer ist leer, die Wand noch nicht.", "Nochmal in den Baumarkt? Das kostet Zeit und Sprit."],
  gut: ["Passt! Alles fertig, kaum Reste.", "Sauber gerechnet — der Kunde gibt Trinkgeld.", "Fertig, und der Keller bleibt frei von Resteimern."],
  zuviel: ["Fertig — aber der Keller steht voller Reste.", "Reicht locker. Vielleicht etwas zu locker für den Geldbeutel."],
};

function Spiel() {
  const [runde, setRunde] = useState(0);
  const [auf, setAuf] = useState<Auftrag | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [versuche, setVersuche] = useState(0);
  const [richtig, setRichtig] = useState(false);
  const [tipp, setTipp] = useState(false);
  const [korb, setKorb] = useState<number[]>([]);
  const [phase, setPhase] = useState<"start" | "rechnen" | "kaufen" | "arbeiten" | "fertig" | "ende">("start");
  const [t, setT] = useState(0);
  const [punkte, setPunkte] = useState<number[]>([]);
  const [auswahl, setAuswahl] = useState<Flaeche | null>(null);
  const [best, setBest] = useState(0);
  useEffect(() => { setBest(liesBest()); }, []);

  const rg = useMemo(() => (auf ? rechne(auf.raum, auf.art, auf.einst) : null), [auf]);
  const art = auf ? ARTEN[auf.art] : null;
  const opt = useMemo(() => (auf && rg ? guenstigsterEinkauf(ARTEN[auf.art].gebinde, rg.bedarf) : null), [auf, rg]);

  const neu = (n: number) => {
    const a = auftrag(ARTEN_REIHE[n % 3]);
    setAuf(a); setRunde(n); setEingabe(""); setVersuche(0); setRichtig(false); setTipp(false); setAuswahl(null);
    setKorb(ARTEN[a.art].gebinde.map(() => 0)); setT(0); setPhase("rechnen");
  };
  const start = () => { setPunkte([]); neu(0); };

  // Arbeiten: in 2 Sekunden wird gestrichen, so weit das Material reicht.
  useEffect(() => {
    if (phase !== "arbeiten") return;
    const los = performance.now();
    let id = 0;
    const schritt = (jetzt: number) => {
      const x = Math.min(1, (jetzt - los) / 2000);
      setT(x);
      if (x < 1) id = requestAnimationFrame(schritt);
      else setPhase("fertig");
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
  }, [phase]);

  if (phase === "start" || phase === "ende" || !auf || !rg || !art || !opt) {
    const summe = punkte.reduce((s, p) => s + p, 0);
    return (
      <div className="card p-6 flex flex-col items-center gap-3 text-center">
        <div className="text-4xl">🖌️</div>
        <h3 className="text-xl font-black">Renovieren</h3>
        <p className="max-w-xl text-muted">
          {RUNDEN} Aufträge: streichen, tapezieren, fliesen. Rechne erst aus, wie viel Fläche (bzw. wie viele Tapetenbahnen) es sind, dann
          kauf ein. Reicht das Material nicht, bleibt die Wand grau; kaufst du zu viel, zahlst du drauf. Bis zu 100 Punkte je Auftrag.
        </p>
        {phase === "ende" && <p className="text-lg font-black">Ergebnis: {summe} von {RUNDEN * 100} Punkten {summe >= best && summe > 0 ? "🏆 neuer Rekord!" : ""}</p>}
        {best > 0 && <p className="text-sm text-muted">Dein Rekord: {best}</p>}
        <button className="btn btn-primary" onClick={start}>{phase === "ende" ? "Nochmal" : "Los geht's"}</button>
      </div>
    );
  }

  const ziel = rg.schluessel;
  const pruefen = () => {
    const x = leseZahl(eingabe);
    const ok = x !== null && Math.abs(x - ziel.wert) <= Math.max(0.05, ziel.wert * 0.02);
    setVersuche(v => v + 1);
    if (ok) { setRichtig(true); setPhase("kaufen"); }
  };
  const menge = korb.reduce((s, n, i) => s + n * art.gebinde[i].inhalt, 0);
  const preis = korb.reduce((s, n, i) => s + n * art.gebinde[i].preis, 0);
  const reicht = menge + 1e-9 >= rg.bedarf;
  const deckung = rg.bedarf > 0 ? Math.min(1, menge / rg.bedarf) : 1;

  // Anteil je Fläche beim Arbeiten: die Flächen kommen der Reihe nach dran.
  const anteil: Partial<Record<Flaeche, number>> = {};
  if (phase === "arbeiten" || phase === "fertig") {
    let rest = rg.netto * deckung * t;
    for (const x of rg.teile) {
      anteil[x.f] = x.netto > 0 ? Math.max(0, Math.min(1, rest / x.netto)) : 1;
      rest -= x.netto;
    }
  }

  const wertung = () => {
    const rechnen = richtig ? (tipp ? 0 : versuche <= 1 ? 40 : 20) : 0;
    const genug = reicht ? 30 : 0;
    const geld = reicht && preis > 0 ? Math.round(30 * Math.min(1, opt.preis / preis)) : 0;
    return { rechnen, genug, geld, summe: rechnen + genug + geld };
  };
  const weiter = () => {
    const w = wertung().summe;
    const alle = [...punkte, w];
    setPunkte(alle);
    if (runde + 1 >= RUNDEN) {
      const s = alle.reduce((a, b) => a + b, 0);
      if (s > best) { setBest(s); schreibBest(s); }
      setPhase("ende");
    } else neu(runde + 1);
  };
  const spruch = (liste: string[]) => liste[(runde * 7 + Math.round(rg.netto)) % liste.length];
  const w = wertung();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
      <div className="flex flex-col gap-2">
        <RaumNetz r={auf.raum} art={auf.art} einst={auf.einst} auswahl={auswahl} onWaehle={setAuswahl}
          anteil={phase === "arbeiten" || phase === "fertig" ? anteil : undefined} />
        <p className="text-xs text-muted">Antippen zeigt die Maße einer Fläche und ihre Fenster und Türen. Fenster: {z(OEFFNUNG.fenster.b)} × {z(OEFFNUNG.fenster.h)} m (Brüstung {z(OEFFNUNG.fenster.unten)} m), Tür: {z(OEFFNUNG.tuer.b)} × {z(OEFFNUNG.tuer.h)} m, Balkontür: {z(OEFFNUNG.balkontuer.b)} × {z(OEFFNUNG.balkontuer.h)} m.</p>
      </div>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex justify-between font-black"><span>Auftrag {runde + 1} von {RUNDEN} · {art.icon} {art.name}</span><span>⭐ {punkte.reduce((s, p) => s + p, 0)}</span></div>
        <p className="card p-3">{auf.text} Der Raum ist {z(auf.raum.L)} m lang, {z(auf.raum.B)} m breit und {z(auf.raum.H)} m hoch.</p>
        {auswahl && <FlaechenFeld r={auf.raum} art={auf.art} f={auswahl} setRaum={() => {}} sperre />}

        {phase === "rechnen" && (
          <div className="card p-3 flex flex-col gap-2">
            <strong>① {auf.art === "tapezieren" ? "Wie viele Bahnen braucht man für die Wände?" : `Wie viele m² sind zu ${auf.art === "fliesen" ? "fliesen" : "streichen"}?`}</strong>
            <div className="flex items-center gap-2">
              <input className="input w-28" inputMode="decimal" aria-label={ziel.label} value={eingabe} onChange={x => setEingabe(x.target.value)}
                onKeyDown={x => { if (x.key === "Enter") pruefen(); }} />
              <span className="text-muted">{ziel.einheit}</span>
              <button className="btn btn-primary" onClick={pruefen}>✔ Prüfen</button>
            </div>
            {versuche > 0 && !richtig && <span className="text-bad">✘ Noch nicht — schau dir die Fenster und Türen an.</span>}
            <button className="btn self-start" onClick={() => setTipp(true)} disabled={tipp}>💡 Rechenweg je Fläche (kostet die Rechenpunkte)</button>
            {tipp && rg.teile.map(x => x.zeilen.map((y, i) => <code key={x.f + i} className="text-xs">{y}</code>))}
          </div>
        )}

        {phase === "kaufen" && (
          <div className="card p-3 flex flex-col gap-2">
            <span className="text-ok font-bold">✔ {z(ziel.wert)} {ziel.einheit} — richtig.</span>
            <strong>② Einkaufen: Du brauchst {auf.art === "tapezieren" ? "Rollen" : auf.art === "streichen" ? "Farbe" : "Fliesen"}.</strong>
            {auf.art === "streichen" && <span className="text-xs text-muted">{auf.einst.anstriche} Anstrich{auf.einst.anstriche > 1 ? "e" : ""}, 1 l reicht für {auf.einst.ergiebigkeit} m².</span>}
            {auf.art === "fliesen" && <span className="text-xs text-muted">10 % Verschnitt einrechnen.</span>}
            {auf.art === "tapezieren" && <span className="text-xs text-muted">Bahnlänge = Raumhöhe + 10 cm; eine Rolle ist {z(10.05)} m lang. Reste einer Rolle kann man nicht aneinanderstückeln.</span>}
            {art.gebinde.map((g, i) => (
              <div key={g.name} className="flex items-center gap-2">
                <button className="btn" aria-label={`${g.name} weniger`} onClick={() => setKorb(k => k.map((n, j) => (j === i ? Math.max(0, n - 1) : n)))}>−</button>
                <span className="w-6 text-center font-black">{korb[i]}</span>
                <button className="btn" aria-label={`${g.name} mehr`} onClick={() => setKorb(k => k.map((n, j) => (j === i ? n + 1 : n)))}>+</button>
                <span className="flex-1">{g.name}</span><span className="text-muted">{euro(g.preis)}</span>
              </div>
            ))}
            <div className="flex justify-between font-black border-t border-line pt-1"><span>Im Korb: {z(menge)} {art.einheit}</span><span>{euro(preis)}</span></div>
            <button className="btn btn-primary" disabled={menge === 0} onClick={() => setPhase("arbeiten")}>🛒 Kaufen und loslegen</button>
          </div>
        )}

        {(phase === "arbeiten" || phase === "fertig") && (
          <div className="card p-3 flex flex-col gap-1">
            {phase === "arbeiten" ? <strong>{art.icon} Es wird gearbeitet …</strong> : (
              <>
                <strong className={reicht ? "text-ok" : "text-bad"}>
                  {!reicht ? spruch(SPRUECHE.knapp) : preis > opt.preis * 1.25 ? spruch(SPRUECHE.zuviel) : spruch(SPRUECHE.gut)}
                </strong>
                <span>Gebraucht: {z(rg.bedarf)} {art.einheit} · gekauft: {z(menge)} {art.einheit} für {euro(preis)}</span>
                {!reicht && <span>Es fehlen {z(rg.bedarf - menge)} {art.einheit} — {z(rg.netto * (1 - deckung))} m² bleiben unbearbeitet.</span>}
                <span>Günstigster Einkauf wäre: {opt.anzahl.map((n, i) => (n ? `${n} × ${art.gebinde[i].name}` : "")).filter(Boolean).join(" + ")} = {euro(opt.preis)}</span>
                {rg.zeilen.map((x, i) => <code key={i} className="text-xs">{x}</code>)}
                <span className="font-black mt-1">Punkte: Rechnung {w.rechnen} + reicht {w.genug} + Preis {w.geld} = {w.summe}</span>
                <button className="btn btn-primary self-start" onClick={weiter}>{runde + 1 >= RUNDEN ? "🏁 Auswertung" : "➡ Nächster Auftrag"}</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Renovieren() {
  const [modus, setModus] = useState<"spiel" | "planer">("spiel");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        <button className={`chip ${modus === "spiel" ? "chip-on" : ""}`} aria-pressed={modus === "spiel"} onClick={() => setModus("spiel")}>🎯 Aufträge (Spiel)</button>
        <button className={`chip ${modus === "planer" ? "chip-on" : ""}`} aria-pressed={modus === "planer"} onClick={() => setModus("planer")}>🛠️ Planer</button>
      </div>
      {modus === "spiel" ? <Spiel /> : <Planer />}
    </div>
  );
}
