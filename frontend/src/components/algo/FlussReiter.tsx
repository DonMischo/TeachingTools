"use client";
/**
 * Reiter »Flussdiagramm«: sieben Aufgaben in steigender Schwierigkeit,
 * Beispiele zum Ablaufenlassen und eine freie Zeichenfläche.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AUFGABEN, BEISPIELE, beispiel, brauchtAntwort, pruefeBau, startStand, weiter,
  type AblaufStand, type Diagramm, type FlussAufgabe, type KnotenTyp,
} from "@/lib/algo/fluss";
import FlussEditor, { Form, FormKnopf } from "./FlussEditor";
import { aufgabenWertung, type Wertung } from "@/lib/algo/wertung";
import { HilfeLeiste, WertungZeile, useMessung } from "./Hilfe";

type Auswahl = { art: "aufgabe"; id: string } | { art: "beispiel"; id: string } | { art: "frei" };

const LEER: Diagramm = {
  knoten: [
    { id: "s", typ: "start", text: "Start", x: 110, y: 40 },
    { id: "e", typ: "ende", text: "Ende", x: 110, y: 300 },
  ],
  kanten: [],
};

export default function FlussReiter({ erledigt, onGeloest, start }: {
  erledigt: string[];
  onGeloest: (aufgabeId: string, w: Wertung) => void;
  /** Beispiel, das beim Öffnen gezeigt werden soll (aus dem Automaten-Reiter) */
  start?: string | null;
}) {
  const [wahl, setWahl] = useState<Auswahl>(start ? { art: "beispiel", id: start } : { art: "aufgabe", id: AUFGABEN[0].id });
  useEffect(() => { if (start) setWahl({ art: "beispiel", id: start }); }, [start]);
  const knopf = (an: boolean) => `text-left text-sm rounded-lg px-2 py-1.5 ${an ? "bg-surface-hover font-bold" : "hover:bg-surface-hover"}`;
  const schluessel = wahl.art === "frei" ? "frei" : `${wahl.art}-${wahl.id}`;
  return (
    <div className="grid lg:grid-cols-[230px_minmax(0,1fr)] gap-4 items-start">
      <nav className="card p-2 flex flex-col gap-0.5" aria-label="Flussdiagramm-Aufgaben">
        <div className="text-xs font-bold text-muted px-2 pt-1">Aufgaben</div>
        {AUFGABEN.map(a => (
          <button key={a.id} type="button" onClick={() => setWahl({ art: "aufgabe", id: a.id })}
            className={knopf(wahl.art === "aufgabe" && wahl.id === a.id)}>
            {erledigt.includes(a.id) ? "✅" : "⬜"} {a.titel}
          </button>
        ))}
        <div className="text-xs font-bold text-muted px-2 pt-3">Beispiele</div>
        {BEISPIELE.map(b => (
          <button key={b.id} type="button" onClick={() => setWahl({ art: "beispiel", id: b.id })}
            className={knopf(wahl.art === "beispiel" && wahl.id === b.id)}>🔀 {b.titel}</button>
        ))}
        <div className="text-xs font-bold text-muted px-2 pt-3">Werkstatt</div>
        <button type="button" onClick={() => setWahl({ art: "frei" })} className={knopf(wahl.art === "frei")}>✏️ Frei zeichnen</button>
        <Legende />
      </nav>
      <div key={schluessel} className="min-w-0">
        {wahl.art === "aufgabe" && <AufgabeAnsicht a={AUFGABEN.find(a => a.id === wahl.id)!} onGeloest={w => onGeloest(wahl.id, w)} geloest={erledigt.includes(wahl.id)} />}
        {wahl.art === "beispiel" && <BeispielAnsicht id={wahl.id} />}
        {wahl.art === "frei" && <Frei />}
      </div>
    </div>
  );
}

