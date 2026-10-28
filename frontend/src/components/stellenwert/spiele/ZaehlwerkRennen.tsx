"use client";
/**
 * Zählwerk-Rennen: 60 Sekunden. Das Zählwerk zeigt eine Zahl, gefragt ist,
 * was nach +1 (−1, + einem Stellenwert …) dasteht. Nach der Antwort dreht
 * das Zählwerk wirklich — man sieht den Übertrag wandern. Je mehr Walzen sich
 * bewegen, desto mehr Punkte; ein Fehler kostet 3 Sekunden.
 */
import { useEffect, useRef, useState } from "react";
import { BASEN, INDEX, geaenderteStellen, lies, schreibe, ziffer, type Basis } from "@/lib/stellenwert";
import { zaehlRunde, zaehlZiel, type ZaehlRunde } from "@/lib/stellenwertSpiele";
import { Chips } from "@/components/prozent/ui";
import { ZaehlwerkAnzeige } from "../teile";
import { ZaehlwerkErklaerung } from "./Erklaerung";

const DAUER = 60, STRAFE = 3;
const SCHLUESSEL = "hp_stellenwert_zaehlwerk_best";
const liesBest = (): number => { try { return Number(localStorage.getItem(SCHLUESSEL)) || 0; } catch { return 0; } };
const schreibBest = (n: number) => { try { localStorage.setItem(SCHLUESSEL, String(n)); } catch { /* privat */ } };

const STUFEN = [
  { id: "1", label: "⭐ +1" },
  { id: "2", label: "⭐⭐ +1 und −1" },
  { id: "3", label: "⭐⭐⭐ + Stellenwerte" },
] as const;

const schrittText = (r: ZaehlRunde) =>
  `${r.schritt < 0 ? "−" : "+"} ${schreibe(Math.abs(r.schritt), r.basis)}${Math.abs(r.schritt) > 1 && r.basis !== 10 ? INDEX[r.basis] : ""}`;

