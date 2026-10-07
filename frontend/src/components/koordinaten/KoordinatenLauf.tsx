"use client";
/**
 * Koordinaten-Lauf — Punkte ins Koordinatensystem setzen wie in einem
 * Jump'n'Run: erst laufen (x), dann springen (y).
 *
 * Ansichten: Weltkarte (Level und Infohappen je Welt), ein Level, ein
 * Infohappen. Jeder Infohappen führt sich auf seinem eigenen kleinen Feld vor;
 * im Level zeigt »Vorführen« den Weg zum nächsten Punkt und stellt danach den
 * Stand wieder her — lösen muss man selbst.
 *
 * Regeln und Level: @/lib/koordinaten (dort getestet).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  anfang, aufgabe as aufgabeVon, achsenText, bruchTex, fertig as istFertig, fmt, geradeTex, ladeStand,
  mitErgebnis, naechstes, punktText, schritt, speichereStand, sterne as sterneFuer, vorfuehrung,
  type Aktion, type DemoSchritt, type Level, type Stand, type Zustand,
} from "@/lib/koordinaten/spiel";
import { LEVEL, WELTEN, infoNach, type Info } from "@/lib/koordinaten/level";
import { Tex } from "@/components/Tex";
import { Spielfeld, type Effekt } from "./Spielfeld";

const AKTION_MS = 380;
const SATZ_MS = 2400;

/* ── Vorführen ─────────────────────────────────────────────────────────────── */

type Lauf = { text: string; nr: number; von: number; taste: Aktion | null };

/**
 * Spielt Schritte ab: je Schritt ein Satz, dann die Tastendrücke im Takt.
 * Jeder Schritt steht mindestens SATZ_MS — mitlesen soll möglich sein.
 */
function useVorfuehrung() {
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const uhren = useRef<ReturnType<typeof setTimeout>[]>([]);
  const ende = useRef<(() => void) | null>(null);

  const stopp = useCallback(() => {
    uhren.current.forEach(clearTimeout);
    uhren.current = [];
    setLauf(null);
    const e = ende.current;
    ende.current = null;
    e?.();
  }, []);

  const abspielen = useCallback((schritte: DemoSchritt[], tu: (a: Aktion) => void, onEnde?: () => void) => {
    uhren.current.forEach(clearTimeout);
    uhren.current = [];
    ende.current = onEnde ?? null;
    let t = 0;
    schritte.forEach((s, nr) => {
      const basis = { text: s.text, nr, von: schritte.length };
      // Der erste Satz sofort — sonst blitzt der Knopf ohne Rückmeldung.
      if (t === 0) setLauf({ ...basis, taste: null });
      else uhren.current.push(setTimeout(() => setLauf({ ...basis, taste: null }), t));
      s.aktionen.forEach((a, k) => {
        uhren.current.push(setTimeout(() => { setLauf({ ...basis, taste: a }); tu(a); }, t + 900 + k * AKTION_MS));
      });
      t += Math.max(SATZ_MS, 900 + s.aktionen.length * AKTION_MS + 700);
    });
    uhren.current.push(setTimeout(stopp, t + 300));
  }, [stopp]);

  useEffect(() => () => uhren.current.forEach(clearTimeout), []);
  return { lauf, aktiv: lauf !== null, abspielen, stopp };
}

/* ── Ein Feld mit Zustand — für Level und Infohappen ───────────────────────── */