function Legende() {
  const zeile = (t: KnotenTyp, h: number, text: string) => (
    <div className="flex items-center gap-2 text-xs">
      <svg viewBox="0 0 180 80" width={44} height={20} aria-hidden><Form typ={t} x={90} y={40} h={h} stil={{ fill: "none", stroke: "currentColor", strokeWidth: 6 }} /></svg>
      {text}
    </div>
  );
  return (
    <div className="mt-3 border-t border-line pt-2 px-2 flex flex-col gap-1 text-muted">
      <div className="text-xs font-bold">Die vier Grundfiguren</div>
      {zeile("start", 52, "Start / Ende")}
      {zeile("io", 52, "Ein- / Ausgabe")}
      {zeile("aktion", 52, "Anweisung")}
      {zeile("entscheidung", 78, "Entscheidung")}
    </div>
  );
}

// ── Ablauf ──────────────────────────────────────────────────────────────

function useAblauf(d: Diagramm) {
  const [s, setS] = useState<AblaufStand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zahl, setZahl] = useState("");
  const frage = s ? brauchtAntwort(d, s) : null;
  const schritt = (antwort?: number | boolean) => {
    if (!s) return;
    try { setS(weiter(d, s, antwort)); setZahl(""); } catch (e) { setFehler(e instanceof Error ? e.message : String(e)); }
  };
  return {
    s, fehler, frage, zahl, setZahl, schritt,
    starte: () => { setFehler(null); setS(startStand(d)); },
    stopp: () => { setS(null); setFehler(null); },
  };
}

function AblaufLeiste({ a, d }: { a: ReturnType<typeof useAblauf>; d: Diagramm }) {
  const k = a.s ? d.knoten.find(x => x.id === a.s!.bei) : null;
  return (
    <div className="card p-3 flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold">▶ Ablauf</span>
        {!a.s && <button type="button" className="btn-primary" onClick={a.starte}>Ablauf starten</button>}
        {a.s && !a.s.fertig && !a.fehler && (
          a.frage?.art === "zahl" ? (
            <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (a.zahl.trim() !== "" && !isNaN(+a.zahl.replace(",", "."))) a.schritt(+a.zahl.replace(",", ".")); }}>
              <label>{a.frage.name} =</label>
              <input className="input w-24" inputMode="decimal" autoFocus value={a.zahl} onChange={e => a.setZahl(e.target.value)} />
              <button type="submit" className="btn-primary">Weiter</button>
            </form>
          ) : a.frage?.art === "janein" ? (
            <>
              <span>»{k?.text}«</span>
              <button type="button" className="btn-secondary" onClick={() => a.schritt(true)}>ja</button>
              <button type="button" className="btn-secondary" onClick={() => a.schritt(false)}>nein</button>
            </>
          ) : <button type="button" className="btn-primary" onClick={() => a.schritt()}>Nächster Schritt ⏭</button>
        )}
        {a.s && <button type="button" className="btn-secondary ml-auto" onClick={a.stopp}>⟲ Beenden</button>}
      </div>
      {k && !a.s?.fertig && <div className="text-muted">Gerade bei: <b className="text-fg">{k.text}</b>{k.code ? <code className="ml-2 text-xs">{k.code}</code> : null}</div>}
      {a.s?.fertig && <div className="text-ok font-bold">🏁 Ende erreicht nach {a.s.schritte} Schritten.</div>}
      {a.fehler && <div className="text-bad" role="alert">{a.fehler}</div>}
      {a.s && Object.keys(a.s.werte).length > 0 && (
        <div className="flex flex-wrap gap-1.5">{Object.entries(a.s.werte).map(([n, v]) => <span key={n} className="chip font-mono">{n} = {Math.round(v * 1000) / 1000}</span>)}</div>
      )}
      {a.s && a.s.ausgaben.length > 0 && <div>📤 Ausgabe: <b>{a.s.ausgaben.join(" · ")}</b></div>}
      {a.s && a.s.protokoll.length > 0 && (
        <ol className="text-xs font-mono bg-page border border-line rounded-lg p-2 list-decimal pl-6 max-h-40 overflow-auto">
          {a.s.protokoll.map((z, i) => <li key={i}>{z}</li>)}
        </ol>
      )}
    </div>
  );
}