export default function ZaehlwerkRennen() {
  const [stufe, setStufe] = useState<"1" | "2" | "3">("1");
  const [basen, setBasen] = useState<Basis[]>([2, 10, 16]);
  const [phase, setPhase] = useState<"start" | "laeuft" | "ende">("start");
  const [runde, setRunde] = useState<ZaehlRunde | null>(null);
  const [zeigt, setZeigt] = useState(0);
  const [eingabe, setEingabe] = useState("");
  const [rueck, setRueck] = useState<{ ok: boolean; text: string } | null>(null);
  const [punkte, setPunkte] = useState(0);
  const [stat, setStat] = useState({ richtig: 0, gesamt: 0 });
  const [rest, setRest] = useState(DAUER);
  const [best, setBest] = useState(0);
  const ende = useRef(0);
  const weiter = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setBest(liesBest()); return () => clearTimeout(weiter.current); }, []);

  useEffect(() => {
    if (phase !== "laeuft") return;
    const t = setInterval(() => {
      const r = Math.max(0, (ende.current - Date.now()) / 1000);
      setRest(r);
      if (r <= 0) setPhase("ende");
    }, 100);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "ende" && punkte > liesBest()) { schreibBest(punkte); setBest(punkte); }
  }, [phase, punkte]);

  const neueRunde = () => {
    const r = zaehlRunde(Number(stufe) as 1 | 2 | 3, basen);
    setRunde(r); setZeigt(r.start); setEingabe(""); setRueck(null);
  };

  const starte = () => {
    ende.current = Date.now() + DAUER * 1000;
    setRest(DAUER); setPunkte(0); setStat({ richtig: 0, gesamt: 0 }); setPhase("laeuft");
    neueRunde();
  };

  const antworte = (text = eingabe) => {
    if (!runde || rueck) return;
    const x = lies(text, runde.basis);
    if (x === null) return;
    const ziel = zaehlZiel(runde);
    const ok = x === ziel;
    const gedreht = geaenderteStellen(runde.start, ziel, runde.basis, runde.stellen).length;
    if (ok) setPunkte(p => p + 5 + gedreht * 5);
    else ende.current -= STRAFE * 1000;
    setStat(s => ({ richtig: s.richtig + (ok ? 1 : 0), gesamt: s.gesamt + 1 }));
    setRueck({
      ok,
      text: ok
        ? `✔ ${gedreht > 1 ? `${gedreht} Walzen haben sich gedreht!` : "Richtig!"}`
        : `✘ Es ist ${schreibe(ziel, runde.basis)}${INDEX[runde.basis]} (−${STRAFE} s)`,
    });
    setZeigt(ziel);
    clearTimeout(weiter.current);
    weiter.current = setTimeout(neueRunde, ok ? 1300 : 2600);
  };

  if (phase !== "laeuft" || !runde) {
    return (
      <div className="flex flex-col gap-3 items-start">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-black">🚗 Zählwerk-Rennen</h2>
          <ZaehlwerkErklaerung />
        </div>
        <p className="text-sm max-w-2xl">
          Das Zählwerk zeigt eine Zahl. Was steht da nach dem nächsten Schritt? Achtung beim <b>Übertrag</b>: läuft eine
          Walze über die größte Ziffer, springt sie auf 0 und die Walze links dreht eins weiter. {DAUER} Sekunden — je mehr
          Walzen sich drehen, desto mehr Punkte. Ein Fehler kostet {STRAFE} Sekunden.
        </p>
        <Chips wahl={stufe} setze={setStufe} optionen={STUFEN} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Zahlensysteme">
          {BASEN.map(b => (
            <button key={b.basis} className={`chip ${basen.includes(b.basis) ? "chip-on" : ""}`} aria-pressed={basen.includes(b.basis)}
              onClick={() => setBasen(xs => (xs.includes(b.basis) ? (xs.length > 1 ? xs.filter(x => x !== b.basis) : xs) : [...xs, b.basis]))}>
              {b.icon} {b.kurz}
            </button>
          ))}
        </div>
        {phase === "ende" && (
          <p className="text-lg font-black" role="status">
            Zeit um! {punkte} Punkte, {stat.richtig} von {stat.gesamt} richtig.{punkte >= best && punkte > 0 && " 🏆 Neuer Bestwert!"}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={starte}>{phase === "ende" ? "🔁 Nochmal" : "▶ Start"}</button>
          {best > 0 && <span className="text-sm text-muted">Bestwert: {best}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 items-start">
      <div className="flex flex-wrap gap-4 items-center text-sm font-bold w-full">
        <span>⏱ {Math.ceil(rest)} s</span>
        <span>⭐ {punkte}</span>
        <span>✔ {stat.richtig}/{stat.gesamt}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <ZaehlwerkAnzeige n={zeigt} basis={runde.basis} stellen={runde.stellen} gross />
        <span className="text-3xl font-black">{schrittText(runde)}</span>
        <span className="text-sm text-muted">{BASEN.find(b => b.basis === runde.basis)!.name}</span>
      </div>
      <form className="flex flex-wrap gap-2 items-center" onSubmit={e => { e.preventDefault(); antworte(); }}>
        <input className="input w-40 font-mono text-xl uppercase" value={eingabe} autoFocus autoComplete="off" aria-label="Was zeigt das Zählwerk dann?"
          onChange={e => setEingabe(e.target.value)} disabled={!!rueck} placeholder="?" />
        <span className="text-muted">{INDEX[runde.basis]}</span>
        <button className="btn-primary" type="submit" disabled={!!rueck}>OK</button>
      </form>
      <div className="flex flex-wrap gap-1" aria-label="Zifferntasten">
        {Array.from({ length: runde.basis }, (_, d) => (
          <button key={d} type="button" className="btn font-mono w-10" disabled={!!rueck} onClick={() => setEingabe(t => t + ziffer(d))}>{ziffer(d)}</button>
        ))}
        <button type="button" className="btn w-10" disabled={!!rueck} onClick={() => setEingabe(t => t.slice(0, -1))} aria-label="Löschen">⌫</button>
      </div>
      {rueck && <p className={`font-black ${rueck.ok ? "text-ok" : "text-bad"}`} role="status">{rueck.text}</p>}
    </div>
  );
}
