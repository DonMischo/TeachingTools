"use client";
/**
 * Die Seitenspalte der Rallye: Frage, Punktestand, Rückmeldung und am Ende
 * die Sterne samt neuen Erfolgen. Geantwortet wird nebenan im Raster.
 */
import { useState } from "react";
import { pseNummer } from "@/lib/pse/elemente";
import { BEREICHE, RUNDE, type Bereich } from "@/lib/pse/rallye";
import { ERFOLGE, erreicht, PUNKTE_JE_RUNDE } from "@/lib/pse/erfolge";
import type { Rallye } from "./useRallye";

const Sterne = ({ n, gross }: { n: number; gross?: boolean }) => (
  <span className={gross ? "text-3xl" : "text-sm"} aria-label={`${n} von 3 Sternen`}>
    {"★".repeat(n)}<span className="opacity-25">{"★".repeat(3 - n)}</span>
  </span>
);

/** Alle Erfolge, nach Gruppe sortiert, mit Fortschrittsbalken. */
function Erfolgsliste({ stand }: { stand: Rallye["stand"] }) {
  const gruppen = [...new Set(ERFOLGE.map(e => e.gruppe))];
  return (
    <div className="flex flex-col gap-3">
      {gruppen.map(g => (
        <div key={g}>
          <div className="text-xs font-bold text-muted mb-1">{g}</div>
          <div className="flex flex-col gap-1">
            {ERFOLGE.filter(e => e.gruppe === g).map(e => {
              const wert = Math.min(e.wert(stand), e.ziel);
              const fertig = erreicht(e, stand);
              return (
                <div key={e.id} title={e.text}
                  className={`rounded-lg border px-2 py-1 ${fertig ? "border-accent bg-accent/10" : "border-line"}`}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={fertig ? "" : "grayscale opacity-50"}>{e.icon}</span>
                    <span className={`font-medium ${fertig ? "text-fg" : "text-muted"}`}>{e.name}</span>
                    <span className="ml-auto tabular-nums text-muted">{wert}/{e.ziel}</span>
                  </div>
                  {!fertig && (
                    <div className="h-1 rounded bg-line mt-1 overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${(wert / e.ziel) * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RallyePanel({ r }: { r: Rallye }) {
  const [zeigeErfolge, setZeigeErfolge] = useState(false);

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black">🎯 PSE-Rallye</h2>
        <span className="text-sm tabular-nums text-muted">
          {r.ergebnis ? RUNDE : r.nummer}/{RUNDE} · <strong className="text-fg">{r.punkte}</strong> Pkt.
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {(Object.keys(BEREICHE) as Bereich[]).map(b => (
          <button key={b} onClick={() => r.setBereich(b)} title={BEREICHE[b].hinweis}
            className={`px-2.5 py-1 rounded-lg border text-xs ${
              r.bereich === b ? "border-accent text-fg font-bold" : "border-line text-muted hover:text-fg"}`}>
            {BEREICHE[b].label}
          </button>
        ))}
      </div>

      {r.ergebnis ? (
        <div className="flex flex-col gap-3">
          <div className="text-center">
            <Sterne n={r.ergebnis.sterne} gross />
            <div className="text-2xl font-black mt-1">{r.ergebnis.punkte} von {PUNKTE_JE_RUNDE} Punkten</div>
            <p className="text-sm text-muted mt-1">{r.ergebnis.text}</p>
          </div>
          {r.ergebnis.erfolge.length > 0 && (
            <div className="rounded-xl border border-accent bg-accent/10 p-3 flex flex-col gap-1">
              <div className="text-sm font-bold">Neue Erfolge</div>
              {r.ergebnis.erfolge.map(e => (
                <div key={e.id} className="text-sm">{e.icon} <strong>{e.name}</strong> — {e.text}</div>
              ))}
            </div>
          )}
          <button onClick={r.neueRunde} className="btn-primary w-full">Noch eine Runde</button>
        </div>
      ) : r.aufgabe ? (
        <div className="flex flex-col gap-3">
          <p className="text-base font-medium">{r.aufgabe.frage}</p>

          {r.geloest ? (
            <>
              <div className="rounded-xl border border-good bg-good/10 px-3 py-2 text-sm">
                <strong>{r.rueckmeldung?.richtig ? "Richtig." : "Die Lösung:"}</strong>{" "}
                {r.aufgabe.erklaerung}
              </div>
              <button onClick={r.weiter} className="btn-primary w-full">
                {r.nummer >= RUNDE ? "Runde abschließen" : "Weiter"}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">
                Klick das passende Feld im Periodensystem an.
                {r.versuche > 0 && ` ${r.versuche} Fehlversuch${r.versuche > 1 ? "e" : ""} — noch ${
                  r.versuche >= 2 ? 1 : 3 - r.versuche} Punkt${r.versuche >= 2 ? "" : "e"}.`}
              </p>
              {r.rueckmeldung && !r.rueckmeldung.richtig && (
                <div className="rounded-xl border border-bad bg-bad/10 px-3 py-2 text-sm text-bad">
                  {pseNummer(r.rueckmeldung.z)?.name} passt nicht. Versuch es noch einmal.
                </div>
              )}
              <button onClick={r.aufgeben}
                className="text-xs text-muted hover:text-fg underline self-start">
                Lösung zeigen
              </button>
            </>
          )}
        </div>
      ) : (
        <button onClick={r.neueRunde} className="btn-primary w-full">Runde starten</button>
      )}

      <div className="border-t border-line pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Gesamt: <strong className="text-fg">{r.stand.punkte}</strong> Pkt. ·{" "}
            <strong className="text-fg">{r.stand.sterne}</strong> ★ ·{" "}
            {r.stand.gefunden.length}/118 Elemente
          </span>
          <button onClick={() => setZeigeErfolge(z => !z)}
            className="text-xs text-muted hover:text-fg underline">
            Erfolge ({r.stand.erfolge.length}/{ERFOLGE.length})
          </button>
        </div>
        {zeigeErfolge && <div className="mt-3"><Erfolgsliste stand={r.stand} /></div>}
      </div>
    </div>
  );
}
