"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BEREICH } from "@/lib/leviathan/bereiche";
import { SOFORT } from "@/lib/leviathan/regeln";
import { mio, gesamt } from "@/lib/leviathan/hilfen";
import { TYP } from "@/lib/leviathan/laender";
import {
  budget, effizienz, ertrag, kipppunkte, saettigung, VERFALL, leereVerteilung, lernfaktor, MAX_KREDIT, STARTJAHR, verteilt,
} from "@/lib/leviathan/motor";
import { FOLGEN, HEBEL, type Hebel, type Verteilung, type Zustand } from "@/lib/leviathan/typen";
import { LeviathanAnzeige, Verlauf } from "./Anzeigen";
import { KRISE_TEXT } from "./Start";
import { Balken, Karte, QuelleLink } from "./ui";
import Rechenweg from "./Rechenweg";
import Wirkungsnetz from "./Wirkungsnetz";
import Zeitlupe, { TEMPO, type Tempo } from "./Zeitlupe";

/** Kleine Vorlieben im Browser (nur Komfort, darf fehlen). */
function vorliebe<T extends string>(schluessel: string, standard: T, erlaubt: readonly T[]): T {
  try {
    const x = localStorage.getItem(schluessel) as T | null;
    return x && erlaubt.includes(x) ? x : standard;
  } catch { return standard; }
}
function merke(schluessel: string, wert: string) {
  try { localStorage.setItem(schluessel, wert); } catch { /* egal */ }
}

