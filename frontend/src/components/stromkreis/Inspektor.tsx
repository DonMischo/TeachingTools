"use client";
/** Rechte Spalte: Werte des Ausgewählten einstellen und ablesen. */
import { useState } from "react";
import type { Bauteil, Draht } from "@/lib/stromkreis/modell";
import type { Messung } from "@/lib/stromkreis/simulation";
import { LED_FARBEN, TEILE, type Feld } from "@/lib/stromkreis/teile";
import { formatiere } from "@/lib/stromkreis/format";
import type { Effektiv } from "./Zeichenflaeche";

export interface Stand {
  messung?: Messung;
  drahtStrom?: number;
  /** Effektivwerte bei Wechselstrom. */
  eff?: Effektiv;
}

function Zahlfeld({ feld, wert, setzen }: { feld: Feld; wert: number; setzen: (v: number) => void }) {
  const anzeige = (v: number) => String(Number((v / feld.faktor).toPrecision(6))).replace(".", ",");
  const [text, setText] = useState(anzeige(wert));
  const uebernehmen = () => {
    const v = Number(text.replace(",", ".").trim());
    if (!Number.isFinite(v)) { setText(anzeige(wert)); return; }
    const si = Math.max(feld.min, Math.min(feld.max, v * feld.faktor));
    setzen(si);
    setText(anzeige(si));
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{feld.label}</span>
      <span className="flex items-center gap-2">
        <input
          className="input w-full" inputMode="decimal" value={text}
          onChange={e => setText(e.target.value)} onBlur={uebernehmen}
          onKeyDown={e => { if (e.key === "Enter") uebernehmen(); }}
        />
        {feld.einheit && <span className="text-sm text-muted w-8">{feld.einheit}</span>}
      </span>
    </label>
  );
}

function Zeile({ name, wert }: { name: string; wert: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{name}</span>
      <span className="font-mono font-semibold">{wert}</span>
    </div>
  );
}

interface Props {
  bauteil?: Bauteil;
  draht?: Draht;
  stand: Stand;
  wechsel: boolean;
  setzeWert: (id: string, name: string, wert: number) => void;
  schalten: (id: string) => void;
  drehen: () => void;
  loeschen: () => void;
  reparieren: (id: string) => void;
  oszi: (id: string) => void;
}