function BeispielAnsicht({ id }: { id: string }) {
  const b = beispiel(id) ?? BEISPIELE[0];
  const [d, setD] = useState<Diagramm>(b.diagramm);
  const ablauf = useAblauf(d);
  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 text-sm"><h2 className="text-lg font-black">{b.titel}</h2><p>{b.text}</p></section>
      <AblaufLeiste a={ablauf} d={d} />
      <FlussEditor d={d} onChange={x => { setD(x); ablauf.stopp(); }} modus="bearbeiten" aktiv={ablauf.s?.bei} />
      <button type="button" className="self-start text-xs underline text-muted" onClick={() => { setD(b.diagramm); ablauf.stopp(); }}>Original wiederherstellen</button>
    </div>
  );
}

const FREI = "hp_algo_fluss_frei";

function Frei() {
  const [d, setD] = useState<Diagramm>(LEER);
  const [geladen, setGeladen] = useState(false);
  useEffect(() => {
    try { const roh = JSON.parse(localStorage.getItem(FREI) ?? "null"); if (roh?.knoten) setD(roh); } catch { /* egal */ }
    setGeladen(true);
  }, []);
  const ablauf = useAblauf(d);
  const aendern = (x: Diagramm) => {
    setD(x);
    ablauf.stopp();
    if (geladen) try { localStorage.setItem(FREI, JSON.stringify(x)); } catch { /* egal */ }
  };
  const probleme = useMemo(() => pruefeBau({ id: "frei", titel: "", text: "", art: "bauen" }, d), [d]);
  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 text-sm flex flex-col gap-2">
        <h2 className="text-lg font-black">✏️ Frei zeichnen</h2>
        <p>Zeichne dein eigenes Flussdiagramm — zum Beispiel für das Zubereiten eines Toasts. Ein Kasten wird ausgewählt, indem du ihn anklickst; der blaue Knopf ➜ zieht einen Pfeil.</p>
        <label className="flex items-center gap-2">Beispiel laden:
          <select className="input w-auto" value="" onChange={e => { const b = beispiel(e.target.value); if (b) aendern(b.diagramm); }}>
            <option value="">—</option>
            {BEISPIELE.map(b => <option key={b.id} value={b.id}>{b.titel}</option>)}
          </select>
          <button type="button" className="btn-secondary" onClick={() => aendern(LEER)}>Leeren</button>
        </label>
      </section>
      <Pruefliste probleme={probleme} />
      <AblaufLeiste a={ablauf} d={d} />
      <FlussEditor d={d} onChange={aendern} modus="bearbeiten" aktiv={ablauf.s?.bei} />
    </div>
  );
}

function Pruefliste({ probleme }: { probleme: string[] }) {
  if (!probleme.length) return <div className="text-sm text-ok font-bold">✅ Das Diagramm ist vollständig: Start, Ende, alle Pfeile da.</div>;
  return (
    <ul className="text-sm text-muted list-disc pl-5">
      {probleme.slice(0, 4).map((p, i) => <li key={i}>{p}</li>)}
      {probleme.length > 4 && <li>… und {probleme.length - 4} weitere Hinweise</li>}
    </ul>
  );
}

// ── Aufgaben ────────────────────────────────────────────────────────────

const FORMEN: { form: KnotenTyp; text: string }[] = [
  { form: "start", text: "Start / Ende" }, { form: "io", text: "Ein- / Ausgabe" },
  { form: "aktion", text: "Anweisung" }, { form: "entscheidung", text: "Entscheidung" },
];
const gleicheForm = (a: KnotenTyp, b: KnotenTyp) => a === b || ((a === "start" || a === "ende") && (b === "start" || b === "ende"));

const RICHTZEIT: Record<FlussAufgabe["art"], number> = { formen: 90, verbinden: 150, fehler: 60, verfolgen: 120, frage: 45, bauen: 360 };

