"use client";
import type { ReactNode } from "react";
import type { StudentDiffRow, TeacherDiffRow } from "@/lib/api";

export type Filter = "all" | "new" | "update";

const ACTION_LABEL: Record<string, string> = { new: "NEU", update: "GEÄNDERT", unchanged: "–" };
const ACTION_COLOR: Record<string, string> = {
  new: "bg-green-900/40 text-green-300",
  update: "bg-yellow-900/40 text-yellow-300",
  unchanged: "text-muted",
};
export const FIELD_LABELS: Record<string, string> = { nummer: "Nr.", email: "E-Mail", klasse: "Klasse", role: "Rolle", geschlecht: "Geschl.", geburtsdatum: "Geb." };

function FieldDiff({ field, csvVal, dbVal }: { field: string; csvVal: string; dbVal: string | undefined }) {
  const label = FIELD_LABELS[field] ?? field;
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-page rounded-sm px-1.5 py-0.5 mr-1 mb-1">
      <span className="text-muted">{label}:</span>
      {dbVal ? <><span className="line-through opacity-50">{dbVal}</span><span>→</span></> : null}
      <span className="text-accent">{csvVal || "(leer)"}</span>
    </span>
  );
}

/** Filter, Auswahl und Diff-Tabelle einer CSV-Vorschau — dieselbe für Lehrkräfte und Schüler. */
export function ImportDiffTable({ rows, summary, filter, setFilter, selected, setSelected, toggleRow, newLabel, extra }: {
  rows: (StudentDiffRow | TeacherDiffRow)[];
  summary: ReactNode;
  filter: Filter;
  setFilter: (f: Filter) => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  toggleRow: (key: string) => void;
  newLabel: string;
  extra?: { header: string; cell: (r: StudentDiffRow | TeacherDiffRow) => ReactNode };
}) {
  return (
    <>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <p className="text-xs text-muted">{summary}</p>
        <div className="flex gap-2 flex-wrap">
          {(["all", "new", "update"] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === f ? "bg-accent text-accent-fg border-transparent" : "border-line hover:border-accent"
              }`}>
              {f === "all" ? "Alle" : f === "new" ? "Nur neu" : "Nur geändert"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 text-xs">
        <button onClick={() => setSelected(new Set(rows.map(r => r.key)))} className="underline opacity-70 hover:opacity-100">Alle auswählen</button>
        <button onClick={() => setSelected(new Set())} className="underline opacity-70 hover:opacity-100">Keine</button>
        <span className="opacity-50">{selected.size} ausgewählt</span>
      </div>
      <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-lg border border-line">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="border-b border-line text-muted">
              <th className="w-8 py-2 px-2"></th>
              <th className="text-left py-2 px-2 w-24">Status</th>
              <th className="text-left py-2 px-2">Nachname</th>
              <th className="text-left py-2 px-2">Vorname</th>
              <th className="text-left py-2 px-2">Klasse</th>
              {extra && <th className="text-left py-2 px-2">{extra.header}</th>}
              <th className="text-left py-2 px-2">Änderungen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} onClick={() => toggleRow(row.key)}
                className={`border-b border-line/40 cursor-pointer transition-colors hover:bg-surface-hover ${selected.has(row.key) ? "bg-accent/5" : ""}`}>
                <td className="py-1.5 px-2 text-center">
                  <input type="checkbox" checked={selected.has(row.key)} onChange={() => toggleRow(row.key)} onClick={e => e.stopPropagation()} className="accent-accent" />
                </td>
                <td className="py-1.5 px-2">
                  <span className={`inline-block rounded-sm px-1.5 py-0.5 font-mono font-bold text-[10px] ${ACTION_COLOR[row.action]}`}>{ACTION_LABEL[row.action]}</span>
                </td>
                <td className="py-1.5 px-2 font-medium">{row.csv_data.nachname}</td>
                <td className="py-1.5 px-2">{row.csv_data.vorname}</td>
                <td className="py-1.5 px-2 font-mono">{row.csv_data.klasse || "–"}</td>
                {extra && <td className="py-1.5 px-2">{extra.cell(row)}</td>}
                <td className="py-1.5 px-2">
                  {row.action === "new" ? <span className="opacity-50 italic">{newLabel}</span>
                    : row.changed_fields.length > 0 ? (
                      <div className="flex flex-wrap">
                        {row.changed_fields.map(f => <FieldDiff key={f} field={f} csvVal={row.csv_data[f] ?? ""} dbVal={row.db_data?.[f]} />)}
                      </div>
                    ) : <span className="opacity-30">–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
