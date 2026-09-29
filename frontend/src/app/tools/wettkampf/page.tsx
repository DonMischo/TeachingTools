"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, WettkampfOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAvailability } from "@/hooks/useAvailability";

const TYPE_LABELS: Record<string, string> = {
  knockout: "K.O.-System",
  round_robin: "Jeder gegen Jeden",
  pairing: "Paarungsturnier",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Entwurf", color: "text-gray-400" },
  active: { label: "Läuft", color: "text-green-400" },
  finished: { label: "Abgeschlossen", color: "text-blue-400" },
};

export default function WettkampfListPage() {
  const router = useRouter();
  const { auth } = useAuth();
  const { can } = useAvailability();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["wettkampf"],
    queryFn: api.wettkampf.list,
  });

  async function handleDelete(w: WettkampfOut) {
    if (!confirm(`"${w.title}" wirklich löschen?`)) return;
    setDeleting(w.id);
    try {
      await api.wettkampf.delete(w.id);
      qc.invalidateQueries({ queryKey: ["wettkampf"] });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <Link href="/tools" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">← Tools</Link>
      <h1 className="text-2xl font-bold mb-2 mt-1">Wettkämpfe</h1>
      {auth && can("wettkampf", "create") && (
        <button
          onClick={() => router.push("/tools/wettkampf/new")}
          className="btn-primary mb-6"
        >
          + Neuer Wettkampf
        </button>
      )}

      {isLoading && <p className="text-[var(--text-muted)]">Wird geladen…</p>}

      {!isLoading && list.length === 0 && (
        <p className="text-[var(--text-muted)]">Noch keine Wettkämpfe vorhanden.</p>
      )}

      <div className="space-y-3">
        {list.map((w) => {
          const st = STATUS_LABELS[w.status] ?? STATUS_LABELS.draft;
          return (
            <div
              key={w.id}
              className="flex items-center gap-4 p-4 border border-[var(--border)] bg-[var(--surface)] rounded-xl hover:border-[var(--accent)] transition-colors cursor-pointer"
              onClick={() => router.push(`/tools/wettkampf/${w.id}`)}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{w.title}</p>
                <p className="text-sm text-[var(--text-muted)]">
                  {TYPE_LABELS[w.type] ?? w.type} · {w.participants.length} Teilnehmer
                </p>
              </div>
              <span className={`text-sm font-medium shrink-0 ${st.color}`}>{st.label}</span>
              {auth && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(w); }}
                  disabled={deleting === w.id}
                  className="text-gray-500 hover:text-red-400 transition-colors shrink-0 text-sm"
                >
                  🗑
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
