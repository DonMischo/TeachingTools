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
import { useMemo, useState, type ReactNode } from "react";
import {
  parse, render, wert, wertVonLinks, naechster, kandidaten, anwenden, begruendung,
  brauchtKlammer, opZeichen, fmt, wuerfelnTerm, wuerfelnZug, wuerfelnStufen,
  zugAusTerm, zugTerm, zugWert, gruppen, tauscheZahlen, tauscheGruppen,
  zerlegeStufen, stellenwerte, STELLEN, RechenError,
  type Node, type Op, type Pfad, type Zug, type StufenModus,
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

function Obstkorb() {
  const [stufe, setStufe] = useState("1");
  const [src, setSrc] = useState("2 + 3 · 4");
  const [baum, setBaum] = useState<Node>(() => parse("2 + 3 · 4"));
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
      <Aufgabenleiste
        stufen={STUFEN} aktiv={stufe} onWaehle={wuerfeln} onNeu={() => wuerfeln(stufe)}
        hinweis={Number(stufe) <= 2 ? "Punkt vor Strich" : "mit Klammern"} />
      <Eigenes platzhalter="z. B. 2 + (3 + 4) · 5" onSubmit={eigenes} fehler={fehler} />

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

function Rechenzug() {
  const [stufe, setStufe] = useState("1");
  const [start, setStart] = useState<Zug>(() => zugAusTerm("3 · 4 + 5"));
  const [zug, setZug] = useState<Zug>(() => zugAusTerm("3 · 4 + 5"));
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
      <Aufgabenleiste
        stufen={STUFEN} aktiv={stufe} onWaehle={wuerfeln} onNeu={() => wuerfeln(stufe)}
        hinweis={stufe === "1" ? "nur + und ·" : stufe === "2" ? "mit −" : stufe === "3" ? "mit :" : "alles gemischt"} />
      <Eigenes platzhalter="z. B. 3 · 4 + 5 − 2" onSubmit={eigenes} fehler={fehler} />

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

function Tafel({ zahl, breite, verschoben }: { zahl: number; breite: number; verschoben: number }) {
  const ziffern = stellenwerte(zahl, breite);
  const spalten = STELLEN.slice(-breite);
  return (
    <div className="flex">
      {ziffern.map((z, i) => {
        const angehaengt = verschoben > 0 && i >= breite - verschoben && z !== "";
        return (
          <div key={i} className="flex flex-col items-center w-11 border-l border-[var(--border)] last:border-r">
            <span className="w-full text-center text-[10px] font-bold uppercase text-[var(--text-muted)] bg-[var(--surface-hover)] py-0.5">
              {spalten[i]}
            </span>
            <span className={`w-full text-center text-2xl font-black py-1.5 font-mono ${
              angehaengt ? "text-[var(--accent)]" : z === "" ? "text-transparent" : ""
            }`}>
              {z === "" ? "·" : z}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const MODI: { id: StufenModus; label: string }[] = [
  { id: "frei", label: "Frei" },
  { id: "10", label: "· 10" },
  { id: "100", label: "· 100" },
  { id: "1000", label: "· 1000" },
];

const MODUS_HINWEIS: Record<StufenModus, string> = {
  frei: "Zehner, Hunderter, Tausender",
  "10": "eine Stelle rutschen",
  "100": "zwei Stellen rutschen",
  "1000": "drei Stellen rutschen",
};

function Stufenzahlen() {
  const [modus, setModus] = useState<StufenModus>("frei");
  const [a, setA] = useState(3);
  const [b, setB] = useState(40);

  const z = useMemo(() => {
    try { return zerlegeStufen(a, b); } catch { return null; }
  }, [a, b]);

  function wuerfeln(m: StufenModus) {
    setModus(m);
    const [na, nb] = wuerfelnStufen(m, [a, b]);
    setA(na); setB(nb);
  }

  const breite = z ? Math.max(String(z.ergebnis).length, String(z.kern).length + z.nullen) : 3;

  return (
    <div className="flex flex-col gap-4">
      <Aufgabenleiste
        stufen={MODI} aktiv={modus}
        onWaehle={id => wuerfeln(id as StufenModus)} onNeu={() => wuerfeln(modus)}
        hinweis={MODUS_HINWEIS[modus]} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Eigene Zahlen</span>
        <input type="number" min={0} max={100000} value={a} aria-label="erster Faktor"
          onChange={e => setA(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-24 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] font-mono text-sm" />
        <span className="text-xl font-black">·</span>
        <input type="number" min={0} max={100000} value={b} aria-label="zweiter Faktor"
          onChange={e => setB(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-24 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] font-mono text-sm" />
      </div>

      {z && (
        <>
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3">
            <p className="text-2xl sm:text-3xl font-black font-mono">
              {z.a} · {z.b} = <span className="text-[var(--accent)]">{z.ergebnis}</span>
            </p>
            <ol className="flex flex-col gap-2 text-sm">
              <li className="flex gap-2">
                <span className="font-black text-[var(--accent)]">1.</span>
                <span>
                  {z.kernB === 1 && z.nullenA === 0
                    // »49 · 1« wäre albern — bei einer reinen Stufenzahl bleibt
                    // der erste Faktor einfach stehen.
                    ? <>Nullen abtrennen: die {z.nullenB === 1 ? "Null" : `${z.nullenB} Nullen`} der{" "}
                        <span className="font-mono font-bold">{z.b}</span> warten draußen,{" "}
                        <span className="font-mono font-bold">{z.a}</span> bleibt stehen.</>
                    : <>Nullen abtrennen: <span className="font-mono font-bold">{z.a} · {z.b}</span> wird zu{" "}
                        <span className="font-mono font-bold">{z.kernA} · {z.kernB}</span>
                        {z.nullen > 0 && <> — {z.nullen} {z.nullen === 1 ? "Null wartet" : "Nullen warten"} draußen.</>}</>}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-black text-[var(--accent)]">2.</span>
                <span>
                  {z.kernB === 1
                    // Bei reinen Stufenzahlen gibt es nichts auszurechnen — das ist
                    // der Punkt der Übung, also darf hier auch kein »· 1« stehen.
                    ? <>Die {z.b} ist eine 1 mit {z.nullenB === 1 ? "einer Null" : `${z.nullenB} Nullen`} — mal 1 ändert nichts,
                        es bleibt <span className="font-mono font-bold">{z.kern}</span>.</>
                    : <>Kleines Einmaleins: <span className="font-mono font-bold">{z.kernA} · {z.kernB} = {z.kern}</span></>}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-black text-[var(--accent)]">3.</span>
                <span>
                  {z.nullen === 0
                    ? <>Keine Null abgetrennt — fertig: <span className="font-mono font-bold">{z.ergebnis}</span></>
                    : <>Zurückrutschen: <span className="font-mono font-bold">{z.kern}</span> rutscht{" "}
                      {z.nullen} {z.nullen === 1 ? "Stelle" : "Stellen"} nach links →{" "}
                      <span className="font-mono font-bold">{z.ergebnis}</span></>}
                </span>
              </li>
            </ol>
          </div>

          {/* Stellenwerttafel: erst der Kern, dann derselbe Kern eine Etage höher */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
            <div className="min-w-fit flex flex-col items-center gap-1">
              <Tafel zahl={z.kern} breite={breite} verschoben={0} />
              {z.nullen > 0 && (
                <>
                  <span className="text-sm font-bold text-[var(--accent)]">
                    ⬅︎ {z.nullen} {z.nullen === 1 ? "Stelle" : "Stellen"} rutschen
                  </span>
                  <Tafel zahl={z.ergebnis} breite={breite} verschoben={z.nullen} />
                </>
              )}
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
        🎚️ »Mal 10« heißt nicht »eine Null anhängen«, sondern: jede Ziffer rückt eine Stelle nach
        links. Aus Einern werden Zehner, aus Zehnern Hunderter — die Null füllt nur den frei
        gewordenen Platz. Bei »mal 100« sind es zwei Stellen, bei »mal 1000« drei.
      </p>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── Rahmen ── */

export default function Rechenregeln({ action }: { action?: ReactNode }) {
  const [reiter, setReiter] = useState<Reiter>("korb");

  return (
    <div className="flex flex-col gap-5 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🍎 Rechenregeln</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Klammern vor Punkt vor Strich, Vertauschen und Stufenzahlen — zum Ansehen statt zum Auswendiglernen.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {REITER.map(r => (
          <Knopf key={r.id} an={r.id === reiter} onClick={() => setReiter(r.id)}>
            {r.icon} {r.titel}
          </Knopf>
        ))}
      </div>

      {reiter === "korb" && <Obstkorb />}
      {reiter === "zug" && <Rechenzug />}
      {reiter === "stufen" && <Stufenzahlen />}
    </div>
  );
}
