"use client";
/**
 * Code-Abenteuer — das Levelspiel der Algorithmen-Werkstatt.
 *
 * Drei Arten von Leveln teilen sich eine Bühne:
 *   direkt      — Pfeiltasten + Enter, jeder Druck wird als Baustein mitgeschrieben
 *   Vorhersage  — Programm lesen, Endfeld anklicken und sagen, was dort passiert
 *   Programm    — mit Blockly bauen, dann ablaufen lassen
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEVEL, WELTEN, type Level } from "@/lib/algo/level";
import { THEMEN, fuelle, thema as themaVon, type ThemaId } from "@/lib/algo/themen";
import {
  ausgangVon, bausteine, direktSchritt, fuehreAus, mitIds, PFEIL, startVon, Welt,
  type Ausgang, type Befehl, type Ergebnis, type Fehler, type Lauf, type Programm, type Richtung, type Zustand,
} from "@/lib/algo/spiel";
import { levelWertung, richtzeitLevel, type Wertung } from "@/lib/algo/wertung";
import { HilfeLeiste, Sterne, useMessung, type Messung } from "./Hilfe";
import type { AlgoStand } from "@/lib/algo/fortschritt";
import Spielfeld from "./Spielfeld";
import BausteinAnsicht from "./Bausteine";
import Duell from "./Duell";
import BlocklyEditor from "./BlocklyEditor";
import FlussEditor from "./FlussEditor";
import { ausProgramm } from "@/lib/algo/fluss";

const LEER: Programm = { haupt: [], fn: [] };

function lies<T extends string>(k: string, erlaubt: readonly T[], vor: T): T {
  try { const v = localStorage.getItem(k); return v && (erlaubt as readonly string[]).includes(v) ? (v as T) : vor; } catch { return vor; }
}
function schreib(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* egal */ }
}

export const FEHLER_MARKE: Record<Fehler["art"], string> = {
  ausfuehrbar: "nicht ausführbar",
  endlich: "nicht endlich",
  gefahr: "Gefahr",
  gegner: "erwischt",
  reihenfolge: "falsche Reihenfolge",
  unfertig: "nicht fertig",
};

interface Erfolg { wertung: Wertung; bloecke: number; zeilen: string[] }
type Fertig = (bloecke: number) => void;

export default function CodeAbenteuer({ stand, onGeloest }: {
  stand: AlgoStand;
  onGeloest: (id: string, s: { sterne: number; bloecke: number; punkte: number }) => void;
}) {
  const [themaId, setThemaId] = useState<ThemaId>("cyber");
  const [levelId, setLevelId] = useState<string>(() => LEVEL.find(l => !stand.level[l.id])?.id ?? LEVEL[0].id);
  const [duell, setDuell] = useState(false);
  useEffect(() => {
    setThemaId(lies("hp_algo_thema", THEMEN.map(t => t.id), "cyber"));
  }, []);
  const thema = themaVon(themaId);
  const level = LEVEL.find(l => l.id === levelId)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-stretch">
        {THEMEN.map(t => (
          <button key={t.id} type="button" onClick={() => { setThemaId(t.id); schreib("hp_algo_thema", t.id); }}
            className={`rounded-xl border px-3 py-2 text-left transition-colors ${t.id === themaId ? "border-line-active bg-surface-hover" : "border-line bg-surface hover:bg-surface-hover"}`}>
            <div className="font-black text-sm">{t.figur ?? "🟡"} {t.name}</div>
            <div className="text-xs text-muted">{t.untertitel}</div>
          </button>
        ))}
      </div>

      <Weltkarte stand={stand} aktuell={duell ? "" : levelId} onWahl={id => { setDuell(false); setLevelId(id); }} duell={duell} onDuell={() => setDuell(true)} />

      {duell
        ? <Duell thema={thema} />
        : <LevelAnsicht key={`${level.id}`} level={level} thema={thema}
            onGeloest={s => onGeloest(level.id, s)}
            onWeiter={() => {
              const i = LEVEL.findIndex(l => l.id === level.id);
              if (i < LEVEL.length - 1) setLevelId(LEVEL[i + 1].id);
            }} />}
    </div>
  );
}

