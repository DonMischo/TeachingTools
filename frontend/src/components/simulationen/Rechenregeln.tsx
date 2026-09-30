"use client";
/**
 * Rechenregeln — Klammern vor Punkt vor Strich, Vertauschen, Stufenzahlen.
 *
 * Drei Bilder für dieselbe Sache, jedes für eine Regel:
 *
 *   🍎 Obstkorb   Ein Produkt *ist* ein Korb: »3 · 4« sind drei Körbe mit je
 *                 vier Äpfeln. Solange die Körbe zu sind, kann man nichts
 *                 zusammenzählen — Punkt vor Strich wird damit keine Vorschrift,
 *                 sondern etwas, das man sieht. Klammern sind Kisten drumherum.
 *   🚂 Rechenzug  Derselbe Term als Zug: · und : kuppeln fest, + und − lose.
 *                 Waggons tauschen die Plätze, das Gewicht (das Ergebnis)
 *                 bleibt — oder eben nicht, und genau das ist die Lehre.
 *   🎚️ Stufenzahlen  »Eine Null anhängen« ist kein Zauberspruch, sondern ein
 *                 Rutschen auf der Stellenwerttafel.
 *
 * Gerechnet wird in `@/lib/rechenregeln`; hier steht nur das Bild.
 */
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { text, wahl, zahl, type Vorgabe } from "@/lib/vorgabe";
import {
  parse, render, wert, wertVonLinks, naechster, kandidaten, anwenden, begruendung,
  brauchtKlammer, opZeichen, fmt, wuerfelnTerm, wuerfelnZug, wuerfelnStufen,
  zugAusTerm, zugTerm, zugWert, gruppen, tauscheZahlen, tauscheGruppen,
  zerlegeStufen, ziffernNachStellen, tafelBereich, neueStellen, zahlAusText,
  STELLEN_NAMEN, RechenError,
  type Node, type Op, type Pfad, type Zug, type StufenModus, type Rechenart,
} from "@/lib/rechenregeln";

type Reiter = "korb" | "zug" | "stufen";

const REITER: { id: Reiter; icon: string; titel: string }[] = [
  { id: "korb", icon: "🍎", titel: "Obstkorb" },
  { id: "zug", icon: "🚂", titel: "Rechenzug" },
  { id: "stufen", icon: "🎚️", titel: "Stufenzahlen" },
];

const FRUECHTE = ["🍎", "🍐", "🍊", "🍓", "🍌", "🍇", "🍑", "🥝"];

function fehlertext(e: unknown): string {
  return e instanceof RechenError ? e.message : "Das kann ich nicht lesen.";
}

/* ─────────────────────────────────────────────────────────── Bausteine ── */