export default function Inspektor({ bauteil, draht, stand, wechsel, setzeWert, schalten, drehen, loeschen, reparieren, oszi }: Props) {
  if (draht) {
    return (
      <div className="card p-4 flex flex-col gap-3">
        <div className="font-bold">〰️ Leitung</div>
        <Zeile name="Stromstärke" wert={formatiere(Math.abs(stand.drahtStrom ?? 0), "A")} />
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={drehen}>↻ Drehen</button>
          <button className="btn btn-danger flex-1" onClick={loeschen}>🗑 Löschen</button>
        </div>
      </div>
    );
  }
  if (!bauteil) {
    return (
      <div className="card p-4 flex flex-col gap-2 text-sm">
        <div className="font-bold">So geht&apos;s</div>
        <p className="text-muted">Bauteil links wählen, dann auf die Fläche klicken — oder aufziehen, um Lage und Länge festzulegen.</p>
        <p className="text-muted">Mit <b>Leitung</b> von Punkt zu Punkt ziehen. Was sich an einem Punkt trifft, ist verbunden.</p>
        <p className="text-muted">Schalter mit einem Klick umlegen. Bauteile verschieben, an den Enden länger ziehen; <b>R</b> dreht, <b>Entf</b> löscht, <b>Strg+Z</b> nimmt zurück.</p>
        <p className="text-muted">Leere Fläche ziehen verschiebt die Ansicht, das Mausrad zoomt.</p>
      </div>
    );
  }

  const info = TEILE[bauteil.art];
  const w = { ...info.werte, ...bauteil.werte };
  const m = stand.messung;
  const quelle = bauteil.art === "batterie" || bauteil.art === "wechselquelle";
  // Quellen zeigen Klemmenspannung und abgegebenen Strom, alle anderen Betrag von U und I.
  const u = m ? (quelle ? -m.spannung : Math.abs(m.spannung)) : 0;
  const i = m ? Math.abs(m.strom) : 0;
  const p = m ? (quelle ? -m.leistung : m.leistung) : 0;
  const ac = wechsel && stand.eff;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="font-bold">{info.name}</div>

      {bauteil.art === "schalter" && (
        <button className="btn btn-primary" onClick={() => schalten(bauteil.id)}>
          {w.geschlossen >= 0.5 ? "Öffnen" : "Schließen"}
        </button>
      )}
      {bauteil.art === "umschalter" && (
        <button className="btn btn-primary" onClick={() => schalten(bauteil.id)}>Umlegen (Stellung {w.stellung >= 0.5 ? 2 : 1})</button>
      )}
      {bauteil.art === "led" && (
        <label className="flex flex-col gap-1">
          <span className="label">Farbe</span>
          <select
            className="input" value={Math.round(w.farbe)}
            onChange={e => {
              const k = Number(e.target.value);
              setzeWert(bauteil.id, "farbe", k);
              setzeWert(bauteil.id, "durchlass", LED_FARBEN[k].durchlass);
            }}
          >
            {LED_FARBEN.map((f, k) => <option key={f.name} value={k}>{f.name} ({formatiere(f.durchlass, "V")})</option>)}
          </select>
        </label>
      )}
      {info.felder?.map(f => (
        <Zahlfeld key={`${bauteil.id}:${f.schluessel}`} feld={f} wert={w[f.schluessel]} setzen={v => setzeWert(bauteil.id, f.schluessel, v)} />
      ))}

      {m && (
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          {bauteil.art === "trafo" ? (
            <>
              <Zeile name="U primär" wert={formatiere(ac ? Math.sqrt(stand.eff!.u) : Math.abs(m.spannung), "V")} />
              <Zeile name="I primär" wert={formatiere(ac ? Math.sqrt(stand.eff!.i) : Math.abs(m.strom), "A")} />
              <Zeile name="U sekundär" wert={formatiere(ac ? Math.sqrt(stand.eff!.u2) : Math.abs(m.spannung2 ?? 0), "V")} />
              <Zeile name="I sekundär" wert={formatiere(ac ? Math.sqrt(stand.eff!.i2) : Math.abs(m.strom2 ?? 0), "A")} />
            </>
          ) : (
            <>
              <Zeile name={quelle ? "Klemmenspannung" : "Spannung"} wert={ac ? `${formatiere(Math.sqrt(stand.eff!.u), "V")} eff.` : formatiere(u, "V")} />
              <Zeile name={quelle ? "abgegebener Strom" : "Stromstärke"} wert={ac ? `${formatiere(Math.sqrt(stand.eff!.i), "A")} eff.` : formatiere(i, "A")} />
              {!ac && <Zeile name={quelle ? "abgegebene Leistung" : "Leistung"} wert={formatiere(p, "W")} />}
            </>
          )}
          {m.drehzahl !== undefined && <Zeile name="Drehzahl" wert={`${Math.round(Math.abs(m.drehzahl) * 60 / (2 * Math.PI)).toLocaleString("de-DE")} U/min`} />}
          {m.helligkeit !== undefined && !m.kaputt && <Zeile name="Helligkeit" wert={`${Math.round(m.helligkeit * 100)} %`} />}
          {ac && bauteil.art !== "trafo" && <div className="text-xs text-muted">Wechselstrom: Effektivwerte. Den Verlauf zeigt das Oszilloskop.</div>}
        </div>
      )}

      {m?.kaputt && (
        <div className="flex flex-col gap-2 rounded-lg border border-bad p-2 text-sm">
          <span className="text-bad font-bold">
            {bauteil.art === "sicherung" ? "Die Sicherung hat ausgelöst." : "Durchgebrannt — zu viel Strom."}
          </span>
          <button className="btn btn-secondary" onClick={() => reparieren(bauteil.id)}>
            {bauteil.art === "sicherung" ? "Neue Sicherung einsetzen" : "Austauschen"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button className="btn btn-secondary flex-1" onClick={() => oszi(bauteil.id)}>📈 Oszilloskop</button>
        <button className="btn btn-secondary flex-1" onClick={drehen}>↻ Drehen</button>
        <button className="btn btn-danger flex-1" onClick={loeschen}>🗑 Löschen</button>
      </div>
    </div>
  );
}
