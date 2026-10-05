"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, SportfestDiscipline } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SportfestSetupPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (auth !== null && auth.role !== "admin") router.replace("/tools/sportfest");
  }, [auth, router]);

  const { data: disciplines = [] } = useQuery<SportfestDiscipline[]>({
    queryKey: ["sf-disciplines"],
    queryFn: api.sportfest.disciplines.list,
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.sportfest.disciplines.setEnabled(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sf-disciplines"] }),
  });

  if (!auth || auth.role !== "admin") return null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-xl mx-auto w-full">
      <div>
        <Link href="/tools/sportfest" className="text-sm text-(--text-muted) hover:text-(--text) transition-colors">← Sportfest</Link>
        <h1 className="text-2xl font-black tracking-tight mt-1">⚙️ Sportfest Setup</h1>
        <p className="text-(--text-muted) text-sm mt-1">Disziplinen aktivieren / deaktivieren</p>
      </div>
      <div className="rounded-2xl border border-(--border) bg-(--surface) divide-y divide-(--border)">
        {disciplines.map(disc => (
          <label key={disc.id} className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-(--surface-hover)">
            <input
              type="checkbox"
              checked={disc.enabled}
              onChange={e => toggleMut.mutate({ id: disc.id, enabled: e.target.checked })}
              className="w-4 h-4 accent-(--accent)"
            />
            <span className="font-medium text-sm">{disc.name}</span>
            <span className={`ml-auto text-xs ${disc.enabled ? "text-green-400" : "text-(--text-muted)"}`}>
              {disc.enabled ? "Aktiv" : "Inaktiv"}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
