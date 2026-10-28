"use client";
/**
 * Zählwerk-Rennen: Das Zählwerk zeigt eine Zahl, gefragt ist, was nach +1
 * (−1, + einem Stellenwert …) dasteht. Geantwortet wird, indem man die Walzen
 * selbst dreht (DrehZaehlwerk); mit »Übertrag mitdrehen« nimmt eine
 * überlaufende Walze die nächste mit. Je mehr Walzen sich bewegen müssen,
 * desto mehr Punkte. Gespielt wird auf Zeit (ein Fehler kostet 3 Sekunden)
 * oder eine feste Zahl Aufgaben (die Zeit läuft mit). Im Zehnersystem wird in
 * Stellenwerten gezählt (+ 1 H, − 3 Z …), bis 1 000, 1 Million oder 1 Milliarde.
 */
import { useEffect, useRef, useState } from "react";
import { BASEN, INDEX, geaenderteStellen, schreibe, spalte, ziffer, ziffernVon, type Basis } from "@/lib/stellenwert";
import { DEZ_BEREICHE, zaehlRunde, zaehlZiel, zehnerSchritt, type ZaehlRunde } from "@/lib/stellenwertSpiele";
import { Chips } from "@/components/prozent/ui";
import { DrehZaehlwerk } from "../DrehZaehlwerk";
import { ZaehlwerkErklaerung } from "./Erklaerung";

const STRAFE = 3;
/** so lange bleibt die Rückmeldung stehen (ms); Enter geht nach SPERRE früher weiter */
const ZEIGEN_OK = 1200, ZEIGEN_FEHLER = 4500, SPERRE = 700;
const SCHLUESSEL = "hp_stellenwert_zaehlwerk_best";

const MODI = [
  { id: "t60", label: "⏱ 60 s", zeit: 60 },
  { id: "t120", label: "⏱ 2 min", zeit: 120 },
  { id: "a10", label: "🔢 10 Aufgaben", aufgaben: 10 },
  { id: "a20", label: "🔢 20 Aufgaben", aufgaben: 20 },
  { id: "a30", label: "🔢 30 Aufgaben", aufgaben: 30 },
] as const;
type Modus = (typeof MODI)[number]["id"];

// je Modus ein eigener Bestwert; 60 s behält den alten Schlüssel
const schluessel = (m: Modus) => (m === "t60" ? SCHLUESSEL : `${SCHLUESSEL}_${m}`);
const liesBest = (m: Modus): number => { try { return Number(localStorage.getItem(schluessel(m))) || 0; } catch { return 0; } };
const schreibBest = (m: Modus, n: number) => { try { localStorage.setItem(schluessel(m), String(n)); } catch { /* privat */ } };

const STUFEN = [
  { id: "1", label: "⭐ +1" },
  { id: "2", label: "⭐⭐ +1 und −1" },
  { id: "3", label: "⭐⭐⭐ + Stellenwerte" },
] as const;

function schrittText(r: ZaehlRunde) {
  const vz = r.schritt < 0 ? "−" : "+";
  if (r.basis === 10) {
    const { anzahl, exp } = zehnerSchritt(r.schritt);
    return `${vz} ${anzahl} ${spalte(10, exp).kurz}`;
  }
  return `${vz} ${schreibe(Math.abs(r.schritt), r.basis)}${Math.abs(r.schritt) > 1 ? INDEX[r.basis] : ""}`;
}