const TIPP: Record<FlussAufgabe["art"], string> = {
  formen: "Frag dich bei jedem Kasten: Fängt hier etwas an oder hört es auf? Kommt etwas herein oder geht etwas hinaus? Wird etwas gefragt? Oder wird einfach etwas getan?",
  verbinden: "Fang beim Start an und folge der Reihenfolge, in der man den Automaten wirklich bedient.",
  fehler: "Geh das Diagramm mit dem Finger durch — einmal mit vollen Taschen und einmal, wenn keine Flasche mehr übrig ist.",
  verfolgen: "Rechne Kasten für Kasten. Die gelben Notizen erklären jeden Schritt.",
  frage: "Denk an die Merkmale: endlich viele Schritte, jeder ausführbar und eindeutig, aus Eingaben wird eine Ausgabe.",
  bauen: "Fang mit Start und Ende an. Dann die Kästen dazwischen, zuletzt die Pfeile (Pfeil-Modus).",
};

const HINWEIS: Record<string, string> = {
  formen: "Fragen mit »?« sind Rauten. »Münze einwerfen« und »Kaugummi fällt ins Fach« sind Ein- bzw. Ausgaben (Parallelogramm). »Rad drehen« ist eine Anweisung (Rechteck).",
  verbinden: "Start → Becher → Taste → »Bezahlt?«. Bei »nein« geht es zur Karte und von dort zurück zur Raute, bei »ja« weiter zum Warten.",
  fehler: "Schau dir die beiden Pfeile an, die von der Raute weggehen. Wohin führt der Pfeil, wenn die Tasche leer ist?",
  verfolgen: "3 · 14 = 42, dazu 10 ergibt 52. Wie oft passt 7 in 52, und was bleibt übrig?",
  frage: "Mit denselben Zahlen kommt jedes Mal dasselbe heraus — das heißt »eindeutig«, auch wenn andere Leute andere Zahlen haben.",
  "bauen-geburtstag": "Du brauchst: Start, zwei Eingaben (eingabe T, eingabe M), zwei Anweisungen (x = 3*T + M, r = x mod 7), eine Ausgabe (ausgabe r), Ende.",
  "bauen-lexikon": "Die Schleife: Eine Raute »Steht das Wort auf der Seite?«. Bei »nein« blätterst du und gehst zurück zur Raute, bei »ja« liest du den Eintrag.",
};

const VORLAGE_BAU: Record<string, string> = { "bauen-geburtstag": "geburtstag", "bauen-lexikon": "lexikon" };

interface KindProps { a: FlussAufgabe; onGeloest: () => void; fehler: () => void; demo: number }

function AufgabeAnsicht({ a, onGeloest, geloest }: { a: FlussAufgabe; onGeloest: (w: Wertung) => void; geloest: boolean }) {
  const m = useMessung(RICHTZEIT[a.art]);
  const [demo, setDemo] = useState(0);
  const [wertung, setWertung] = useState<Wertung | null>(null);
  const fertig = () => {
    if (wertung) return;
    const w = aufgabenWertung({ ...m, richtzeit: RICHTZEIT[a.art] });
    setWertung(w);
    onGeloest(w);
  };
  const p: KindProps = { a, onGeloest: fertig, fehler: m.fehler, demo };
  return (
    <div className="flex flex-col gap-3">
      <section className="card p-4 text-sm flex flex-col gap-2">
        <h2 className="text-lg font-black">{a.titel} {geloest && "✅"}</h2>
        <p>{a.text}</p>
        <HilfeLeiste m={m} tipp={TIPP[a.art]} hinweis={HINWEIS[a.id]} onVorfuehren={() => setDemo(d => d + 1)} />
        {wertung && <WertungZeile w={wertung} />}
      </section>
      {a.art === "formen" && <FormenAufgabe {...p} />}
      {a.art === "verbinden" && <VerbindenAufgabe {...p} />}
      {a.art === "fehler" && <FehlerAufgabe {...p} />}
      {a.art === "verfolgen" && <VerfolgenAufgabe {...p} />}
      {a.art === "frage" && <FrageAufgabe {...p} />}
      {a.art === "bauen" && <BauAufgabe {...p} />}
    </div>
  );
}

