"use client";
/**
 * Prozent-Blitz: 60 Sekunden, so viele Runden wie möglich. Drei Sorten
 * mischen sich — Anteil schätzen (Kreis, Streifen, Hunderterfeld),
 * Merkprozente im Kopf, Schnäppchen vergleichen. Serien geben Bonus, ein
 * Fehler kostet 3 Sekunden und doppelt so viele Punkte, wie ein Treffer
 * bringt. Wer klickt, bevor er lesen konnte, bekommt nur halbe Punkte bzw.
 * dreifachen Abzug, und die nächste Aufgabe wartet kurz (blitzWertung in
 * lib/prozent.ts). Bestwert bleibt im Browser.
 */
import { useEffect, useRef, useState } from "react";
import { BLITZ, blitzWertung, erzeugeRunde, type Runde } from "@/lib/prozent";
import { FARBE, HunderterBild, KreisBild } from "./bilder";
import { Chips } from "./ui";

const DAUER = 60, STRAFE = 3;
const SCHLUESSEL = "hp_prozent_blitz_best";

const SORTEN = [
  { id: "alle", label: "🎲 Gemischt" },
  { id: "schaetzen", label: "👀 Schätzen" },
  { id: "kopf", label: "🧠 Kopfrechnen" },
  { id: "schnaeppchen", label: "🛒 Schnäppchen" },
] as const;
type Sorte = (typeof SORTEN)[number]["id"];

function runde(sorte: Sorte): Runde {
  for (;;) {
    const r = erzeugeRunde();
    if (sorte === "alle" || r.art === sorte) return r;
  }
}

const liesBest = (): number => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

function StreifenOhneZahlen({ p }: { p: number }) {
  return (
    <svg viewBox="0 0 400 60" className="w-full h-auto max-h-24" role="img" aria-label="Streifen">
      <rect x={4} y={10} width={392} height={40} rx={6} fill="none" strokeWidth={2} style={{ stroke: "var(--text)" }} />
      <rect x={4} y={10} width={(392 * p) / 100} height={40} rx={6} fill={FARBE} fillOpacity={0.85} />
    </svg>
  );
}

type Fehler = { runde: Runde; gewaehlt: number };

