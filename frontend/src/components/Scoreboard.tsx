"use client";

import { useState } from "react";
import { ClassOut } from "@/lib/api";

type Props = { classes: ClassOut[] };

const GENDER_RE = /\s*(♂|♀|männlich|weiblich|\bm\b|\bw\b|\bf\b)$/i;
function baseName(name: string) { return name.replace(GENDER_RE, "").trim(); }

type MergedRow = { key: string; total_points: number; parts: ClassOut[] };

function buildMergedRows(classes: ClassOut[]): MergedRow[] {
  const groups = new Map<string, ClassOut[]>();
  for (const cls of classes) {
    const key = baseName(cls.display_name || cls.code);
    (groups.get(key) ?? (groups.set(key, []), groups.get(key)!)).push(cls);
  }
  return Array.from(groups.values())
    .map(parts => ({
      key: baseName(parts[0].display_name || parts[0].code),
      total_points: parts.reduce((s, c) => s + c.total_points, 0),
      parts,
    }))
    .sort((a, b) => b.total_points - a.total_points || a.key.localeCompare(b.key));
}

export function Scoreboard({ classes }: Props) {
  const [merged, setMerged] = useState(false);

  const sorted = [...classes].sort(
    (a, b) => b.total_points - a.total_points || a.code.localeCompare(b.code)
  );
  const mergedRows = buildMergedRows(classes);
  const canMerge = mergedRows.some(r => r.parts.length > 1);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Punktestand</h2>
        {canMerge && (
          <button
            onClick={() => setMerged(m => !m)}
            className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
              merged
                ? "border-indigo-500 bg-indigo-900/30 text-indigo-300"
                : "border-(--border) text-(--text-muted) hover:border-indigo-500 hover:text-indigo-300"
            }`}
          >
            {merged ? "⊕ Klassen zusammengefasst" : "⊕ Klassen zusammenfassen"}
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-(--text-muted) border-b border-(--border)">
            <th className="text-left py-2 w-8">#</th>
            <th className="text-left py-2">Klasse</th>
            <th className="text-right py-2">Punkte</th>
          </tr>
        </thead>
        <tbody>
          {merged
            ? mergedRows.map((row, i) => (
                <tr key={row.key} className="border-b border-(--border) hover:bg-(--surface-hover)">
                  <td className="py-2 text-(--text-muted)">{i + 1}</td>
                  <td className="py-2 font-medium">
                    {row.key}
                    {row.parts.length > 1 && (
                      <span className="ml-2 text-xs text-(--text-muted)">
                        ({row.parts.map(p => p.display_name || p.code).join(" + ")})
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-bold">{row.total_points}</td>
                </tr>
              ))
            : sorted.map((cls, i) => (
                <tr key={cls.id} className="border-b border-(--border) hover:bg-(--surface-hover)">
                  <td className="py-2 text-(--text-muted)">{i + 1}</td>
                  <td className="py-2 font-medium">{cls.display_name || cls.code}</td>
                  <td className="py-2 text-right font-bold">{cls.total_points}</td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
