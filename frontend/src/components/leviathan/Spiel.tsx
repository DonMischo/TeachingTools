"use client";
import { useMemo, useState } from "react";
import { BEREICH } from "@/lib/leviathan/bereiche";
import { mio, gesamt } from "@/lib/leviathan/hilfen";
import { TYP } from "@/lib/leviathan/laender";
import {
  budget, effizienz, ertrag, kipppunkte, leereVerteilung, lernfaktor, MAX_KREDIT, STARTJAHR, verteilt,
} from "@/lib/leviathan/motor";
import { FOLGEN, HEBEL, type Hebel, type Verteilung, type Zustand } from "@/lib/leviathan/typen";
import { LeviathanAnzeige, Verlauf } from "./Anzeigen";
import { KRISE_TEXT } from "./Start";
import { Balken, Karte, QuelleLink } from "./ui";
import Wirkungsnetz from "./Wirkungsnetz";

export default function Spiel({ z, onRunde }: { z: Zustand; onRunde: (v: Verteilung) => void }) {
  const [v, setV] = useState<Verteilung>(leereVerteilung);
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

  const setze = (h: Hebel | "kredit", n: number) => setV((alt) => ({ ...alt, [h]: Math.max(0, n) }));
  const plus = (h: Hebel) => rest > 0 && setze(h, v[h] + 1);
  const minus = (h: Hebel) => setze(h, v[h] - 1);

  function beenden() {
    onRunde(v);
    setV(leereVerteilung());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-black text-lg">{t.icon} {z.land}</span>
        <span className="tabular-nums">Jahr <b>{jahr}</b> · Runde <b>{z.runde + 1}</b> von {z.einst.runden}</span>
        {z.einst.sichtbar && <span>{KRISE_TEXT[z.einst.krise].icon} {KRISE_TEXT[z.einst.krise].name}</span>}
        {z.regierung.autokrat && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--red)] text-white">👑 Autokrat an der Macht</span>}
        {z.regierung.geschlossen && !z.regierung.autokrat && <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-[var(--border)]">Einparteienstaat – keine Wahlen</span>}
        {z.status === "wiederaufbau" && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--accent)] text-[var(--accent-text,#111)]">🏗️ Wiederaufbau</span>}
        {wahlJahr && !z.regierung.geschlossen && <span className="text-xs text-[var(--text-muted)]">🗳️ Nach dieser Runde wird gewählt.</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Karte titel="Leviathan">
          <LeviathanAnzeige w={z.w} />
        </Karte>
        <Karte titel="Lebensqualität" rechts={<span className="text-3xl font-black tabular-nums">{Math.round(z.lq)}</span>}>
          <Verlauf verlauf={z.verlauf} wert={(s) => s.lq} />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Sammelwert aus Wirtschaft, Gesundheit, Zusammenhalt, Gleichheit, Klima, Vertrauen, Demokratie und Bildung.
            Fällt sie zwei Runden lang auf 12 oder darunter, bricht das Land zusammen.
          </p>
        </Karte>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Karte titel="Deine Entscheidungen" rechts={
          <span className={`font-black tabular-nums ${rest < 0 ? "text-[var(--red)]" : ""}`}>{rest} von {verfuegbar} Aktionspunkten frei</span>}>
          <div className="flex flex-col gap-2">
            {HEBEL.map((h) => {
              const gesperrt = (z.gesperrt[h] ?? 0) > 0;
              let wirkung = v[h] ? ertrag(v[h]) * eff * Math.max(0.15, 1.1 - z.w[h] / 100) : 0;
              if (h === "energie") wirkung *= lernfaktor(z.energieKumuliert);
              return (
                <div key={h} className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${gesperrt ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-[min(100%,18rem)]">
                    <Balken g={h} wert={z.w[h]} delta={vorher ? z.w[h] - vorher[h] : undefined} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <button onClick={() => minus(h)} disabled={gesperrt || v[h] === 0} aria-label={`${BEREICH[h].name} weniger`}
                      className="w-7 h-7 rounded-lg border border-[var(--border)] font-black disabled:opacity-30">−</button>
                    <span className="w-6 text-center font-black tabular-nums" aria-label={`${v[h]} Punkte in ${BEREICH[h].name}`}>{v[h]}</span>
                    <button onClick={() => plus(h)} disabled={gesperrt || rest <= 0} aria-label={`${BEREICH[h].name} mehr`}
                      className="w-7 h-7 rounded-lg border border-[var(--border)] font-black disabled:opacity-30">+</button>
                    <span className="w-16 text-xs text-[var(--text-muted)] tabular-nums">
                      {gesperrt ? `🔒 ${z.gesperrt[h]} R.` : v[h] ? `≈ +${Math.round(wirkung)}` : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-xl border border-[var(--border)] p-3">
              <div className="font-bold mb-1">Haushalt dieser Runde</div>
              <Posten name="Steuern" x={b.steuern} />
              {b.rohstoff > 0.4 && <Posten name="Rohstoffe" x={b.rohstoff} />}
              {b.rente > 0.4 && <Posten name="Renten" x={-b.rente} />}
              {b.zinsen > 0.4 && <Posten name="Zinsen" x={-b.zinsen} />}
              {b.korrektur !== 0 && <Posten name="Ereignisse" x={b.korrektur} />}
              {b.wiederaufbau !== 0 && <Posten name="Wiederaufbau" x={b.wiederaufbau} />}
              <div className="border-t border-[var(--border)] mt-1 pt-1 flex justify-between font-black"><span>Aktionspunkte</span><span>{b.gesamt}</span></div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Jeder Punkt wirkt zu {Math.round(eff * 100)} % – Korruption und ein schwacher Staat fressen mit.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-3">
              <div className="font-bold mb-1">Kredit aufnehmen</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setze("kredit", v.kredit - 1)} disabled={v.kredit === 0}
                  aria-label="Kredit verringern" className="w-7 h-7 rounded-lg border border-[var(--border)] font-black disabled:opacity-30">−</button>
                <span className="w-6 text-center font-black">{v.kredit}</span>
                <button onClick={() => setze("kredit", Math.min(MAX_KREDIT, v.kredit + 1))} disabled={v.kredit >= MAX_KREDIT}
                  aria-label="Kredit erhöhen" className="w-7 h-7 rounded-lg border border-[var(--border)] font-black disabled:opacity-30">+</button>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Schulden: <b>{z.schulden}</b>. Jeder Kredit kostet ab jetzt Zinsen; ab 18 droht eine Schuldenkrise.
                Nicht verteilte Punkte tilgen Schulden.
              </p>
            </div>
          </div>

          <button onClick={beenden} disabled={rest < 0}
            className="mt-4 w-full px-5 py-3 rounded-xl font-black bg-[var(--accent)] text-[var(--accent-text,#111)] disabled:opacity-40">
            Runde beenden → {jahr + 2}
          </button>
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

      <Karte titel="🕸️ Wirkungsnetz – wie hängt alles zusammen?">
        <Wirkungsnetz z={z} hervorheben={HEBEL.filter((h) => v[h] > 0)} einsatz={v} />
      </Karte>

      <Karte titel={letzte.length ? `Nachrichten ${jahr}` : "Nachrichten"}>
        {letzte.length === 0 && <p className="text-sm text-[var(--text-muted)]">{z.runde === 0 ? "Noch ist alles ruhig. Verteile deine ersten Aktionspunkte." : "Zwei ruhige Jahre."}</p>}
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
          {letzte.map((m, i) => <Meldungskarte key={i} m={m} />)}
        </div>
        {frueher.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-[var(--text-muted)]">Frühere Nachrichten ({frueher.length})</summary>
            <ul className="mt-2 space-y-1">
              {frueher.map((m, i) => (
                <li key={i}><span className="tabular-nums text-[var(--text-muted)]">{STARTJAHR + 2 * m.runde}</span> {m.icon} <b>{m.titel}</b>{m.folgen ? ` – ${m.folgen}` : ""}</li>
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
          <div className="flex-1 h-3 rounded-full bg-[var(--surface-hover)] overflow-hidden">
            <div className="h-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${(r.x / g) * 100}%` }} />
          </div>
          <span className="w-12 text-right tabular-nums">{Math.round((r.x / g) * 100)} %</span>
        </div>
      ))}
      <p className="text-xs text-[var(--text-muted)] mt-2">
        {b.tfr.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Kinder je Frau
        {b.tfr < 2.1 ? " – unter 2,1 schrumpft die Bevölkerung ohne Zuwanderung." : " – die Bevölkerung wächst."}
        {" "}Auf 100 Erwerbstätige kommen {Math.round((b.alt / b.erwerb) * 100)} Ältere.
      </p>
    </div>
  );
}