function useFeld(level: Level) {
  const aufgabe = useMemo(() => aufgabeVon(level), [level]);
  const [zustand, setZustand] = useState<Zustand>(() => anfang(aufgabe, level.bereich));
  const [effekt, setEffekt] = useState<Effekt | null>(null);
  const zRef = useRef(zustand);
  zRef.current = zustand;
  const effektNr = useRef(0);

  // Neues Level → neuer Anfang (Schlüssel ist das Level selbst)
  const [fuer, setFuer] = useState(level);
  if (fuer !== level) {
    setFuer(level);
    setZustand(anfang(aufgabe, level.bereich));
    setEffekt(null);
  }

  /** Eine Aktion ausführen; gibt das Ereignis zurück. */
  const tu = useCallback((a: Aktion) => {
    const { zustand: neu, ereignis } = schritt(aufgabe, level.bereich, zRef.current, a);
    zRef.current = neu;
    setZustand(neu);
    if (ereignis.art !== "nichts") setEffekt({ id: ++effektNr.current, ereignis, landung: neu.held });
    return ereignis;
  }, [aufgabe, level.bereich]);

  const setze = useCallback((z: Zustand) => { zRef.current = z; setZustand(z); setEffekt(null); }, []);
  const neu = useCallback(() => setze(anfang(aufgabe, level.bereich)), [aufgabe, level.bereich, setze]);
  return { aufgabe, zustand, effekt, tu, setze, neu };
}

/* ── Bedienknöpfe ─────────────────────────────────────────────────────────── */

function Knopf({ an, onClick, label, children, breit }: {
  an: boolean; onClick: () => void; label: string; children: ReactNode; breit?: boolean;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={`h-12 ${breit ? "px-5" : "w-12"} rounded-xl border-2 text-lg font-black transition-transform
        ${an ? "border-accent bg-accent text-accent-fg scale-110" : "border-line bg-surface hover:border-accent"}`}>
      {children}
    </button>
  );
}

function Steuerung({ tu, taste, aus }: { tu: (a: Aktion) => void; taste: Aktion | null; aus: boolean }) {
  const k = (a: Aktion) => () => { if (!aus) tu(a); };
  return (
    <div className="flex items-center justify-center gap-6 flex-wrap">
      <div className="flex gap-2">
        <Knopf an={taste === "links"} onClick={k("links")} label="nach links laufen">◀</Knopf>
        <Knopf an={taste === "rechts"} onClick={k("rechts")} label="nach rechts laufen">▶</Knopf>
      </div>
      <div className="flex gap-2">
        <Knopf an={taste === "hoch"} onClick={k("hoch")} label="höher springen">▲</Knopf>
        <Knopf an={taste === "runter"} onClick={k("runter")} label="niedriger springen">▼</Knopf>
      </div>
      <Knopf an={taste === "springen"} onClick={k("springen")} label="springen" breit>⤒ Springen</Knopf>
    </div>
  );
}

const TASTEN: Record<string, Aktion> = {
  ArrowLeft: "links", ArrowRight: "rechts", ArrowUp: "hoch", ArrowDown: "runter",
  a: "links", d: "rechts", w: "hoch", s: "runter", " ": "springen", Enter: "springen",
};

function useTastatur(tu: (a: Aktion) => void, aus: boolean) {
  return useCallback((e: React.KeyboardEvent) => {
    const a = TASTEN[e.key] ?? TASTEN[e.key.toLowerCase()];
    if (!a) return;
    e.preventDefault();
    if (!aus) tu(a);
  }, [tu, aus]);
}

function DemoLeiste({ lauf, stopp }: { lauf: Lauf; stopp: () => void }) {
  return (
    // Liegt über dem oberen Rand des Feldes, statt es nach unten zu schieben.
    <div className="absolute inset-x-2 top-2 z-10 flex items-center gap-x-3 gap-y-1 flex-wrap rounded-xl border-2 border-accent bg-surface/95 shadow-xl px-3 py-2"
      data-testid="vorfuehrung">
      <span className="text-xs text-muted tabular-nums shrink-0">{lauf.nr + 1}/{lauf.von}</span>
      <span className="font-black flex-1 min-w-[10rem] text-sm sm:text-base">{lauf.text}</span>
      <button type="button" onClick={stopp} className="text-xs rounded-lg px-2 py-1 border border-line hover:border-accent">
        ⏹ Beenden
      </button>
    </div>
  );
}

const Sterne = ({ n, gross }: { n: number; gross?: boolean }) => (
  <span className={gross ? "text-3xl" : "text-sm"} aria-label={`${n} von 3 Sternen`}>
    {[1, 2, 3].map(i => <span key={i} className={i <= n ? "text-amber-400" : "text-muted opacity-40"}>★</span>)}
  </span>
);

