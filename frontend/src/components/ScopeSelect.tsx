"use client";
import { useQuery } from "@tanstack/react-query";
import { api, ClassOut, StudentGroupOut } from "@/lib/api";

/**
 * Für wen eine Spielsitzung läuft: eine Klasse oder ein Kurs/WPF.
 *
 * Kurse und Wahlpflichtgruppen sind klassenübergreifend — in einem WPF »NaT«
 * der Jahrgangsstufe 9 sitzen Schüler aus 9a, 9b und 9c. Punkte gehen deshalb
 * nicht an „die Sitzung“, sondern je Klasse einzeln, jede mit ihrer eigenen
 * Trefferquote (siehe api/scoping.py).
 *
 * A/B-Gruppen fehlen bewusst: sie gehören zu genau einer Klasse, und dafür
 * wählt man die Klasse.
 */
export type Scope = { kind: "class"; id: number } | { kind: "group"; id: number } | null;

/** Für die Beitritts-API: genau eines der beiden Felder ist gesetzt. */
export function scopeBody(scope: Scope): { class_id?: number; group_id?: number } {
  if (!scope) return {};
  return scope.kind === "class" ? { class_id: scope.id } : { group_id: scope.id };
}

const OPT_PREFIX = { class: "c", group: "g" } as const;

function groupLabel(g: StudentGroupOut) {
  return g.grade ? `${g.grade} ${g.name}` : g.name;
}

export function ScopeSelect({ value, onChange, className = "input" }: {
  value: Scope;
  onChange: (scope: Scope) => void;
  className?: string;
}) {
  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    staleTime: 60_000,
  });
  const { data: kurse = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "kurs"],
    queryFn: () => api.groups.list({ group_type: "kurs" }),
    staleTime: 60_000,
  });
  const { data: wpf = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "wahlpflicht"],
    queryFn: () => api.groups.list({ group_type: "wahlpflicht" }),
    staleTime: 60_000,
  });

  const selected = value ? `${OPT_PREFIX[value.kind]}${value.id}` : "";

  return (
    <select
      className={className}
      value={selected}
      onChange={(e) => {
        const raw = e.target.value;
        if (!raw) return onChange(null);
        const id = Number(raw.slice(1));
        onChange({ kind: raw[0] === "c" ? "class" : "group", id });
      }}
    >
      <option value="">Klasse / Kurs wählen…</option>
      <optgroup label="Klassen">
        {classes.map((c) => (
          <option key={`c${c.id}`} value={`c${c.id}`}>{c.display_name} ({c.code})</option>
        ))}
      </optgroup>
      {kurse.length > 0 && (
        <optgroup label="Kurse (klassenübergreifend)">
          {kurse.map((g) => (
            <option key={`g${g.id}`} value={`g${g.id}`}>{groupLabel(g)}</option>
          ))}
        </optgroup>
      )}
      {wpf.length > 0 && (
        <optgroup label="WPF (klassenübergreifend)">
          {wpf.map((g) => (
            <option key={`g${g.id}`} value={`g${g.id}`}>{groupLabel(g)}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