/** Führt `schritte` nacheinander aus, sobald `demo` hochzählt. */
function useVorfuehrung(demo: number, schritte: () => (() => void)[], takt = 550) {
  useEffect(() => {
    if (!demo) return;
    const liste = schritte();
    const uhren = liste.map((f, i) => setTimeout(f, (i + 1) * takt));
    return () => uhren.forEach(clearTimeout);
  }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps
}

function FormenAufgabe({ a, onGeloest, fehler, demo }: KindProps) {
  const d = beispiel(a.beispiel!)!.diagramm;
  const [formen, setFormen] = useState<Record<string, KnotenTyp | null>>(() => Object.fromEntries(d.knoten.map(k => [k.id, null])));
  const [wahl, setWahl] = useState<string | null>(null);
  const [geprueft, setGeprueft] = useState(false);
  const falsch = d.knoten.filter(k => formen[k.id] && !gleicheForm(formen[k.id]!, k.typ)).map(k => k.id);
  const fertig = d.knoten.every(k => formen[k.id]);
  const k = d.knoten.find(x => x.id === wahl);
  useVorfuehrung(demo, () => d.knoten.map(kn => () => setFormen(f => ({ ...f, [kn.id]: kn.typ }))));
  return (
    <div className="flex flex-col gap-3">
      {k && (
        <div className="card p-3 flex flex-wrap items-center gap-2 text-sm">
          <span>Form für »<b>{k.text}</b>«:</span>
          {FORMEN.map(f => (
            <FormKnopf key={f.form} typ={f.form} text={f.text}
              onClick={() => { setFormen({ ...formen, [k.id]: f.form }); setGeprueft(false); setWahl(null); }} />
          ))}
        </div>
      )}
      <FlussEditor d={d} modus="lesen" formen={formen} onKnotenKlick={setWahl} markiertKnoten={geprueft ? falsch : []} />
      <div className="flex gap-2 items-center flex-wrap">
        <button type="button" className="btn-primary" disabled={!fertig}
          onClick={() => { setGeprueft(true); if (!falsch.length) onGeloest(); else fehler(); }}>Prüfen</button>
        {geprueft && (falsch.length
          ? <span className="text-sm text-bad">{falsch.length} {falsch.length === 1 ? "Form stimmt" : "Formen stimmen"} noch nicht (rot umrandet).</span>
          : <span className="text-sm text-ok font-bold">Alles richtig! Oval = Start/Ende, Parallelogramm = Ein-/Ausgabe, Rechteck = Anweisung, Raute = Entscheidung.</span>)}
        {!fertig && <span className="text-xs text-muted">Noch {d.knoten.filter(x => !formen[x.id]).length} Kästen ohne Form.</span>}
      </div>
    </div>
  );
}

const kantenSchluessel = (d: Diagramm) => new Set(d.kanten.map(e => `${e.von}>${e.nach}>${e.marke ?? ""}`));

function VerbindenAufgabe({ a, onGeloest, fehler, demo }: KindProps) {
  const loesung = beispiel(a.beispiel!)!.diagramm;
  const [d, setD] = useState<Diagramm>({ ...loesung, kanten: [] });
  const [ergebnis, setErgebnis] = useState<{ falsch: number; fehlt: number } | null>(null);
  useVorfuehrung(demo, () => [() => setD({ ...loesung, kanten: [] }), ...loesung.kanten.map((_, i) => () => setD({ ...loesung, kanten: loesung.kanten.slice(0, i + 1) }))]);
  const pruefen = () => {
    const soll = kantenSchluessel(loesung), ist = kantenSchluessel(d);
    const falsch = [...ist].filter(x => !soll.has(x)).length, fehlt = [...soll].filter(x => !ist.has(x)).length;
    setErgebnis({ falsch, fehlt });
    if (!falsch && !fehlt) onGeloest();
    else fehler();
  };
  return (
    <div className="flex flex-col gap-3">
      <FlussEditor d={d} onChange={x => { setD(x); setErgebnis(null); }} modus="verbinden" pfeilStart />
      <div className="flex gap-2 items-center flex-wrap">
        <button type="button" className="btn-primary" onClick={pruefen}>Prüfen</button>
        {ergebnis && (ergebnis.falsch || ergebnis.fehlt
          ? <span className="text-sm text-bad">{ergebnis.falsch ? `${ergebnis.falsch} Pfeil(e) zeigen falsch. ` : ""}{ergebnis.fehlt ? `${ergebnis.fehlt} Pfeil(e) fehlen noch.` : ""}</span>
          : <span className="text-sm text-ok font-bold">Perfekt verbunden!</span>)}
      </div>
    </div>
  );
}

function FehlerAufgabe({ a, onGeloest, fehler, demo }: KindProps) {
  const { diagramm, falsch } = useMemo(() => a.kaputt!(beispiel(a.beispiel!)!.diagramm), [a]);
  const [klick, setKlick] = useState<{ i: number; ok: boolean } | null>(null);
  const [zeige, setZeige] = useState(false);
  useVorfuehrung(demo, () => [() => setZeige(true), () => setZeige(false), () => setZeige(true)]);
  return (
    <div className="flex flex-col gap-3">
      <FlussEditor d={diagramm} modus="lesen" markiertKante={klick ?? (zeige ? { i: falsch, ok: false } : null)}
        onKanteKlick={i => { if (klick?.ok) return; const ok = i === falsch; setKlick({ i, ok }); if (ok) onGeloest(); else fehler(); }} />
      {zeige && !klick?.ok && <p className="text-sm">🎬 Der rot markierte Pfeil ist falsch — klicke ihn an.</p>}
      {klick && (klick.ok
        ? <p className="text-sm text-ok font-bold">Gefunden! Wenn die Tasche leer ist, muss es weiter zum Bon gehen — sonst steckt man fest. So ein Fehler heißt »Bug«.</p>
        : <p className="text-sm text-bad">Dieser Pfeil stimmt. Geh das Diagramm mit dem Finger durch: Was passiert, wenn keine Flaschen mehr da sind?</p>)}
    </div>
  );
}

function VerfolgenAufgabe({ a, onGeloest, fehler, demo }: KindProps) {
  const d = beispiel(a.beispiel!)!.diagramm;
  const [antwort, setAntwort] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const ablauf = useAblauf(d);
  const [vorgerechnet, setVorgerechnet] = useState<string[]>([]);
  // Vorführen: das Protokoll Zeile für Zeile aufdecken
  useVorfuehrung(demo, () => {
    let s = startStand(d);
    const ein = [...a.eingaben!];
    while (!s.fertig) s = weiter(d, s, brauchtAntwort(d, s)?.art === "zahl" ? ein.shift() : undefined);
    return [() => setVorgerechnet([]), ...s.protokoll.map((_, i) => () => setVorgerechnet(s.protokoll.slice(0, i + 1)))];
  }, 900);
  return (
    <div className="flex flex-col gap-3">
      <form className="card p-3 flex items-center gap-2 text-sm flex-wrap" onSubmit={e => {
        e.preventDefault();
        if (ok) return;
        const r = antwort.trim() === a.antwort;
        setOk(r);
        if (r) onGeloest(); else fehler();
      }}>
        <label htmlFor="verfolgen-antwort">Ausgabe:</label>
        <input id="verfolgen-antwort" className="input w-24" inputMode="numeric" value={antwort} onChange={e => { setAntwort(e.target.value); setOk(null); }} />
        <button type="submit" className="btn-primary">Prüfen</button>
        {ok === true && <span className="text-ok font-bold">Richtig: 3 · {a.eingaben![0]} + {a.eingaben![1]} = {3 * a.eingaben![0] + a.eingaben![1]}, und das geteilt durch 7 lässt den Rest {a.antwort}.</span>}
        {ok === false && <span className="text-bad">Noch nicht. Lass das Diagramm mit »Ablauf« rechnen und gib dabei {a.eingaben!.join(" und ")} ein.</span>}
      </form>
      {vorgerechnet.length > 0 && (
        <ol className="card p-3 text-sm font-mono list-decimal pl-8">{vorgerechnet.map((z, i) => <li key={i}>{z}</li>)}</ol>
      )}
      <AblaufLeiste a={ablauf} d={d} />
      <FlussEditor d={d} modus="lesen" aktiv={ablauf.s?.bei} kommentare />
    </div>
  );
}

function FrageAufgabe({ a, onGeloest, fehler, demo }: KindProps) {
  const [wahl, setWahl] = useState<number | null>(null);
  const [zeige, setZeige] = useState(false);
  useVorfuehrung(demo, () => [() => setZeige(true)]);
  const gut = wahl !== null && a.optionen![wahl].richtig;
  return (
    <div className="flex flex-col gap-2">
      {a.optionen!.map((o, i) => (
        <button key={i} type="button" onClick={() => { if (gut) return; setWahl(i); if (o.richtig) onGeloest(); else fehler(); }}
          className={`card p-3 text-left text-sm ${wahl === i ? (o.richtig ? "border-ok" : "border-bad") : zeige && o.richtig ? "border-dashed border-ok" : "hover:bg-surface-hover"}`}>
          {o.text}
          {wahl === i && <div className={`mt-1 ${o.richtig ? "text-ok" : "text-bad"}`}>{o.warum}</div>}
        </button>
      ))}
    </div>
  );
}

function BauAufgabe({ a, onGeloest, fehler, demo }: KindProps) {
  const speicher = `hp_algo_fluss_${a.id}`;
  const [d, setD] = useState<Diagramm>(LEER);
  const [geladen, setGeladen] = useState(false);
  const [probleme, setProbleme] = useState<string[] | null>(null);
  useEffect(() => {
    try { const roh = JSON.parse(localStorage.getItem(speicher) ?? "null"); if (roh?.knoten) setD(roh); } catch { /* egal */ }
    setGeladen(true);
  }, [speicher]);
  const ablauf = useAblauf(d);
  const aendern = (x: Diagramm) => {
    setD(x); setProbleme(null); ablauf.stopp();
    if (geladen) try { localStorage.setItem(speicher, JSON.stringify(x)); } catch { /* egal */ }
  };
  // Vorführen: das Musterdiagramm Kasten für Kasten aufbauen
  useVorfuehrung(demo, () => {
    const ziel = beispiel(VORLAGE_BAU[a.id])?.diagramm;
    if (!ziel) return [];
    return ziel.knoten.map((_, i) => () => {
      const knoten = ziel.knoten.slice(0, i + 1), ids = new Set(knoten.map(k => k.id));
      aendern({ knoten, kanten: ziel.kanten.filter(e => ids.has(e.von) && ids.has(e.nach)) });
    });
  }, 700);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 items-center flex-wrap">
        <button type="button" className="btn-primary" onClick={() => { const p = pruefeBau(a, d); setProbleme(p); if (!p.length) onGeloest(); else fehler(); }}>Prüfen</button>
        {probleme && !probleme.length && <span className="text-sm text-ok font-bold">🎉 Dein Diagramm erfüllt alle Bedingungen!</span>}
      </div>
      {probleme && probleme.length > 0 && <Pruefliste probleme={probleme} />}
      <AblaufLeiste a={ablauf} d={d} />
      <FlussEditor d={d} onChange={aendern} modus="bearbeiten" aktiv={ablauf.s?.bei} />
    </div>
  );
}