/* ── Infohappen ───────────────────────────────────────────────────────────── */

/** Alle Schritte, mit denen die Figur das Beispiel eines Infohappens löst. */
export function infoVorfuehrung(info: Info): DemoSchritt[] {
  const l = info.beispiel;
  const a = aufgabeVon(l);
  let z = anfang(a, l.bereich);
  const out: DemoSchritt[] = info.einleitung.map(text => ({ text, aktionen: [] }));
  for (let n = 0; n < 20 && !istFertig(z); n++) {
    const teil = vorfuehrung(l, a, z);
    out.push(...teil);
    for (const ak of teil.flatMap(s => s.aktionen)) z = schritt(a, l.bereich, z, ak).zustand;
  }
  return out;
}

function InfoAnsicht({ info, weiter }: { info: Info; weiter?: { label: string; los: () => void } }) {
  const feld = useFeld(info.beispiel);
  const demo = useVorfuehrung();
  const vorfuehren = () => {
    feld.neu();
    demo.abspielen(infoVorfuehrung(info), feld.tu);
  };
  return (
    <div className="flex flex-col gap-4" data-testid="infohappen">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
        <div className="card p-5 flex flex-col gap-3">
          <h2 className="text-xl font-black">{info.icon} {info.titel}</h2>
          {info.absaetze.map((t, i) => <p key={i} className="leading-relaxed">{t}</p>)}
          <div className="flex gap-2 flex-wrap mt-2">
            <button type="button" className="btn-primary" onClick={vorfuehren} disabled={demo.aktiv}>▶ Vorführen</button>
            {weiter && <button type="button" className="btn-secondary" onClick={() => { demo.stopp(); weiter.los(); }}>{weiter.label} →</button>}
          </div>
        </div>
        <div className="relative flex flex-col gap-3">
          {demo.lauf && <DemoLeiste lauf={demo.lauf} stopp={demo.stopp} />}
          <Spielfeld level={info.beispiel} aufgabe={feld.aufgabe} zustand={feld.zustand} effekt={feld.effekt} demo
            maxHoehe="calc(100vh - 10rem)" />
          {info.beispiel.art === "spiegeln" && (
            <p className="text-xs text-muted">Violett: Original und Spiegelachse.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Ein Level ───────────────────────────────────────────────────────────── */

function Auftrag({ level, aufgabe, zustand }: { level: Level; aufgabe: ReturnType<typeof aufgabeVon>; zustand: Zustand }) {
  const i = naechstes(aufgabe, zustand);
  let kopf: ReactNode = null;
  if (level.art === "spiegeln") kopf = <p className="text-sm">Spiegle {achsenText(level.achse)}: aus A wird A′.</p>;
  if (level.art === "steigung") kopf = (
    <div className="flex flex-col gap-1">
      <p className="text-sm">Start: {punktText({ name: "A", p: level.start })}</p>
      <p className="text-lg">Steigung <Tex tex={`m = ${bruchTex(level.m)}`} /></p>
      {level.tipp && <p className="text-xs text-muted">{laufSatz(level.m)}</p>}
    </div>
  );
  if (level.art === "gerade") kopf = (
    <div className="flex flex-col gap-1">
      <p className="text-lg"><Tex tex={geradeTex(level.m, level.n)} /></p>
      {level.tipp && <p className="text-xs text-muted">
        Erst <Tex tex={`n = ${level.n}`} /> auf der y-Achse setzen, dann {laufSatz(level.m)}
      </p>}
    </div>
  );
  // Bei Steigung und Gerade sind die Ziele das Rätsel — sie werden erst nach dem Setzen genannt.
  const verdeckt = level.art === "steigung" || level.art === "gerade";
  return (
    <div className="card p-4 flex flex-col gap-3">
      <h3 className="font-black text-sm uppercase tracking-wide text-muted">Auftrag</h3>
      {kopf}
      <ul className="flex flex-wrap gap-2">
        {aufgabe.ziele.map((t, j) => {
          if (aufgabe.vorab[j]) return null;
          const gesetzt = zustand.gesetzt[j];
          const aktuell = j === i;
          return (
            <li key={t.name} className={`rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums
              ${gesetzt ? "border-ok text-ok" : aktuell && aufgabe.geordnet ? "border-accent" : "border-line"}`}>
              {gesetzt ? "✓ " : ""}
              {verdeckt && !gesetzt ? `${t.name}(?|?)` : level.art === "spiegeln" && !gesetzt ? `${t.name}(?|?)` : punktText(t)}
            </li>
          );
        })}
      </ul>
      {level.art === "spiegeln" && (
        <p className="text-xs text-muted">
          Original: {aufgabe.vorlage.filter((_, j) => !aufgabe.vorab[j]).map(punktText).join(", ")}
        </p>
      )}
    </div>
  );
}

function laufSatz([z, n]: [number, number]) {
  return `je ${n} nach rechts laufen und ${Math.abs(z)} ${z > 0 ? "nach oben springen" : "nach unten"}.`;
}

function LevelAnsicht({ level, stand, onErgebnis, onKarte, onNaechstes, onInfo }: {
  level: Level; stand: Stand;
  onErgebnis: (id: string, sterne: number) => void;
  onKarte: () => void; onNaechstes: (() => void) | null; onInfo: (id: string) => void;
}) {
  const feld = useFeld(level);
  const demo = useVorfuehrung();
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [geschafft, setGeschafft] = useState<number | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);

  const kopfRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMeldung(null); setGeschafft(null);
    // Level oben an den Bildschirmrand: dann passt das Feld samt Knöpfen darunter.
    kopfRef.current?.scrollIntoView?.({ block: "start" });
    flaeche.current?.focus({ preventScroll: true });
  }, [level]);

  const spielerTu = useCallback((a: Aktion) => {
    const e = feld.tu(a);
    if (e.art === "treffer") {
      setMeldung({ text: `✓ ${punktText(feld.aufgabe.ziele[e.ziel])}`, gut: true });
      if (e.fertig) {
        // Ein Treffer ändert die Fehlerzahl nicht — der Stand vor dem Sprung genügt.
        const st = sterneFuer(feld.zustand.fehler);
        setGeschafft(st);
        onErgebnis(level.id, st);
      }
    } else if (e.art === "daneben") setMeldung({ text: e.hinweis, gut: false });
    else if (e.art === "schon") setMeldung({ text: "Diesen Punkt hast du schon gesetzt.", gut: false });
  }, [feld, level.id, onErgebnis]);

  const tasten = useTastatur(spielerTu, demo.aktiv || geschafft !== null);

  const vorfuehren = () => {
    const kopie = feld.zustand;
    setMeldung(null);
    demo.abspielen(vorfuehrung(level, feld.aufgabe, kopie), feld.tu, () => {
      feld.setze(kopie);
      flaeche.current?.focus({ preventScroll: true });
    });
  };

  const neu = () => { demo.stopp(); feld.neu(); setMeldung(null); setGeschafft(null); flaeche.current?.focus({ preventScroll: true }); };
  const { zustand } = feld;
  const relativ = zustand.held.y !== 0 || level.art === "steigung";
  const bisher = stand[level.id];

  return (
    <div ref={kopfRef} className="flex flex-col gap-3 scroll-mt-2" data-testid="level">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black">
            {WELTEN.find(w => w.nr === level.welt)?.icon} {level.titel}
            {bisher ? <span className="ml-2"><Sterne n={bisher} /></span> : null}
          </h2>
          <p className="text-sm text-muted max-w-2xl">{level.text}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="chip" onClick={vorfuehren} disabled={demo.aktiv || geschafft !== null}>▶ Vorführen</button>
          {level.info.map(id => {
            const info = infoNach(id);
            return info && <button key={id} type="button" className="chip" onClick={() => { demo.stopp(); onInfo(id); }}>{info.icon} {info.titel}</button>;
          })}
          <button type="button" className="chip" onClick={neu}>↺ Neu</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] items-start">
        <div ref={flaeche} tabIndex={0} onKeyDown={tasten} aria-label="Spielfläche — Pfeiltasten laufen und Sprunghöhe, Leertaste springt"
          className="relative flex flex-col gap-2 outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-accent">
          <div className="relative" onPointerDown={() => flaeche.current?.focus({ preventScroll: true })}>
            {demo.lauf && <DemoLeiste lauf={demo.lauf} stopp={demo.stopp} />}
            <Spielfeld level={level} aufgabe={feld.aufgabe} zustand={zustand} effekt={feld.effekt} demo={demo.aktiv} />
            {geschafft !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                <div className="card p-6 flex flex-col items-center gap-3 text-center shadow-2xl" data-testid="geschafft">
                  <div className="text-2xl font-black">Geschafft!</div>
                  <Sterne n={geschafft} gross />
                  <p className="text-sm text-muted">
                    {zustand.fehler === 0 ? "Ohne einen einzigen Fehlsprung." : `${zustand.fehler} Fehlsprung${zustand.fehler === 1 ? "" : "e"}.`}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={neu}>↺ Nochmal</button>
                    {onNaechstes
                      ? <button type="button" className="btn-primary" onClick={onNaechstes}>Weiter →</button>
                      : <button type="button" className="btn-primary" onClick={onKarte}>Zur Weltkarte</button>}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-x-3 flex-wrap text-sm">
            <span className="tabular-nums font-bold" data-testid="anzeige">
              {relativ ? "auf Höhe " + fmt(zustand.held.y) + " · " : ""}x = {fmt(zustand.held.x)} · Sprung {zustand.sprung >= 0 ? "↑" : "↓"} {Math.abs(zustand.sprung)}
            </span>
            <span className="text-xs text-muted hidden md:inline">Tastatur: ← → laufen · ↑ ↓ Sprunghöhe · Leertaste springen</span>
            <span className="text-muted">Fehlsprünge: {zustand.fehler}</span>
          </div>
          <Steuerung tu={spielerTu} taste={demo.lauf?.taste ?? null} aus={demo.aktiv || geschafft !== null} />
        </div>
        <div className="flex flex-col gap-3">
          <Auftrag level={level} aufgabe={feld.aufgabe} zustand={zustand} />
          {meldung && (
            <div role="status" className={`rounded-xl border-2 p-3 text-sm font-bold ${meldung.gut ? "border-ok text-ok" : "border-bad"}`}>
              {meldung.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Weltkarte ───────────────────────────────────────────────────────────── */

function Weltkarte({ stand, onLevel, onInfo }: { stand: Stand; onLevel: (id: string) => void; onInfo: (id: string) => void }) {
  const naechstesLevel = LEVEL.find(l => !stand[l.id])?.id;
  return (
    <div className="flex flex-col gap-5">
      {WELTEN.map(w => (
        <section key={w.nr} className="card p-4 flex flex-col gap-3">
          <h2 className="font-black text-lg">{w.icon} Welt {w.nr}: {w.titel}</h2>
          <div className="flex flex-wrap gap-2">
            {w.infos.map(id => {
              const info = infoNach(id)!;
              return (
                <button key={id} type="button" onClick={() => onInfo(id)}
                  className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-left hover:border-accent">
                  <span className="text-xs text-muted block">ℹ️ Infohappen</span>
                  <span className="font-bold">{info.icon} {info.titel}</span>
                </button>
              );
            })}
          </div>
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]">
            {LEVEL.filter(l => l.welt === w.nr).map((l, k) => (
              <button key={l.id} type="button" onClick={() => onLevel(l.id)}
                className={`rounded-xl border-2 px-3 py-2 text-left hover:border-accent
                  ${l.id === naechstesLevel ? "border-accent" : "border-line"}`}>
                <span className="text-xs text-muted block">Level {w.nr}.{k + 1}</span>
                <span className="font-bold block">{l.titel}</span>
                <Sterne n={stand[l.id] ?? 0} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── Ganzes Spiel ─────────────────────────────────────────────────────────── */

type Ansicht = { art: "karte" } | { art: "level"; id: string } | { art: "info"; id: string; zurueck?: string };

export default function KoordinatenLauf({ speicherSchluessel = "hp_koordinaten_stand", zurKarte = 0 }: {
  speicherSchluessel?: string;
  /** Jede Erhöhung führt zurück zur Weltkarte — der Reiter »Koordinaten-Lauf« zählt sie hoch. */
  zurKarte?: number;
}) {
  const [stand, setStand] = useState<Stand>({});
  const [ansicht, setAnsicht] = useState<Ansicht>({ art: "karte" });
  useEffect(() => { setAnsicht({ art: "karte" }); }, [zurKarte]);
  useEffect(() => { setStand(ladeStand(speicherSchluessel)); }, [speicherSchluessel]);

  // Gespeichert wird im Ereignis selbst, nicht per Effekt — sonst überschreibt
  // ein leerer Anfangsstand unter StrictMode den gespeicherten.
  const onErgebnis = useCallback((id: string, st: number) => {
    setStand(s => mitErgebnis(s, id, st));
    speichereStand(speicherSchluessel, mitErgebnis(ladeStand(speicherSchluessel), id, st));
  }, [speicherSchluessel]);

  const gesamt = Object.values(stand).reduce((a, b) => a + b, 0);
  const oben = () => typeof window !== "undefined" && window.scrollTo?.({ top: 0 });

  let inhalt: ReactNode;
  if (ansicht.art === "level") {
    const i = LEVEL.findIndex(l => l.id === ansicht.id);
    const level = LEVEL[i];
    const folge = LEVEL[i + 1];
    // Beginnt mit dem nächsten Level eine neue Welt, kommt erst ihr Infohappen.
    const onNaechstes = folge
      ? () => setAnsicht(folge.welt !== level.welt
        ? { art: "info", id: WELTEN.find(w => w.nr === folge.welt)!.infos[0], zurueck: folge.id }
        : { art: "level", id: folge.id })
      : null;
    inhalt = (
      <LevelAnsicht level={level} stand={stand} onErgebnis={onErgebnis}
        onKarte={() => setAnsicht({ art: "karte" })} onNaechstes={onNaechstes}
        onInfo={id => setAnsicht({ art: "info", id, zurueck: level.id })} />
    );
  } else if (ansicht.art === "info") {
    const info = infoNach(ansicht.id)!;
    const ziel = ansicht.zurueck ?? LEVEL.find(l => l.info.includes(info.id))?.id;
    inhalt = (
      <InfoAnsicht key={info.id} info={info}
        weiter={ziel ? { label: ansicht.zurueck ? "Zum Level" : "Zum ersten Level", los: () => { setAnsicht({ art: "level", id: ziel }); oben(); } } : undefined} />
    );
  } else {
    inhalt = (
      <Weltkarte stand={stand}
        onLevel={id => {
          const l = LEVEL.find(x => x.id === id)!;
          // Das allererste Level einer Welt beginnt mit ihrem Infohappen, solange es noch nicht gelöst ist.
          const erstes = LEVEL.find(x => x.welt === l.welt)!.id === id;
          setAnsicht(erstes && !stand[id] ? { art: "info", id: WELTEN.find(w => w.nr === l.welt)!.infos[0], zurueck: id } : { art: "level", id });
        }}
        onInfo={id => setAnsicht({ art: "info", id })} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted max-w-3xl">
          Erst laufen, dann springen: Die Figur läuft x ab und springt y hoch — unter der x-Achse taucht sie ab.
          So entstehen Punkte, Figuren, Spiegelbilder und am Ende ganze Geraden.
        </p>
        <span className="chip" data-testid="koordinaten-gesamt">
          <span className="text-amber-400">★</span> {gesamt} von {LEVEL.length * 3}
        </span>
      </div>
      {inhalt}
    </div>
  );
}