function Weltkarte({ stand, aktuell, onWahl, duell, onDuell }: {
  stand: AlgoStand; aktuell: string; onWahl: (id: string) => void; duell: boolean; onDuell: () => void;
}) {
  return (
    <div className="card p-3 flex flex-col gap-1.5" data-testid="algo-weltkarte">
      {WELTEN.map(w => (
        <div key={w.nr} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-muted w-44 shrink-0" title={w.idee}>{w.nr}. {w.titel}</span>
          {LEVEL.filter(l => l.welt === w.nr).map(l => {
            const st = stand.level[l.id];
            return (
              <button key={l.id} type="button" onClick={() => onWahl(l.id)} title={`${l.titel}${st?.punkte ? ` — ${st.punkte} Punkte` : ""}`}
                className={`rounded-lg border px-2 py-1 text-xs font-bold tabular-nums ${l.id === aktuell ? "border-line-active bg-surface-hover" : "border-line hover:bg-surface-hover"}`}>
                {l.id} <Sterne n={st?.sterne ?? 0} />
              </button>
            );
          })}
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-muted w-44 shrink-0">Extra</span>
        <button type="button" onClick={onDuell}
          className={`rounded-lg border px-2 py-1 text-xs font-bold ${duell ? "border-line-active bg-surface-hover" : "border-line hover:bg-surface-hover"}`}>
          ⚔️ Duell zu zweit
        </button>
      </div>
    </div>
  );
}

const uhr = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;

function LevelAnsicht({ level, thema, onGeloest, onWeiter }: {
  level: Level;
  thema: ReturnType<typeof themaVon>;
  onGeloest: (s: { sterne: number; bloecke: number; punkte: number }) => void;
  onWeiter: () => void;
}) {
  const art = level.modus === "direkt" ? "direkt" : level.vorhersage ? "vorhersage" : "programm";
  const richtzeit = richtzeitLevel(art, level.optimal);
  const m = useMessung(richtzeit);
  const [erfolg, setErfolg] = useState<Erfolg | null>(null);
  const tipp = fuelle(level.tipp ?? WELTEN.find(w => w.nr === level.welt)!.idee, thema);

  const fertig: Fertig = bloecke => {
    const b = art === "vorhersage" ? level.optimal : bloecke;
    const w = levelWertung({ ...m, bloecke: b, optimal: level.optimal, richtzeit });
    const zeilen = [
      art === "vorhersage" ? null : `${b} ${art === "direkt" ? "Tastendrücke" : "Bausteine"} (Bestzahl ${level.optimal})`,
      `${m.fehlversuche} Fehlversuch${m.fehlversuche === 1 ? "" : "e"}`,
      `Zeit ${uhr(m.sekunden)} (Richtzeit ${uhr(richtzeit * (m.hilfsmodus ? 2 : 1))})`,
      m.vorgefuehrt ? "Vorgeführt: halbe Punkte, höchstens ein Stern" : null,
    ].filter(Boolean) as string[];
    setErfolg({ wertung: w, bloecke: b, zeilen });
    onGeloest({ sterne: w.sterne, bloecke: b, punkte: w.punkte });
  };

  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-black">{level.id} · {fuelle(level.titel, thema)}</h2>
          <span className="text-xs text-muted">
            {level.karten.length > 1 && `${level.karten.length} Karten · `}
            {level.maxBloecke ? `höchstens ${level.maxBloecke} Bausteine · ` : ""}
            ★★★ {art === "vorhersage" ? "beim ersten Versuch" : `mit ${level.optimal} ${art === "direkt" ? "Tastendrücken" : "Bausteinen"} und höchstens einem Fehlversuch`}
          </span>
        </div>
        <p className="text-sm">{fuelle(level.text, thema)}</p>
      </section>
      {art === "direkt" && <Direkt level={level} thema={thema} m={m} tipp={tipp} fertig={fertig} />}
      {art === "vorhersage" && <Vorhersage level={level} thema={thema} m={m} tipp={tipp} fertig={fertig} />}
      {art === "programm" && <ProgrammLevel level={level} thema={thema} m={m} tipp={tipp} fertig={fertig} />}
      {erfolg && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setErfolg(null)}>
          <div className="card p-6 max-w-md w-full text-center flex flex-col gap-3" onClick={e => e.stopPropagation()} role="dialog" aria-label="Level geschafft">
            <Sterne n={erfolg.wertung.sterne} gross />
            <h3 className="text-xl font-black">Geschafft! {erfolg.wertung.punkte} Punkte</h3>
            <ul className="text-sm text-muted">{erfolg.zeilen.map(z => <li key={z}>{z}</li>)}</ul>
            {level.merke && <p className="text-sm rounded-lg bg-page border border-line p-3 text-left">📌 <b>Merke:</b> {fuelle(level.merke, thema)}</p>}
            <div className="flex gap-2 justify-center">
              <button type="button" className="btn-secondary" onClick={() => setErfolg(null)}>Nochmal</button>
              <button type="button" className="btn-primary" onClick={() => { setErfolg(null); onWeiter(); }}>Nächstes Level →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FehlerZeile({ f }: { f: Fehler }) {
  const merkmal = f.art === "ausfuehrbar" || f.art === "endlich";
  return (
    <div className="rounded-lg border border-bad/60 bg-bad/10 p-2 text-sm flex items-center gap-2 flex-wrap" role="alert">
      <span className={`rounded px-1.5 py-0.5 text-xs font-black ${merkmal ? "bg-bad text-white" : "bg-surface-hover"}`}>{FEHLER_MARKE[f.art]}</span>
      <span>{f.text}</span>
    </div>
  );
}

/** Die ersten Bausteine der Musterlösung — als konkreter Hinweis. */
function Anfang({ level, thema }: { level: Level; thema: ReturnType<typeof themaVon> }) {
  const k = Math.max(1, Math.ceil(level.loesung.haupt.length / 3));
  return (
    <span className="flex flex-col gap-1">
      <span>So fängt eine gute Lösung an:</span>
      <BausteinAnsicht prog={{ haupt: mitIds(level.loesung.haupt.slice(0, k)), fn: [] }} verb={thema.verb} />
    </span>
  );
}

interface KindProps { level: Level; thema: ReturnType<typeof themaVon>; m: Messung; tipp: string; fertig: Fertig }

// ── Direktsteuerung ─────────────────────────────────────────────────────

const TASTE: Record<string, Richtung> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

function Direkt({ level, thema, m, tipp, fertig }: KindProps) {
  const karte = level.karten[0];
  const welt = useRef(new Welt(karte));
  const [z, setZ] = useState<Zustand>(() => startVon(karte));
  const [zuege, setZuege] = useState<Befehl[]>([]);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const demo = useAbspielen();
  const neu = () => { welt.current = new Welt(karte); setZ(startVon(karte)); setZuege([]); setErgebnis(null); };

  const zug = useCallback((t: "geh" | "nimm", r?: Richtung) => {
    if (ergebnis || demo.lauf) return;
    const e = direktSchritt(welt.current, t, r);
    const w = welt.current;
    setZ({ ...w.schritte.at(-1)!, genommen: [...w.z.genommen], gegner: [...w.z.gegner], x: w.z.x, y: w.z.y, r: w.z.r });
    const neueZuege = [...zuege, ...mitIds([t === "geh" ? { t, r: r! } : { t }])];
    setZuege(neueZuege);
    if (e) {
      setErgebnis(e);
      if (e.ok) fertig(neueZuege.length);
      else m.fehler();
    }
  }, [ergebnis, zuege, fertig, m, demo.lauf]);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && /INPUT|TEXTAREA|SELECT/.test(ziel.tagName)) return;
      // Nur, solange das Spiel sichtbar ist (verborgene Reiter bleiben eingehängt).
      if (!huelle.current?.offsetParent) return;
      if (e.key in TASTE) { e.preventDefault(); zug("geh", TASTE[e.key]); }
      else if (e.key === "Enter") { e.preventDefault(); zug("nimm"); }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [zug]);

  // Nach dem Vorführen wieder von vorn
  useEffect(() => { if (demo.fertig) { demo.zurueck(); neu(); } }, [demo.fertig]); // eslint-disable-line react-hooks/exhaustive-deps

  const knopf = "w-12 h-12 rounded-xl bg-surface-hover border border-line text-xl font-black active:scale-95";
  const anzeige = demo.lauf ? demo.lauf.schritte[demo.i] : z;
  return (
    <div ref={huelle} className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
      <div className="flex flex-col gap-2">
        <Spielfeld karte={karte} z={anzeige} thema={thema} dauer={demo.lauf ? demo.tempo * 0.8 : 180} fehler={ergebnis?.ok === false} />
        {ergebnis && !ergebnis.ok && <FehlerZeile f={ergebnis.fehler} />}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="grid grid-cols-3 gap-1 w-fit" aria-label="Steuerkreuz">
            <span /><button type="button" className={knopf} onClick={() => zug("geh", 0)} aria-label="hoch">↑</button><span />
            <button type="button" className={knopf} onClick={() => zug("geh", 3)} aria-label="links">←</button>
            <button type="button" className={knopf} onClick={() => zug("nimm")} aria-label={thema.verb}>✋</button>
            <button type="button" className={knopf} onClick={() => zug("geh", 1)} aria-label="rechts">→</button>
            <span /><button type="button" className={knopf} onClick={() => zug("geh", 2)} aria-label="runter">↓</button><span />
          </div>
          <div className="text-sm text-muted flex-1 min-w-40">
            Pfeiltasten bewegen, <b>Enter</b> (oder ✋) heißt »{thema.verb}«.
            <button type="button" className="btn-secondary mt-2 block" onClick={neu}>⟲ Von vorn</button>
          </div>
        </div>
        <HilfeLeiste m={m} tipp={tipp}
          hinweis={<>Die ersten Tasten: <b className="text-lg">{level.loesung.haupt.slice(0, 3).map(b => (b.t === "geh" ? PFEIL[b.r] : "✋")).join(" ")}</b></>}
          onVorfuehren={() => { neu(); demo.starte([{ lauf: fuehreAus(karte, level.loesung) }]); }} />
      </div>
      <div className="card p-3 flex flex-col gap-2">
        <div className="text-sm font-bold">📝 Mitgeschrieben: {zuege.length} Schritte</div>
        <p className="text-xs text-muted">Jeder Tastendruck ist ein Baustein. Zusammen ergeben sie dein Programm.</p>
        <BausteinAnsicht prog={{ haupt: zuege, fn: [] }} verb={thema.verb} aktiv={zuege.at(-1)?.id} />
      </div>
    </div>
  );
}

// ── Vorhersage ──────────────────────────────────────────────────────────

const AUSGAENGE: { id: Ausgang; text: (t: ReturnType<typeof themaVon>) => string }[] = [
  { id: "geschafft", text: t => `${fuelle("{Held}", t)} schafft alles.` },
  { id: "leer", text: t => `${fuelle("{Held}", t)} will ${t.verb} — aber da liegt nichts (nicht ausführbar).` },
  { id: "wand", text: t => `${fuelle("{Held}", t)} läuft gegen eine Wand (nicht ausführbar).` },
  { id: "unfertig", text: () => "Das Programm hört auf, bevor alles erledigt ist." },
];

function Vorhersage({ level, thema, m, tipp, fertig }: KindProps) {
  const karte = level.karten[0];
  const prog = useMemo(() => ({ haupt: mitIds(level.vorhersage!.haupt), fn: mitIds(level.vorhersage!.fn) }), [level]);
  const lauf = useMemo(() => fuehreAus(karte, prog), [karte, prog]);
  const ende = lauf.schritte.at(-1)!;
  const richtigerAusgang = ausgangVon(lauf);
  const [feld, setFeld] = useState<{ x: number; y: number; ok: boolean } | null>(null);
  const [ausgang, setAusgang] = useState<{ id: Ausgang; ok: boolean } | null>(null);
  const abspiel = useAbspielen();
  const geloest = feld?.ok && ausgang?.ok;

  const pruefe = (f: typeof feld, a: typeof ausgang) => { if (f?.ok && a?.ok) fertig(level.optimal); };
  const klick = (x: number, y: number) => {
    if (feld?.ok) return;
    const ok = x === ende.x && y === ende.y;
    if (!ok) m.fehler();
    const f = { x, y, ok };
    setFeld(f);
    pruefe(f, ausgang);
  };
  const waehle = (id: Ausgang) => {
    if (ausgang?.ok) return;
    const ok = id === richtigerAusgang;
    if (!ok) m.fehler();
    const a = { id, ok };
    setAusgang(a);
    pruefe(feld, a);
  };

  const z = abspiel.lauf ? abspiel.lauf.schritte[abspiel.i] : startVon(karte);
  return (
    <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
      <div className="flex flex-col gap-2">
        <Spielfeld karte={karte} z={z} thema={thema} dauer={abspiel.tempo * 0.8} onFeld={abspiel.lauf ? undefined : klick} markiert={abspiel.lauf ? null : feld} />
        <p className="text-sm">
          <b>1.</b> Wo steht {fuelle("{held}", thema)} am Ende? Feld anklicken.{" "}
          {feld && (feld.ok ? <span className="text-ok font-bold">Richtig!</span> : <span className="text-bad">Nicht ganz — geh das Programm mit dem Finger durch.</span>)}
        </p>
        <div className="flex flex-col gap-1">
          <p className="text-sm"><b>2.</b> Und was passiert dort?</p>
          {AUSGAENGE.map(a => (
            <button key={a.id} type="button" onClick={() => waehle(a.id)}
              className={`text-left text-sm rounded-lg border px-3 py-1.5 ${ausgang?.id === a.id ? (ausgang.ok ? "border-ok bg-ok/10" : "border-bad bg-bad/10") : "border-line hover:bg-surface-hover"}`}>
              {a.text(thema)}
            </button>
          ))}
        </div>
        {geloest && <button type="button" className="btn-secondary self-start" onClick={() => abspiel.starte([{ lauf }])}>▶ Ablauf ansehen</button>}
        <HilfeLeiste m={m} tipp={tipp}
          hinweis="Lege den Finger auf die Figur und gehe jeden Baustein einzeln. Beim letzten Baustein: Liegt auf diesem Feld wirklich etwas? Ist das nächste Feld frei?"
          onVorfuehren={() => abspiel.starte([{ lauf }])} />
      </div>
      <div className="card p-3 flex flex-col gap-2">
        <div className="text-sm font-bold">📜 Das Programm</div>
        <BausteinAnsicht prog={prog} verb={thema.verb} aktiv={abspiel.lauf ? z.aktiv : undefined} />
      </div>
    </div>
  );
}

// ── Programm bauen und ablaufen lassen ──────────────────────────────────

/** Spielt einen oder mehrere Läufe nacheinander ab. */
function useAbspielen() {
  const [laeufe, setLaeufe] = useState<{ lauf: Lauf }[]>([]);
  const [nr, setNr] = useState(0);
  const [i, setI] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(350);
  const [fertig, setFertig] = useState(false);
  const lauf = laeufe[nr]?.lauf ?? null;

  useEffect(() => {
    if (!laeuft || !lauf) return;
    if (i >= lauf.schritte.length - 1) {
      if (lauf.ergebnis.ok && nr < laeufe.length - 1) {
        const t = setTimeout(() => { setNr(nr + 1); setI(0); }, 700);
        return () => clearTimeout(t);
      }
      setLaeuft(false);
      setFertig(true);
      return;
    }
    const nurSensor = lauf.schritte[i].scan && lauf.schritte[i].scan!.art !== "nimm";
    const t = setTimeout(() => setI(i + 1), nurSensor ? tempo * 0.6 : tempo);
    return () => clearTimeout(t);
  }, [laeuft, lauf, i, nr, laeufe.length, tempo]);

  return {
    lauf, nr, i, laeuft, tempo, setTempo, fertig,
    starte: (l: { lauf: Lauf }[]) => { setLaeufe(l); setNr(0); setI(0); setFertig(false); setLaeuft(true); },
    /** Einzelschritt: beginnt bei Bedarf und hält an */
    schritt: (l: () => { lauf: Lauf }[]) => {
      if (!lauf || fertig) { setLaeufe(l()); setNr(0); setI(0); setFertig(false); setLaeuft(false); return; }
      setLaeuft(false);
      if (i < lauf.schritte.length - 1) setI(i + 1);
      else if (lauf.ergebnis.ok && nr < laeufe.length - 1) { setNr(nr + 1); setI(0); }
      else setFertig(true);
    },
    halt: () => setLaeuft(false),
    weiter: () => setLaeuft(true),
    zurueck: () => { setLaeufe([]); setNr(0); setI(0); setLaeuft(false); setFertig(false); },
  };
}

function ProgrammLevel({ level, thema, m, tipp, fertig }: KindProps) {
  const speicher = `hp_algo_entwurf_${level.id}`;
  const [prog, setProg] = useState<Programm>(() => level.vorlage ?? LEER);
  const [geladen, setGeladen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [variante, setVariante] = useState(0);
  /** läuft gerade die Vorführung der Musterlösung? Dann zählt das Ergebnis nicht. */
  const [demo, setDemo] = useState<"aus" | "laeuft" | "fertig">("aus");
  const loesung = useMemo(() => ({ haupt: mitIds(level.loesung.haupt), fn: mitIds(level.loesung.fn) }), [level]);
  const abspiel = useAbspielen();
  const gemeldet = useRef(false);

  useEffect(() => {
    try {
      const roh = localStorage.getItem(speicher);
      if (roh) { const p = JSON.parse(roh); if (p?.haupt) { setProg({ haupt: mitIds(p.haupt), fn: mitIds(p.fn ?? []) }); setEditorKey(k => k + 1); } }
      else if (level.vorlage) setProg({ haupt: mitIds(level.vorlage.haupt), fn: mitIds(level.vorlage.fn) });
    } catch { /* egal */ }
    setGeladen(true);
  }, [speicher, level.vorlage]);

  const aendern = (p: Programm) => {
    setProg(p);
    if (geladen) try { localStorage.setItem(speicher, JSON.stringify(p)); } catch { /* egal */ }
    if (abspiel.lauf) abspiel.zurueck();
    if (demo === "laeuft") setDemo("fertig");
  };

  const anzahl = bausteine(prog);
  const zuViele = level.maxBloecke !== undefined && anzahl > level.maxBloecke;
  const laeufe = () => level.karten.map(k => ({ lauf: fuehreAus(k, prog) }));

  // Ergebnis melden, sobald das Abspielen fertig ist (die Vorführung zählt nicht)
  const letzter = abspiel.lauf;
  const allesOk = abspiel.fertig && letzter?.ergebnis.ok && abspiel.nr === level.karten.length - 1;
  useEffect(() => {
    if (!abspiel.fertig) { gemeldet.current = false; return; }
    if (gemeldet.current) return;
    gemeldet.current = true;
    if (demo === "laeuft") { setDemo("fertig"); return; }
    if (allesOk) fertig(anzahl);
    else m.fehler();
  }, [abspiel.fertig, allesOk, anzahl, fertig, m, demo]);

  const karteNr = abspiel.lauf ? abspiel.nr : variante;
  const karte = level.karten[karteNr];
  const z = abspiel.lauf ? abspiel.lauf.schritte[abspiel.i] : startVon(karte);
  const fehler = demo !== "laeuft" && abspiel.fertig && letzter && !letzter.ergebnis.ok ? letzter.ergebnis.fehler : null;

  const editorProps = { prog, onChange: aendern, erlaubt: level.bloecke, bedingungen: level.bedingungen, verb: thema.verb, aktiv: abspiel.lauf && demo !== "laeuft" ? z.aktiv : undefined };
  return (
    <div className="flex flex-col gap-4">
    <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 items-start">
      <div className="flex flex-col gap-2">
        {level.karten.length > 1 && (
          <div className="flex gap-1">
            {level.karten.map((_, i) => (
              <button key={i} type="button" onClick={() => { abspiel.zurueck(); setVariante(i); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold border ${i === karteNr ? "bg-accent text-accent-fg border-transparent" : "border-line text-muted"}`}>
                Karte {i + 1}
              </button>
            ))}
          </div>
        )}
        <Spielfeld karte={karte} z={z} thema={thema} dauer={abspiel.tempo * 0.8} fehler={!!fehler} />
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        {fehler && <FehlerZeile f={fehler} />}
        <div className="flex items-center gap-2 flex-wrap">
          {abspiel.laeuft
            ? <button type="button" className="btn-secondary" onClick={abspiel.halt}>⏸ Pause</button>
            : abspiel.lauf && !abspiel.fertig
              ? <button type="button" className="btn-primary" onClick={abspiel.weiter}>▶ Weiter</button>
              : <button type="button" className="btn-primary" disabled={zuViele || anzahl === 0} onClick={() => { setDemo(d => (d === "laeuft" ? "fertig" : d)); abspiel.starte(laeufe()); }}>▶ Start</button>}
          <button type="button" className="btn-secondary" disabled={zuViele || anzahl === 0} onClick={() => abspiel.schritt(laeufe)}>⏭ Schritt</button>
          <button type="button" className="btn-secondary" onClick={abspiel.zurueck}>⟲ Zurück</button>
          <label className="text-xs text-muted flex items-center gap-1 ml-auto">🐢
            <input type="range" min={80} max={900} step={20} value={980 - abspiel.tempo} onChange={e => abspiel.setTempo(980 - +e.target.value)} />🐇
          </label>
        </div>
        <HilfeLeiste m={m} tipp={tipp} hinweis={<Anfang level={level} thema={thema} />}
          onVorfuehren={() => { setDemo("laeuft"); abspiel.starte(level.karten.map(k => ({ lauf: fuehreAus(k, loesung) }))); }} />
        {demo !== "aus" && (
          <div className="card p-3 flex flex-col gap-2 text-sm">
            <div className="font-bold">🎬 So geht es{demo === "laeuft" ? " — schau zu:" : ":"}</div>
            <BausteinAnsicht prog={loesung} verb={thema.verb} aktiv={demo === "laeuft" ? z.aktiv : undefined} />
            {demo === "fertig" && (
              <button type="button" className="btn-secondary self-start"
                onClick={() => { aendern({ haupt: mitIds(level.loesung.haupt), fn: mitIds(level.loesung.fn) }); setEditorKey(k => k + 1); setDemo("aus"); }}>
                📋 In meinen Editor übernehmen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className={zuViele ? "text-bad font-bold" : "text-muted"}>
            {anzahl}{level.maxBloecke ? ` / ${level.maxBloecke}` : ""} Bausteine
          </span>
          <button type="button" className="ml-auto text-xs underline text-muted"
            onClick={() => { aendern(level.vorlage ? { haupt: mitIds(level.vorlage.haupt), fn: mitIds(level.vorlage.fn) } : LEER); setEditorKey(k => k + 1); }}>
            {level.vorlage ? "Vorlage wiederherstellen" : "Alles löschen"}
          </button>
        </div>
        <BlocklyEditor key={`${editorKey}-${geladen}`} {...editorProps} />
        {anzahl > 0 && !level.bloecke.includes("rufe") && (
          <details className="card p-2 text-sm">
            <summary className="cursor-pointer font-bold">🔀 Mein Programm als Flussdiagramm</summary>
            <div className="mt-2"><FlussEditor d={ausProgramm(prog)} modus="lesen" /></div>
          </details>
        )}
      </div>
    </div>
  );
}