export default function Spiel() {
  const [sorte, setSorte] = useState<Sorte>("alle");
  const [phase, setPhase] = useState<"start" | "laeuft" | "ende">("start");
  const [aktuell, setAktuell] = useState<Runde | null>(null);
  const [rest, setRest] = useState(DAUER);
  const [punkte, setPunkte] = useState(0);
  const [serie, setSerie] = useState(0);
  const [stat, setStat] = useState({ richtig: 0, gesamt: 0, besteSerie: 0 });
  const [fehler, setFehler] = useState<Fehler[]>([]);
  const [rueck, setRueck] = useState<{ ok: boolean; text: string; plus: number; schnell: boolean } | null>(null);
  const [best, setBest] = useState(0);
  const ende = useRef(0);
  // seit wann die Antworten anklickbar sind, und wie oft in Folge vorschnell geklickt wurde
  const gezeigt = useRef(0);
  const [hastig, setHastig] = useState(0);
  const [gesperrtBis, setGesperrtBis] = useState(0);
  // die Uhr tickt alle 100 ms und zeichnet neu — damit geht die Sperre von selbst auf
  const gesperrt = phase === "laeuft" && Date.now() < gesperrtBis;

  useEffect(() => { setBest(liesBest()); }, []);

  useEffect(() => {
    if (phase !== "laeuft") return;
    const id = setInterval(() => {
      const r = Math.max(0, (ende.current - Date.now()) / 1000);
      setRest(r);
      if (r <= 0) setPhase("ende");
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "ende") return;
    if (punkte > liesBest()) { schreibBest(punkte); setBest(punkte); }
  }, [phase, punkte]);

  const starte = () => {
    ende.current = Date.now() + DAUER * 1000;
    setRest(DAUER); setPunkte(0); setSerie(0); setStat({ richtig: 0, gesamt: 0, besteSerie: 0 }); setFehler([]); setRueck(null);
    setHastig(0); setGesperrtBis(0); gezeigt.current = Date.now();
    setAktuell(runde(sorte)); setPhase("laeuft");
  };

  const antworte = (i: number) => {
    const jetzt = Date.now();
    if (!aktuell || phase !== "laeuft" || jetzt < gesperrtBis) return;
    const ok = i === aktuell.richtig;
    const w = blitzWertung(ok, jetzt - gezeigt.current, serie, hastig);
    setPunkte(p => p + w.plus);
    setSerie(w.neueSerie);
    setHastig(w.hastig);
    setStat(s => ({ richtig: s.richtig + (ok ? 1 : 0), gesamt: s.gesamt + 1, besteSerie: Math.max(s.besteSerie, w.neueSerie) }));
    if (!ok) {
      ende.current -= STRAFE * 1000;
      setFehler(f => [...f, { runde: aktuell, gewaehlt: i }]);
    }
    setRueck({ ok, text: aktuell.erklaerung, plus: w.plus, schnell: w.schnell });
    setAktuell(runde(sorte));
    // vorschnell geklickt: die nächste Aufgabe ist erst nach einer Pause anklickbar
    setGesperrtBis(jetzt + w.sperre);
    gezeigt.current = jetzt + w.sperre;
  };

  if (phase === "start") {
    return (
      <div className="card p-4 sm:p-5 flex flex-col gap-4 items-center text-center">
        <h2 className="text-3xl font-black">⚡ Prozent-Blitz</h2>
        <p className="max-w-xl text-muted">
          {DAUER} Sekunden, so viele Aufgaben wie möglich. Jede richtige gibt {BLITZ.punkte} Punkte, eine Serie bis zu 10 extra.
          Ein Fehler kostet {2 * BLITZ.punkte} Punkte und {STRAFE} Sekunden. Wer klickt, bevor er hinschauen konnte
          (unter einer halben Sekunde), bekommt nur halbe Punkte, verliert bei einem Fehler {3 * BLITZ.punkte} — und muss
          danach kurz warten. Also lieber kurz nachdenken als raten.
        </p>
        <Chips wahl={sorte} setze={setSorte} optionen={SORTEN} />
        <button className="btn-primary text-xl px-8 py-3" onClick={starte}>▶ Los geht’s</button>
        {best > 0 && <p className="text-sm text-muted">Dein Bestwert hier: <strong className="text-fg">{best}</strong> Punkte</p>}
      </div>
    );
  }

  if (phase === "ende") {
    return (
      <div className="card p-4 sm:p-5 flex flex-col gap-4 items-center text-center">
        <h2 className="text-3xl font-black">⏱️ Zeit um!</h2>
        <p className="text-5xl font-black">{punkte} Punkte</p>
        <p className="text-muted">{stat.richtig} von {stat.gesamt} richtig · beste Serie {stat.besteSerie}{punkte >= best && punkte > 0 ? " · 🏆 neuer Bestwert!" : ` · Bestwert ${best}`}</p>
        <button className="btn-primary text-lg px-6" onClick={starte}>↺ Nochmal</button>
        <button className="btn" onClick={() => setPhase("start")}>Sorte wechseln</button>
        {fehler.length > 0 && (
          <div className="w-full max-w-2xl text-left rounded-xl border border-line p-4 bg-page">
            <h3 className="font-black mb-2">Daraus lernen</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {fehler.map((f, i) => (
                <li key={i}>
                  <strong>{f.runde.art === "schaetzen" ? "Schätzen" : f.runde.frage}</strong>
                  {" — "}gewählt: {f.runde.art === "schaetzen" ? `${f.runde.optionen[f.gewaehlt]} %` : f.runde.optionen[f.gewaehlt]}
                  <br /><span className="text-muted">{f.runde.erklaerung}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const r = aktuell!;
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-3 rounded-full bg-page overflow-hidden" aria-label={`noch ${Math.ceil(rest)} Sekunden`}>
          <div className="h-full" style={{ width: `${(rest / DAUER) * 100}%`, background: rest < 10 ? "#e11d48" : FARBE, transition: "width 100ms linear" }} />
        </div>
        <span className="font-black tabular-nums w-12 text-right">{Math.ceil(rest)} s</span>
        <span className="font-black tabular-nums">⭐ {punkte}</span>
        {serie >= 2 && <span className="chip chip-on">🔥 {serie}</span>}
      </div>

      <div className="min-h-6 text-sm text-center">
        {rueck && (
          <span className={rueck.ok ? "text-ok font-bold" : "text-bad font-bold"}>
            {rueck.ok ? `✔ +${rueck.plus}` : `✘ −${-rueck.plus} Punkte, −${STRAFE} s`}
            {rueck.schnell && <span className="text-bad"> ⚡ zu schnell geklickt{rueck.ok ? " — nur halbe Punkte" : ""}</span>}
            {" "}<span className="text-muted font-normal">{rueck.text}</span>
          </span>
        )}
        {gesperrt && <div className="text-sm font-bold" role="status">⏳ Erst lesen … gleich geht’s weiter</div>}
      </div>

      {r.art === "schaetzen" && (
        <>
          <p className="text-xl font-black text-center">Wie viel Prozent sind gefärbt?</p>
          <div className="max-w-md w-full mx-auto">
            {r.bild === "kreis" && <KreisBild p={r.p} beschriftung={false} />}
            {r.bild === "streifen" && <StreifenOhneZahlen p={r.p} />}
            {r.bild === "feld" && <div className="max-w-64 mx-auto"><HunderterBildOhneText p={r.p} /></div>}
          </div>
          <Antworten optionen={r.optionen.map(o => `${o} %`)} antworte={antworte} gesperrt={gesperrt} />
        </>
      )}
      {r.art === "kopf" && (
        <>
          <p className="text-4xl font-black text-center py-4">{r.frage} = ?</p>
          <Antworten optionen={r.optionen} antworte={antworte} gesperrt={gesperrt} />
        </>
      )}
      {r.art === "schnaeppchen" && (
        <>
          <p className="text-xl font-black text-center">🛒 {r.frage}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {r.optionen.map((o, i) => (
              <button key={i} className="btn text-xl py-6 font-black disabled:opacity-40" disabled={gesperrt} onClick={() => antworte(i)}>{i ? "🅱️" : "🅰️"} {o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HunderterBildOhneText({ p }: { p: number }) {
  // Das Hunderterfeld verrät unten »x von 100« — im Spiel wird das abgedeckt.
  return <div className="[&_text]:hidden"><HunderterBild p={p} /></div>;
}

function Antworten({ optionen, antworte, gesperrt }: { optionen: string[]; antworte: (i: number) => void; gesperrt: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {optionen.map((o, i) => (
        <button key={`${i}-${o}`} className="btn text-2xl py-4 font-black disabled:opacity-40" disabled={gesperrt} onClick={() => antworte(i)}>{o}</button>
      ))}
    </div>
  );
}

