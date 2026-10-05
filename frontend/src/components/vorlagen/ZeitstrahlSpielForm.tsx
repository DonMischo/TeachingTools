"use client";
/** Formular für ein eingebettetes Zeitstrahl-Spiel (Caputh-Frage, TaskCrawler-Aufgabe). */
import type { TimelineGameSpec } from "@/components/timeline/types";
import { Feld, Gruppe, ZahlFeld, ZeilenKnoepfe, move, eindeutigeId } from "./felder";

export const LEERES_ZEITSTRAHL_SPIEL: TimelineGameSpec = {
  mode: "sort", scoring: "position", axis: { kind: "year", min: 1900, max: 2000 }, items: [],
};

type Item = TimelineGameSpec["items"][number];

export function ZeitstrahlSpielForm({ spec, onChange }: { spec: TimelineGameSpec; onChange: (s: TimelineGameSpec) => void }) {
  const jahre = spec.axis.kind === "year";
  const spot = spec.mode === "spot";
  const setAxis = (patch: Partial<TimelineGameSpec["axis"]>) => onChange({ ...spec, axis: { ...spec.axis, ...patch } });
  const setItem = (i: number, patch: Partial<Item>) =>
    onChange({ ...spec, items: spec.items.map((it, j) => j === i ? { ...it, ...patch } : it) });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-(--border) p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Spielart">
          <select className="input" value={spec.mode}
            onChange={e => onChange({ ...spec, mode: e.target.value as "sort" | "spot", scoring: e.target.value === "sort" ? spec.scoring ?? "position" : null })}>
            <option value="sort">Einsortieren — Schüler ziehen die Ereignisse an ihren Platz</option>
            <option value="spot">Fehler finden — einige Ereignisse stehen falsch</option>
          </select>
        </Feld>
        <Feld label="Achse">
          <select className="input" value={spec.axis.kind}
            onChange={e => setAxis({ kind: e.target.value as "year" | "number" })}>
            <option value="year">Jahreszahlen</option>
            <option value="number">Zahlenstrahl (z. B. Längen, Temperaturen)</option>
          </select>
        </Feld>
        <Feld label={jahre ? "Von Jahr" : "Von"} hint={jahre ? "v. Chr. als negative Zahl, z. B. -753" : undefined}>
          <ZahlFeld value={spec.axis.min} onChange={v => setAxis({ min: v ?? 0 })} />
        </Feld>
        <Feld label={jahre ? "Bis Jahr" : "Bis"}>
          <ZahlFeld value={spec.axis.max} onChange={v => setAxis({ max: v ?? 0 })} />
        </Feld>
        {!jahre && (
          <Feld label="Einheit (optional)">
            <input className="input" value={spec.axis.unit ?? ""} placeholder="z. B. cm"
              onChange={e => setAxis({ unit: e.target.value || null })} />
          </Feld>
        )}
        {!spot && (
          <Feld label="Bewertung">
            <select className="input" value={spec.scoring ?? "position"}
              onChange={e => onChange({ ...spec, scoring: e.target.value as "position" | "order" })}>
              <option value="position">Genaue Position zählt</option>
              <option value="order">Nur die Reihenfolge zählt</option>
            </select>
          </Feld>
        )}
        {!spot && (spec.scoring ?? "position") === "position" && (
          <Feld label="Toleranz (optional)" hint={jahre ? "Wie viele Jahre daneben noch richtig ist; leer = exakt." : "Wie weit daneben noch richtig ist; leer = exakt."}>
            <ZahlFeld value={spec.tolerance} onChange={v => onChange({ ...spec, tolerance: v })} />
          </Feld>
        )}
      </div>

      <Gruppe label="Ereignisse" hint={spot
        ? "»Steht bei« ist die angezeigte Position. Für falsch platzierte Ereignisse »richtig wäre« ausfüllen — mindestens eines."
        : "Die Schüler sehen nur die Bezeichnung und ziehen sie an die richtige Stelle."}>
        {spec.items.map((it, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-end border-b border-(--border) pb-2">
            <Feld label="Bezeichnung" className="flex-[2_1_12rem]">
              <input className="input text-sm" value={it.label} onChange={e => setItem(i, { label: e.target.value })} />
            </Feld>
            <Feld label={spot ? "Steht bei" : jahre ? "Jahr" : "Wert"} className="w-28">
              <ZahlFeld className="input text-sm" value={it.value} onChange={v => setItem(i, { value: v ?? 0 })} />
            </Feld>
            {spot && (
              <Feld label="Richtig wäre" className="w-28">
                <ZahlFeld className="input text-sm" value={it.actual} onChange={v => setItem(i, { actual: v })} placeholder="stimmt" />
              </Feld>
            )}
            {jahre && (
              <Feld label="Genaues Datum (optional)" className="w-40">
                <input type="date" className="input text-sm" value={it.exact_date ?? ""}
                  onChange={e => setItem(i, { exact_date: e.target.value || null })} />
              </Feld>
            )}
            <Feld label="Info nach dem Lösen (optional)" className="flex-[2_1_12rem]">
              <input className="input text-sm" value={it.info ?? ""} onChange={e => setItem(i, { info: e.target.value || null })} />
            </Feld>
            <ZeilenKnoepfe index={i} count={spec.items.length} what="Ereignis"
              onMove={d => onChange({ ...spec, items: move(spec.items, i, d) })}
              onRemove={() => onChange({ ...spec, items: spec.items.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <button type="button" className="text-xs text-(--accent) hover:underline self-start"
          onClick={() => onChange({
            ...spec,
            items: [...spec.items, { id: eindeutigeId("e", spec.items.map(x => x.id), "e"), label: "", value: spec.axis.min }],
          })}>
          + Ereignis
        </button>
      </Gruppe>
    </div>
  );
}