export default function Spiel({ z, onRunde }: { z: Zustand; onRunde: (v: Verteilung) => void }) {
  const [v, setV] = useState<Verteilung>(leereVerteilung);
  const [ansicht, setAnsicht] = useState<"netz" | "rechenweg" | "zeitlupe">("netz");
  const [tempo, setTempo] = useState<Tempo>(() => vorliebe("hp_leviathan_tempo", "mittel", Object.keys(TEMPO) as Tempo[]));
  const [zeitlupeAuto, setZeitlupeAuto] = useState(() => vorliebe("hp_leviathan_zeitlupe", "an", ["an", "aus"] as const) === "an");
  const [autostart, setAutostart] = useState(false);
  const zusammenhang = useRef<HTMLDivElement>(null);
  // Neue Runde: Verteilung leeren; im Zeitlupen-Modus die Runde gleich abspielen.
  const ersteRunde = useRef(z.runde);
  useEffect(() => {
    setV(leereVerteilung());
    if (zeitlupeAuto && z.runde !== ersteRunde.current && z.rechnung) {
      setAnsicht("zeitlupe");
      setAutostart(true);
      setTimeout(() => zusammenhang.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [z.runde, z.status]);
  const b = budget(z);
  const verfuegbar = b.gesamt + v.kredit;
  const rest = verfuegbar - verteilt(v);
  const vorher = z.verlauf[z.verlauf.length - 2]?.w;
  const eff = effizienz(z);
  const t = TYP[z.typ];
  const jahr = STARTJAHR + 2 * z.runde;
  const letzte = z.meldungen.filter((m) => m.runde === z.runde);
  const frueher = useMemo(() => z.meldungen.filter((m) => m.runde < z.runde).slice().reverse(), [z.meldungen, z.runde]);
  const kp = kipppunkte(z.einst);
  const wahlJahr = (z.runde + 1) % 2 === 0;

  // Funktional aktualisieren: schnelle Mehrfachklicks sehen sonst einen veralteten Stand.
  const aendere = (h: Hebel | "kredit", schritt: number) => setV((alt) => {
    const neu = { ...alt, [h]: Math.max(0, alt[h] + schritt) };
    if (h === "kredit") neu.kredit = Math.min(MAX_KREDIT, neu.kredit);
    return h !== "kredit" && schritt > 0 && verteilt(neu) > b.gesamt + neu.kredit ? alt : neu;
  });
  const plus = (h: Hebel) => aendere(h, 1);
  const minus = (h: Hebel) => aendere(h, -1);

  function beenden() {
    onRunde(v);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-black text-lg">{t.icon} {z.land}</span>
        <span className="tabular-nums">Jahr <b>{jahr}</b> · Runde <b>{z.runde + 1}</b> von {z.einst.runden}</span>
        {z.einst.sichtbar && <span>{KRISE_TEXT[z.einst.krise].icon} {KRISE_TEXT[z.einst.krise].name}</span>}
        {z.regierung.autokrat && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-(--red) text-white">👑 Autokrat an der Macht</span>}
        {z.regierung.geschlossen && !z.regierung.autokrat && <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-(--border)">Einparteienstaat – keine Wahlen</span>}
        {z.status === "wiederaufbau" && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-(--accent) text-(--accent-text,#111)">🏗️ Wiederaufbau</span>}
        {wahlJahr && !z.regierung.geschlossen && <span className="text-xs text-(--text-muted)">🗳️ Nach dieser Runde wird gewählt.</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Karte titel="Leviathan">
          <LeviathanAnzeige w={z.w} />
        </Karte>
        <Karte titel="Lebensqualität" rechts={<span className="text-3xl font-black tabular-nums">{Math.round(z.lq)}</span>}>
          <Verlauf verlauf={z.verlauf} wert={(s) => s.lq} />
          <p className="text-xs text-(--text-muted) mt-1">
            Sammelwert aus Wirtschaft, Gesundheit, Zusammenhalt, Demokratie, wenig Korruption, Vertrauen, Gleichheit, Klima und Bildung (angelehnt an den World Happiness Report).
            Fällt sie zwei Runden lang auf 12 oder darunter, bricht das Land zusammen.
          </p>
        </Karte>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Karte titel="Deine Entscheidungen" rechts={
          <span className={`font-black tabular-nums ${rest < 0 ? "text-(--red)" : ""}`}>{rest} von {verfuegbar} Aktionspunkten frei</span>}>
          <div className="flex flex-col gap-2">
            {HEBEL.map((h) => {
              const gesperrt = (z.gesperrt[h] ?? 0) > 0;
              const grund = v[h] ? ertrag(v[h]) * eff : 0;
              let wirkung = grund * saettigung(z.w[h]);
              if (h === "energie") wirkung *= lernfaktor(z.energieKumuliert);
              const verfall = VERFALL * (z.w[h] - 10);
              const sofort = SOFORT[h].map((s) => `${BEREICH[s.nach].name} ${s.faktor * grund > 0 ? "+" : "−"}${Math.abs(Math.round(s.faktor * grund))}`);
              return (
                <div key={h} className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${gesperrt ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-[min(100%,18rem)]">
                    <Balken g={h} wert={z.w[h]} delta={vorher ? z.w[h] - vorher[h] : undefined} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <button onClick={() => minus(h)} disabled={gesperrt || v[h] === 0} aria-label={`${BEREICH[h].name} weniger`}
                      className="w-7 h-7 rounded-lg border border-(--border) font-black disabled:opacity-30">−</button>
                    <span className="w-6 text-center font-black tabular-nums" aria-label={`${v[h]} Punkte in ${BEREICH[h].name}`}>{v[h]}</span>
                    <button onClick={() => plus(h)} disabled={gesperrt || rest <= 0} aria-label={`${BEREICH[h].name} mehr`}
                      className="w-7 h-7 rounded-lg border border-(--border) font-black disabled:opacity-30">+</button>
                    <span className="w-16 text-xs text-(--text-muted) tabular-nums">
                      {gesperrt ? `🔒 ${z.gesperrt[h]} R.` : v[h] ? `≈ +${Math.round(wirkung)}` : ""}
                    </span>
                  </div>
                  <p className="basis-full text-[11px] text-(--text-muted) pl-8 -mt-0.5">
                    {v[h]
                      ? <>netto ≈ <b className="text-(--text)">{wirkung - verfall >= 0 ? "+" : "−"}{Math.abs(Math.round(wirkung - verfall))}</b> (Verfall −{Math.round(verfall)}){sofort.length > 0 && <> · sofort: {sofort.join(", ")}</>}</>
                      : `ohne Punkte: −${Math.round(verfall)} Verfall${SOFORT[h].length ? ` · Punkte wirken auch direkt auf ${SOFORT[h].map((s) => BEREICH[s.nach].name).join(", ")}` : ""}`}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-xl border border-(--border) p-3">
              <div className="font-bold mb-1">Haushalt dieser Runde</div>
              <Posten name="Steuern" x={b.steuern} />
              {b.rohstoff > 0.4 && <Posten name="Rohstoffe" x={b.rohstoff} />}
              {b.hilfe > 0.4 && <Posten name="Internationale Hilfe" x={b.hilfe} />}
              {b.korruption < -0.4 && <Posten name="Korruption versickert" x={b.korruption} />}
              {b.rente > 0.4 && <Posten name="Renten" x={-b.rente} />}
              {b.zinsen > 0.4 && <Posten name="Zinsen" x={-b.zinsen} />}
              {b.korrektur !== 0 && <Posten name="Ereignisse" x={b.korrektur} />}
              {b.wiederaufbau !== 0 && <Posten name="Wiederaufbau" x={b.wiederaufbau} />}
              <div className="border-t border-(--border) mt-1 pt-1 flex justify-between font-black"><span>Aktionspunkte</span><span>{b.gesamt}</span></div>
              <p className="text-xs text-(--text-muted) mt-1">
                Jeder Punkt wirkt zu {Math.round(eff * 100)} % – Korruption und ein schwacher Staat fressen mit.
              </p>
            </div>
            <div className="rounded-xl border border-(--border) p-3">
              <div className="font-bold mb-1">Kredit aufnehmen</div>
              <div className="flex items-center gap-2">
                <button onClick={() => aendere("kredit", -1)} disabled={v.kredit === 0}
                  aria-label="Kredit verringern" className="w-7 h-7 rounded-lg border border-(--border) font-black disabled:opacity-30">−</button>
                <span className="w-6 text-center font-black">{v.kredit}</span>
                <button onClick={() => aendere("kredit", 1)} disabled={v.kredit >= MAX_KREDIT}
                  aria-label="Kredit erhöhen" className="w-7 h-7 rounded-lg border border-(--border) font-black disabled:opacity-30">+</button>
              </div>
              <p className="text-xs text-(--text-muted) mt-1">
                Schulden: <b>{z.schulden}</b>. Jeder Kredit kostet ab jetzt Zinsen; ab 18 droht eine Schuldenkrise.
                Nicht verteilte Punkte tilgen Schulden.
              </p>
            </div>
          </div>

          <button onClick={beenden} disabled={rest < 0}
            className="mt-4 w-full px-5 py-3 rounded-xl font-black bg-(--accent) text-(--accent-text,#111) disabled:opacity-40">
            Runde beenden → {jahr + 2}
          </button>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={zeitlupeAuto}
              onChange={(e) => { setZeitlupeAuto(e.target.checked); merke("hp_leviathan_zeitlupe", e.target.checked ? "an" : "aus"); }} />
            🎬 Nach »Runde beenden« die Runde im Wirkungsnetz abspielen
          </label>
        </Karte>

        <div className="flex flex-col gap-4">
          <Karte titel="Lage im Land">
            <div className="flex flex-col gap-1.5">
              {FOLGEN.map((g) => (
                <Balken key={g} g={g} wert={z.w[g]} delta={vorher ? z.w[g] - vorher[g] : undefined}
                  markierungen={g === "klima" ? kp : []} />
              ))}
            </div>
            {z.kipppunkte.length > 0 && (
              <p className="text-xs mt-2" style={{ color: "var(--red)" }}>
                🧊 Überschritten: Kipppunkt{z.kipppunkte.length > 1 ? "e" : ""} bei {z.kipppunkte.join(", ")} – die Klimalast sinkt nicht mehr darunter.
              </p>
            )}
          </Karte>
          <Karte titel="Bevölkerung" rechts={<span className="font-black tabular-nums">{mio(gesamt(z.bev))}</span>}>
            <Pyramide z={z} />
          </Karte>
        </div>
      </div>

      <div ref={zusammenhang} className="scroll-mt-4">
      <Karte titel="Wie hängt alles zusammen?" rechts={
        <div className="inline-flex flex-wrap rounded-xl border border-(--border) p-1" role="tablist">
          {([["netz", "🕸️ Wirkungsnetz"], ["zeitlupe", "🎬 Zeitlupe"], ["rechenweg", "🧮 Rechenweg"]] as const).map(([id, t]) => (
            <button key={id} role="tab" aria-selected={ansicht === id} onClick={() => { setAnsicht(id); setAutostart(false); }}
              className={`px-3 py-1 rounded-lg text-sm font-bold ${ansicht === id ? "bg-(--accent) text-(--accent-text,#111)" : "text-(--text-muted)"}`}>{t}</button>
          ))}
        </div>}>
        {ansicht === "netz" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-(--border) px-3 py-2 text-sm">
              <span>Verteile direkt im Netz: <b>+</b> und <b>−</b> an den eckigen Bereichen.</span>
              <span className={`font-black tabular-nums ${rest < 0 ? "text-(--red)" : ""}`}>{rest} von {verfuegbar} AP frei</span>
              <button onClick={beenden} disabled={rest < 0}
                className="ml-auto px-4 py-1.5 rounded-lg font-black bg-(--accent) text-(--accent-text,#111) disabled:opacity-40">
                Runde beenden → {jahr + 2}
              </button>
            </div>
            <Wirkungsnetz z={z} hervorheben={HEBEL.filter((h) => v[h] > 0)} einsatz={v} onPlus={plus} onMinus={minus}
              frei={{ rest, von: verfuegbar }} />
          </div>
        )}
        {ansicht === "zeitlupe" && (
          <Zeitlupe key={`${z.runde}-${autostart}`} z={z} tempo={tempo} autostart={autostart}
            onTempo={(t) => { setTempo(t); merke("hp_leviathan_tempo", t); }}
            // Nach dem Abspielen geht es im Netz weiter: dort gleich die nächsten Punkte verteilen.
            onFertig={autostart ? () => {
              setAnsicht("netz");
              setAutostart(false);
              zusammenhang.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
            } : undefined} />
        )}
        {ansicht === "rechenweg" && <Rechenweg key={z.runde} z={z} />}
      </Karte>
      </div>

      <Karte titel={letzte.length ? `Nachrichten ${jahr}` : "Nachrichten"}>
        {letzte.length === 0 && <p className="text-sm text-(--text-muted)">{z.runde === 0 ? "Noch ist alles ruhig. Verteile deine ersten Aktionspunkte." : "Zwei ruhige Jahre."}</p>}
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
          {letzte.map((m, i) => <Meldungskarte key={i} m={m} />)}
        </div>
        {frueher.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-(--text-muted)">Frühere Nachrichten ({frueher.length})</summary>
            <ul className="mt-2 space-y-1">
              {frueher.map((m, i) => (
                <li key={i}><span className="tabular-nums text-(--text-muted)">{STARTJAHR + 2 * m.runde}</span> {m.icon} <b>{m.titel}</b>{m.folgen ? ` – ${m.folgen}` : ""}</li>
              ))}
            </ul>
          </details>
        )}
      </Karte>
    </div>
  );
}

function Posten({ name, x }: { name: string; x: number }) {
  return <div className="flex justify-between tabular-nums"><span>{name}</span><span>{x >= 0 ? "+" : "−"}{Math.abs(x).toFixed(1)}</span></div>;
}

export function Meldungskarte({ m }: { m: Zustand["meldungen"][number] }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: m.positiv ? "var(--green)" : "var(--border)" }}>
      <div className="font-black">{m.icon} {m.titel}</div>
      <p className="text-sm mt-1">{m.text}</p>
      {m.folgen && <p className="text-xs mt-1 font-bold">{m.folgen}</p>}
      <div className="mt-1"><QuelleLink id={m.quelle} /></div>
    </div>
  );
}

function Pyramide({ z }: { z: Zustand }) {
  const b = z.bev;
  const g = gesamt(b);
  const zeilen = [
    { name: "65 und älter", x: b.alt },
    { name: "20 bis 64", x: b.erwerb },
    { name: "unter 20", x: b.jung },
  ];
  return (
    <div className="text-sm">
      {zeilen.map((r) => (
        <div key={r.name} className="flex items-center gap-2 my-1">
          <span className="w-24 shrink-0">{r.name}</span>
          <div className="flex-1 h-3 rounded-full bg-(--surface-hover) overflow-hidden">
            <div className="h-full bg-(--accent) transition-all duration-500" style={{ width: `${(r.x / g) * 100}%` }} />
          </div>
          <span className="w-12 text-right tabular-nums">{Math.round((r.x / g) * 100)} %</span>
        </div>
      ))}
      <p className="text-xs text-(--text-muted) mt-2">
        {b.tfr.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Kinder je Frau
        {b.tfr < 2.1 ? " – unter 2,1 schrumpft die Bevölkerung ohne Zuwanderung." : " – die Bevölkerung wächst."}
        {" "}Auf 100 Erwerbstätige kommen {Math.round((b.alt / b.erwerb) * 100)} Ältere.
      </p>
    </div>
  );
}
