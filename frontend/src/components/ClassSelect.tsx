"use client";
import { useQuery } from "@tanstack/react-query";
import { api, ClassOut } from "@/lib/api";

/**
 * Unified class picker for game-like tools (Caputh, Bingo, future games):
 * the selected class is bound to the session so correctness points are
 * credited to it.
 */
export function ClassSelect({ value, onChange, className = "input" }: {
  value: number | "";
  onChange: (classId: number | "") => void;
  className?: string;
}) {
  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    staleTime: 60_000,
  });

  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
    >
      <option value="">Klasse wählen…</option>
      {classes.map((c) => (
        <option key={c.id} value={c.id}>{c.display_name} ({c.code})</option>
      ))}
    </select>
  );
}