function Knopf({ an, onClick, children, klein }: {
  an?: boolean; onClick: () => void; children: ReactNode; klein?: boolean;
}) {
  return (
    <button
      // Ohne das ist der Knopf in einem Formular ein Absende-Knopf: der Klick
      // löst dann onClick *und* onSubmit aus, und der Punktestand zählte doppelt.
      type="button"
      onClick={onClick}
      className={`rounded-xl border font-bold transition-colors ${klein ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
        an
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      {children}
    </button>
  );
}

const STUFEN = ["1", "2", "3", "4"].map(id => ({ id, label: `Stufe ${id}` }));

/**
 * Aufgaben würfeln — auf allen drei Reitern dasselbe Muster.
 *
 * Der Würfel steht als eigener Knopf da: dass ein zweiter Klick auf dieselbe
 * Stufe neu würfelt, sieht man ihr nicht an. Die Stufenknöpfe wechseln die
 * Sorte Aufgabe und würfeln dabei ebenfalls.
 */
function Aufgabenleiste({ stufen, aktiv, onWaehle, onNeu, hinweis }: {
  stufen: { id: string; label: string }[];
  aktiv: string;
  onWaehle: (id: string) => void;
  onNeu: () => void;
  hinweis?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Knopf an onClick={onNeu}>🎲 Neue Aufgabe</Knopf>
      <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Sorte</span>
      {stufen.map(s => (
        <Knopf key={s.id} an={s.id === aktiv} onClick={() => onWaehle(s.id)}>{s.label}</Knopf>
      ))}
      {hinweis && <span className="text-xs text-[var(--text-muted)]">{hinweis}</span>}
    </div>
  );
}

function Eigenes({ platzhalter, onSubmit, fehler }: {
  platzhalter: string; onSubmit: (s: string) => void; fehler: string | null;
}) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-1">
      <form
        className="flex items-center gap-2"
        onSubmit={e => { e.preventDefault(); onSubmit(text); }}
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={platzhalter}
          aria-label="Eigener Term"
          className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]
            text-sm font-mono w-56 focus:outline-none focus:border-[var(--accent)]"
        />
        <Knopf onClick={() => onSubmit(text)}>Übernehmen</Knopf>
      </form>
      {fehler && <span className="text-xs text-red-500">{fehler}</span>}
    </div>
  );
}

/* ─────────────────────────────────────────── Selbst rechnen & zählen ── */

/**
 * Erst selbst rechnen, dann nachsehen.
 *
 * Gezählt wird nur der *erste* Versuch je Aufgabe. Wer nachbessert, soll das
 * dürfen — der Punktestand soll aber nicht davon abhängen, wie oft jemand
 * probiert hat. Bei einer falschen Antwort steht die Lösung ausdrücklich
 * nicht da: nachgerechnet wird am Bild, dafür ist es gebaut.
 */
function Loesungsfeld({ loesung, onGeprueft, onZeigen }: {
  loesung: number;
  onGeprueft: (richtig: boolean) => void;
  /** Aufgeben — gibt die Lösung frei, ohne sie zu zählen. */
  onZeigen?: () => void;
}) {
  const [text, setText] = useState("");
  const [urteil, setUrteil] = useState<"richtig" | "falsch" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gezaehlt, setGezaehlt] = useState(false);

  function pruefe() {
    const v = zahlAusText(text);
    if (v === null) {
      setFehler("Da fehlt noch eine Zahl.");
      return;
    }
    setFehler(null);
    const richtig = Math.abs(v - loesung) < 1e-9;
    setUrteil(richtig ? "richtig" : "falsch");
    if (!gezaehlt) {
      setGezaehlt(true);
      onGeprueft(richtig);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <form className="flex flex-wrap items-center gap-2"
        onSubmit={e => { e.preventDefault(); pruefe(); }}>
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Dein Ergebnis</span>
        <input
          value={text}
          onChange={e => { setText(e.target.value); setUrteil(null); }}
          // Die Knöpfe sind alle type="button", also gibt es kein Absenden per
          // Eingabetaste mehr — die will man hier aber haben.
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); pruefe(); } }}
          inputMode="decimal"
          placeholder="?"
          aria-label="Dein Ergebnis"
          className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]
            text-sm font-mono w-28 focus:outline-none focus:border-[var(--accent)]"
        />
        <Knopf onClick={pruefe} klein>Prüfen</Knopf>
        {onZeigen && !urteil && <Knopf onClick={onZeigen} klein>Lösung zeigen</Knopf>}
      </form>
      {fehler && <span className="text-xs text-red-500">{fehler}</span>}
      {urteil === "richtig" && (
        <span className="text-sm font-bold text-green-600 dark:text-green-400">✔ Richtig!</span>
      )}
      {urteil === "falsch" && (
        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
          ✘ Noch nicht — rechne am Bild nach und probier es noch einmal.
        </span>
      )}
    </div>
  );
}

/** Wie viele Antworten sassen — für die ganze Sitzung, über die Reiter hinweg. */
export type Punktestand = { richtig: number; gesamt: number; serie: number; beste: number };

const LEER: Punktestand = { richtig: 0, gesamt: 0, serie: 0, beste: 0 };

function zaehle(p: Punktestand, richtig: boolean): Punktestand {
  const serie = richtig ? p.serie + 1 : 0;
  return {
    richtig: p.richtig + (richtig ? 1 : 0),
    gesamt: p.gesamt + 1,
    serie,
    beste: Math.max(p.beste, serie),
  };
}

function Punkteleiste({ p, onReset }: { p: Punktestand; onReset: () => void }) {
  if (!p.gesamt) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        Tipp dein Ergebnis ein, bevor du nachsiehst — dann wird mitgezählt.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span aria-label="Punktestand" className="font-black">
        ✔ {p.richtig} von {p.gesamt} richtig
      </span>
      <span className="text-[var(--text-muted)]">
        · Serie {p.serie}{p.beste > p.serie && ` (beste ${p.beste})`}
      </span>
      <Knopf onClick={onReset} klein>↺ Zähler</Knopf>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── Obstkorb 🍎 ── */

/** Ein Haufen Obst. Ab 24 Stück wird gezählt statt gelegt — sonst füllt es die Tafel. */
function Haufen({ n, frucht }: { n: number; frucht: string }) {
  if (n > 24) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--surface-hover)] text-sm font-bold">
        {n} × <span className="text-lg">{frucht}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap justify-center gap-0.5 max-w-[7.5rem]" aria-hidden>
      {Array.from({ length: n }, (_, i) => <span key={i} className="text-lg leading-none">{frucht}</span>)}
    </span>
  );
}

function Korb({ inhalt, frucht }: { inhalt: number; frucht: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5 px-1.5 pt-1 pb-0.5 rounded-b-2xl rounded-t-md
      border-2 border-amber-600/60 bg-amber-500/10">
      <Haufen n={inhalt} frucht={frucht} />
      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-500">je {inhalt}</span>
    </span>
  );
}

function Teller({ inhalt, frucht }: { inhalt: number; frucht: string }) {
  return (
    <span className="flex flex-col items-center px-2 py-1 rounded-full border-2 border-sky-500/50 bg-sky-500/10">
      <Haufen n={inhalt} frucht={frucht} />
    </span>
  );
}

/** Das Bild einer Rechnung, deren beide Zahlen schon feststehen. */
function Rechnung({ op, a, b, frucht }: { op: Op; a: number; b: number; frucht: string }) {
  if (op === "*") {
    const zuViel = a > 8 || a * b > 60;
    return zuViel
      ? <span className="text-sm font-bold">{a} Körbe mit je {b} {frucht}</span>
      : <span className="flex items-end gap-1 flex-wrap justify-center">
          {Array.from({ length: a }, (_, i) => <Korb key={i} inhalt={b} frucht={frucht} />)}
        </span>;
  }
  if (op === ":") {
    const teilbar = b > 0 && Number.isInteger(a / b) && b <= 8 && a <= 48;
    return teilbar
      ? <span className="flex items-center gap-1 flex-wrap justify-center">
          {Array.from({ length: b }, (_, i) => <Teller key={i} inhalt={a / b} frucht={frucht} />)}
        </span>
      : <span className="text-sm font-bold">{fmt(a)} verteilt auf {fmt(b)}</span>;
  }
  if (op === "-") {
    // Wegnehmen: die letzten b Früchte liegen blass da — sie kommen weg.
    const zeigbar = a <= 24;
    return zeigbar
      ? <span className="inline-flex flex-wrap justify-center gap-0.5 max-w-[9rem]">
          {Array.from({ length: a }, (_, i) => (
            <span key={i} className={`text-lg leading-none ${i >= a - b ? "opacity-25 grayscale" : ""}`}>{frucht}</span>
          ))}
        </span>
      : <span className="text-sm font-bold">{fmt(a)} weniger {fmt(b)}</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      <Haufen n={a} frucht={frucht} />
      <span className="text-lg font-black text-[var(--text-muted)]">+</span>
      <Haufen n={b} frucht={frucht} />
    </span>
  );
}

function Bild({ n, pfad, dranPfad, frucht, onTipp }: {
  n: Node; pfad: Pfad; dranPfad: Pfad | null; frucht: string; onTipp: (p: Pfad) => void;
}) {
  if (n.k === "num") {
    return (
      <span className="flex flex-col items-center gap-1 px-2 py-1.5">
        <Haufen n={n.v} frucht={frucht} />
        <span className="text-base font-black">{fmt(n.v)}</span>
      </span>
    );
  }

  if (n.a.k === "num" && n.b.k === "num") {
    const dran = pfad === dranPfad;
    return (
      <button
        onClick={() => onTipp(pfad)}
        title="Antippen und ausrechnen"
        className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-2xl border-2 transition-all ${
          dran
            ? "border-[var(--accent)] bg-[var(--accent)]/10 shadow-lg animate-pulse"
            : "border-dashed border-[var(--border)] hover:border-[var(--accent)]/60"
        }`}
      >
        <Rechnung op={n.op} a={n.a.v} b={n.b.v} frucht={frucht} />
        <span className="text-sm font-black font-mono">
          {fmt(n.a.v)} {opZeichen(n.op)} {fmt(n.b.v)}
        </span>
      </button>
    );
  }

  const seite = (kind: Node, s: "a" | "b") => {
    const inhalt = <Bild n={kind} pfad={pfad + s} dranPfad={dranPfad} frucht={frucht} onTipp={onTipp} />;
    if (!brauchtKlammer(n.op, s, kind)) return inhalt;
    return (
      <span className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border-2 border-violet-500/50 bg-violet-500/5">
        {inhalt}
        <span className="text-[10px] font-bold uppercase tracking-wide text-violet-500">📦 Kiste</span>
      </span>
    );
  };

  return (
    <span className="flex items-center gap-2 flex-wrap justify-center">
      {seite(n.a, "a")}
      <span className="text-3xl sm:text-4xl font-black text-[var(--text-muted)] px-1">{opZeichen(n.op)}</span>
      {seite(n.b, "b")}
    </span>
  );
}