/** Übertrag mitdrehen: eine überlaufende Walze nimmt die links daneben mit (Standard: aus). */
function MitdrehenSchalter({ an, setze }: { an: boolean; setze: (b: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-sm cursor-pointer" title="Läuft eine Walze über, dreht die links daneben von selbst eins weiter — Walze für Walze, wie im echten Zählwerk.">
      <input type="checkbox" checked={an} onChange={e => setze(e.target.checked)} /> ⚙️ Übertrag mitdrehen
    </label>
  );
}

const uhr = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function ZaehlwerkRennen() {
  const [stufe, setStufe] = useState<"1" | "2" | "3">("1");
  const [basen, setBasen] = useState<Basis[]>([2, 10, 16]);
  const [bereich, setBereich] = useState<(typeof DEZ_BEREICHE)[number]["id"]>("4");
  const [modus, setModus] = useState<Modus>("t60");
  const [phase, setPhase] = useState<"start" | "laeuft" | "ende">("start");
  const [runde, setRunde] = useState<ZaehlRunde | null>(null);
  // jede Runde ein frisches Zählwerk (key)
  const [rundeNr, setRundeNr] = useState(0);
  // was gerade auf den Walzen steht, und ob ein Übertrag noch unterwegs ist
  const [eingestellt, setEingestellt] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [mitdrehen, setMitdrehen] = useState(false);
  const [rueck, setRueck] = useState<{ ok: boolean; text: string; deine?: string; richtig?: string; seit: number } | null>(null);
  const [punkte, setPunkte] = useState(0);
  const [stat, setStat] = useState({ richtig: 0, gesamt: 0 });
  const [sek, setSek] = useState(0);
  const [best, setBest] = useState(0);
  const uhrRef = useRef(0);
  const weiter = useRef<ReturnType<typeof setTimeout>>(undefined);

  const m = MODI.find(x => x.id === modus)!;
  const zeit = "zeit" in m ? m.zeit : null;
  const aufgaben = "aufgaben" in m ? m.aufgaben : null;
  const dezStellen = DEZ_BEREICHE.find(b => b.id === bereich)!.stellen;

  useEffect(() => () => clearTimeout(weiter.current), []);
  useEffect(() => { setBest(liesBest(modus)); }, [modus]);

  // auf Zeit: uhrRef ist das Ende (zählt runter); nach Aufgaben: der Start (zählt hoch)
  useEffect(() => {
    if (phase !== "laeuft") return;
    const t = setInterval(() => {
      if (zeit === null) { setSek((Date.now() - uhrRef.current) / 1000); return; }
      const r = Math.max(0, (uhrRef.current - Date.now()) / 1000);
      setSek(r);
      if (r <= 0) setPhase("ende");
    }, 100);
    return () => clearInterval(t);
  }, [phase, zeit]);

  useEffect(() => {
    if (phase === "ende" && punkte > liesBest(modus)) { schreibBest(modus, punkte); setBest(punkte); }
  }, [phase, punkte, modus]);

  const neueRunde = () => {
    const r = zaehlRunde(Number(stufe) as 1 | 2 | 3, basen, Math.random, dezStellen);
    setRunde(r); setRundeNr(n => n + 1); setEingestellt(r.start); setLaeuft(false); setRueck(null);
  };

  /** nach der Rückmeldung: nächste Aufgabe oder Schluss */
  const naechste = () => {
    clearTimeout(weiter.current);
    // wer einen Fehler anschaut, soll dafür keine Zeit verlieren
    if (rueck && !rueck.ok) uhrRef.current += Date.now() - rueck.seit;
    if (aufgaben !== null && stat.gesamt >= aufgaben) setPhase("ende");
    else neueRunde();
  };

  const starte = () => {
    uhrRef.current = zeit === null ? Date.now() : Date.now() + zeit * 1000;
    setSek(zeit ?? 0); setPunkte(0); setStat({ richtig: 0, gesamt: 0 }); setPhase("laeuft");
    neueRunde();
  };

  const antworte = () => {
    if (!runde) return;
    // Enter während der Rückmeldung: weiter, sobald man sie kurz gesehen hat
    if (rueck) { if (Date.now() - rueck.seit > SPERRE) naechste(); return; }
    // erst prüfen, wenn das Zählwerk stillsteht
    if (laeuft) return;
    const x = eingestellt;
    const ziel = zaehlZiel(runde);
    const ok = x === ziel;
    const gedreht = geaenderteStellen(runde.start, ziel, runde.basis, runde.stellen).length;
    if (ok) setPunkte(p => p + 5 + gedreht * 5);
    else if (zeit !== null) uhrRef.current -= STRAFE * 1000;
    setStat(s => ({ richtig: s.richtig + (ok ? 1 : 0), gesamt: s.gesamt + 1 }));
    setRueck(ok
      ? { ok, seit: Date.now(), text: `✔ ${gedreht > 1 ? `${gedreht} Walzen haben sich gedreht!` : "Richtig!"}` }
      : {
          ok, seit: Date.now(), text: `✘ Leider falsch${zeit !== null ? ` (−${STRAFE} s)` : ""}`,
          deine: ziffernVon(x, runde.basis, runde.stellen).map(ziffer).join(""),
          richtig: ziffernVon(ziel, runde.basis, runde.stellen).map(ziffer).join(""),
        });
    clearTimeout(weiter.current);
  };

  // die Rückmeldung bleibt stehen; danach geht es von selbst weiter
  useEffect(() => {
    if (!rueck) return;
    weiter.current = setTimeout(naechste, rueck.ok ? ZEIGEN_OK : ZEIGEN_FEHLER);
    return () => clearTimeout(weiter.current);
  }, [rueck]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase !== "laeuft" || !runde) {
    return (
      <div className="flex flex-col gap-3 items-start">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-black">🚗 Zählwerk-Rennen</h2>
          <ZaehlwerkErklaerung />
        </div>
        <p className="text-sm max-w-2xl">
          Das Zählwerk zeigt eine Zahl. Dreh die Walzen so, wie sie nach dem nächsten Schritt stehen, und prüf mit Enter.
          Achtung beim <b>Übertrag</b>: läuft eine Walze über die größte Ziffer, springt sie auf 0 und die Walze links
          dreht eins weiter. Je mehr Walzen sich drehen, desto mehr Punkte. Im Zehnersystem wird in Stellenwerten
          gezählt: <b>+ 1 H</b> heißt »einen Hunderter dazu«.
        </p>
        <Chips wahl={modus} setze={setModus} optionen={MODI} />
        <Chips wahl={stufe} setze={setStufe} optionen={STUFEN} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Zahlensysteme">
          {BASEN.map(b => (
            <button key={b.basis} className={`chip ${basen.includes(b.basis) ? "chip-on" : ""}`} aria-pressed={basen.includes(b.basis)}
              onClick={() => setBasen(xs => (xs.includes(b.basis) ? (xs.length > 1 ? xs.filter(x => x !== b.basis) : xs) : [...xs, b.basis]))}>
              {b.icon} {b.kurz}
            </button>
          ))}
        </div>
        {basen.includes(10) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">🔟 Zahlen</span>
            <Chips wahl={bereich} setze={setBereich} optionen={DEZ_BEREICHE} />
          </div>
        )}
        <MitdrehenSchalter an={mitdrehen} setze={setMitdrehen} />
        {phase === "ende" && (
          <p className="text-lg font-black" role="status">
            {zeit !== null ? "Zeit um!" : `Geschafft in ${uhr(sek)}!`} {punkte} Punkte, {stat.richtig} von {stat.gesamt} richtig.
            {punkte >= best && punkte > 0 && " 🏆 Neuer Bestwert!"}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={starte}>{phase === "ende" ? "🔁 Nochmal" : "▶ Start"}</button>
          {best > 0 && <span className="text-sm text-muted">Bestwert ({m.label}): {best}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 items-start">
      <div className="flex flex-wrap gap-4 items-center text-sm font-bold w-full">
        <span>⏱ {zeit !== null ? `${Math.ceil(sek)} s` : uhr(sek)}</span>
        {aufgaben !== null && <span>📝 Aufgabe {Math.min(stat.gesamt + (rueck ? 0 : 1), aufgaben)} von {aufgaben}</span>}
        <span>⭐ {punkte}</span>
        <span>✔ {stat.richtig}/{stat.gesamt}</span>
        <button className="btn text-xs ml-auto" onClick={() => { clearTimeout(weiter.current); setPhase("ende"); }}>⏹ Aufhören</button>
      </div>
      <p className="text-lg">
        <span className="text-muted text-sm">Start: </span>
        <b className="font-mono">{schreibe(runde.start, runde.basis, runde.stellen).replace(/\s/g, "")}</b>
        <span className="text-sm text-muted">{INDEX[runde.basis]}</span>
        <span className="text-3xl font-black ml-3">{schrittText(runde)}</span>
        <span className="text-sm text-muted ml-3">{BASEN.find(b => b.basis === runde.basis)!.name}</span>
      </p>
      <div className="overflow-x-auto max-w-full">
        <DrehZaehlwerk key={rundeNr} basis={runde.basis} stellen={runde.stellen} start={runde.start}
          mitdrehen={mitdrehen} gesperrt={!!rueck} beschriftet={runde.basis === 10} gross={runde.stellen <= 7}
          onWert={setEingestellt} onLaeuft={setLaeuft} onEnter={antworte} />
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <button className="btn-primary" onClick={antworte} disabled={laeuft && !rueck}>{rueck ? "Weiter ⏎" : "Prüfen ⏎"}</button>
        <MitdrehenSchalter an={mitdrehen} setze={setMitdrehen} />
        <span className="text-xs text-muted">▲▼ oder Pfeiltasten drehen, ←→ wechselt die Walze, eine Ziffer tippen stellt sie direkt ein.</span>
      </div>
      {rueck && (
        <div role="status" className="flex flex-col gap-1">
          <p className={`font-black ${rueck.ok ? "text-ok" : "text-bad"}`}>{rueck.text}</p>
          {rueck.deine && rueck.richtig && (
            <div className="font-mono text-xl flex flex-col gap-0.5">
              <span>
                <span className="text-sm text-muted font-sans inline-block w-16">deine</span>
                {rueck.deine.split("").map((c, i) => (
                  <span key={i} className={c !== rueck.richtig![i] ? "text-bad font-black underline" : "text-muted"}>{c}</span>
                ))}
              </span>
              <span>
                <span className="text-sm text-muted font-sans inline-block w-16">richtig</span>
                {rueck.richtig.split("").map((c, i) => (
                  <span key={i} className={c !== rueck.deine![i] ? "text-ok font-black" : ""}>{c}</span>
                ))}
              </span>
            </div>
          )}
          <p className="text-xs text-muted">⏎ Enter = weiter</p>
        </div>
      )}
    </div>
  );
}