/** Ein fester Term gilt nur, wenn er sich lesen und ausrechnen lässt. */
function lesbar(term: string | undefined): string | undefined {
  if (!term) return undefined;
  try { return Number.isFinite(wert(parse(term))) ? term : undefined; } catch { return undefined; }
}

function Obstkorb({ melde, fest }: { melde: (richtig: boolean) => void; fest?: string }) {
  const anfang = lesbar(fest) ?? "2 + 3 · 4";
  const [stufe, setStufe] = useState("1");
  const [src, setSrc] = useState(anfang);
  const [baum, setBaum] = useState<Node>(() => parse(anfang));
  const [verlauf, setVerlauf] = useState<Node[]>([]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [frucht, setFrucht] = useState(FRUECHTE[0]);

  const dran = naechster(baum);
  const bereit = kandidaten(baum);
  const grund = dran ? begruendung(baum, dran) : null;
  const fertig = baum.k === "num";
  const linksRechts = useMemo(() => { try { return wertVonLinks(src); } catch { return null; } }, [src]);
  const richtig = useMemo(() => { try { return wert(parse(src)); } catch { return null; } }, [src]);

  function neu(term: string) {
    setSrc(term);
    setBaum(parse(term));
    setVerlauf([]);
    setHinweis(null);
    setFrucht(FRUECHTE[Math.floor(Math.random() * FRUECHTE.length)]);
  }

  function wuerfeln(s: string) {
    setStufe(s);
    setFehler(null);
    neu(wuerfelnTerm(Number(s), src));
  }

  function eigenes(text: string) {
    try {
      const baumNeu = parse(text);
      if (!Number.isFinite(wert(baumNeu))) throw new RechenError("Das geht nicht auf.");
      setFehler(null);
      neu(render(baumNeu));
    } catch (e) {
      setFehler(fehlertext(e));
    }
  }

  function tipp(pfad: Pfad) {
    if (!dran) return;
    if (pfad !== dran.pfad) {
      const k = bereit.find(c => c.pfad === pfad);
      setHinweis(k
        ? `Noch nicht — ${begruendung(baum, dran)}: erst ${fmt(dran.a)} ${opZeichen(dran.op)} ${fmt(dran.b)}.`
        : "Hier stehen noch nicht beide Zahlen fest.");
      return;
    }
    setHinweis(null);
    setVerlauf(v => [...v, baum]);
    setBaum(anwenden(baum, pfad));
  }

  function zurueck() {
    setVerlauf(v => {
      if (!v.length) return v;
      setBaum(v[v.length - 1]);
      setHinweis(null);
      return v.slice(0, -1);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {!fest && <>
      <Aufgabenleiste
        stufen={STUFEN} aktiv={stufe} onWaehle={wuerfeln} onNeu={() => wuerfeln(stufe)}
        hinweis={Number(stufe) <= 2 ? "Punkt vor Strich" : "mit Klammern"} />
      <Eigenes platzhalter="z. B. 2 + (3 + 4) · 5" onSubmit={eigenes} fehler={fehler} />
      </>}

      {/* Termzeile */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <span aria-label="Term" className="text-2xl sm:text-3xl font-black font-mono tracking-tight">{render(baum)}</span>
        {dran && (
          <span className="px-2.5 py-1 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-bold">
            als Nächstes: {fmt(dran.a)} {opZeichen(dran.op)} {fmt(dran.b)} — {grund}
          </span>
        )}
        <span className="flex-1" />
        {dran && <Knopf onClick={() => tipp(dran.pfad)} klein>▶︎ Schritt</Knopf>}
        {verlauf.length > 0 && <Knopf onClick={zurueck} klein>↶ zurück</Knopf>}
        <Knopf onClick={() => neu(src)} klein>↺ von vorn</Knopf>
      </div>

      {/* Erst selbst rechnen — solange der Term noch nicht ausgerechnet dasteht. */}
      {!fertig && richtig !== null && (
        <Loesungsfeld key={src} loesung={richtig} onGeprueft={melde} />
      )}

      {/* Bühne */}
      <div className="p-4 sm:p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
        <div className="min-w-fit flex justify-center">
          <Bild n={baum} pfad="" dranPfad={dran?.pfad ?? null} frucht={frucht} onTipp={tipp} />
        </div>
      </div>

      {hinweis && (
        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">✋ {hinweis}</p>
      )}

      {fertig && (
        <div className="p-4 rounded-2xl border-2 border-green-500/50 bg-green-500/10 flex flex-col gap-1">
          <p className="font-black text-lg">✅ {src} = {render(baum)}</p>
          {linksRechts !== null && richtig !== null && linksRechts !== richtig && (
            <p className="text-sm text-[var(--text-muted)]">
              Wer stur von links nach rechts rechnet, kommt auf {fmt(linksRechts)} — falsch.
              Die Körbe müssen erst ausgekippt werden: {fmt(richtig)}.
            </p>
          )}
        </div>
      )}

      {!fertig && verlauf.length > 0 && (
        <ol className="text-sm font-mono text-[var(--text-muted)] flex flex-col gap-0.5">
          {verlauf.map((v, i) => <li key={i}>{render(v)}</li>)}
        </ol>
      )}

      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        🧺 Ein Malpunkt ist ein Korb: »3 · 4« sind drei Körbe mit je vier Früchten. Zusammenzählen
        lässt sich erst, was auf dem Tisch liegt — deshalb Punkt vor Strich. Eine Klammer ist eine
        Kiste: was drin ist, wird zuerst gepackt.
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── Zug 🚂 ── */

type Auswahl = { art: "wagen" | "gruppe"; i: number } | null;

function Waggon({ v, an, onClick }: { v: number; an: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center transition-transform ${an ? "-translate-y-1.5" : ""}`}
    >
      <span className={`flex items-center justify-center w-16 h-14 rounded-lg border-2 text-2xl font-black ${
        an
          ? "border-[var(--accent)] bg-[var(--accent)]/15 shadow-lg"
          : "border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--accent)]/60"
      }`}>
        {fmt(v)}
      </span>
      <span className="flex gap-5 -mt-1.5" aria-hidden>
        <span className="w-3.5 h-3.5 rounded-full bg-[var(--text-muted)]/60" />
        <span className="w-3.5 h-3.5 rounded-full bg-[var(--text-muted)]/60" />
      </span>
    </button>
  );
}

function Rechenzug({ fest }: { fest?: string }) {
  const [stufe, setStufe] = useState("1");
  const [anfang] = useState(() => {
    if (fest) try { zugAusTerm(fest); return fest; } catch { /* dann die Vorlage */ }
    return "3 · 4 + 5";
  });
  const [start, setStart] = useState<Zug>(() => zugAusTerm(anfang));
  const [zug, setZug] = useState<Zug>(() => zugAusTerm(anfang));
  const [auswahl, setAuswahl] = useState<Auswahl>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  // Warum es diesmal schiefging — beim Tauschen gemerkt, denn hinterher sieht
  // man dem Term nicht mehr an, was gegen was getauscht wurde.
  const [grund, setGrund] = useState("");

  const gs = gruppen(zug);
  const wertStart = zugWert(start);
  const wertJetzt = zugWert(zug);
  const gleich = wertStart === wertJetzt;
  const veraendert = zugTerm(zug) !== zugTerm(start);

  function neu(z: Zug) {
    setStart(z); setZug(z); setAuswahl(null); setMeldung(null);
  }

  function wuerfeln(s: string) {
    setStufe(s); setFehler(null); neu(zugAusTerm(wuerfelnZug(Number(s), zugTerm(start))));
  }

  function eigenes(text: string) {
    try { setFehler(null); neu(zugAusTerm(text)); }
    catch (e) { setFehler(fehlertext(e)); }
  }

  function tippWagen(i: number) {
    if (auswahl?.art === "wagen" && auswahl.i !== i) {
      const gruppeVon = (k: number) => gs.findIndex(g => g.includes(k));
      const [ga, gb] = [gruppeVon(auswahl.i), gruppeVon(i)];
      const eigene = gs[ga].slice(1).map(idx => zug.ops[idx - 1]);
      setGrund(
        ga !== gb
          ? "Der Waggon hat den Block gewechselt: ein Faktor ist kein Summand."
          : eigene.includes(":")
            ? "Beim Teilen zählt die Reihenfolge: 12 : 4 ist nicht 4 : 12."
            : "Hier zählt die Reihenfolge.");
      setZug(tauscheZahlen(zug, auswahl.i, i));
      setAuswahl(null);
      setMeldung(null);
      return;
    }
    setAuswahl(auswahl?.art === "wagen" && auswahl.i === i ? null : { art: "wagen", i });
    setMeldung(null);
  }

  function tippGruppe(g: number) {
    if (auswahl?.art === "gruppe" && auswahl.i !== g) {
      if (Math.abs(auswahl.i - g) !== 1) {
        setMeldung("Nur Nachbarn können die Plätze tauschen.");
        setAuswahl({ art: "gruppe", i: g });
        return;
      }
      const trennend = zug.ops[gs[Math.max(auswahl.i, g)][0] - 1];
      setGrund(trennend === "-"
        ? "Beim Minus zählt die Reihenfolge: 8 − 3 ist nicht 3 − 8."
        : "Hier zählt die Reihenfolge.");
      setZug(tauscheGruppen(zug, auswahl.i, g));
      setAuswahl(null);
      setMeldung(null);
      return;
    }
    setAuswahl(auswahl?.art === "gruppe" && auswahl.i === g ? null : { art: "gruppe", i: g });
    setMeldung(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {!fest && <>
      <Aufgabenleiste
        stufen={STUFEN} aktiv={stufe} onWaehle={wuerfeln} onNeu={() => wuerfeln(stufe)}
        hinweis={stufe === "1" ? "nur + und ·" : stufe === "2" ? "mit −" : stufe === "3" ? "mit :" : "alles gemischt"} />
      <Eigenes platzhalter="z. B. 3 · 4 + 5 − 2" onSubmit={eigenes} fehler={fehler} />
      </>}

      <p className="text-sm text-[var(--text-muted)]">
        Zwei Waggons antippen → sie tauschen die Plätze. Auf das Dach eines Blocks tippen →
        der ganze Block zieht um. <strong>Feste Kupplung</strong> (· und :) hält zusammen,
        <strong> lose Kupplung</strong> (+ und −) lässt los.
      </p>

      {/* Zug */}
      <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
        <div className="min-w-fit flex items-end justify-center gap-1 pb-1">
          {gs.map((g, gi) => (
            <div key={gi} className="flex items-end gap-1">
              {gi > 0 && (
                <span className="flex flex-col items-center pb-4 px-1">
                  <span className="text-2xl font-black text-[var(--text-muted)]">
                    {opZeichen(zug.ops[gs[gi][0] - 1])}
                  </span>
                  <span className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">lose</span>
                </span>
              )}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => tippGruppe(gi)}
                  className={`w-full px-2 py-0.5 rounded-t-lg border-2 border-b-0 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    auswahl?.art === "gruppe" && auswahl.i === gi
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-muted)] hover:border-[var(--accent)]/60"
                  }`}
                >
                  Block {gi + 1}
                </button>
                <div className="flex items-end gap-0.5">
                  {g.map((idx, k) => (
                    <div key={idx} className="flex items-end">
                      {k > 0 && (
                        <span className="flex flex-col items-center pb-4 px-0.5">
                          <span className="text-xl font-black text-amber-600">{opZeichen(zug.ops[idx - 1])}</span>
                          <span className="text-[9px] uppercase tracking-wide text-amber-600">fest</span>
                        </span>
                      )}
                      <Waggon
                        v={zug.zahlen[idx]}
                        an={auswahl?.art === "wagen" && auswahl.i === idx}
                        onClick={() => tippWagen(idx)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {meldung && <p className="text-sm font-bold text-amber-600 dark:text-amber-400">✋ {meldung}</p>}

      {/* Waage: wiegt der Zug noch dasselbe? */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Am Anfang</p>
          <p className="font-mono text-lg font-black">{zugTerm(start)} = {fmt(wertStart)}</p>
        </div>
        <div className={`p-3 rounded-2xl border-2 ${
          !veraendert ? "border-[var(--border)] bg-[var(--surface)]"
            : gleich ? "border-green-500/60 bg-green-500/10" : "border-red-500/60 bg-red-500/10"
        }`}>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">Jetzt</p>
          <p className="font-mono text-lg font-black">{zugTerm(zug)} = {fmt(wertJetzt)}</p>
        </div>
      </div>

      {veraendert && (
        <p className={`text-sm font-bold ${gleich ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {gleich
            ? "✅ Gleich geblieben — hier darfst du vertauschen. Bei + und · ist die Reihenfolge egal."
            : `❌ Jetzt kommt ${fmt(wertJetzt)} heraus statt ${fmt(wertStart)}. ${grund}`}
        </p>
      )}

      <div className="flex gap-2">
        <Knopf onClick={() => { setZug(start); setAuswahl(null); setMeldung(null); }} klein>↺ zurücksetzen</Knopf>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── Stufenzahlen 🎚️ ── */

function Tafel({ zahl, von, bis, hervor = [] }: {
  zahl: number; von: number; bis: number;
  /** Die Stellen, die durchs Rutschen neu dazugekommen sind. */
  hervor?: number[];
}) {
  const ziffern = ziffernNachStellen(zahl, von, bis);
  const spalten: number[] = [];
  for (let e = von; e >= bis; e--) spalten.push(e);
  return (
    <div className="flex items-stretch">
      {spalten.map((e, i) => (
        <Fragment key={e}>
          {e === -1 && (
            <span className="self-end px-0.5 pb-1.5 text-2xl font-black text-[var(--accent)]" aria-hidden>,</span>
          )}
          <div className="flex flex-col items-center w-11 border-l border-[var(--border)] last:border-r">
            <span className="w-full text-center text-[10px] font-bold uppercase text-[var(--text-muted)] bg-[var(--surface-hover)] py-0.5">
              {STELLEN_NAMEN[e]}
            </span>
            <span className={`w-full text-center text-2xl font-black py-1.5 font-mono ${
              hervor.includes(e) && ziffern[i] !== "" ? "text-[var(--accent)]"
                : ziffern[i] === "" ? "text-transparent" : ""
            }`}>
              {ziffern[i] === "" ? "·" : ziffern[i]}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

const MODI: StufenModus[] = ["frei", "komma", "10", "100", "1000", "10000"];

function modusLabel(m: StufenModus, art: Rechenart): string {
  if (m === "frei") return "Frei";
  if (m === "komma") return "Komma";
  return `${opZeichen(art)} ${m === "10000" ? "10 000" : m}`;
}

function modusHinweis(m: StufenModus, art: Rechenart): string {
  const richtung = art === "*" ? "nach links" : "nach rechts";
  if (m === "frei") return "Zehner, Hunderter, Tausender";
  if (m === "komma") return "mit Zehnteln und Hundertsteln";
  const stellen = String(m).length - 1;
  return `${["eine Stelle", "zwei Stellen", "drei Stellen", "vier Stellen"][stellen - 1]} ${richtung}`;
}

/** »40 ist 4 mit einer Null«, »0,3 ist 3, eine Stelle nach rechts«. */
function zahlWort(kern: number, stellen: number): string {
  if (stellen > 0) return `${fmt(kern)} mit ${stellen === 1 ? "einer Null" : `${stellen} Nullen`}`;
  const n = -stellen;
  return `${fmt(kern)}, ${n === 1 ? "eine Stelle" : `${n} Stellen`} nach rechts gerutscht`;
}

const stellenWort = (n: number) => (Math.abs(n) === 1 ? "1 Stelle" : `${Math.abs(n)} Stellen`);

function Stufenzahlen({ melde, fest }: {
  melde: (richtig: boolean) => void;
  /** Feste Rechnung (TaskCrawler-Station): keine anderen Zahlen, kein »Lösung zeigen«. */
  fest?: { a: number; b: number; art: Rechenart };
}) {
  const [modus, setModus] = useState<StufenModus>("frei");
  const [art, setArt] = useState<Rechenart>(fest?.art ?? "*");
  // Die Zahlen stehen als Text da, nicht als number: nur so darf man »0,3«
  // tippen, ohne dass das Komma beim Zwischenstand verschluckt wird.
  const [aText, setAText] = useState(fest ? fmt(fest.a) : "3");
  const [bText, setBText] = useState(fest ? fmt(fest.b) : "40");
  // Solange die Lösung verdeckt ist, gibt es etwas selbst zu rechnen.
  const [offen, setOffen] = useState(false);

  const a = zahlAusText(aText), b = zahlAusText(bText);
  const { z, fehler } = useMemo(() => {
    if (a === null || b === null) return { z: null, fehler: "Da fehlt noch eine Zahl." };
    try { return { z: zerlegeStufen(a, b, art), fehler: null }; }
    catch (e) { return { z: null, fehler: fehlertext(e) }; }
  }, [a, b, art]);

  function wuerfeln(m: StufenModus, neueArt: Rechenart = art) {
    setModus(m);
    setArt(neueArt);
    const [na, nb] = wuerfelnStufen(m, neueArt, a !== null && b !== null ? [a, b] : undefined);
    setAText(fmt(na));
    setBText(fmt(nb));
    setOffen(false);
  }

  const feld = (wert: string, setzen: (s: string) => void, label: string) => (
    <input value={wert} aria-label={label} inputMode="decimal" readOnly={!!fest}
      onChange={e => { setzen(e.target.value); setOffen(false); }}
      className="w-24 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] font-mono text-sm" />
  );

  const zeichen = opZeichen(art);
  const bereich = z ? tafelBereich(z.kern, z.ergebnis) : null;
  // Die Zerlegung in Worten — genannt wird nur, was wirklich verschoben ist.
  const teile = z ? [
    z.stellenA !== 0 ? `${fmt(z.a)} ist ${zahlWort(z.kernA, z.stellenA)}` : null,
    z.stellenB !== 0 ? `${fmt(z.b)} ist ${zahlWort(z.kernB, z.stellenB)}` : null,
  ].filter(Boolean) : [];

  return (
    <div className="flex flex-col gap-4">
      {!fest && <>
      <Aufgabenleiste
        stufen={MODI.map(m => ({ id: m, label: modusLabel(m, art) }))} aktiv={modus}
        onWaehle={id => wuerfeln(id as StufenModus)} onNeu={() => wuerfeln(modus)}
        hinweis={modusHinweis(modus, art)} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Rechenart</span>
        <Knopf an={art === "*"} onClick={() => wuerfeln(modus, "*")}>· mal</Knopf>
        <Knopf an={art === ":"} onClick={() => wuerfeln(modus, ":")}>: geteilt</Knopf>
      </div>
      </>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Eigene Zahlen</span>
        {feld(aText, setAText, "erste Zahl")}
        <span className="text-xl font-black">{zeichen}</span>
        {feld(bText, setBText, "zweite Zahl")}
      </div>

      {fehler && <p className="text-sm font-bold text-amber-600 dark:text-amber-400">✋ {fehler}</p>}

      {z && (
        <Loesungsfeld
          key={`${art}|${aText}|${bText}`}
          loesung={z.ergebnis}
          onGeprueft={r => { setOffen(true); melde(r); }}
          onZeigen={fest ? undefined : () => setOffen(true)} />
      )}

      {z && !offen && (
        <p className="p-4 rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)]">
          🙈 Der Rechenweg ist verdeckt. Rechne erst selbst — dann steht hier, wie die Rutsche geht.
        </p>
      )}

      {z && offen && bereich && (
        <>
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3">
            <p className="text-2xl sm:text-3xl font-black font-mono">
              {fmt(z.a)} {zeichen} {fmt(z.b)} = <span className="text-[var(--accent)]">{fmt(z.ergebnis)}</span>
            </p>
            <ol className="flex flex-col gap-2 text-sm">
              <li className="flex gap-2">
                <span className="font-black text-[var(--accent)]">1.</span>
                <span>
                  {teile.length === 0
                    ? <>Nichts abzutrennen — hier steht keine Stufenzahl.</>
                    : <>Zerlegen: {teile.join(", ")} — das wartet draußen, gerechnet wird mit{" "}
                        <span className="font-mono font-bold">{fmt(z.kernA)} {zeichen} {fmt(z.kernB)}</span>.</>}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-black text-[var(--accent)]">2.</span>
                <span>
                  {z.kernB === 1
                    // Bei reinen Stufenzahlen gibt es nichts auszurechnen — das ist
                    // der Punkt der Übung, also darf hier auch kein »· 1« stehen.
                    ? <>Die {fmt(z.b)} ist eine 1 mit {z.stellenB === 1 ? "einer Null" : `${z.stellenB} Nullen`} —{" "}
                        {art === "*" ? "mal 1" : "durch 1"} ändert nichts,
                        es bleibt <span className="font-mono font-bold">{fmt(z.kern)}</span>.</>
                    : <>Kleines {art === "*" ? "Einmaleins" : "Einsdurcheins"}:{" "}
                        <span className="font-mono font-bold">{fmt(z.kernA)} {zeichen} {fmt(z.kernB)} = {fmt(z.kern)}</span></>}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-black text-[var(--accent)]">3.</span>
                <span>
                  {z.stellen === 0
                    ? <>Nichts zu rutschen — fertig: <span className="font-mono font-bold">{fmt(z.ergebnis)}</span></>
                    : <>Rutschen: <span className="font-mono font-bold">{fmt(z.kern)}</span> rutscht{" "}
                      {stellenWort(z.stellen)} nach {z.stellen > 0 ? "links" : "rechts"} →{" "}
                      <span className="font-mono font-bold">{fmt(z.ergebnis)}</span></>}
                </span>
              </li>
            </ol>
          </div>

          {/* Stellenwerttafel: erst der Kern, dann derselbe Kern eine Etage höher (oder tiefer) */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
            <div className="min-w-fit flex flex-col items-center gap-1">
              <Tafel zahl={z.kern} von={bereich.von} bis={bereich.bis} />
              {z.stellen !== 0 && (
                <>
                  <span className="text-sm font-bold text-[var(--accent)]">
                    {z.stellen > 0 ? "⬅︎" : "➡︎"} {stellenWort(z.stellen)} rutschen
                  </span>
                  <Tafel zahl={z.ergebnis} von={bereich.von} bis={bereich.bis}
                    hervor={neueStellen(z.stellen)} />
                </>
              )}
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        🎚️ »Mal 10« heißt nicht »eine Null anhängen«, sondern: jede Ziffer rückt eine Stelle nach
        links. Aus Einern werden Zehner, aus Zehnern Hunderter — die Null füllt nur den frei
        gewordenen Platz. Geteilt geht dieselbe Rutsche rückwärts: aus 45 : 10 wird 4,5, die
        4 fällt vom Zehner auf den Einer und die 5 ins Zehntel.
      </p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── Rahmen ── */

/**
 * `vorgabe` (TaskCrawler-Station) legt Reiter und Aufgabe fest:
 *   { term: "2 + 3 · (4 − 1)" }                 → Obstkorb
 *   { reiter: "zug", term: "12 : 4 + 5" }       → Rechenzug
 *   { a: 3.5, b: 100, art: "*" }                → Stufenzahlen (art "*" oder ":")
 */
export default function Rechenregeln({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const va = zahl(vorgabe, "a"), vb = zahl(vorgabe, "b"), vterm = text(vorgabe, "term");
  const festerReiter: Reiter | undefined = vorgabe
    ? wahl(vorgabe, "reiter", ["korb", "zug", "stufen"] as const) ?? (va !== undefined && vb !== undefined ? "stufen" : "korb")
    : undefined;
  const stufenFest = va !== undefined && vb !== undefined
    ? { a: va, b: vb, art: (wahl(vorgabe, "art", ["*", ":"] as const) ?? "*") as Rechenart }
    : undefined;
  const [reiter, setReiter] = useState<Reiter>(festerReiter ?? "korb");
  // Der Punktestand gehört hierher und nicht in die Reiter: die werden beim
  // Umschalten abgebaut, und ein Zähler, der beim Reiterwechsel auf 0 springt,
  // wäre keiner.
  const [punkte, setPunkte] = useState(LEER);
  const melde = (richtig: boolean) => setPunkte(p => zaehle(p, richtig));

  return (
    <div className="flex flex-col gap-5 p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🍎 Rechenregeln</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Klammern vor Punkt vor Strich, Vertauschen und Stufenzahlen — zum Ansehen statt zum Auswendiglernen.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {!festerReiter && <div className="flex gap-2 flex-wrap">
        {REITER.map(r => (
          <Knopf key={r.id} an={r.id === reiter} onClick={() => setReiter(r.id)}>
            {r.icon} {r.titel}
          </Knopf>
        ))}
      </div>}

      {reiter !== "zug" && !festerReiter && <Punkteleiste p={punkte} onReset={() => setPunkte(LEER)} />}

      {reiter === "korb" && <Obstkorb melde={melde} fest={festerReiter ? vterm : undefined} />}
      {reiter === "zug" && <Rechenzug fest={festerReiter ? vterm : undefined} />}
      {reiter === "stufen" && <Stufenzahlen melde={melde} fest={festerReiter ? stufenFest : undefined} />}
    </div>
  );
}
